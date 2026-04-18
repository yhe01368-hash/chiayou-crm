from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional
from uuid import UUID
from datetime import datetime
import httpx

from app.core.supabase_client import get_client
from app.schemas.schemas import (
    RepairCreate, RepairUpdate, RepairResponse, RepairStatusUpdate, RepairStatusEnum
)

router = APIRouter(prefix="/api/repairs", tags=["維修管理"])


def _load_repair(row: dict, sb) -> dict:
    """附加 customer 詳細資料"""
    if row.get("customer_id"):
        customer = sb.select(
            "customers",
            select="*",
            filters={"id": row["customer_id"]},
            single=True,
        )
        row["customer"] = customer
    return row


@router.get("", response_model=List[RepairResponse])
def get_repairs(
    status: Optional[RepairStatusEnum] = Query(None),
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
            "repairs",
            select="*",
            filters=filters if filters else None,
            order="created_at.desc",
            limit=limit,
        )
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=502, detail=f"Supabase 錯誤: {e.response.text}")
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))

    return [_load_repair(r, sb) for r in rows]


@router.get("/{repair_id}", response_model=RepairResponse)
def get_repair(repair_id: UUID):
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
def create_repair(repair: RepairCreate):
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
    # UUID -> str (否則 JSON 序列化失敗)
    for k, v in list(payload.items()):
        if v is not None and not isinstance(v, (str, int, float, bool)):
            payload[k] = str(v)
    # 處理 Decimal -> float (Supabase JSON 不接受 Decimal)
    if payload.get("cost") is not None:
        payload["cost"] = float(payload["cost"])

    try:
        row = sb.insert("repairs", payload)
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=502, detail=f"Supabase 錯誤: {e.response.text}")
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))

    return _load_repair(row, sb)


@router.put("/{repair_id}", response_model=RepairResponse)
def update_repair(repair_id: UUID, repair: RepairUpdate):
    sb = get_client()
    payload = repair.model_dump(exclude_unset=True)
    if not payload:
        return get_repair(repair_id)

    if "cost" in payload and payload["cost"] is not None:
        payload["cost"] = float(payload["cost"])

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
def update_repair_status(repair_id: UUID, status_update: RepairStatusUpdate):
    sb = get_client()
    payload = {"status": status_update.status.value}
    if status_update.status == RepairStatusEnum.completed:
        payload["completed_at"] = datetime.utcnow().isoformat()

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
def delete_repair(repair_id: UUID):
    sb = get_client()
    try:
        sb.delete("repairs", filters={"id": str(repair_id)})
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=502, detail=f"Supabase 錯誤: {e.response.text}")
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))

    return None
