# Python 3.10
FROM python:3.10-slim

WORKDIR /app

# 複製 backend 目錄
COPY backend/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ ./backend/

WORKDIR /app/backend

ENV PYTHONUNBUFFERED=1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "$PORT"]
