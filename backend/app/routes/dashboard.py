from fastapi import APIRouter, HTTPException, Depends, Query
from datetime import datetime
from decimal import Decimal
import httpx

from app.core.supabase_client import get_client
from app.schemas.schemas import DashboardResponse
from app.routes.auth import get_current_user

router = APIRouter(prefix="/api/dashboard", tags=["儀表板"])


@router.get("")
def get_dashboard(
    month: str = Query(None, description="指定月份 YYYY-MM（debug 用，不給則當月）"),
    _current_user: dict = Depends(get_current_user),
):
    sb = get_client()

    # 計算月份區間（給 month=YYYY-MM 就用該月，否則本月）
    if month:
        try:
            y, m = month.split("-")
            y, m = int(y), int(m)
            first_day = datetime(y, m, 1).date().isoformat()
            if m == 12:
                last_day = datetime(y + 1, 1, 1).date().isoformat()
            else:
                last_day = datetime(y, m + 1, 1).date().isoformat()
        except (ValueError, AttributeError):
            raise HTTPException(status_code=400, detail="month 格式錯誤，要 YYYY-MM")
    else:
        first_day = datetime.now().replace(day=1).date().isoformat()
        last_day = None

    try:
        # 1. 待處理維修數量 (pending + processing)
        pending_repairs = 0
        for s in ("pending", "processing"):
            rows = sb.select("repairs", select="id", filters={"status": s}) or []
            pending_repairs += len(rows)

        # 2. 低庫存商品數量
        low_rows = sb.select(
            "inventory",
            select="id",
        )
        low_stock_items = len([r for r in low_rows if r.get("quantity", 0) <= r.get("min_stock", 0)]) if low_rows else 0

        # 3. 本月營收 (completed shipments，含稅則加計5%)
        date_filters = {"status": "completed", "shipment_date": f"gte.{first_day}"}
        if last_day:
            date_filters["shipment_date"] = [f"gte.{first_day}", f"lt.{last_day}"]
        completed_rows = sb.select(
            "shipments",
            select="total_amount,tax_included",
            filters=date_filters,
        )
        monthly_revenue = float(sum(
            (r.get("total_amount", 0) or 0) * 1.05
            if r.get("tax_included") else (r.get("total_amount", 0) or 0)
            for r in (completed_rows or [])
            if isinstance(r.get("total_amount"), (int, float, Decimal))
        ))

        # 3.5 本月銷貨成本（COGS）= 本月 completed shipments 的 items.quantity × inventory.cost_price
        completed_shipments = sb.select(
            "shipments",
            select="id",
            filters=date_filters,
        ) or []
        monthly_cost = 0.0
        if completed_shipments:
            shipment_ids = [s["id"] for s in completed_shipments if s.get("id")]
            if shipment_ids:
                items = sb.select(
                    "shipment_items",
                    select="product_id,quantity",
                    filters={"shipment_id": shipment_ids},
                ) or []
                # 一次拿所有產品的進價（避免 N+1）
                product_ids = list({i.get("product_id") for i in items if i.get("product_id")})
                cost_map = {}
                if product_ids:
                    inv_rows = sb.select(
                        "inventory",
                        select="id,cost_price",
                        filters={"id": product_ids},
                    ) or []
                    cost_map = {
                        r["id"]: (r.get("cost_price") or 0)
                        for r in inv_rows if r.get("id")
                    }
                monthly_cost = float(sum(
                    (cost_map.get(i.get("product_id"), 0) or 0) * (i.get("quantity", 0) or 0)
                    for i in items
                    if isinstance(i.get("quantity"), (int, float))
                ))
        monthly_profit = monthly_revenue - monthly_cost

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
        monthly_cost=monthly_cost,
        monthly_profit=monthly_profit,
        recent_shipments=result_shipments,
    )
