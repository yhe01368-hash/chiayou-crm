from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime
from decimal import Decimal
import httpx

from app.core.supabase_client import get_client
from app.schemas.schemas import DashboardResponse
from app.routes.auth import get_current_user

router = APIRouter(prefix="/api/dashboard", tags=["儀表板"])


@router.get("")
def get_dashboard(_current_user: dict = Depends(get_current_user)):
    sb = get_client()

    # 本月區間
    first_day = datetime.now().replace(day=1).date().isoformat()
    date_filters = {"status": "completed", "shipment_date": f"gte.{first_day}"}

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

        # 3. 本月營收 (completed shipments)
        # total_amount 已經記錄為該稅別的金額（未稅單就是未稅金額、含稅單就是含稅金額），直接加總
        # ⚠️ 必須 limit=1000 以上，Supabase PostgREST 預設 limit=1 會嚴重截斷
        completed_rows = sb.select(
            "shipments",
            select="total_amount",
            filters=date_filters,
            limit=1000,
        )
        monthly_revenue = float(sum(
            r.get("total_amount", 0) or 0
            for r in (completed_rows or [])
            if isinstance(r.get("total_amount"), (int, float, Decimal))
        ))

        # 3.5 本月銷貨成本（COGS）= 本月 completed shipments 的 items.quantity × inventory.cost_price
        completed_shipments = sb.select(
            "shipments",
            select="id",
            filters=date_filters,
            limit=1000,
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
                        limit=1000,
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
