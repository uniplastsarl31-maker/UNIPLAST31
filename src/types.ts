export interface ProductImage {
  url: string;
  original_url?: string;
  scale: number;
  x: number;
  y: number;
}
export interface Family {
  slides?: Hero[];
  slider_height?: number;
  id: string;
  name: string;
  name_fr: string;
  image: string;
  sort_order: number;
  visible: boolean;
}
export interface Product {
  public_discount_percent?: number;
  price_hidden?: boolean;
  id: string;
  name: string;
  name_fr: string;
  code: string;
  barcode: string | null;
  family_id: string;
  description: string;
  dimensions: string;
  capacity: string;
  material: string;
  pack_size: number;
  pack_label: string;
  unit_price_cents: number;
  available: boolean;
  stock_cartons: number | null;
  is_new: boolean;
  upcoming: boolean;
  preorder_enabled: boolean;
  discount_price_cents: number | null;
  discount_start: string | null;
  discount_end: string | null;
  offer_title: string;
  show_offer: boolean;
  pinned: boolean;
  sort_order: number;
  images: ProductImage[];
  created_at: string;
  demo?: boolean;
  price_on_request: boolean;
  availability_confirmed: boolean;
  source_metadata?: {
    row: number;
    original_barcode: string;
    weight: string;
    notes: string[];
  };
}
export interface Hero {
  scale?: number;
  fit?: "contain" | "cover";
  x?: number;
  y?: number;
  id: string;
  eyebrow: string;
  title: string;
  body: string;
  image: string;
  cta: string;
  family_id: string;
  visible: boolean;
}
export interface Settings {
  home_slider_height: number;
  slider_interval: number;
  about_title: string;
  about_body: string;
  about_image: string;
  price_visibility: "public" | "approved";
  secondary_phone: string;
  whatsapp_phone: string;
  website_url: string;
  facebook_url: string;
  catalog_pdf_url: string;
  catalog_pdf_title: string;
  seasons: Season[];
  recommendation_mode: "balanced" | "sales";
  id: boolean;
  company_name: string;
  company_name_fr: string;
  logo_url: string;
  phone: string;
  email: string;
  address: string;
  currency: string;
  timezone: string;
  shipping_cents: number;
  tax_note: string;
  pack_label: string;
  accent_color: string;
  primary_color: string;
  heroes: Hero[];
  privacy: string;
  terms: string;
}
export interface Season {
  id: string;
  title: string;
  description: string;
  starts_on: string;
  ends_on: string;
  visible: boolean;
  product_ids: string[];
  family_ids: string[];
}
export interface CustomerAccess {
  user_id: string;
  name: string;
  phone: string;
  email?: string;
  status: "pending" | "approved" | "revoked";
  created_at: string;
}
export interface CartItem {
  product_id: string;
  cartons: number;
}
export interface Customer {
  name: string;
  phone: string;
  wilaya: string;
  address: string;
  notes: string;
}
export type OrderStatus =
  | "new"
  | "confirmed"
  | "preparing"
  | "delivered"
  | "cancelled";
export interface OrderLine {
  product_id: string;
  name: string;
  code: string;
  barcode: string | null;
  pack_label: string;
  unit_price_cents: number;
  original_unit_price_cents: number;
  pack_size: number;
  cartons: number;
  total_units: number;
  carton_price_cents: number;
  discount_cents: number;
  total_cents: number;
}
export interface Order {
  id: string;
  reference: string;
  user_id: string;
  created_at: string;
  status: OrderStatus;
  customer: Customer;
  items: OrderLine[];
  subtotal_cents: number;
  discount_cents: number;
  shipping_cents: number;
  total_cents: number;
  currency: string;
  company_snapshot: Pick<
    Settings,
    | "company_name"
    | "logo_url"
    | "phone"
    | "email"
    | "address"
    | "tax_note"
    | "timezone"
  >;
  idempotency_key: string;
  preview?: boolean;
}
export interface RequestRecord {
  id: string;
  user_id: string;
  kind: "preorder" | "custom";
  created_at: string;
  reference: string;
  status: "pending" | "reviewing" | "accepted" | "declined";
  product_id: string | null;
  customer: Customer & { email?: string };
  cartons: number;
  details: {
    description: string;
    dimensions: string;
    capacity: string;
    color: string;
    material: string;
    quantity: string;
    attachments: string[];
  };
}
export interface Catalog {
  products: Product[];
  families: Family[];
  settings: Settings;
  sales: Record<string, number>;
}
