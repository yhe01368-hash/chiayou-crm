from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from uuid import UUID

from app.core.database import get_db
from app.models.models import Inventory
from app.schemas.schemas import (
    InventoryCreate, InventoryUpdate, InventoryResponse, StockAdjust
)

router = APIRouter(prefix="/api/inventory", tags=["庫存管理"])

@router.get("", response_model=List[InventoryResponse])
def get_inventory(
    category: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    low_stock: bool = Query(False),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db)
):
    query = db.query(Inventory)
    if category:
        query = query.filter(Inventory.category == category)
    if search:
        query = query.filter(
            (Inventory.product_name.ilike(f"%{search}%")) |
            (Inventory.product_code.ilike(f"%{search}%"))
        )
    if low_stock:
        query = query.filter(Inventory.quantity <= Inventory.min_stock)
    
    items = query.order_by(Inventory.product_name).offset(skip).limit(limit).all()
    
    # Add is_low_stock field
    result = []
    for item in items:
        item_dict = {
            **{c.name: getattr(item, c.name) for c in item.__table__.columns},
            "is_low_stock": item.quantity <= item.min_stock
        }
        result.append(item_dict)
    
    return result

@router.get("/{item_id}", response_model=InventoryResponse)
def get_inventory_item(item_id: UUID, db: Session = Depends(get_db)):
    item = db.query(Inventory).filter(Inventory.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="商品不存在")
    return {**{c.name: getattr(item, c.name) for c in item.__table__.columns}, "is_low_stock": item.quantity <= item.min_stock}

@router.post("", response_model=InventoryResponse, status_code=201)
def create_inventory_item(item: InventoryCreate, db: Session = Depends(get_db)):
    # Check if product code exists
    existing = db.query(Inventory).filter(Inventory.product_code == item.product_code).first()
    if existing:
        raise HTTPException(status_code=400, detail="商品編號已存在")
    
    db_item = Inventory(**item.model_dump())
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    return {**{c.name: getattr(db_item, c.name) for c in db_item.__table__.columns}, "is_low_stock": db_item.quantity <= db_item.min_stock}

@router.put("/{item_id}", response_model=InventoryResponse)
def update_inventory_item(item_id: UUID, item: InventoryUpdate, db: Session = Depends(get_db)):
    db_item = db.query(Inventory).filter(Inventory.id == item_id).first()
    if not db_item:
        raise HTTPException(status_code=404, detail="商品不存在")
    
    update_data = item.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_item, key, value)
    
    db.commit()
    db.refresh(db_item)
    return {**{c.name: getattr(db_item, c.name) for c in db_item.__table__.columns}, "is_low_stock": db_item.quantity <= db_item.min_stock}

@router.patch("/{item_id}/stock", response_model=InventoryResponse)
def adjust_stock(item_id: UUID, adjustment: StockAdjust, db: Session = Depends(get_db)):
    db_item = db.query(Inventory).filter(Inventory.id == item_id).first()
    if not db_item:
        raise HTTPException(status_code=404, detail="商品不存在")
    
    new_quantity = db_item.quantity + adjustment.quantity
    if new_quantity < 0:
        raise HTTPException(status_code=400, detail="庫存不能為負數")
    
    db_item.quantity = new_quantity
    db.commit()
    db.refresh(db_item)
    return {**{c.name: getattr(db_item, c.name) for c in db_item.__table__.columns}, "is_low_stock": db_item.quantity <= db_item.min_stock}

@router.delete("/{item_id}", status_code=204)
def delete_inventory_item(item_id: UUID, db: Session = Depends(get_db)):
    db_item = db.query(Inventory).filter(Inventory.id == item_id).first()
    if not db_item:
        raise HTTPException(status_code=404, detail="商品不存在")
    db.delete(db_item)
    db.commit()
    return None
