# Python 3.10
FROM python:3.10-slim

WORKDIR /app

# 先升級 pip
RUN pip install --upgrade pip

# 安裝依賴
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 複製應用程式
COPY backend/ ./backend/

WORKDIR /app/backend

ENV PYTHONUNBUFFERED=1

CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
