import uuid
from datetime import datetime, date
from sqlalchemy import Column, String, Text, Integer, Numeric, DateTime, Date, ForeignKey, Enum as SQLEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.core.database import Base
import enum

class RepairStatus(str, enum.Enum):
    pending = "pending"
    processing = "processing"
    completed = "completed"
    cancelled = "cancelled"

class ShipmentStatus(str, enum.Enum):
    draft = "draft"
    completed = "completed"
    cancelled = "cancelled"

class Customer(Base):
    __tablename__ = "customers"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(100), nullable=False)
    phone = Column(String(20), nullable=False)
    phone2 = Column(String(20), nullable=True)
    address = Column(Text, nullable=True)
    email = Column(String(100), nullable=True)
    note = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    repairs = relationship("Repair", back_populates="customer")
    shipments = relationship("Shipment", back_populates="customer")

class Repair(Base):
    __tablename__ = "repairs"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    customer_id = Column(UUID(as_uuid=True), ForeignKey("customers.id"), nullable=False)
    device_type = Column(String(50), nullable=False)
    device_brand = Column(String(50), nullable=True)
    device_model = Column(String(100), nullable=True)
    serial_number = Column(String(100), nullable=True)
    problem = Column(Text, nullable=False)
    status = Column(SQLEnum(RepairStatus), default=RepairStatus.pending)
    repair_detail = Column(Text, nullable=True)
    cost = Column(Numeric(10, 2), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)
    
    customer = relationship("Customer", back_populates="repairs")

class Inventory(Base):
    __tablename__ = "inventory"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    product_code = Column(String(50), unique=True, nullable=False)
    product_name = Column(String(200), nullable=False)
    category = Column(String(50), nullable=False)
    quantity = Column(Integer, default=0)
    unit = Column(String(10), default="個")
    cost_price = Column(Numeric(10, 2), nullable=True)
    selling_price = Column(Numeric(10, 2), nullable=False)
    supplier = Column(String(100), nullable=True)
    min_stock = Column(Integer, default=5)
    note = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    shipment_items = relationship("ShipmentItem", back_populates="product")

class Shipment(Base):
    __tablename__ = "shipments"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    shipment_number = Column(String(20), unique=True, nullable=False)
    customer_id = Column(UUID(as_uuid=True), ForeignKey("customers.id"), nullable=False)
    shipment_date = Column(Date, default=date.today)
    total_amount = Column(Numeric(12, 2), default=0)
    status = Column(SQLEnum(ShipmentStatus), default=ShipmentStatus.draft)
    note = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    customer = relationship("Customer", back_populates="shipments")
    items = relationship("ShipmentItem", back_populates="shipment", cascade="all, delete-orphan")

class ShipmentItem(Base):
    __tablename__ = "shipment_items"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    shipment_id = Column(UUID(as_uuid=True), ForeignKey("shipments.id"), nullable=False)
    product_id = Column(UUID(as_uuid=True), ForeignKey("inventory.id"), nullable=False)
    product_name = Column(String(200), nullable=False)
    quantity = Column(Integer, nullable=False)
    unit_price = Column(Numeric(10, 2), nullable=False)
    subtotal = Column(Numeric(12, 2), nullable=False)
    
    shipment = relationship("Shipment", back_populates="items")
    product = relationship("Inventory", back_populates="shipment_items")
