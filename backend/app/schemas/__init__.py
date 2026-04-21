# Re-export all schemas from schemas.py and knowledge.py
from .schemas import (
    CustomerCreate, CustomerUpdate, CustomerResponse,
    RepairCreate, RepairUpdate, RepairResponse, RepairStatusUpdate,
    InventoryCreate, InventoryUpdate, InventoryResponse, StockAdjust,
    ShipmentCreate, ShipmentUpdate, ShipmentResponse, ShipmentItemResponse,
    RepairStatusEnum, ShipmentStatusEnum,
    DashboardResponse,
)
from .knowledge import (
    KnowledgeBaseCreate, KnowledgeBaseUpdate, KnowledgeBaseResponse,
)