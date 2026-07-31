from fastapi import APIRouter, HTTPException, Query, Depends
from typing import List, Optional
from uuid import UUID
from datetime import date
import httpx

from app.core.supabase_client import get_client
from app.schemas.schemas import (
    RepairLogCreate, RepairLogUpdate, RepairLogResponse
)
from app.routes.auth import get_current_user

router = APIRouter(prefix="/api/repair-logs", tags=["維修日誌"])


def _load_log(row: dict) -> dict:
    """目前 repair_logs 沒有關聯子表，僅原樣回傳。"""
    return row


@router.get("", response_model=List[RepairLogResponse])
def list_repair_logs(
    customer_id: Optional[UUID] = Query(None),
    repair_id: Optional[UUID] = Query(None),
    search: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    _current_user: dict = Depends(get_current_user),
):
    """列出維修日誌，預設按 log_date 倒序。"""
    sb = get_client()
    filters = {}
    if customer_id:
        filters["customer_id"] = str(customer_id)
    if repair_id:
        filters["repair_id"] = str(repair_id)
    # 搜尋關鍵字（標題 / 客戶名 / 問題 / 過程 / 備註）
    # PostgREST 用 or=(title.ilike.*X*,customer_name.ilike.*X*,...)
    try:
        rows = sb.select(
            "repair_logs",
            select="*",
            filters=filters if filters else None,
            order="log_date.desc,created_at.desc",
            limit=limit,
            range_start=skip,
            range_end=skip + limit - 1,
        )
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=502, detail=f"Supabase 錯誤: {e.response.text}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"[list] {type(e).__name__}: {str(e)}")

    if not rows:
        return []

    # client-side 模糊搜尋（標題 / 客戶 / 問題 / 過程 / 備註）
    if search:
        q = search.lower()
        rows = [
            r for r in rows
            if q in str(r.get("title", "")).lower()
            or q in str(r.get("customer_name", "")).lower()
            or q in str(r.get("problem", "")).lower()
            or q in str(r.get("process", "")).lower()
            or q in str(r.get("note", "")).lower()
            or q in str(r.get("device_info", "")).lower()
        ]

    return [_load_log(r) for r in rows]


@router.get("/{log_id}", response_model=RepairLogResponse)
def get_repair_log(log_id: UUID, _current_user: dict = Depends(get_current_user)):
    sb = get_client()
    try:
        row = sb.select(
            "repair_logs",
            select="*",
            filters={"id": str(log_id)},
            single=True,
        )
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=502, detail=f"Supabase 錯誤: {e.response.text}")
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))

    if not row:
        raise HTTPException(status_code=404, detail="找不到維修日誌")
    return _load_log(row)


@router.post("", response_model=RepairLogResponse, status_code=201)
def create_repair_log(
    payload: RepairLogCreate,
    current_user: dict = Depends(get_current_user),
):
    sb = get_client()
    data = payload.model_dump(exclude_unset=True)

    # 如果有傳 customer_id 但沒填 customer_name，自動從 customers 帶入
    if data.get("customer_id") and not data.get("customer_name"):
        try:
            cust = sb.select(
                "customers",
                select="name",
                filters={"id": str(data["customer_id"])},
                single=True,
            )
            if cust:
                data["customer_name"] = cust.get("name", "")
        except Exception:
            pass  # 取不到就讓前端自己處理

    # 預設 log_date = 今天
    if not data.get("log_date"):
        data["log_date"] = date.today().isoformat()

    # 自動填入建立者
    if current_user and current_user.get("username"):
        data["created_by"] = current_user["username"]

    # UUID -> str
    for k, v in list(data.items()):
        if v is not None and not isinstance(v, (str, int, float, bool, list)):
            data[k] = str(v)

    try:
        row = sb.insert("repair_logs", data)
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=502, detail=f"Supabase 錯誤: {e.response.text}")
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))

    return _load_log(row)


@router.put("/{log_id}", response_model=RepairLogResponse)
def update_repair_log(
    log_id: UUID,
    payload: RepairLogUpdate,
    _current_user: dict = Depends(get_current_user),
):
    sb = get_client()
    data = payload.model_dump(exclude_unset=True)
    if not data:
        return get_repair_log(log_id)

    # UUID -> str
    for k, v in list(data.items()):
        if v is not None and not isinstance(v, (str, int, float, bool, list)):
            data[k] = str(v)

    try:
        row = sb.update("repair_logs", data, filters={"id": str(log_id)})
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=502, detail=f"Supabase 錯誤: {e.response.text}")
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))

    if not row:
        raise HTTPException(status_code=404, detail="找不到維修日誌")
    return _load_log(row)


@router.delete("/{log_id}", status_code=204)
def delete_repair_log(log_id: UUID, _current_user: dict = Depends(get_current_user)):
    sb = get_client()
    try:
        sb.delete("repair_logs", filters={"id": str(log_id)})
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=502, detail=f"Supabase 錯誤: {e.response.text}")
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))
    return None