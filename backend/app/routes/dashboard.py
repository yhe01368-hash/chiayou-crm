from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timedelta
from decimal import Decimal

from app.core.database import get_db
from app.models.models import Repair, Inventory, Shipment, RepairStatus, ShipmentStatus
from app.schemas.schemas import DashboardResponse

router = APIRouter(prefix="/dashboard", tags=["儀表板"])

@router.get("", response_model=DashboardResponse)
def get_dashboard(db: Session = Depends(get_db)):
    # Pending repairs count
    pending_repairs = db.query(func.count(Repair.id)).filter(
        Repair.status.in_([RepairStatus.pending, RepairStatus.processing])
    ).scalar()
    
    # Low stock items count
    low_stock = db.query(func.count(Inventory.id)).filter(
        Inventory.quantity <= Inventory.min_stock
    ).scalar()
    
    # Monthly revenue (current month)
    now = datetime.now()
    first_day_of_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    
    monthly_revenue = db.query(func.coalesce(func.sum(Shipment.total_amount), Decimal("0"))).filter(
        Shipment.status == ShipmentStatus.completed,
        Shipment.shipment_date >= first_day_of_month.date()
    ).scalar()
    
    # Recent shipments (last 5)
    recent_shipments = db.query(Shipment).order_by(
        Shipment.created_at.desc()
    ).limit(5).all()
    
    return DashboardResponse(
        pending_repairs=pending_repairs or 0,
        low_stock_items=low_stock or 0,
        monthly_revenue=monthly_revenue or Decimal("0"),
        recent_shipments=recent_shipments
    )
