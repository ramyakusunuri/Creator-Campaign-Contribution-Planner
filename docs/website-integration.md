# E-Commerce Website Integration Guide: C24 Promo Service

This guide explains how an e-commerce website integrates with the C24 Promo Tracking Service.

---

## 1. Architecture & Division of Responsibility

| Capability | Owned By | Description |
| :--- | :--- | :--- |
| **Promo Code Registration** | Brand (C24 Dashboard) | Brand registers the code, influencer association, and validity window. |
| **Discount Rule & Calculation**| **Website** | The e-commerce website owns all discount logic (e.g. 10% off, ₹500 off, minimum cart value). C24 does not know or calculate discounts. |
| **Pre-Checkout Advisory Check**| C24 Service | Website asks C24 whether a promo code is registered and valid *right now*. |
| **Paid Order Reporting** | Website Server | When payment succeeds, website reports order items, paid timestamp, and applied discount to C24. |
| **Attribution & Live Dashboard**| C24 Service | Stores order in SQLite database, updates campaign metrics, and streams live SSE updates. |

---

## 2. Authentication: The Reporting Key

Website integration uses **`X-Report-Key`** to communicate with the service:
```http
X-Report-Key: demo-report-key-b1
```
- The website server MUST NOT use `X-Brand-Key` (which is reserved for the brand's dashboard).
- Never place the report key in client-side HTML or JavaScript. All calls should be made backend-to-backend from your e-commerce server.

---

## 3. Step 1: Pre-Checkout Advisory Check

When a customer enters a promo code on your website checkout page, your backend queries C24:

### Request
```http
GET /brands/B1/promo-codes/AARAV10/check HTTP/1.1
Host: api.c24promo.com
X-Report-Key: demo-report-key-b1
```

### Response (200 OK)
```json
{
  "code": "AARAV10",
  "valid": true,
  "reason": "valid"
}
```

### Possible Reasons
- `"valid"`: Code exists and current timestamp is between `valid_from` and `valid_to`.
- `"not_found"`: Code is not registered by this brand.
- `"not_yet_valid"`: Code campaign has not yet started.
- `"expired"`: Code validity window has ended.

> **Security Note:** This endpoint never leaks the influencer identity, discount rule, or other brand campaign data.

---

## 4. Step 2: Applying Discount on Website

If `valid: true`, your website applies its internal discount rule to the cart (e.g., 10% off apparel items).

---

## 5. Step 3: Reporting Paid Orders

Once customer payment is confirmed, your backend immediately reports the redemption:

### Request
```http
POST /brands/B1/promo-codes/AARAV10/redemptions HTTP/1.1
Host: api.c24promo.com
Content-Type: application/json
X-Report-Key: demo-report-key-b1

{
  "order_id": "ORD-2026-9901",
  "customer_id": "CUST-HASH-7821",
  "used_at": "2026-10-18T14:30:00+05:30",
  "payment_confirmed_at": "2026-10-18T14:30:45+05:30",
  "discount_inr": 200.00,
  "items": [
    {
      "product_id": "PRD-JACKET-01",
      "name": "Classic Denim Jacket",
      "unit_price_inr": 2000.00,
      "quantity: 1,
      "line_discount_inr": 200.00
    }
  ]
}
```

### Constraints & Validation
1. **Forbidden PII:** Do NOT include customer names, emails, phone numbers, or shipping addresses. Use pseudonymous `customer_id`.
2. **Payment Confirmation:** `payment_confirmed_at` is strictly required. Orders must be paid.
3. **Currency & Decimals:** INR values must not exceed 2 decimal places.
4. **Unknown Discount:** If the discount was unknown, omit `discount_inr` or pass `null`. Do NOT pass `0` unless the discount was literally zero rupees.
5. **Payload Size:** Maximum request body is 1 MB.

### Response (201 Created)
```json
{
  "success": true,
  "order_id": "ORD-2026-9901",
  "registered": true,
  "validity_flag": "valid"
}
```

### Idempotency
- Safe to retry on network timeouts.
- Submitting an identical payload for `order_id` returns HTTP 200:
  ```json
  {
    "duplicate": true,
    "order_id": "ORD-2026-9901",
    "message": "Order already processed with identical payload"
  }
  ```
- Submitting a modified payload with the same `order_id` returns HTTP 409 Conflict.

---

## 6. Step 4: Periodic Reconciliation

To verify that all reported orders match website sales records:

### Request
```http
GET /brands/B1/reconciliation?from=2026-10-01T00:00:00Z&to=2026-10-31T23:59:59Z HTTP/1.1
Host: api.c24promo.com
X-Report-Key: demo-report-key-b1
```

### Response (200 OK)
```json
{
  "brand_id": "B1",
  "from": "2026-10-01T00:00:00Z",
  "to": "2026-10-31T23:59:59Z",
  "registered_codes": [
    {
      "code": "AARAV10",
      "use_count": 142,
      "units": 210,
      "subtotal_inr": 315000.00,
      "order_ids": ["ORD-101", "ORD-102", ...]
    }
  ],
  "unregistered_uses": [],
  "generated_at": "2026-10-18T15:00:00Z"
}
```
Maximum range limit: 5,000 uses per query.

---

## 7. Standalone Testing Simulator

Run the simulator script to verify integration in demo mode:
```bash
node scripts/fake-website.js
```
The simulator checks `/health` and automatically tests code verification, order reporting, and idempotency duplicates.
