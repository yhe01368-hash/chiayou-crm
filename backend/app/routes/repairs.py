from fastapi import APIRouter, HTTPException, Query, Depends
from typing import List, Optional
from uuid import UUID
from datetime import date, datetime
import httpx
import json
import ast

from app.core.supabase_client import get_client
from app.schemas.schemas import (
    RepairCreate, RepairUpdate, RepairResponse, RepairStatusUpdate, RepairStatusEnum
)
from app.routes.auth import get_current_user

router = APIRouter(prefix="/api/repairs", tags=["維修管理"])


def _parse_jsonb(obj):
    """遞迴將 JSONB 字串欄位反序列化（支援JSON和Python repr格式）"""
    if isinstance(obj, dict):
        return {k: _parse_jsonb(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [_parse_jsonb(item) for item in obj]
    elif isinstance(obj, str):
        try:
            return json.loads(obj)
        except (json.JSONDecodeError, TypeError):
            try:
                return ast.literal_eval(obj)
            except (ValueError, SyntaxError):
                return obj
    return obj


def _load_repair(row: dict, sb) -> dict:
    """附加 customer 詳細資料，解析 JSONB 欄位"""
    if row.get("customer_id"):
        customer = sb.select(
            "customers",
            select="*",
            filters={"id": row["customer_id"]},
            single=True,
        )
        row["customer"] = customer
    # 解析所有 JSONB 字串欄位
    row = _parse_jsonb(row)
    return row


@router.get("", response_model=List[RepairResponse])
def get_repairs(
    status: Optional[RepairStatusEnum] = Query(None),
    customer_id: Optional[UUID] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    _current_user: dict = Depends(get_current_user),
):
    sb = get_client()
    filters = {}
    if status:
        filters["status"] = status.value
    if customer_id:
        filters["customer_id"] = str(customer_id)

    try:
        rows = sb.select(
            "repairs",
            select="*",
            filters=filters if filters else None,
            order="created_at.desc",
            limit=limit,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"[select] {type(e).__name__}: {str(e)}")

    if not rows:
        return []

    try:
        rows = [_parse_jsonb(r) for r in rows]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"[_parse_jsonb] {type(e).__name__}: {str(e)}")

    try:
        result = [_load_repair(r, sb) for r in rows]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"[_load_repair] {type(e).__name__}: {str(e)[:200]}")

    return result


@router.get("/{repair_id}", response_model=RepairResponse)
def get_repair(repair_id: UUID, _current_user: dict = Depends(get_current_user)):
    sb = get_client()
    try:
        row = sb.select(
            "repairs",
            select="*",
            filters={"id": str(repair_id)},
            single=True,
        )
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=502, detail=f"Supabase 錯誤: {e.response.text}")
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))

    if not row:
        raise HTTPException(status_code=404, detail="維修單不存在")
    return _load_repair(row, sb)


@router.post("", response_model=RepairResponse, status_code=201)
def create_repair(repair: RepairCreate, _current_user: dict = Depends(get_current_user)):
    sb = get_client()

    # Verify customer exists
    try:
        customer = sb.select(
            "customers",
            select="id",
            filters={"id": str(repair.customer_id)},
            single=True,
        )
    except Exception:
        customer = None

    if not customer:
        raise HTTPException(status_code=404, detail="客戶不存在")

    payload = repair.model_dump()
    # 處理 Decimal -> float (Supabase JSON 不接受 Decimal)
    if payload.get("cost") is not None:
        payload["cost"] = float(payload["cost"])
    # UUID -> str；list 保持原樣（parts_used 等）
    for k, v in list(payload.items()):
        if v is not None and not isinstance(v, (str, int, float, bool, list)):
            payload[k] = str(v)

    try:
        row = sb.insert("repairs", payload)
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=502, detail=f"Supabase 錯誤: {e.response.text}")
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))

    return _load_repair(row, sb)


@router.put("/{repair_id}", response_model=RepairResponse)
def update_repair(repair_id: UUID, repair: RepairUpdate, _current_user: dict = Depends(get_current_user)):
    sb = get_client()
    payload = repair.model_dump(exclude_unset=True)
    if not payload:
        return get_repair(repair_id)

    if "cost" in payload and payload["cost"] is not None:
        payload["cost"] = float(payload["cost"])

    # parts_used 可能是 list → 保持原樣（已是 dict list）
    # UUID -> str (否則 JSON 序列化失敗)
    for k, v in list(payload.items()):
        if v is not None and not isinstance(v, (str, int, float, bool, list)):
            payload[k] = str(v)

    try:
        row = sb.update(
            "repairs",
            payload,
            filters={"id": str(repair_id)},
        )
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=502, detail=f"Supabase 錯誤: {e.response.text}")
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))

    if not row:
        raise HTTPException(status_code=404, detail="維修單不存在")
    return _load_repair(row, sb)


@router.patch("/{repair_id}/status", response_model=RepairResponse)
def update_repair_status(repair_id: UUID, status_update: RepairStatusUpdate, _current_user: dict = Depends(get_current_user)):
    sb = get_client()

    # 拿取舊狀態
    old_repair = sb.select(
        "repairs",
        select="*",
        filters={"id": str(repair_id)},
        single=True,
    )
    if not old_repair:
        raise HTTPException(status_code=404, detail="維修單不存在")

    payload = {"status": status_update.status.value}
    if status_update.status == RepairStatusEnum.completed:
        payload["completed_at"] = datetime.utcnow().isoformat()

        # ── 有使用零件 → 自動建立出貨單草稿 ──────────────────────
        if old_repair.get("parts_used") and len(old_repair["parts_used"]) > 0:
            shipment_number = f"SH{datetime.now().strftime('%Y%m%d%H%M%S')}"
            shipment_payload = {
                "shipment_number": shipment_number,
                "customer_id": old_repair["customer_id"],
                "shipment_date": date.today().isoformat(),
                "status": "draft",
                "note": f"維修單 {repair_id} 完成後自動建立",
            }
            created_shipment = sb.insert("shipments", shipment_payload)
            shipment_id = created_shipment["id"]
            total = 0.0

            for part in old_repair["parts_used"]:
                pid = part.get("product_id")
                qty = part.get("quantity", 1)
                if not pid:
                    continue
                product = sb.select(
                    "inventory",
                    select="*",
                    filters={"id": pid},
                    single=True,
                )
                if not product:
                    continue
                subtotal = qty * float(product["selling_price"])
                total += subtotal
                sb.insert("shipment_items", {
                    "shipment_id": shipment_id,
                    "product_id": pid,
                    "product_name": product["product_name"],
                    "quantity": qty,
                    "unit_price": float(product["selling_price"]),
                    "subtotal": subtotal,
                })

            # 更新出貨單總金額
            sb.update("shipments", {"total_amount": total}, filters={"id": shipment_id})

    try:
        row = sb.update(
            "repairs",
            payload,
            filters={"id": str(repair_id)},
        )
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=502, detail=f"Supabase 錯誤: {e.response.text}")
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))

    if not row:
        raise HTTPException(status_code=404, detail="維修單不存在")
    return _load_repair(row, sb)


@router.delete("/{repair_id}", status_code=204)
def delete_repair(repair_id: UUID, _current_user: dict = Depends(get_current_user)):
    sb = get_client()
    try:
        sb.delete("repairs", filters={"id": str(repair_id)})
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=502, detail=f"Supabase 錯誤: {e.response.text}")
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))

    return None
