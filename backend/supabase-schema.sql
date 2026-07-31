-- ===============================================
-- 嘉祐資訊 CRM - Supabase 資料庫設定
-- 執行一次就完成所有設定
-- ===============================================

-- 啟用 UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ===============================================
-- 1. 客戶資料表
-- ===============================================
CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    phone2 VARCHAR(20),
    tax_id VARCHAR(20),
    address TEXT,
    email VARCHAR(100),
    contact_person VARCHAR(100),
    fax VARCHAR(20),
    note TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- ===============================================
-- 2. 維修資料表
-- ===============================================
CREATE TABLE IF NOT EXISTS repairs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    device_type VARCHAR(50) NOT NULL,
    device_brand VARCHAR(50),
    device_model VARCHAR(100),
    serial_number VARCHAR(100),
    problem TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    repair_detail TEXT,
    cost DECIMAL(10,2),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP
);

-- ===============================================
-- 3. 庫存資料表
-- ===============================================
CREATE TABLE IF NOT EXISTS inventory (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_code VARCHAR(50) UNIQUE NOT NULL,
    product_name VARCHAR(200) NOT NULL,
    category VARCHAR(50) NOT NULL,
    quantity INTEGER DEFAULT 0,
    unit VARCHAR(10) DEFAULT '個',
    cost_price DECIMAL(10,2),
    selling_price DECIMAL(10,2) NOT NULL,
    supplier VARCHAR(100),
    min_stock INTEGER DEFAULT 5,
    note TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- ===============================================
-- 4. 出貨單資料表
-- ===============================================
CREATE TABLE IF NOT EXISTS shipments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shipment_number VARCHAR(20) UNIQUE NOT NULL,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
    shipment_date DATE DEFAULT CURRENT_DATE,
    total_amount DECIMAL(12,2) DEFAULT 0,
    status VARCHAR(20) DEFAULT 'draft',
    note TEXT,
    tax_included BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- ===============================================
-- 5. 出貨項目資料表
-- ===============================================
CREATE TABLE IF NOT EXISTS shipment_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shipment_id UUID NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES inventory(id) ON DELETE RESTRICT,
    product_name VARCHAR(200) NOT NULL,
    quantity INTEGER NOT NULL,
    unit_price DECIMAL(10,2) NOT NULL,
    subtotal DECIMAL(12,2) NOT NULL
);

-- ===============================================
-- 自動更新 updated_at 函式
-- ===============================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 套用觸發器到各資料表
DROP TRIGGER IF EXISTS customers_updated_at ON customers;
CREATE TRIGGER customers_updated_at BEFORE UPDATE ON customers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS repairs_updated_at ON repairs;
CREATE TRIGGER repairs_updated_at BEFORE UPDATE ON repairs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS inventory_updated_at ON inventory;
CREATE TRIGGER inventory_updated_at BEFORE UPDATE ON inventory
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS shipments_updated_at ON shipments;
CREATE TRIGGER shipments_updated_at BEFORE UPDATE ON shipments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ===============================================
-- 索引（加速搜尋）
-- ===============================================
CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
CREATE INDEX IF NOT EXISTS idx_repairs_customer_id ON repairs(customer_id);
CREATE INDEX IF NOT EXISTS idx_repairs_status ON repairs(status);
CREATE INDEX IF NOT EXISTS idx_inventory_category ON inventory(category);
CREATE INDEX IF NOT EXISTS idx_shipments_customer_id ON shipments(customer_id);
CREATE INDEX IF NOT EXISTS idx_shipments_status ON shipments(status);

-- ===============================================
-- 6. 使用者資料表
-- ===============================================
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    role VARCHAR(20) DEFAULT 'user',  -- 'admin' 或 'user'
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 管理者帳戶（帳號：admin，密碼：admin123）
-- 管理者帳戶（帳號：admin，密碼：admin123，PBKDF2 hash）
INSERT INTO users (username, password_hash, full_name, role) VALUES
('admin', 'AmaPCjrXQMLH/amxFVLAXbjnewyLs6MgU4oLLbtyNGA=$gRjCXowKQstI/E/lg44U4Up9abyucEDuVS9EhVeaWW8=', '系統管理員', 'admin')
ON CONFLICT (username) DO NOTHING;

DROP TRIGGER IF EXISTS users_updated_at ON users;
CREATE TRIGGER users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

-- 完成
SELECT 'CRM 資料庫設定完成！' AS status;

-- ===============================================
-- 出貨單快速建立函式（效能優化）
-- 一次交易完成：建立主表、寫入明細、扣庫存
-- ===============================================
CREATE OR REPLACE FUNCTION create_shipment_with_items(
    p_customer_id UUID,
    p_shipment_date DATE,
    p_note TEXT,
    p_tax_included BOOLEAN,
    p_items JSONB  -- [{"product_id": "uuid", "quantity": int}]
)
RETURNS TABLE(
    shipment_id UUID,
    shipment_number VARCHAR(20),
    customer_id UUID,
    shipment_date DATE,
    total_amount DECIMAL(12,2),
    tax_included BOOLEAN,
    status VARCHAR(20),
    note TEXT,
    created_at TIMESTAMP,
    updated_at TIMESTAMP,
    items JSONB
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_shipment_number VARCHAR(20);
    v_shipment_id UUID;
    v_item JSONB;
    v_product_id UUID;
    v_qty INTEGER;
    v_unit_price DECIMAL(10,2);
    v_subtotal DECIMAL(12,2);
    v_total DECIMAL(12,2) := 0;
    v_items JSONB := '[]'::JSONB;
BEGIN
    -- 產生單號
    v_shipment_number := 'SH' || TO_CHAR(NOW(), 'YYYYMMDDHH24MISS');

    -- 驗證客戶存在
    IF NOT EXISTS (SELECT 1 FROM customers WHERE id = p_customer_id) THEN
        RAISE EXCEPTION '客戶不存在';
    END IF;

    -- 建立出貨單主表
    INSERT INTO shipments (shipment_number, customer_id, shipment_date, note, tax_included, status, total_amount)
    VALUES (v_shipment_number, p_customer_id, COALESCE(p_shipment_date, CURRENT_DATE), p_note, COALESCE(p_tax_included, true), 'draft', 0)
    RETURNING id INTO v_shipment_id;

    -- 處理每個商品
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_product_id := (v_item->>'product_id')::UUID;
        v_qty := (v_item->>'quantity')::INTEGER;

        -- 檢查商品存在與庫存
        IF NOT EXISTS (SELECT 1 FROM inventory WHERE id = v_product_id) THEN
            RAISE EXCEPTION '商品不存在: %', v_product_id;
        END IF;

        IF (SELECT quantity FROM inventory WHERE id = v_product_id) < v_qty THEN
            RAISE EXCEPTION '庫存不足: % (庫存: %)', v_product_id, (SELECT quantity FROM inventory WHERE id = v_product_id);
        END IF;

        -- 扣庫存
        UPDATE inventory SET quantity = quantity - v_qty WHERE id = v_product_id;

        -- 取得單價
        SELECT selling_price INTO v_unit_price FROM inventory WHERE id = v_product_id;
        v_subtotal := v_unit_price * v_qty;
        v_total := v_total + v_subtotal;

        -- 寫入明細
        INSERT INTO shipment_items (shipment_id, product_id, product_name, quantity, unit_price, subtotal)
        SELECT v_shipment_id, id, product_name, v_qty, v_unit_price, v_subtotal FROM inventory WHERE id = v_product_id;

        -- 蒐集 items JSONB
        v_items := v_items || jsonb_build_object(
            'product_id', v_product_id,
            'product_name', (SELECT product_name FROM inventory WHERE id = v_product_id),
            'quantity', v_qty,
            'unit_price', v_unit_price,
            'subtotal', v_subtotal
        );
    END LOOP;

    -- 更新總金額
    UPDATE shipments SET total_amount = v_total WHERE id = v_shipment_id;

    -- 回傳結果
    RETURN QUERY
    SELECT
        s.id, s.shipment_number, s.customer_id, s.shipment_date,
        s.total_amount, s.tax_included, s.status, s.note,
        s.created_at, s.updated_at, v_items
    FROM shipments s
    WHERE s.id = v_shipment_id;
END;
$$;

-- ============================================================
-- 維修知識庫 (knowledge) — 2026-07-20 補
-- 之前 schema.sql 沒建這個 table，導致前端 /knowledge 一直 500
-- ============================================================
CREATE TABLE IF NOT EXISTS knowledge (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    category VARCHAR(50) NOT NULL DEFAULT '其他',
    problem TEXT NOT NULL DEFAULT '',
    solution TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_knowledge_category ON knowledge(category);
CREATE INDEX IF NOT EXISTS idx_knowledge_created_at ON knowledge(created_at DESC);

-- ============================================================
-- 維修日誌 (repair_logs) — 2026-07-31 新增
-- 從維修單帶入問題描述、維修過程、客戶、日期
-- 一張維修單可對應多筆日誌
-- ============================================================
CREATE TABLE IF NOT EXISTS repair_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    repair_id UUID REFERENCES repairs(id) ON DELETE SET NULL,
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    customer_name VARCHAR(100),
    device_info VARCHAR(255),
    log_date DATE DEFAULT CURRENT_DATE,
    title VARCHAR(255),
    problem TEXT,
    process TEXT,
    note TEXT,
    created_by VARCHAR(50),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_repair_logs_repair_id ON repair_logs(repair_id);
CREATE INDEX IF NOT EXISTS idx_repair_logs_customer_id ON repair_logs(customer_id);
CREATE INDEX IF NOT EXISTS idx_repair_logs_log_date ON repair_logs(log_date DESC);

DROP TRIGGER IF EXISTS repair_logs_updated_at ON repair_logs;
CREATE TRIGGER repair_logs_updated_at BEFORE UPDATE ON repair_logs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
