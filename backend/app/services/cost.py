"""
營收/成本/淨利計算共用邏輯。

CHIayou-CRM 的成本 = shipment_items.quantity × inventory.cost_price
（已售出產品用進價當 COGS）

淨利 = 營收 - 成本

注意：total_amount 已經記錄為該稅別的金額（未稅單就是未稅、含稅單就是含稅），
不再做稅別轉換。營收直接加總、成本直接加總。
"""

from datetime import datetime
from decimal import Decimal


def monthly_cost_profit(sb, year: int, month: int) -> dict:
    """
    算指定年月的營收/成本/淨利。

    Args:
        sb: SupabaseClient instance
        year: 西元年（例如 2026）
        month: 1-12

    Returns:
        {
            "revenue": float,  # 該月所有 completed 出貨單的 total_amount 加總
            "cost": float,     # 該月所有 shipment_items × inventory.cost_price 加總
            "profit": float,   # revenue - cost
            "count": int,      # 出貨單筆數
        }
    """
    first_day = datetime(year, month, 1).date().isoformat()
    if month == 12:
        last_day = datetime(year + 1, 1, 1).date().isoformat()
    else:
        last_day = datetime(year, month + 1, 1).date().isoformat()

    # 1. 拿本月 completed 出貨單
    date_filters = {
        "status": "completed",
        "shipment_date": [f"gte.{first_day}", f"lt.{last_day}"],
    }
    completed = sb.select(
        "shipments",
        select="id,total_amount",
        filters=date_filters,
        limit=1000,
    ) or []

    revenue = float(sum(
        r.get("total_amount", 0) or 0
        for r in completed
        if isinstance(r.get("total_amount"), (int, float, Decimal))
    ))

    # 2. 算 COGS：items × inventory.cost_price
    cost = 0.0
    if completed:
        shipment_ids = [s["id"] for s in completed if s.get("id")]
        if shipment_ids:
            items = sb.select(
                "shipment_items",
                select="product_id,quantity",
                filters={"shipment_id": shipment_ids},
            ) or []
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
            cost = float(sum(
                (cost_map.get(i.get("product_id"), 0) or 0) * (i.get("quantity", 0) or 0)
                for i in items
                if isinstance(i.get("quantity"), (int, float))
            ))

    return {
        "revenue": revenue,
        "cost": cost,
        "profit": revenue - cost,
        "count": len(completed),
    }
