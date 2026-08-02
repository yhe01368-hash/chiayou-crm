from fastapi import APIRouter, HTTPException, Depends, Query
from datetime import datetime
import httpx

from app.core.supabase_client import get_client
from app.routes.auth import get_current_user
from app.services.cost import monthly_cost_profit

router = APIRouter(prefix="/api/dashboard/revenue", tags=["營收明細"])


@router.get("/details")
def get_revenue_details(
    start_date: str = Query(default=None, description="起始日期 YYYY-MM-DD"),
    end_date: str = Query(default=None, description="結束日期 YYYY-MM-DD"),
    _current_user: dict = Depends(get_current_user),
):
    sb = get_client()

    try:
        # 1. 拿月份區間內所有 completed 出貨單（含明細）
        filters = {"status": "completed"}

        if start_date and end_date:
            filters["shipment_date"] = [f"gte.{start_date}", f"lte.{end_date}"]
        elif start_date:
            filters["shipment_date"] = f"gte.{start_date}"
        elif end_date:
            filters["shipment_date"] = f"lte.{end_date}"
        else:
            first_day = datetime.now().replace(day=1).date().isoformat()
            filters["shipment_date"] = f"gte.{first_day}"

        rows = sb.select(
            "shipments",
            select="*",
            filters=filters,
            order="shipment_date.desc",
            limit=1000,
        )

        # 2. 整理每筆出貨單，並算該區間的總計
        result = []
        total_revenue = 0.0
        for row in (rows or []):
            sid = row.get("id")
            customer_name = ""
            if row.get("customer_id"):
                cust = sb.select("customers", select="name", filters={"id": row["customer_id"]}, single=True)
                if cust:
                    customer_name = cust.get("name", "")
            raw_amount = row.get("total_amount", 0) or 0
            total_revenue += float(raw_amount)
            result.append({
                "id": sid,
                "shipment_number": row.get("shipment_number", ""),
                "customer_name": customer_name,
                "shipment_date": row.get("shipment_date", ""),
                "total_amount": raw_amount,
                "tax_included": row.get("tax_included", False),
            })

        # 3. 算成本：start_date / end_date 對應的年月 → 用 cost service
        # 若使用者只給單邊日期，預設用年-01 ~ 年-12 整年範圍算
        if start_date and end_date:
            sy, sm, _ = start_date.split("-")
            ey, em, _ = end_date.split("-")
            sy, sm, ey, em = int(sy), int(sm), int(ey), int(em)
            # 跨月就分段算，避免兩年跨界的複雜判斷
            total_cost = 0.0
            y, m = sy, sm
            while (y, m) <= (ey, em):
                r = monthly_cost_profit(sb, y, m)
                total_cost += r["cost"]
                m += 1
                if m > 12:
                    m = 1
                    y += 1
        else:
            # 沒指定或單邊：算本月成本
            now = datetime.now()
            r = monthly_cost_profit(sb, now.year, now.month)
            total_cost = r["cost"]

        total_profit = total_revenue - total_cost

    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=502, detail=f"Supabase 錯誤: {e.response.text}")
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))

    return {
        "items": result,
        "total": total_revenue,
        "cost": total_cost,
        "profit": total_profit,
        "count": len(result),
    }
