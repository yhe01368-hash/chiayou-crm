from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.routes import customers, repairs, inventory, shipments, dashboard, knowledge

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="嘉祐資訊 CRM 系統 API"
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routes
app.include_router(customers.router)
app.include_router(repairs.router)
app.include_router(inventory.router)
app.include_router(shipments.router)
app.include_router(dashboard.router)
app.include_router(knowledge.router)

@app.get("/")
def root():
    return {"message": "嘉祐資訊 CRM API", "version": settings.VERSION}

@app.get("/api/health")
def health_check():
    return {"status": "healthy"}
