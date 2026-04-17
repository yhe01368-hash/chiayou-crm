from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional
from uuid import UUID
import httpx

from app.core.supabase_client import get_client
from app.schemas.schemas import InventoryCreate, InventoryUpdate, InventoryResponse, StockAdjust

router = APIRouter(prefix="/api/inventory", tags=["庫存管理"])


def _enrich(row: dict) -> dict:
    row["is_low_stock"] = row.get("quantity", 0) <= row.get("min_stock", 0)
    return row


@router.get("", response_model=List[InventoryResponse])
def get_inventory(
    category: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    low_stock: bool = Query(False),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
):
    sb = get_client()

    try:
        rows = sb.select(
            "inventory",
            select="*",
            order="product_name.asc",
            limit=limit,
        )
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=502, detail=f"Supabase 錯誤: {e.response.text}")
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))

    # client-side過濾
    if category:
        rows = [r for r in rows if r.get("category") == category]
    if search:
        q = search.lower()
        rows = [r for r in rows
                if q in (r.get("product_name") or "").lower()
                or q in (r.get("product_code") or "").lower()]
    if low_stock:
        rows = [r for r in rows if r.get("quantity", 0) <= r.get("min_stock", 0)]

    return [_enrich(r) for r in rows]


@router.get("/{item_id}", response_model=InventoryResponse)
def get_inventory_item(item_id: UUID):
    sb = get_client()
    try:
        row = sb.select(
            "inventory",
            select="*",
            filters={"id": str(item_id)},
            single=True,
        )
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=502, detail=f"Supabase 錯誤: {e.response.text}")
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))

    if not row:
        raise HTTPException(status_code=404, detail="商品不存在")
    return _enrich(row)


@router.post("", response_model=InventoryResponse, status_code=201)
def create_inventory_item(item: InventoryCreate):
    sb = get_client()
    payload = item.model_dump()

    # 檢查商品編號是否重複
    try:
        existing = sb.select(
            "inventory",
            select="id",
            filters={"product_code": payload["product_code"]},
            single=True,
        )
    except Exception:
        existing = None

    if existing:
        raise HTTPException(status_code=400, detail="商品編號已存在")

    # Decimal -> float
    for float_field in ("cost_price", "selling_price"):
        if payload.get(float_field) is not None:
            payload[float_field] = float(payload[float_field])

    try:
        row = sb.insert("inventory", payload)
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=502, detail=f"Supabase 錯誤: {e.response.text}")
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))

    return _enrich(row)


@router.put("/{item_id}", response_model=InventoryResponse)
def update_inventory_item(item_id: UUID, item: InventoryUpdate):
    sb = get_client()
    payload = item.model_dump(exclude_unset=True)
    if not payload:
        return get_inventory_item(item_id)

    for float_field in ("cost_price", "selling_price"):
        if float_field in payload and payload[float_field] is not None:
            payload[float_field] = float(payload[float_field])

    try:
        row = sb.update(
            "inventory",
            payload,
            filters={"id": str(item_id)},
        )
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=502, detail=f"Supabase 錯誤: {e.response.text}")
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))

    if not row:
        raise HTTPException(status_code=404, detail="商品不存在")
    return _enrich(row)


@router.patch("/{item_id}/stock", response_model=InventoryResponse)
def adjust_stock(item_id: UUID, adjustment: StockAdjust):
    sb = get_client()

    # 先取得目前的 quantity
    try:
        item = sb.select(
            "inventory",
            select="quantity,min_stock",
            filters={"id": str(item_id)},
            single=True,
        )
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=502, detail=f"Supabase 錯誤: {e.response.text}")
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))

    if not item:
        raise HTTPException(status_code=404, detail="商品不存在")

    new_quantity = item["quantity"] + adjustment.quantity
    if new_quantity < 0:
        raise HTTPException(status_code=400, detail="庫存不能為負數")

    try:
        row = sb.update(
            "inventory",
            {"quantity": new_quantity},
            filters={"id": str(item_id)},
        )
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=502, detail=f"Supabase 錯誤: {e.response.text}")
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))

    return _enrich(row)


@router.delete("/{item_id}", status_code=204)
def delete_inventory_item(item_id: UUID):
    sb = get_client()
    try:
        sb.delete("inventory", filters={"id": str(item_id)})
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=502, detail=f"Supabase 錯誤: {e.response.text}")
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))

    return None
