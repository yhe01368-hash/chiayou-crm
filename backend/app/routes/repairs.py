from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional
from uuid import UUID
from datetime import datetime

from app.core.database import get_db
from app.models.models import Repair, Customer, RepairStatus
from app.schemas.schemas import (
    RepairCreate, RepairUpdate, RepairResponse, RepairStatusUpdate, RepairStatusEnum
)

router = APIRouter(prefix="/repairs", tags=["維修管理"])

@router.get("", response_model=List[RepairResponse])
def get_repairs(
    status: Optional[RepairStatusEnum] = Query(None),
    customer_id: Optional[UUID] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db)
):
    query = db.query(Repair).options(joinedload(Repair.customer))
    if status:
        query = query.filter(Repair.status == status)
    if customer_id:
        query = query.filter(Repair.customer_id == customer_id)
    repairs = query.order_by(Repair.created_at.desc()).offset(skip).limit(limit).all()
    return repairs

@router.get("/{repair_id}", response_model=RepairResponse)
def get_repair(repair_id: UUID, db: Session = Depends(get_db)):
    repair = db.query(Repair).options(joinedload(Repair.customer)).filter(Repair.id == repair_id).first()
    if not repair:
        raise HTTPException(status_code=404, detail="維修單不存在")
    return repair

@router.post("", response_model=RepairResponse, status_code=201)
def create_repair(repair: RepairCreate, db: Session = Depends(get_db)):
    # Verify customer exists
    customer = db.query(Customer).filter(Customer.id == repair.customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="客戶不存在")
    
    db_repair = Repair(**repair.model_dump())
    db.add(db_repair)
    db.commit()
    db.refresh(db_repair)
    return db_repair

@router.put("/{repair_id}", response_model=RepairResponse)
def update_repair(repair_id: UUID, repair: RepairUpdate, db: Session = Depends(get_db)):
    db_repair = db.query(Repair).filter(Repair.id == repair_id).first()
    if not db_repair:
        raise HTTPException(status_code=404, detail="維修單不存在")
    
    update_data = repair.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_repair, key, value)
    
    db.commit()
    db.refresh(db_repair)
    return db_repair

@router.patch("/{repair_id}/status", response_model=RepairResponse)
def update_repair_status(repair_id: UUID, status_update: RepairStatusUpdate, db: Session = Depends(get_db)):
    db_repair = db.query(Repair).filter(Repair.id == repair_id).first()
    if not db_repair:
        raise HTTPException(status_code=404, detail="維修單不存在")
    
    db_repair.status = status_update.status
    if status_update.status == RepairStatusEnum.completed:
        db_repair.completed_at = datetime.utcnow()
    
    db.commit()
    db.refresh(db_repair)
    return db_repair

@router.delete("/{repair_id}", status_code=204)
def delete_repair(repair_id: UUID, db: Session = Depends(get_db)):
    db_repair = db.query(Repair).filter(Repair.id == repair_id).first()
    if not db_repair:
        raise HTTPException(status_code=404, detail="維修單不存在")
    db.delete(db_repair)
    db.commit()
    return None
