from fastapi import APIRouter, HTTPException, Depends, Query
from datetime import datetime
import httpx

from app.core.supabase_client import get_client
from app.routes.auth import get_current_user

router = APIRouter(prefix="/api/dashboard/revenue", tags=["營收明細"])


@router.get("/details")
def get_revenue_details(
    start_date: str = Query(default=None, description="起始日期 YYYY-MM-DD"),
    end_date: str = Query(default=None, description="結束日期 YYYY-MM-DD"),
    _current_user: dict = Depends(get_current_user),
):
    sb = get_client()

    try:
        # 組過濾條件：list 格式讓 httpx 產生多個同名 query param
        filters = {"status": "completed"}

        if start_date and end_date:
            # 兩者都有 → list 產生 shipment_date=gte.XXX & shipment_date=lte.XXX
            filters["shipment_date"] = [f"gte.{start_date}", f"lte.{end_date}"]
            rows = sb.select(
                "shipments",
                select="*",
                filters=filters,
                order="shipment_date.desc",
            )
        elif start_date:
            # 只有起始日
            filters["shipment_date"] = f"gte.{start_date}"
            rows = sb.select(
                "shipments",
                select="*",
                filters=filters,
                order="shipment_date.desc",
            )
        elif end_date:
            # 只有結束日
            filters["shipment_date"] = f"lte.{end_date}"
            rows = sb.select(
                "shipments",
                select="*",
                filters=filters,
                order="shipment_date.desc",
            )
        else:
            # 預設本月
            first_day = datetime.now().replace(day=1).date().isoformat()
            filters["shipment_date"] = f"gte.{first_day}"
            rows = sb.select(
                "shipments",
                select="*",
                filters=filters,
                order="shipment_date.desc",
            )

        result = []
        for row in (rows or []):
            sid = row.get("id")
            customer_name = ""
            if row.get("customer_id"):
                cust = sb.select("customers", select="name", filters={"id": row["customer_id"]}, single=True)
                if cust:
                    customer_name = cust.get("name", "")
            result.append({
                "id": sid,
                "shipment_number": row.get("shipment_number", ""),
                "customer_name": customer_name,
                "shipment_date": row.get("shipment_date", ""),
                "total_amount": row.get("total_amount", 0),
            })

        total = sum(r["total_amount"] or 0 for r in result)

    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=502, detail=f"Supabase 錯誤: {e.response.text}")
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))

    return {
        "items": result,
        "total": total,
        "count": len(result),
    }
