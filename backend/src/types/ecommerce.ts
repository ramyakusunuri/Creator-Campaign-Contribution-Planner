export type DerivedStatus = 'not_yet_valid' | 'valid' | 'expired';
export type DiscountBasis = 'reported' | 'estimated' | null;
export type OrderStatus = 'completed' | 'partially_refunded' | 'refunded' | 'cancelled';
export type ValidityFlag = 'valid' | 'outside_validity' | 'unregistered';

export interface PromoCodeRegistrationInput {
  code: string;
  creator_id: string;
  valid_from: string;
  valid_to: string;
}

export interface PromoCodeRecord {
  id?: number;
  brand_id: string;
  code: string;
  creator_id: string;
  valid_from: string;
  valid_to: string;
  created_at: string;
}

export interface PromoCodeDetail extends PromoCodeRecord {
  status: DerivedStatus;
}

export interface LineItemInput {
  product_id: string;
  name?: string | null;
  unit_price_inr: number;
  quantity: number;
  line_discount_inr?: number | null;
}

export interface LineItemRecord extends LineItemInput {
  gross_inr: number;
  line_discount_inr: number | null;
  net_inr: number | null;
}

export interface OrderInputPayload {
  order_id: string;
  customer_id: string;
  used_at: string;
  items: LineItemInput[];
  discount_inr?: number | null;
}

export interface OrderRecord {
  id?: number;
  brand_id: string;
  order_id: string;
  promo_code: string | null;
  customer_id: string;
  used_at: string;
  subtotal_inr: number;
  discount_inr: number | null;
  discount_basis: DiscountBasis;
  total_inr: number | null;
  status: OrderStatus;
  validity_flag: ValidityFlag;
  raw_payload?: string;
  items?: LineItemRecord[];
}

export interface RefundEventRecord {
  id?: number;
  brand_id: string;
  refund_id: string;
  order_id: string;
  amount_inr: number;
  is_full_refund: boolean;
  created_at: string;
}

export interface ProductSummary {
  product_id: string;
  name: string | null;
  quantity: number;
  gross_inr: number;
  discount_inr: number | null;
  net_inr: number | null;
  avg_unit_price_inr: number;
  discount_basis: 'reported' | 'estimated' | 'mixed' | null;
}

export interface PromoCodeSummaryMetrics {
  code: string;
  creator_id: string;
  brand_id: string;
  valid_from: string;
  valid_to: string;
  status: DerivedStatus;
  use_count: number;
  unique_customers: number;
  last_used_at: string | null;
  outside_validity_uses: number;
  units: number;
  subtotal_inr: number;
  discount_inr: number | null;
  total_inr: number | null;
  uses_discount_unknown: number;
  discount_inr_known_sum: number;
  implied_discount_pct_derived: number | null;
  // C24 Specific Contribution Model Metrics
  orders: number;
  returns: number;
  retained_orders: number;
  retained_sales_inr: number | null;
  pre_fee_contribution_inr: number | null;
  net_contribution_inr: number | null;
  incremental_contribution_inr: number | null;
  break_even_share: number | null;
  products: ProductSummary[];
}
