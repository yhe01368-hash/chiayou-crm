# 嘉祐資訊 CRM 系統規格書

## 1. 專案概述

- **專案名稱**：嘉祐資訊 CRM（chiayou-crm）
- **用途**：電腦硬體銷售與維修之客戶管理系統
- **功能**：客戶管理、維修紀錄、庫存管理、出貨單管理
- **技術**：React (前端) + FastAPI (後端) + PostgreSQL (資料庫)
- **支援**：響應式網頁 + PWA（手機/電腦皆可用）

---

## 2. 資料模型

### 2.1 客戶 (Customer)
| 欄位 | 型別 | 說明 |
|------|------|------|
| id | UUID | 主鍵 |
| name | VARCHAR(100) | 姓名 |
| phone | VARCHAR(20) | 電話 |
| phone2 | VARCHAR(20) | 行動電話（選填）|
| address | TEXT | 地址 |
| email | VARCHAR(100) | Email（選填）|
| note | TEXT | 備註（選填）|
| created_at | TIMESTAMP | 建立時間 |
| updated_at | TIMESTAMP | 更新時間 |

### 2.2 維修紀錄 (Repair)
| 欄位 | 型別 | 說明 |
|------|------|------|
| id | UUID | 主鍵 |
| customer_id | UUID | 客戶ID（外鍵）|
| device_type | VARCHAR(50) | 裝置類型（筆電/桌機/螢幕/印表機/其他）|
| device_brand | VARCHAR(50) | 品牌 |
| device_model | VARCHAR(100) | 型號 |
| serial_number | VARCHAR(100) | 序號（選填）|
| problem | TEXT | 問題描述 |
| status | ENUM | 狀態（pending/processing/completed/cancelled）|
| repair_detail | TEXT | 維修過程（選填）|
| cost | DECIMAL(10,2) | 維修費用（選填）|
| created_at | TIMESTAMP | 建立時間 |
| updated_at | TIMESTAMP | 更新時間 |
| completed_at | TIMESTAMP | 完成時間（選填）|

### 2.3 庫存項目 (Inventory)
| 欄位 | 型別 | 說明 |
|------|------|------|
| id | UUID | 主鍵 |
| product_code | VARCHAR(50) | 商品編號 |
| product_name | VARCHAR(200) | 商品名稱 |
| category | VARCHAR(50) | 類別（CPU/硬碟/記憶體/顯示卡/主機板/電源供應器/機殼/其他）|
| quantity | INTEGER | 庫存數量 |
| unit | VARCHAR(10) | 單位（個/片/條/顆/台）|
| cost_price | DECIMAL(10,2) | 進貨成本 |
| selling_price | DECIMAL(10,2) | 售價 |
| supplier | VARCHAR(100) | 供應商（選填）|
| min_stock | INTEGER | 最低庫存警示 |
| note | TEXT | 備註（選填）|
| created_at | TIMESTAMP | 建立時間 |
| updated_at | TIMESTAMP | 更新時間 |

### 2.4 出貨單 (Shipment)
| 欄位 | 型別 | 說明 |
|------|------|------|
| id | UUID | 主鍵 |
| shipment_number | VARCHAR(20) | 出貨單號 |
| customer_id | UUID | 客戶ID（外鍵）|
| shipment_date | DATE | 出貨日期 |
| total_amount | DECIMAL(10,2) | 總金額 |
| status | ENUM | 狀態（draft/completed/cancelled）|
| note | TEXT | 備註（選填）|
| created_at | TIMESTAMP | 建立時間 |
| updated_at | TIMESTAMP | 更新時間 |

### 2.5 出貨項目 (ShipmentItem)
| 欄位 | 型別 | 說明 |
|------|------|------|
| id | UUID | 主鍵 |
| shipment_id | UUID | 出貨單ID（外鍵）|
| product_id | UUID | 商品ID（外鍵）|
| product_name | VARCHAR(200) | 商品名称（存快照）|
| quantity | INTEGER | 數量 |
| unit_price | DECIMAL(10,2) | 單價 |
| subtotal | DECIMAL(10,2) | 小計 |

---

## 3. 功能模組

### 3.1 客戶管理
- 新增 / 編輯 / 刪除客戶
- 關鍵字搜尋（姓名/電話）
- 檢視客戶詳細資料與歷史維修紀錄

### 3.2 維修管理
- 新增維修單（選擇客戶或新增客戶）
- 狀態追蹤（待處理 → 處理中 → 已完成 / 已取消）
- 填寫維修詳情與費用
- 檢視歷史維修紀錄

### 3.3 庫存管理
- 新增 / 編輯 / 刪除商品
- 庫存數量增減（入庫/出庫）
- 低庫存警示提醒
- 商品類別篩選

### 3.4 出貨單管理
- 新增出貨單（選擇客戶與商品）
- 自動帶入售價與庫存扣帳
- 出貨單列表與詳情檢視
- 列印出貨單功能

### 3.5 儀表板
- 今日待處理維修
- 庫存低於警示的商品
- 本月營收概覽
- 最近出貨記錄

---

## 4. API 設計

### 4.1 客戶 API
- `GET /api/customers` - 取得所有客戶（支援搜尋）
- `GET /api/customers/{id}` - 取得單一客戶
- `POST /api/customers` - 新增客戶
- `PUT /api/customers/{id}` - 更新客戶
- `DELETE /api/customers/{id}` - 刪除客戶

### 4.2 維修 API
- `GET /api/repairs` - 取得所有維修單
- `GET /api/repairs/{id}` - 取得單一維修單
- `POST /api/repairs` - 新增維修單
- `PUT /api/repairs/{id}` - 更新維修單
- `PATCH /api/repairs/{id}/status` - 更新狀態

### 4.3 庫存 API
- `GET /api/inventory` - 取得所有商品
- `GET /api/inventory/{id}` - 取得單一商品
- `POST /api/inventory` - 新增商品
- `PUT /api/inventory/{id}` - 更新商品
- `PATCH /api/inventory/{id}/stock` - 調整庫存
- `DELETE /api/inventory/{id}` - 刪除商品

### 4.4 出貨單 API
- `GET /api/shipments` - 取得所有出貨單
- `GET /api/shipments/{id}` - 取得單一出貨單
- `POST /api/shipments` - 新增出貨單
- `PUT /api/shipments/{id}` - 更新出貨單

### 4.5 儀表板 API
- `GET /api/dashboard` - 取得儀表板資料

---

## 5. 頁面結構

```
/ (登入頁)
├── /dashboard (儀表板)
├── /customers (客戶列表)
│   └── /customers/new (新增客戶)
│   └── /customers/:id (客戶詳情)
│   └── /customers/:id/edit (編輯客戶)
├── /repairs (維修列表)
│   └── /repairs/new (新增維修單)
│   └── /repairs/:id (維修單詳情)
│   └── /repairs/:id/edit (編輯維修單)
├── /inventory (庫存列表)
│   └── /inventory/new (新增商品)
│   └── /inventory/:id/edit (編輯商品)
├── /shipments (出貨單列表)
│   └── /shipments/new (新增出貨單)
│   └── /shipments/:id (出貨單詳情)
│   └── /shipments/:id/print (列印出貨單)
└── /settings (系統設定)
```

---

## 6. 部署架構

- **前端**：Vercel（免費）
- **後端**：Railway 或 Render（免費方案）
- **資料庫**：Supabase（PostgreSQL，免費方案）
- **網址**：chiayou-crm.vercel.app（預定）

---

## 7. 目前階段

**階段一（進行中）**：建立後端 API 與資料庫
- FastAPI 專案結構
- SQLAlchemy 模型
- CRUD API 路由
- Supabase 連接

**階段二**：建立前端 React 專案
- 頁面元件
- API 串接
- 響應式設計

**階段三**：部署與測試
- 部署至 Vercel + Railway
- 整合測試
