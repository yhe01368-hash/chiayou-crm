from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime
from decimal import Decimal
import httpx

from app.core.supabase_client import get_client
from app.routes.auth import get_current_user
from app.schemas.schemas import DashboardResponse

router = APIRouter(prefix="/api/dashboard", tags=["儀表板"])


@router.get("")
def get_dashboard(_current_user: dict = Depends(get_current_user)):
    sb = get_client()

    try:
        # 1. 待處理維修數量 (pending + processing)
        pending_repairs = 0
        for s in ("pending", "processing"):
            rows = sb.select("repairs", select="id", filters={"status": s}) or []
            pending_repairs += len(rows)

        # 2. 低庫存商品數量
        low_rows = sb.select("inventory", select="id")
        low_stock_items = (
            len([r for r in low_rows if r.get("quantity", 0) <= r.get("min_stock", 0)])
            if low_rows else 0
        )

        # 3. 本月營收 (completed shipments)
        # total_amount 已經記錄為該稅別的金額（未稅單就是未稅、含稅單就是含稅），直接加總
        # ⚠️ 必須 limit=1000 以上，Supabase PostgREST 預設 limit=1 會嚴重截斷
        first_day = datetime.now().replace(day=1).date().isoformat()
        completed_rows = sb.select(
            "shipments",
            select="total_amount",
            filters={"status": "completed", "shipment_date": f"gte.{first_day}"},
            limit=1000,
        )
        monthly_revenue = float(sum(
            r.get("total_amount", 0) or 0
            for r in (completed_rows or [])
            if isinstance(r.get("total_amount"), (int, float, Decimal))
        ))

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
                if row.get("customer_id"):
                    cust = sb.select("customers", select="*", filters={"id": row["customer_id"]}, single=True)
                    row["customer"] = cust
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
        monthly_cost=0.0,        # 移除：成本/淨利改到 RevenueDetail 看
        monthly_profit=0.0,      # 移除：成本/淨利改到 RevenueDetail 看
        recent_shipments=result_shipments,
    )
