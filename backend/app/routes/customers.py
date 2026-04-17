from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional
from uuid import UUID
import httpx

from app.core.supabase_client import get_client
from app.schemas.schemas import CustomerCreate, CustomerUpdate, CustomerResponse

router = APIRouter(prefix="/api/customers", tags=["客戶管理"])


@router.get("", response_model=List[CustomerResponse])
def get_customers(
    search: Optional[str] = Query(None, description="搜尋姓名或電話"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
):
    sb = get_client()
    filters = {}

    if search:
        # PostgREST or filter — name.ilike or phone.ilike
        # 用 text search 用 or 串接
        try:
            rows = sb.select(
                "customers",
                select="*",
                order="created_at.desc",
                limit=limit,
            )
        except httpx.HTTPStatusError as e:
            raise HTTPException(status_code=502, detail=f"Supabase 錯誤: {e.response.text}")
        except Exception as e:
            raise HTTPException(status_code=502, detail=str(e))

        # client-side filter（簡單做法，rows 不多時可接受）
        q = search.lower()
        rows = [r for r in rows if q in (r.get("name") or "").lower() or q in (r.get("phone") or "").lower()]
        return rows

    try:
        rows = sb.select(
            "customers",
            select="*",
            order="created_at.desc",
            limit=limit,
        )
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=502, detail=f"Supabase 錯誤: {e.response.text}")
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))

    return rows


@router.get("/{customer_id}", response_model=CustomerResponse)
def get_customer(customer_id: UUID):
    sb = get_client()
    try:
        row = sb.select(
            "customers",
            select="*",
            filters={"id": str(customer_id)},
            single=True,
        )
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=502, detail=f"Supabase 錯誤: {e.response.text}")
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))

    if not row:
        raise HTTPException(status_code=404, detail="客戶不存在")
    return row


@router.post("", response_model=CustomerResponse, status_code=201)
def create_customer(customer: CustomerCreate):
    sb = get_client()
    payload = customer.model_dump()

    try:
        row = sb.insert("customers", payload)
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=502, detail=f"Supabase 錯誤: {e.response.text}")
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))

    return row


@router.put("/{customer_id}", response_model=CustomerResponse)
def update_customer(customer_id: UUID, customer: CustomerUpdate):
    sb = get_client()
    payload = customer.model_dump(exclude_unset=True)
    if not payload:
        # No fields to update, just return the current customer
        return get_customer(customer_id)

    try:
        row = sb.update(
            "customers",
            payload,
            filters={"id": str(customer_id)},
        )
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=502, detail=f"Supabase 錯誤: {e.response.text}")
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))

    if not row:
        raise HTTPException(status_code=404, detail="客戶不存在")
    return row


@router.delete("/{customer_id}", status_code=204)
def delete_customer(customer_id: UUID):
    sb = get_client()
    try:
        sb.delete("customers", filters={"id": str(customer_id)})
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=502, detail=f"Supabase 錯誤: {e.response.text}")
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))

    return None
