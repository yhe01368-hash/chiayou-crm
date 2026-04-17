// ===== Types =====

export type RepairStatus = 'pending' | 'processing' | 'completed' | 'cancelled';
export type ShipmentStatus = 'draft' | 'completed' | 'cancelled';

export interface Customer {
  id: string;
  name: string;
  phone: string;
  phone2?: string;
  tax_id?: string;
  address?: string;
  email?: string;
  note?: string;
  created_at: string;
  updated_at: string;
}

export interface Repair {
  id: string;
  customer_id: string;
  device_type: string;
  device_brand?: string;
  device_model?: string;
  serial_number?: string;
  problem: string;
  status: RepairStatus;
  repair_detail?: string;
  cost?: number;
  created_at: string;
  updated_at: string;
  completed_at?: string;
  customer?: Customer;
}

export interface InventoryItem {
  id: string;
  product_code: string;
  product_name: string;
  category: string;
  quantity: number;
  unit: string;
  cost_price?: number;
  selling_price: number;
  supplier?: string;
  min_stock: number;
  note?: string;
  created_at: string;
  updated_at: string;
  is_low_stock?: boolean;
}

export interface ShipmentItem {
  id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
}

export interface Shipment {
  id: string;
  shipment_number: string;
  customer_id: string;
  shipment_date: string;
  total_amount: number;
  status: ShipmentStatus;
  note?: string;
  created_at: string;
  updated_at: string;
  items: ShipmentItem[];
  customer?: Customer;
}

export interface DashboardData {
  pending_repairs: number;
  low_stock_items: number;
  monthly_revenue: number;
  recent_shipments: Shipment[];
}

// ===== API Response Types =====

export interface ApiResponse<T> {
  data: T;
  message?: string;
}

// ===== Form Types =====

export interface CustomerFormData {
  name: string;
  phone: string;
  phone2?: string;
  tax_id?: string;
  address?: string;
  email?: string;
  note?: string;
}

export interface RepairFormData {
  customer_id: string;
  device_type: string;
  device_brand?: string;
  device_model?: string;
  serial_number?: string;
  problem: string;
  status: RepairStatus;
  repair_detail?: string;
  cost?: number;
}

export interface InventoryFormData {
  product_code: string;
  product_name: string;
  category: string;
  quantity: number;
  unit: string;
  cost_price?: number;
  selling_price: number;
  supplier?: string;
  min_stock: number;
  note?: string;
}

export interface ShipmentFormData {
  customer_id: string;
  shipment_date?: string;
  items: { product_id: string; quantity: number }[];
  note?: string;
}
