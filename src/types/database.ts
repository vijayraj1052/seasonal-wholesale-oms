export type UserRole = 'customer' | 'admin';

export type OrderStatus =
  | 'PENDING_REVIEW'
  | 'CONFIRMED'
  | 'PAYMENT_PENDING'
  | 'PAID'
  | 'READY_FOR_RELEASE'
  | 'COMPLETED'
  | 'CANCELLED';

export type InventoryTxnType =
  | 'STOCK_ADJUST'
  | 'ALLOCATE'
  | 'RELEASE'
  | 'RELEASE_COMPLETED';

export interface UserProfile {
  user_id: string;
  role: UserRole;
  full_name: string;
  email: string | null;
  mobile_number: string;
  shop_name: string;
  stall_number: string;
  stall_location: string;
  licence_number: string | null;
  is_active: boolean;
}

export interface CustomerProfile {
  user_id: string;
  full_name: string;
  mobile_number: string;
  shop_name: string;
  stall_number: string;
  stall_location: string;
  email: string | null;
  licence_number: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AdminProfile {
  user_id: string;
  email: string | null;
  mobile_number: string | null;
  full_name: string;
  role: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Brand {
  id: string;
  name: string;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
}

export interface Product {
  id: string;
  brand_id: string;
  category_id: string | null;
  name: string;
  variety: string | null;
  serial_number: number | null;
  product_code: string | null;
  description: string | null;
  image_url: string | null;
  ordering_enabled: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type UnitType = 'PIECE' | 'BOX' | 'BUNDLE' | 'CARTON' | 'PACK' | 'OTHER';

export const UNIT_TYPE_LABELS: Record<UnitType, string> = {
  PIECE: 'Piece',
  BOX: 'Box',
  BUNDLE: 'Bundle',
  CARTON: 'Carton',
  PACK: 'Pack',
  OTHER: 'Other',
};

export interface ProductUnit {
  id: string;
  product_id: string;
  unit_type: UnitType;
  unit_label: string;
  quantity_per_unit: number;
  base_price: number;
  discount_percent: number;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface Inventory {
  product_id: string;
  physical_stock: number;
  allocated_stock: number;
  reserved_stock: number;
  available_stock: number;
  net_available_stock: number;
  last_updated: string;
}

export interface CartItem {
  product_id: string;
  product_name: string;
  brand_name: string;
  unit_id: string;
  unit_type: UnitType;
  unit_label: string;
  quantity_per_unit: number;
  base_price: number;
  discount_percent: number;
  requested_quantity: number;
}

export interface InventoryTransaction {
  id: string;
  product_id: string;
  transaction_type: InventoryTxnType;
  quantity_change: number;
  balance_after: { physical: number; allocated: number; available: number };
  reference_type: string | null;
  reference_id: string | null;
  note: string | null;
  created_by: string | null;
  created_at: string;
}

export interface Order {
  id: string;
  order_number: string;
  customer_id: string;
  status: OrderStatus;
  customer_name: string;
  customer_mobile: string;
  customer_shop: string;
  customer_stall_number: string;
  customer_stall_location: string;
  customer_licence: string | null;
  discount_percent: number;
  payment_due_date: string | null;
  payment_marked_at: string | null;
  confirmed_at: string | null;
  cancelled_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  unit_name: string;
  requested_quantity: number;
  confirmed_quantity: number | null;
  unit_price: number;
  product_subtotal: number;
  product_name_snapshot: string;
  brand_name_snapshot: string;
  variety_snapshot: string | null;
  base_price: number | null;
  product_discount_percent: number | null;
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  order_id: string | null;
  is_read: boolean;
  created_at: string;
}

export interface AppSettings {
  id: number;
  payment_deadline_days: number;
  default_discount_percent: number;
  updated_at: string;
  updated_by: string | null;
}

export interface AuditLogEntry {
  id: string;
  entity_type: string;
  entity_id: string | null;
  action: string;
  change_summary: string;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  actor_id: string | null;
  created_at: string;
}

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING_REVIEW: 'Pending Review',
  CONFIRMED: 'Confirmed',
  PAYMENT_PENDING: 'Payment Pending',
  PAID: 'Paid',
  READY_FOR_RELEASE: 'Ready for Release',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};

export const ORDER_STATUS_COLORS: Record<OrderStatus, string> = {
  PENDING_REVIEW: 'bg-amber-100 text-amber-800 border-amber-200',
  CONFIRMED: 'bg-blue-100 text-blue-800 border-blue-200',
  PAYMENT_PENDING: 'bg-orange-100 text-orange-800 border-orange-200',
  PAID: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  READY_FOR_RELEASE: 'bg-cyan-100 text-cyan-800 border-cyan-200',
  COMPLETED: 'bg-green-100 text-green-800 border-green-200',
  CANCELLED: 'bg-red-100 text-red-800 border-red-200',
};
