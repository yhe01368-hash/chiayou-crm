from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime
import httpx

from app.core.supabase_client import get_client
from app.routes.auth import get_current_user

router = APIRouter(prefix="/api/dashboard/revenue", tags=["營收明細"])


@router.get("/details")
def get_revenue_details(_current_user: dict = Depends(get_current_user)):
    sb = get_client()

    try:
        # 取得本月一號開始的所有已完成出貨單
        first_day = datetime.now().replace(day=1).date().isoformat()
        rows = sb.select(
            "shipments",
            select="*",
            filters={"status": "completed", "shipment_date": f"gte.{first_day}"},
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

        # 計算總計
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
