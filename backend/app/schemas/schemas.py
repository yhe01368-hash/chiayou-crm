from pydantic import BaseModel, field_validator
from typing import Optional, List, Union
from datetime import datetime, date
from uuid import UUID
from decimal import Decimal
from enum import Enum

# ===== Utility Types =====
StrInt = Union[str, int]  # 接受字串或整數（如統編 tax_id）

# ===== Enums =====
class RepairStatusEnum(str, Enum):
    pending = "pending"
    processing = "processing"
    completed = "completed"
    cancelled = "cancelled"

class ShipmentStatusEnum(str, Enum):
    draft = "draft"
    completed = "completed"
    cancelled = "cancelled"

# ===== Customer =====
class CustomerBase(BaseModel):
    name: str
    phone: str
    phone2: Optional[str] = None
    tax_id: Optional[StrInt] = None
    address: Optional[str] = None
    email: Optional[str] = None
    contact_person: Optional[str] = None
    fax: Optional[str] = None
    note: Optional[str] = None

    @field_validator("tax_id", mode="before")
    @classmethod
    def tax_id_int_to_str(cls, v):
        return str(v) if isinstance(v, int) else v

class CustomerCreate(CustomerBase):
    pass

class CustomerUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    phone2: Optional[str] = None
    tax_id: Optional[str] = None
    address: Optional[str] = None
    email: Optional[str] = None
    contact_person: Optional[str] = None
    fax: Optional[str] = None
    note: Optional[str] = None

class CustomerResponse(CustomerBase):
    id: UUID
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

# ===== Repair =====
class RepairBase(BaseModel):
    customer_id: UUID
    device_type: str
    device_brand: Optional[StrInt] = None
    device_model: Optional[StrInt] = None
    serial_number: Optional[StrInt] = None
    problem: str
    status: RepairStatusEnum = RepairStatusEnum.pending
    repair_detail: Optional[StrInt] = None
    cost: Optional[Decimal] = None
    completed_at: Optional[datetime] = None
    parts_used: Optional[List[dict]] = None  # [{product_id, quantity}]

    @field_validator("device_brand", "device_model", "serial_number", "repair_detail", mode="before")
    @classmethod
    def str_int_to_str(cls, v):
        return str(v) if isinstance(v, int) else v

class RepairCreate(RepairBase):
    pass

class RepairUpdate(BaseModel):
    customer_id: Optional[UUID] = None
    device_type: Optional[str] = None
    device_brand: Optional[str] = None
    device_model: Optional[str] = None
    serial_number: Optional[str] = None
    problem: Optional[str] = None
    status: Optional[RepairStatusEnum] = None
    repair_detail: Optional[str] = None
    cost: Optional[Decimal] = None
    completed_at: Optional[datetime] = None
    parts_used: Optional[List[dict]] = None

class RepairResponse(RepairBase):
    id: UUID
    created_at: datetime
    updated_at: datetime
    customer: Optional[CustomerResponse] = None

    class Config:
        from_attributes = True

class RepairStatusUpdate(BaseModel):
    status: RepairStatusEnum

# ===== Inventory =====
class InventoryBase(BaseModel):
    product_code: str
    product_name: str
    category: str
    quantity: int = 0
    unit: str = "個"
    cost_price: Optional[Decimal] = None
    selling_price: Decimal
    supplier: Optional[str] = None
    min_stock: int = 5
    note: Optional[str] = None

class InventoryCreate(InventoryBase):
    pass

class InventoryUpdate(BaseModel):
    product_code: Optional[str] = None
    product_name: Optional[str] = None
    category: Optional[str] = None
    quantity: Optional[int] = None
    unit: Optional[str] = None
    cost_price: Optional[Decimal] = None
    selling_price: Optional[Decimal] = None
    supplier: Optional[str] = None
    min_stock: Optional[int] = None
    note: Optional[str] = None

class InventoryResponse(InventoryBase):
    id: UUID
    created_at: datetime
    updated_at: datetime
    is_low_stock: bool = False

    class Config:
        from_attributes = True

class StockAdjust(BaseModel):
    quantity: int  # positive for add, negative for reduce

# ===== Shipment =====
class ShipmentItemBase(BaseModel):
    product_id: UUID
    quantity: int

class ShipmentItemCreate(ShipmentItemBase):
    pass

class ShipmentItemResponse(BaseModel):
    id: UUID
    product_id: UUID
    product_name: str
    quantity: int
    unit_price: Decimal
    subtotal: Decimal

    class Config:
        from_attributes = True

class ShipmentBase(BaseModel):
    customer_id: UUID
    shipment_date: Optional[date] = None
    tax_included: Optional[bool] = True
    status: ShipmentStatusEnum = ShipmentStatusEnum.draft
    note: Optional[str] = None

class ShipmentCreate(BaseModel):
    customer_id: UUID
    shipment_date: Optional[date] = None
    items: List[ShipmentItemCreate]
    tax_included: Optional[bool] = True
    note: Optional[str] = None

class ShipmentUpdate(BaseModel):
    shipment_date: Optional[date] = None
    status: Optional[ShipmentStatusEnum] = None
    note: Optional[str] = None
    items: Optional[List[ShipmentItemCreate]] = None
    tax_included: Optional[bool] = None

class ShipmentResponse(ShipmentBase):
    id: UUID
    shipment_number: str
    total_amount: Decimal
    created_at: datetime
    updated_at: datetime
    items: List[ShipmentItemResponse] = []
    customer: Optional[CustomerResponse] = None

    class Config:
        from_attributes = True

# ===== Dashboard =====
class DashboardResponse(BaseModel):
    pending_repairs: int
    low_stock_items: int
    monthly_revenue: Decimal
    recent_shipments: List[ShipmentResponse]
