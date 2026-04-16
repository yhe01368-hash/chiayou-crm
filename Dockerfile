# Python 3.10
FROM python:3.10-slim

WORKDIR /app

# 安裝依賴
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 複製應用程式到 /app
COPY backend/ ./ 

ENV PYTHONUNBUFFERED=1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "$PORT"]
