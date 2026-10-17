# ATELIER 24 INDIA — Contemporary Fashion E-Commerce Website & Checkout Simulator

A clean, responsive, fully interactive mock fashion e-commerce store regionalized for **India**, featuring Indian Rupee (`₹`) pricing, lively high-fashion model photography, multi-angle image galleries, UPI / RuPay / NetBanking / COD checkout, GST tax calculations, and a dynamic promo code engine.

---

## 🌟 High-Quality Product Images & Categories

Every product in the catalogue features realistic, high-resolution fashion photography matching its category, style, and color, stored locally in `assets/images/products/` with direct CDN fallback redundancy:

1. **Women's Tailoring & Blazers**: Structured Double-Breasted Wool Blend Blazer (`womens-wool-blazer.jpg`, `womens-wool-blazer-detail.jpg`)
2. **Footwear - Sneakers**: Minimalist Italian Nappa Leather Low-Top Sneakers (`mens-white-sneakers.jpg`, `mens-white-sneakers-angle.jpg`)
3. **Men's Knitwear**: Pure Mongolian Cashmere Mock-Neck Knit Pullover (`mens-cashmere-pullover.jpg`, `mens-cashmere-pullover-detail.jpg`)
4. **Women's Dresses**: Pure Mulberry Silk Bias-Cut Evening Midi Dress (`womens-silk-evening-dress.jpg`, `womens-silk-dress-detail.jpg`)
5. **Bags & Leather**: Architectural Calfskin Structured Shoulder Tote (`womens-leather-tote.jpg`, `womens-leather-tote-detail.jpg`)
6. **Outerwear & Jackets**: Relaxed Weatherproof Trench Coat with Tortoise Buckles (`womens-trench-coat.jpg`, `womens-trench-coat-detail.jpg`)
7. **Men's Trousers**: Pleated Wide-Leg Tailored Tropical Wool Trousers (`mens-wool-trousers.jpg`, `mens-wool-trousers-detail.jpg`)
8. **Footwear - Loafers**: Artisanal Chunky Commando-Sole Leather Loafers (`mens-leather-loafers.jpg`, `mens-leather-loafers-detail.jpg`)
9. **Men's Essentials - Hoodies**: Heavyweight 480 GSM French Terry Relaxed Hoodie (`mens-terry-hoodie.jpg`, `mens-terry-hoodie-detail.jpg`)
10. **Accessories - Eyewear**: Sculpted Hand-Polished Acetate Cat-Eye Sunglasses (`sunglasses-acetate.jpg`, `sunglasses-acetate-detail.jpg`)
11. **Accessories - Knitwear**: Pure Cashmere Ribbed Scarf & Beanie Winter Set (`cashmere-scarf-beanie.jpg`, `cashmere-scarf-detail.jpg`)
12. **Men's Shirts**: Pure French Washed-Linen Cuban Collar Resort Shirt (`mens-linen-resort-shirt.jpg`, `mens-linen-shirt-detail.jpg`)
13. **Women's Ethnic Wear**: Handwoven Chanderi Silk Embroidered Anarkali Set (`womens-chanderi-anarkali.jpg`, `womens-anarkali-detail.jpg`)
14. **Men's Ethnic Wear**: Royal Tussar Silk Mandarin Kurta & Nehru Jacket Set (`mens-silk-kurta-nehru-jacket.jpg`, `mens-kurta-detail.jpg`)
15. **Men's T-Shirts**: Pima Cotton Heavyweight Oversized Crewneck T-Shirt (`mens-black-pima-tshirt.jpg`, `mens-pima-tshirt-detail.jpg`)
16. **Denim & Jeans**: Relaxed Straight-Leg Raw Japanese Selvedge Denim (`selvedge-denim-jeans.jpg`, `selvedge-denim-detail.jpg`)

---

## 🔍 Interactive Product Details & Gallery Switcher

- **Multi-Image Thumbnails**: Opening any product's Quick Preview displays a high-resolution primary photo plus clickable thumbnail previews allowing customers to switch between different angles and close-up fabric details seamlessly.
- **Card Hover Angle Transition**: Hovering over any product card on desktop smoothly dissolves into the secondary angle view.
- **Graceful Error Handling**: All images include `onerror` handlers falling back to `assets/images/fallback.jpg` or high-availability CDN mirrors.

---

## 🇮🇳 Indian Checkout & Region Features

- **Currency & Pricing**: Prices formatted in **Indian Rupees (₹)**: e.g. `₹4,999`, `₹3,899`, `₹1,299`.
- **Free Delivery**: Free across India on orders over **₹1,999** (with animated progress tracker).
- **Payment Gateway Simulation**:
  - **UPI / QR**: Instant payment simulation with Google Pay, PhonePe, and Paytm (`ananya.sharma@okhdfcbank`).
  - **RuPay / Visa / Mastercard**: 3D interactive credit/debit card mockup.
  - **NetBanking**: Supported for HDFC, ICICI, SBI, and Axis Bank.
  - **Cash on Delivery (COD)**: Option to pay cash or UPI at delivery.
- **Promo Codes**:
  - `FASHION20`: 20% discount on order subtotal.
  - `SAVE10`: Flat **₹500 discount** applied.
  - `FREESHIP`: 100% Free Shipping across India (saves ₹149).
- **GST Compliance**: 12% Goods & Services Tax itemized with printable GST tax invoice.

---

## 🚀 How to Run the Website

### Option 1: Live Local Server
Open [http://localhost:3000](http://localhost:3000) in your browser.

### Option 2: Direct File Protocol
Open [index.html](file:///C:/Users/ThisPc/.gemini/antigravity/scratch/fashion-store/index.html) directly in any modern browser (Chrome, Edge, Firefox).

---

## 📦 Download ZIP Archive
A complete standalone `.zip` archive containing all source files and images is generated at:
`C:\Users\ThisPc\.gemini\antigravity\scratch\fashion-store-india.zip`
