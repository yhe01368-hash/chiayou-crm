from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional
from uuid import UUID
from datetime import date, datetime
from decimal import Decimal
import httpx

from app.core.supabase_client import get_client
from app.schemas.schemas import (
    ShipmentCreate, ShipmentUpdate, ShipmentResponse, ShipmentItemResponse, ShipmentStatusEnum
)

router = APIRouter(prefix="/api/shipments", tags=["出貨單管理"])


def _generate_shipment_number() -> str:
    return f"SH{datetime.now().strftime('%Y%m%d%H%M%S')}"


def _load_shipment(sb, shipment_id: str) -> dict | None:
    shipment = sb.select(
        "shipments",
        select="*",
        filters={"id": shipment_id},
        single=True,
    )
    if not shipment:
        return None

    # load customer
    if shipment.get("customer_id"):
        customer = sb.select(
            "customers",
            select="*",
            filters={"id": shipment["customer_id"]},
            single=True,
        )
        shipment["customer"] = customer

    # load items
    items = sb.select(
        "shipment_items",
        select="*",
        filters={"shipment_id": shipment_id},
    )
    shipment["items"] = items
    return shipment


@router.get("", response_model=List[ShipmentResponse])
def get_shipments(
    status: Optional[ShipmentStatusEnum] = Query(None),
    customer_id: Optional[UUID] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
):
    sb = get_client()
    filters = {}
    if status:
        filters["status"] = status.value
    if customer_id:
        filters["customer_id"] = str(customer_id)

    try:
        rows = sb.select(
            "shipments",
            select="*",
            filters=filters if filters else None,
            order="created_at.desc",
            limit=limit,
        )
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=502, detail=f"Supabase 錯誤: {e.response.text}")
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))

    result = []
    for row in rows:
        row = _load_shipment(sb, row["id"]) if row else row
        if row:
            result.append(row)
    return result


@router.get("/{shipment_id}", response_model=ShipmentResponse)
def get_shipment(shipment_id: UUID):
    sb = get_client()
    try:
        row = _load_shipment(sb, str(shipment_id))
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=502, detail=f"Supabase 錯誤: {e.response.text}")
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))

    if not row:
        raise HTTPException(status_code=404, detail="出貨單不存在")
    return row


@router.post("", response_model=ShipmentResponse, status_code=201)
def create_shipment(shipment: ShipmentCreate):
    sb = get_client()

    # 驗證客戶存在
    try:
        customer = sb.select(
            "customers",
            select="id",
            filters={"id": str(shipment.customer_id)},
            single=True,
        )
    except Exception:
        customer = None
    if not customer:
        raise HTTPException(status_code=404, detail="客戶不存在")

    shipment_id = None
    created_shipment = None

    try:
        # 建立出貨單主表
        shipment_payload = {
            "shipment_number": _generate_shipment_number(),
            "customer_id": str(shipment.customer_id),
            "shipment_date": (shipment.shipment_date or date.today()).isoformat(),
            "status": "draft",
            "note": shipment.note,
        }
        created_shipment = sb.insert("shipments", shipment_payload)
        shipment_id = created_shipment["id"]

        total = Decimal("0")

        # 建立明細並扣庫存
        for item in shipment.items:
            # 取得商品
            try:
                product = sb.select(
                    "inventory",
                    select="*",
                    filters={"id": str(item.product_id)},
                    single=True,
                )
            except Exception:
                product = None

            if not product:
                raise HTTPException(
                    status_code=404,
                    detail=f"商品 ID {item.product_id} 不存在"
                )

            if product["quantity"] < item.quantity:
                raise HTTPException(
                    status_code=400,
                    detail=f"商品「{product['product_name']}」庫存不足，目前庫存：{product['quantity']}"
                )

            # 扣庫存
            new_qty = product["quantity"] - item.quantity
            sb.update(
                "inventory",
                {"quantity": new_qty},
                filters={"id": str(item.product_id)},
            )

            subtotal = Decimal(str(item.quantity)) * Decimal(str(product["selling_price"]))
            total += subtotal

            item_payload = {
                "shipment_id": shipment_id,
                "product_id": str(item.product_id),
                "product_name": product["product_name"],
                "quantity": item.quantity,
                "unit_price": float(product["selling_price"]),
                "subtotal": float(subtotal),
            }
            sb.insert("shipment_items", item_payload)

        # 更新總金額
        sb.update(
            "shipments",
            {"total_amount": float(total)},
            filters={"id": shipment_id},
        )
        created_shipment["total_amount"] = float(total)

    except HTTPException:
        raise
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=502, detail=f"Supabase 錯誤: {e.response.text}")
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))

    # 重新載入完整資料
    return _load_shipment(sb, shipment_id)


@router.put("/{shipment_id}", response_model=ShipmentResponse)
def update_shipment(shipment_id: UUID, shipment: ShipmentUpdate):
    sb = get_client()
    payload = shipment.model_dump(exclude_unset=True)
    
    # 拿出 items（不更新到 shipments 主表）
    items_data = payload.pop("items", None)
    
    # 更新主表欄位
    if payload:
        try:
            sb.update("shipments", payload, filters={"id": str(shipment_id)})
        except httpx.HTTPStatusError as e:
            raise HTTPException(status_code=502, detail=f"Supabase 錯誤: {e.response.text}")
        except Exception as e:
            raise HTTPException(status_code=502, detail=str(e))

    # 如果有 items 要更新
    if items_data is not None:
        # 刪除原本的 items（退庫存）
        old_items = sb.select("shipment_items", select="*", filters={"shipment_id": str(shipment_id)})
        for old_item in old_items:
            product = sb.select("inventory", select="quantity", filters={"id": old_item["product_id"]}, single=True)
            if product:
                sb.update("inventory", {"quantity": product["quantity"] + old_item["quantity"]}, filters={"id": old_item["product_id"]})
        sb.delete("shipment_items", filters={"shipment_id": str(shipment_id)})

        # 新增新 items（扣庫存）
        total = Decimal("0")
        for item in items_data:
            product = sb.select("inventory", select="*", filters={"id": str(item["product_id"])}, single=True)
            if not product:
                raise HTTPException(status_code=404, detail=f"商品 ID {item['product_id']} 不存在")
            if product["quantity"] < item["quantity"]:
                raise HTTPException(status_code=400, detail=f"商品「{product['product_name']}」庫存不足")
            
            new_qty = product["quantity"] - item["quantity"]
            sb.update("inventory", {"quantity": new_qty}, filters={"id": str(item["product_id"])})
            
            subtotal = Decimal(str(item["quantity"])) * Decimal(str(product["selling_price"]))
            total += subtotal
            
            sb.insert("shipment_items", {
                "shipment_id": str(shipment_id),
                "product_id": str(item["product_id"]),
                "product_name": product["product_name"],
                "quantity": item["quantity"],
                "unit_price": float(product["selling_price"]),
                "subtotal": float(subtotal),
            })
        
        # 更新總金額
        sb.update("shipments", {"total_amount": float(total)}, filters={"id": str(shipment_id)})

    return _load_shipment(sb, str(shipment_id))


@router.delete("/{shipment_id}", status_code=204)
def delete_shipment(shipment_id: UUID):
    sb = get_client()

    # 先取得出貨單
    try:
        shipment = sb.select(
            "shipments",
            select="*",
            filters={"id": str(shipment_id)},
            single=True,
        )
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=502, detail=f"Supabase 錯誤: {e.response.text}")
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))

    if not shipment:
        raise HTTPException(status_code=404, detail="出貨單不存在")

    # 若為草稿狀態，退回庫存
    if shipment.get("status") == "draft":
        try:
            items = sb.select(
                "shipment_items",
                select="*",
                filters={"shipment_id": str(shipment_id)},
            )
        except Exception:
            items = []

        for item in items:
            product = sb.select(
                "inventory",
                select="quantity",
                filters={"id": item["product_id"]},
                single=True,
            )
            if product:
                new_qty = product["quantity"] + item["quantity"]
                sb.update(
                    "inventory",
                    {"quantity": new_qty},
                    filters={"id": item["product_id"]},
                )

    try:
        sb.delete("shipment_items", filters={"shipment_id": str(shipment_id)})
        sb.delete("shipments", filters={"id": str(shipment_id)})
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=502, detail=f"Supabase 錯誤: {e.response.text}")
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))

    return None
