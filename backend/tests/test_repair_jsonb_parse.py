"""回歸測試：維修單的電話為純數字時不能被 JSONB 解析器轉成 int。

真實案例（2026-11-17）：
  客戶「上饶市美钜光学模具有限公司」電話 13361730638（大陸手機號，無前導 0）
  → GET /api/repairs/{id} 回 500，前端編輯頁面打不開。

根因：舊版 _parse_jsonb 對「整筆 row」遞迴呼叫 ast.literal_eval，
      純數字字串被轉成 int，Pydantic 驗證 CustomerResponse.phone: str 失敗。

修法：只解析真正的 JSONB 欄位（parts_used），其他欄位原樣保留。
      另外 schema 加一層防護，phone/phone2/fax 接受 int 自動轉 str。
"""
from app.routes import repairs
from app.schemas.schemas import CustomerResponse, RepairResponse


class FakeClient:
    """最小 fake：只提供 repairs 單筆 + customers 單筆。"""

    def __init__(self, repair_row, customer_row):
        self.repair_row = repair_row
        self.customer_row = customer_row

    def select(self, table, **kwargs):
        if table == "repairs":
            return dict(self.repair_row)
        if table == "customers":
            return dict(self.customer_row)
        return None


def _base_repair(customer_id):
    return {
        "id": "f8ee2761-c745-4d7b-a78d-1927ea8d6a1e",
        "customer_id": customer_id,
        "device_type": "桌機",
        "device_brand": "桌上型電腦",
        "device_model": "進銷存軟體",
        "serial_number": "",
        "problem": "<p></p>",
        "status": "pending",
        "repair_detail": "<p></p>",
        "cost": None,
        "completed_at": None,
        "parts_used": [{"quantity": 1, "product_id": "45350f98-98d1-4d84-8f44-21d3a910daa3"}],
        "created_at": "2026-11-16T17:35:59.743154",
        "updated_at": "2026-11-16T17:35:59.743154",
    }


def _customer(name, phone, customer_id="25088121-b97f-4365-987f-388637204824"):
    return {
        "id": customer_id,
        "name": name,
        "phone": phone,
        "phone2": None,
        "tax_id": None,
        "address": "江西省上饶经济技术开发区兴业大道26号13-2幢4-1、5-1(盛奇光学产业园)",
        "email": None,
        "contact_person": "汪丹丹",
        "fax": None,
        "note": None,
        "created_at": "2026-11-16T17:28:27.014802",
        "updated_at": "2026-11-16T17:28:27.014802",
    }


def test_load_repair_keeps_pure_digit_phone_as_string():
    """大陸手機號 13361730638 必須維持字串，否則 RepairResponse 驗證爆掉。"""
    customer = _customer("上饶市美钜光学模具有限公司", "13361730638")
    row = _base_repair(customer["id"])

    loaded = repairs._load_repair(row, FakeClient(row, customer))

    assert loaded["customer"]["phone"] == "13361730638"
    assert isinstance(loaded["customer"]["phone"], str)


def test_load_repair_response_validates_for_pure_digit_phone():
    """整筆維修單必須能通過 Pydantic 驗證（這就是 500 的根因）。"""
    customer = _customer("上饶市美钜光学模具有限公司", "13361730638")
    row = _base_repair(customer["id"])

    loaded = repairs._load_repair(row, FakeClient(row, customer))

    parsed = RepairResponse(**loaded)  # 修好前會在這裡 raise ValidationError
    assert parsed.customer.phone == "13361730638"


def test_parse_jsonb_fields_does_not_touch_plain_columns():
    """非 JSONB 欄位（電話、統編、HTML、序號）必須原樣保留。"""
    row = {
        "phone": "13361730638",
        "tax_id": "60876563",
        "serial_number": "0422911314",
        "problem": "<p>問題</p>",
        "parts_used": "[{'product_id': 'abc', 'quantity': 2}]",
    }

    parsed = repairs._parse_jsonb_fields(row)

    assert parsed["phone"] == "13361730638"
    assert parsed["tax_id"] == "60876563"
    assert parsed["serial_number"] == "0422911314"
    assert parsed["problem"] == "<p>問題</p>"
    # parts_used 是 JSONB → 仍然要正確反序列化
    assert parsed["parts_used"] == [{"product_id": "abc", "quantity": 2}]


def test_parse_jsonb_fields_handles_json_string_format():
    """JSON 雙引號格式也要能解析。"""
    row = {"parts_used": '[{"product_id": "abc", "quantity": 3}]'}
    parsed = repairs._parse_jsonb_fields(row)
    assert parsed["parts_used"] == [{"product_id": "abc", "quantity": 3}]


def test_schema_accepts_int_phone_as_second_layer_defense():
    """Schema 層防護：即使來源變成 int，也要轉成 str 且保留前導 0 的原字串。"""
    customer = CustomerResponse(
        id="25088121-b97f-4365-987f-388637204824",
        name="上饶市美钜光学模具有限公司",
        phone=13361730638,
        created_at="2026-11-16T17:28:27.014802",
        updated_at="2026-11-16T17:28:27.014802",
    )
    assert customer.phone == "13361730638"
    assert isinstance(customer.phone, str)
