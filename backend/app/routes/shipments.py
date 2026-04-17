from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional
from uuid import UUID
from datetime import date
from decimal import Decimal

from app.core.database import get_db
from app.models.models import Shipment, ShipmentItem, ShipmentStatus, Inventory, Customer
from app.schemas.schemas import (
    ShipmentCreate, ShipmentUpdate, ShipmentResponse, ShipmentItemResponse, ShipmentStatusEnum
)

router = APIRouter(prefix="/api/shipments", tags=["出貨單管理"])

def generate_shipment_number():
    from datetime import datetime
    return f"SH{datetime.now().strftime('%Y%m%d%H%M%S')}"

@router.get("", response_model=List[ShipmentResponse])
def get_shipments(
    status: Optional[ShipmentStatusEnum] = Query(None),
    customer_id: Optional[UUID] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db)
):
    query = db.query(Shipment).options(joinedload(Shipment.customer), joinedload(Shipment.items))
    if status:
        query = query.filter(Shipment.status == status)
    if customer_id:
        query = query.filter(Shipment.customer_id == customer_id)
    
    shipments = query.order_by(Shipment.created_at.desc()).offset(skip).limit(limit).all()
    return shipments

@router.get("/{shipment_id}", response_model=ShipmentResponse)
def get_shipment(shipment_id: UUID, db: Session = Depends(get_db)):
    shipment = db.query(Shipment).options(
        joinedload(Shipment.customer), 
        joinedload(Shipment.items)
    ).filter(Shipment.id == shipment_id).first()
    if not shipment:
        raise HTTPException(status_code=404, detail="出貨單不存在")
    return shipment

@router.post("", response_model=ShipmentResponse, status_code=201)
def create_shipment(shipment: ShipmentCreate, db: Session = Depends(get_db)):
    # Verify customer exists
    customer = db.query(Customer).filter(Customer.id == shipment.customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="客戶不存在")
    
    # Create shipment
    db_shipment = Shipment(
        shipment_number=generate_shipment_number(),
        customer_id=shipment.customer_id,
        shipment_date=shipment.shipment_date or date.today(),
        note=shipment.note,
        status=ShipmentStatus.draft
    )
    db.add(db_shipment)
    db.flush()
    
    total = Decimal("0")
    
    # Create shipment items and deduct inventory
    for item in shipment.items:
        product = db.query(Inventory).filter(Inventory.id == item.product_id).first()
        if not product:
            db.rollback()
            raise HTTPException(status_code=404, detail=f"商品 ID {item.product_id} 不存在")
        
        if product.quantity < item.quantity:
            db.rollback()
            raise HTTPException(status_code=400, detail=f"商品「{product.product_name}」庫存不足，目前庫存：{product.quantity}")
        
        # Deduct inventory
        product.quantity -= item.quantity
        
        # Create shipment item
        subtotal = Decimal(str(item.quantity)) * product.selling_price
        total += subtotal
        
        db_item = ShipmentItem(
            shipment_id=db_shipment.id,
            product_id=item.product_id,
            product_name=product.product_name,
            quantity=item.quantity,
            unit_price=product.selling_price,
            subtotal=subtotal
        )
        db.add(db_item)
    
    db_shipment.total_amount = total
    
    db.commit()
    db.refresh(db_shipment)
    
    # Reload with relationships
    shipment = db.query(Shipment).options(
        joinedload(Shipment.customer),
        joinedload(Shipment.items)
    ).filter(Shipment.id == db_shipment.id).first()
    
    return shipment

@router.put("/{shipment_id}", response_model=ShipmentResponse)
def update_shipment(shipment_id: UUID, shipment: ShipmentUpdate, db: Session = Depends(get_db)):
    db_shipment = db.query(Shipment).filter(Shipment.id == shipment_id).first()
    if not db_shipment:
        raise HTTPException(status_code=404, detail="出貨單不存在")
    
    update_data = shipment.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_shipment, key, value)
    
    db.commit()
    db.refresh(db_shipment)
    
    shipment = db.query(Shipment).options(
        joinedload(Shipment.customer),
        joinedload(Shipment.items)
    ).filter(Shipment.id == db_shipment.id).first()
    
    return shipment

@router.delete("/{shipment_id}", status_code=204)
def delete_shipment(shipment_id: UUID, db: Session = Depends(get_db)):
    db_shipment = db.query(Shipment).filter(Shipment.id == shipment_id).first()
    if not db_shipment:
        raise HTTPException(status_code=404, detail="出貨單不存在")
    
    # Restore inventory for draft shipments
    if db_shipment.status == ShipmentStatus.draft:
        items = db.query(ShipmentItem).filter(ShipmentItem.shipment_id == shipment_id).all()
        for item in items:
            product = db.query(Inventory).filter(Inventory.id == item.product_id).first()
            if product:
                product.quantity += item.quantity
    
    db.delete(db_shipment)
    db.commit()
    return None
