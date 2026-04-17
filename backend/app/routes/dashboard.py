from fastapi import APIRouter, HTTPException
from datetime import datetime
from decimal import Decimal
import httpx

from app.core.supabase_client import get_client
from app.schemas.schemas import DashboardResponse

router = APIRouter(prefix="/api/dashboard", tags=["儀表板"])


@router.get("", response_model=DashboardResponse)
def get_dashboard():
    sb = get_client()

    try:
        # 1. 待處理維修數量 (pending + processing)
        pending_rows = sb.select(
            "repairs",
            select="id",
            filters={"status": "in.(pending,processing)"},
        )
        pending_repairs = len(pending_rows) if pending_rows else 0

        # 2. 低庫存商品數量
        low_rows = sb.select(
            "inventory",
            select="id",
        )
        low_stock_items = len([r for r in low_rows if r.get("quantity", 0) <= r.get("min_stock", 0)]) if low_rows else 0

        # 3. 本月營收 (completed shipments，日期 >= 本月1號)
        first_day = datetime.now().replace(day=1).date().isoformat()
        completed_rows = sb.select(
            "shipments",
            select="total_amount",
            filters={"status": "eq.completed", "shipment_date": f"gte.{first_day}"},
        )
        monthly_revenue = Decimal("0")
        if completed_rows:
            for r in completed_rows:
                amt = r.get("total_amount") or 0
                if isinstance(amt, (int, float)):
                    monthly_revenue += Decimal(str(amt))

        # 4. 最近五筆出貨單
        recent = sb.select(
            "shipments",
            select="*",
            order="created_at.desc",
            limit=5,
        )

        # 附加 customer + items
        result_shipments = []
        for row in (recent or []):
            sid = row.get("id")
            if sid:
                # customer
                if row.get("customer_id"):
                    cust = sb.select("customers", select="*", filters={"id": row["customer_id"]}, single=True)
                    row["customer"] = cust
                # items
                items = sb.select("shipment_items", select="*", filters={"shipment_id": sid})
                row["items"] = items or []
            result_shipments.append(row)

    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=502, detail=f"Supabase 錯誤: {e.response.text}")
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))

    return DashboardResponse(
        pending_repairs=pending_repairs,
        low_stock_items=low_stock_items,
        monthly_revenue=monthly_revenue,
        recent_shipments=result_shipments,
    )
