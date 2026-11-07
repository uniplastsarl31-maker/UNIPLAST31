export interface ProductImage {
  url: string;
  original_url?: string;
  scale: number;
  x: number;
  y: number;
}
export interface Family {
  aliases?: string[];
  kind?: "standard" | "new";
  introduction?: string;
  slider_enabled?: boolean;
  slider_autoplay?: boolean;
  slider_interval?: number;
  promotions?: Hero[];
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
  weight_grams?: number | null;
  pack_size: number;
  pack_label: string;
  unit_price_cents: number;
  available: boolean;
  stock_cartons: number | null;
  is_new: boolean;
  new_until?: string | null;
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
  composition?: Partial<SlideComposition>;
  layout?: "split" | "poster";
  product_id?: string;
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
export interface SlideComposition {
  photo_mode: "product" | "behind" | "circle" | "rounded";
  frame_visible: boolean;
  frame_size: number;
  frame_width: number;
  frame_color: string;
  background_color: string;
  blend: "normal" | "multiply";
  signature_visible: boolean;
  transition: "fade" | "slide" | "none";
  duration_ms: number;
}
export type StorefrontTheme =
  | "classic"
  | "ramadan-night"
  | "ramadan-ivory"
  | "newyear-snow"
  | "newyear-midnight";
export interface Settings {
  storefront_theme?: StorefrontTheme;
  topbar_tagline?: string;
  youtube_url?: string;
  videos_enabled?: boolean;
  videos_title?: string;
  videos?: SiteVideo[];
  product_display?: ProductDisplay;
  custom_order?: CustomOrderOptions;
  family_options?: FamilyOptions;
  home_slider_height: number;
  slider_interval: number;
  about_title: string;
  about_body: string;
  about_image: string;
  price_visibility: "public" | "approved";
  secondary_phone: string;
  viber_phone?: string;
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
export interface SiteVideo {
  id: string;
  title: string;
  source: "youtube" | "upload";
  url: string;
  poster_url: string;
  visible: boolean;
}
export interface ProductDisplay {
  weight: boolean;
  material: boolean;
  dimensions: boolean;
  capacity: boolean;
  barcode: boolean;
  pack: boolean;
  availability: boolean;
  description: boolean;
  new_badge: boolean;
  related_products: boolean;
  hide_empty: boolean;
}
export interface CustomOrderOptions {
  enabled: boolean;
  terms: string;
  min_units: number;
  minimum_scope: "per_item" | "total";
  require_photo: boolean;
  require_acceptance: boolean;
  max_items: number;
}
export interface FamilyOptions {
  slider: boolean;
  introduction: boolean;
  promotions: boolean;
  quick_navigation: boolean;
  custom_link: boolean;
}
export interface CustomRequestItem {
  name: string;
  quantity_units: number;
  images: string[];
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
    items?: CustomRequestItem[];
    terms_accepted?: boolean;
    conditions_snapshot?: {
      terms: string;
      min_units: number;
      minimum_scope: "per_item" | "total";
    };
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
