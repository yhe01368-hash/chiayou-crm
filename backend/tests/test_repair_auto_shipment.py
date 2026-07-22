from uuid import uuid4

from app.routes import repairs
from app.schemas.schemas import RepairUpdate


class FakeClient:
    def __init__(self, repair_id, customer_id, product_id):
        self.repair_id = str(repair_id)
        self.customer_id = str(customer_id)
        self.product_id = str(product_id)
        self.inserted = []
        self.updated = []
        self.old_repair = {
            "id": self.repair_id,
            "customer_id": self.customer_id,
            "status": "processing",
            "parts_used": [],
        }

    def select(self, table, **kwargs):
        if table == "repairs":
            return dict(self.old_repair)
        if table == "customers":
            return {"id": self.customer_id, "name": "測試客戶", "phone": "04-12345678"}
        if table == "inventory":
            return {
                "id": self.product_id,
                "product_name": "測試零件",
                "selling_price": 500,
            }
        return None

    def insert(self, table, row, **kwargs):
        self.inserted.append((table, dict(row)))
        if table == "shipments":
            return {"id": "shipment-1", **row}
        return {"id": "item-1", **row}

    def update(self, table, row, **kwargs):
        self.updated.append((table, dict(row)))
        if table == "repairs":
            return {
                **self.old_repair,
                **row,
                "created_at": "2026-07-23T00:00:00",
                "updated_at": "2026-07-23T00:00:00",
                "problem": "測試",
                "device_type": "桌機",
                "cost": None,
            }
        return {"id": "shipment-1", **row}


def test_put_complete_uses_parts_submitted_in_same_request(monkeypatch):
    repair_id, customer_id, product_id = uuid4(), uuid4(), uuid4()
    fake = FakeClient(repair_id, customer_id, product_id)
    monkeypatch.setattr(repairs, "get_client", lambda: fake)

    repairs.update_repair(
        repair_id,
        RepairUpdate(
            status="completed",
            parts_used=[{"product_id": str(product_id), "quantity": 2}],
        ),
        {"id": "admin"},
    )

    shipment_rows = [row for table, row in fake.inserted if table == "shipments"]
    item_rows = [row for table, row in fake.inserted if table == "shipment_items"]
    assert len(shipment_rows) == 1
    assert len(item_rows) == 1
    assert item_rows[0]["product_id"] == str(product_id)
    assert item_rows[0]["quantity"] == 2
    assert any(table == "shipments" and row["total_amount"] == 1000 for table, row in fake.updated)
