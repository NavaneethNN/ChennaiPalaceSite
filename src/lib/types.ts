export type MenuItem = {
  version: number;
  id: string;
  category: string;
  name: string;
  description: string;
  price_cents: number;
  printer: "kitchen" | "cashier";
  stock: number | null;
  active: boolean;
  sort_order: number;
};
export type OrderItem = {
  id: string;
  menu_item_id: string;
  name: string;
  price_cents: number;
  quantity: number;
  printer: "kitchen" | "cashier";
};
export type Order = {
  id: string;
  session_id: string;
  status: "pending" | "accepted" | "rejected";
  notes: string;
  created_at: string;
  decided_at: string | null;
  items: OrderItem[];
};
export type TableSession = {
  id: string;
  table_number: number;
  opened_at: string;
  closed_at: string | null;
  orders: Order[];
  total_cents: number;
};
export type RestaurantTable = { number: number; active: boolean };
export type Staff = {
  role: "admin" | "cashier";
  name: string;
  cashier_id: string | null;
};
export type Cashier = {
  id: string;
  name: string;
  pin: string;
  active: boolean;
};
export const money = (cents: number) =>
  new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(
    cents / 100,
  );
