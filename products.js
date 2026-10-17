<<<<<<< HEAD
// ATELIER 24 INDIA - Official Curated Product Catalogue (8 Products Across 4 Categories)
const PRODUCTS = [
  {
    id: 1,
    title: "Performance Athletic Track Pants",
    category: "fitness",
    categoryLabel: "Fitness Wear",
    price: 1499,
    origPrice: 1999,
    rating: 4.9,
    reviewsCount: 184,
    badge: "Bestseller",
    badgeColor: "bg-emerald-700 text-white",
    image: "assets/images/products/fitness-track-pants.jpg",
    fallbackUrl: "assets/images/fallback.jpg",
    images: [
      "assets/images/products/fitness-track-pants.jpg",
      "assets/images/products/fitness-track-pants-detail.jpg"
    ],
    description: "Engineered for high-intensity training, workouts, and running. Spun from lightweight 4-way tech stretch moisture-wicking fabric with an ergonomic articulated knee cut, elastic drawstring waistband, secure waterproof zipper utility pockets, and tapered ribbed ankle cuffs.",
    colors: [
      { name: "Onyx Black", hex: "#1A1A1A" },
      { name: "Heather Charcoal", hex: "#3A3D40" },
      { name: "Midnight Navy", hex: "#1B2432" }
    ],
    sizes: ["S", "M", "L", "XL", "XXL"],
    inStock: true,
    stockCount: 18
  },
  {
    id: 2,
    title: "Performance Sports T-Shirt",
    category: "fitness",
    categoryLabel: "Fitness Wear",
    price: 1299,
    origPrice: 1799,
    rating: 4.8,
    reviewsCount: 142,
    badge: "Trending",
    badgeColor: "bg-slate-900 text-white",
    image: "assets/images/products/performance-sports-tshirt.jpg",
    fallbackUrl: "assets/images/fallback.jpg",
    images: [
      "assets/images/products/performance-sports-tshirt.jpg",
      "assets/images/products/performance-sports-tshirt-detail.jpg"
    ],
    description: "Engineered for high-intensity training with ultra-lightweight, quick-dry moisture-wicking Aeroready fabric. Features ergonomic raglan sleeves for chafe-free mobility, micro-perforated back mesh ventilation zones, and 360-degree reflective accents.",
    colors: [
      { name: "Cobalt Blue", hex: "#193778" },
      { name: "Carbon Black", hex: "#1A1A1A" },
      { name: "Steel Grey", hex: "#5C677D" }
    ],
    sizes: ["S", "M", "L", "XL", "XXL"],
    inStock: true,
    stockCount: 24
  },
  {
    id: 3,
    title: "Classic Casual T-Shirt",
    category: "casual",
    categoryLabel: "Casual Wear",
    price: 799,
    origPrice: 1199,
    rating: 4.7,
    reviewsCount: 236,
    badge: "Daily Essential",
    badgeColor: "bg-slate-800 text-white",
    image: "assets/images/products/classic-casual-tshirt.jpg",
    fallbackUrl: "assets/images/fallback.jpg",
    images: [
      "assets/images/products/classic-casual-tshirt.jpg",
      "assets/images/products/classic-casual-tshirt-detail.jpg"
    ],
    description: "Spun from 100% premium long-staple combed compact cotton (220 GSM) with a silky bio-washed hand feel. Features a reinforced ribbed crewneck collar that never sags, neat folded cuffs, and a tailored relaxed drape for everyday comfort.",
    colors: [
      { name: "Sage Olive", hex: "#8A9A84" },
      { name: "Pure Chalk", hex: "#FAFAFA" },
      { name: "Washed Black", hex: "#222222" }
    ],
    sizes: ["S", "M", "L", "XL", "XXL"],
    inStock: true,
    stockCount: 30
  },
  {
    id: 4,
    title: "Casual Denim Jeans",
    category: "casual",
    categoryLabel: "Casual Wear",
    price: 1099,
    origPrice: 1599,
    rating: 4.8,
    reviewsCount: 168,
    badge: "Popular",
    badgeColor: "bg-indigo-900 text-white",
    image: "assets/images/products/casual-denim-jeans.jpg",
    fallbackUrl: "assets/images/fallback.jpg",
    images: [
      "assets/images/products/casual-denim-jeans.jpg",
      "assets/images/products/casual-denim-jeans-detail.jpg"
    ],
    description: "Authentic mid-rise straight-fit jeans crafted from durable 12.5 oz ring-spun denim with 1% elastane for flexible movement. Features a timeless medium indigo vintage wash, handcrafted whiskering, embossed copper rivets, and heavy-duty brass zip fly.",
    colors: [
      { name: "Medium Indigo Wash", hex: "#203A60" },
      { name: "Dark Stonewash", hex: "#162740" }
    ],
    sizes: ["30W", "32W", "34W", "36W", "38W"],
    inStock: true,
    stockCount: 15
  },
  {
    id: 5,
    title: "Comfortable Cotton Night Suit",
    category: "night",
    categoryLabel: "Night Wear",
    price: 999,
    origPrice: 1499,
    rating: 4.9,
    reviewsCount: 195,
    badge: "Cozy Pick",
    badgeColor: "bg-amber-800 text-white",
    image: "assets/images/products/cotton-night-suit.jpg",
    fallbackUrl: "assets/images/fallback.jpg",
    images: [
      "assets/images/products/cotton-night-suit.jpg",
      "assets/images/products/cotton-night-suit-detail.jpg"
    ],
    description: "Ultra-soft two-piece pajama set spun from 100% breathable organic cotton. Includes a relaxed-fit button-down sleep shirt with a classic notch lapel collar, contrast piping, chest pocket, and matching straight trousers with a gentle drawstring waistband.",
    colors: [
      { name: "Sky Mist Blue", hex: "#AFC6D7" },
      { name: "Pastel Lavender", hex: "#D8D4E2" },
      { name: "Crisp Ivory", hex: "#F7F5F0" }
    ],
    sizes: ["S", "M", "L", "XL"],
    inStock: true,
    stockCount: 16
  },
  {
    id: 6,
    title: "Satin Night Dress",
    category: "night",
    categoryLabel: "Night Wear",
    price: 1199,
    origPrice: 1699,
    rating: 4.8,
    reviewsCount: 134,
    badge: "Luxury Pick",
    badgeColor: "bg-rose-900 text-white",
    image: "assets/images/products/satin-night-dress.jpg",
    fallbackUrl: "assets/images/fallback.jpg",
    images: [
      "assets/images/products/satin-night-dress.jpg",
      "assets/images/products/satin-night-dress-detail.jpg"
    ],
    description: "Flowing slip nightdress cut from premium high-luster liquid satin with a sensual fluid drape. Embellished with delicate scalloped French eyelash lace along the contoured V-neckline and hemline, finished with adjustable crossover spaghetti shoulder straps.",
    colors: [
      { name: "Blush Rose", hex: "#CD9BA5" },
      { name: "Champagne Gold", hex: "#EADDC6" },
      { name: "Midnight Noir", hex: "#1A1A1A" }
    ],
    sizes: ["XS", "S", "M", "L", "XL"],
=======
// ATELIER 24 INDIA - Curated Contemporary Fashion & Modern Luxury
const PRODUCTS = [
  {
    id: 1,
    title: "Structured Double-Breasted Wool Blend Blazer",
    category: "women",
    categoryLabel: "Women's Collection",
    price: 4999,
    origPrice: 6499,
    rating: 4.9,
    reviewsCount: 142,
    badge: "Trending in Mumbai",
    badgeColor: "bg-slate-900 text-white",
    image: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=800&q=80",
    description: "Expertly tailored with power padded shoulders, peak lapels, and a relaxed modern drape. Spun from premium lightweight wool-viscose blend, perfect for both corporate elegance and evening dinners.",
    colors: [
      { name: "Oatmeal Camel", hex: "#C2A878" },
      { name: "Midnight Noir", hex: "#1A1A1A" },
      { name: "Alabaster Ivory", hex: "#F5F3EF" }
    ],
    sizes: ["XS", "S", "M", "L", "XL"],
    inStock: true,
    stockCount: 6
  },
  {
    id: 2,
    title: "Minimalist Italian Nappa Leather Low-Top Sneakers",
    category: "footwear",
    categoryLabel: "Footwear",
    price: 3899,
    origPrice: 4599,
    rating: 4.8,
    reviewsCount: 98,
    badge: "Bestseller",
    badgeColor: "bg-emerald-700 text-white",
    image: "https://images.unsplash.com/photo-1552346154-21d32810aba3?auto=format&fit=crop&w=800&q=80",
    description: "Crafted with supple full-grain calf leather. Features tonal waxed cotton laces, cushioned memory-foam footbeds, and a durable anti-slip rubber cupsole.",
    colors: [
      { name: "Pure Chalk", hex: "#FAFAFA" },
      { name: "Triple Black", hex: "#1A1A1A" },
      { name: "Vachetta Tan", hex: "#D4A373" }
    ],
    sizes: ["UK 6", "UK 7", "UK 8", "UK 9", "UK 10", "UK 11"],
>>>>>>> 02d1a97168d2b2e17ce9334821464c3c161ca305
    inStock: true,
    stockCount: 12
  },
  {
<<<<<<< HEAD
    id: 7,
    title: "Elegant Party Dress",
    category: "party",
    categoryLabel: "Party Wear",
    price: 1499,
    origPrice: 2199,
    rating: 4.9,
    reviewsCount: 210,
    badge: "Exclusive",
    badgeColor: "bg-emerald-900 text-white",
    image: "assets/images/products/elegant-party-dress.jpg",
    fallbackUrl: "assets/images/fallback.jpg",
    images: [
      "assets/images/products/elegant-party-dress.jpg",
      "assets/images/products/elegant-party-dress-detail.jpg"
    ],
    description: "Showstopping midi cocktail evening dress featuring an asymmetrical sculpted neckline and contoured hourglass waist. Woven with subtle metallic lurex threads that catch the light from every angle, completed with a graceful side slit for festive galas.",
    colors: [
      { name: "Emerald Jewel", hex: "#143E34" },
      { name: "Wine Burgundy", hex: "#5C1324" },
      { name: "Midnight Black", hex: "#101014" }
    ],
    sizes: ["XS", "S", "M", "L", "XL"],
=======
    id: 3,
    title: "Pure Mongolian Cashmere Mock-Neck Knit Pullover",
    category: "men",
    categoryLabel: "Men's Collection",
    price: 3499,
    origPrice: 4299,
    rating: 4.9,
    reviewsCount: 86,
    badge: "New Arrival",
    badgeColor: "bg-amber-800 text-white",
    image: "https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&w=800&q=80",
    description: "Spun from 100% Grade-A cashmere with a cloud-soft hand feel. Ribbed collar and cuffs with sleek raglan sleeve detailing.",
    colors: [
      { name: "Heather Taupe", hex: "#A89F91" },
      { name: "Nordic Sage", hex: "#7E8D85" },
      { name: "Deep Navy", hex: "#1B2432" }
    ],
    sizes: ["S", "M", "L", "XL", "XXL"],
    inStock: true,
    stockCount: 4
  },
  {
    id: 4,
    title: "Pure Mulberry Silk Bias-Cut Evening Midi Dress",
    category: "women",
    categoryLabel: "Women's Collection",
    price: 4299,
    origPrice: 5499,
    rating: 4.7,
    reviewsCount: 114,
    badge: "Sale -22%",
    badgeColor: "bg-rose-700 text-white",
    image: "https://images.unsplash.com/photo-1496747611176-843222e1e57c?auto=format&fit=crop&w=800&q=80",
    description: "A liquid silk drape cut on the bias to flatter every curve. Hand-finished with delicate adjustable shoulder straps and a subtle side slit.",
    colors: [
      { name: "Emerald Glaze", hex: "#1B4D3E" },
      { name: "Champagne Gold", hex: "#EADDC6" },
      { name: "Midnight Black", hex: "#121212" }
    ],
    sizes: ["XS", "S", "M", "L"],
>>>>>>> 02d1a97168d2b2e17ce9334821464c3c161ca305
    inStock: true,
    stockCount: 8
  },
  {
<<<<<<< HEAD
    id: 8,
    title: "Party Wear Shirt",
    category: "party",
    categoryLabel: "Party Wear",
    price: 1399,
    origPrice: 1999,
    rating: 4.8,
    reviewsCount: 177,
    badge: "Party Edit",
    badgeColor: "bg-slate-900 text-white",
    image: "assets/images/products/party-wear-shirt.jpg",
    fallbackUrl: "assets/images/fallback.jpg",
    images: [
      "assets/images/products/party-wear-shirt.jpg",
      "assets/images/products/party-wear-shirt-detail.jpg"
    ],
    description: "Tailored slim-fit evening shirt crafted in deep rich wine burgundy cotton sateen with a luxurious liquid sheen. Detailed with a modern cutaway spread collar, high-gloss obsidian pearl buttons with cross-stitching, and convertible French barrel cuffs.",
    colors: [
      { name: "Deep Wine Burgundy", hex: "#4E1020" },
      { name: "Glossy Obsidian", hex: "#121214" },
      { name: "Royal Prussian Blue", hex: "#102542" }
    ],
    sizes: ["38 (S)", "40 (M)", "42 (L)", "44 (XL)"],
=======
    id: 5,
    title: "Architectural Calfskin Structured Shoulder Tote",
    category: "accessories",
    categoryLabel: "Bags & Leather",
    price: 5499,
    origPrice: 6999,
    rating: 5.0,
    reviewsCount: 64,
    badge: "Luxury Edition",
    badgeColor: "bg-stone-900 text-white",
    image: "https://images.unsplash.com/photo-1548036328-c9fa89d128fa?auto=format&fit=crop&w=800&q=80",
    description: "Clean geometric silhouette designed to fit a 14-inch MacBook and daily essentials. Contrast micro-suede interior, solid brass magnetic lock, and detachable cross-body strap.",
    colors: [
      { name: "Rich Espresso", hex: "#3B271A" },
      { name: "Saddle Tan", hex: "#8A5A36" },
      { name: "Olive Moss", hex: "#4A5340" }
    ],
    sizes: ["One Size (38 x 29 x 14 cm)"],
    inStock: true,
    stockCount: 5
  },
  {
    id: 6,
    title: "Relaxed Weatherproof Trench Coat with Tortoise Buckles",
    category: "women",
    categoryLabel: "Outerwear",
    price: 5999,
    origPrice: 7499,
    rating: 4.9,
    reviewsCount: 178,
    badge: "Staff Pick",
    badgeColor: "bg-indigo-900 text-white",
    image: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=800&q=80",
    description: "Double-breasted water-repellent cotton gabardine trench coat featuring classic storm flaps, deep welt pockets, and authentic horn buckles.",
    colors: [
      { name: "Classic Khaki", hex: "#C3B091" },
      { name: "Onyx Black", hex: "#191919" }
    ],
    sizes: ["XS", "S", "M", "L", "XL"],
    inStock: true,
    stockCount: 9
  },
  {
    id: 7,
    title: "Pleated Wide-Leg Tailored Tropical Wool Trousers",
    category: "men",
    categoryLabel: "Men's Collection",
    price: 2899,
    origPrice: 3499,
    rating: 4.6,
    reviewsCount: 72,
    badge: "Trending",
    badgeColor: "bg-slate-900 text-white",
    image: "https://images.unsplash.com/photo-1488161628813-04466f872be2?auto=format&fit=crop&w=800&q=80",
    description: "Modern relaxed drape with double reverse front pleats, hidden ticket pocket, and side buckle cinch tabs. Spun from ultra-breathable high-twist wool.",
    colors: [
      { name: "Dark Navy", hex: "#1C2541" },
      { name: "Slate Grey", hex: "#5C677D" }
    ],
    sizes: ["30W", "32W", "34W", "36W"],
    inStock: true,
    stockCount: 11
  },
  {
    id: 8,
    title: "Artisanal Chunky Commando-Sole Leather Loafers",
    category: "footwear",
    categoryLabel: "Footwear",
    price: 4499,
    origPrice: 5299,
    rating: 4.8,
    reviewsCount: 91,
    badge: "Popular",
    badgeColor: "bg-slate-800 text-white",
    image: "https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?auto=format&fit=crop&w=800&q=80",
    description: "Classic penny strap sitting on top of an exaggerated lightweight commando lug sole. Goodyear welted for enduring comfort and durability.",
    colors: [
      { name: "Deep Burgundy", hex: "#4A0E17" },
      { name: "Glossy Black", hex: "#0A0A0A" }
    ],
    sizes: ["UK 6", "UK 7", "UK 8", "UK 9", "UK 10"],
    inStock: true,
    stockCount: 7
  },
  {
    id: 9,
    title: "Heavyweight 480 GSM French Terry Relaxed Hoodie",
    category: "men",
    categoryLabel: "Essentials",
    price: 2299,
    origPrice: null,
    rating: 4.7,
    reviewsCount: 210,
    badge: "Essential",
    badgeColor: "bg-zinc-700 text-white",
    image: "https://images.unsplash.com/photo-1509967419530-da38b4704bc6?auto=format&fit=crop&w=800&q=80",
    description: "Dense 480 GSM organic cotton looped French terry with double-needle flatlock stitching, kangaroo pocket with reinforced bartacks, and no drawstrings for a minimal streetwear silhouette.",
    colors: [
      { name: "Washed Clay", hex: "#A76D58" },
      { name: "Carbon Noir", hex: "#2E2E2E" },
      { name: "Bone White", hex: "#EFECE6" }
    ],
    sizes: ["S", "M", "L", "XL", "XXL"],
    inStock: true,
    stockCount: 15
  },
  {
    id: 10,
    title: "Sculpted Hand-Polished Acetate Cat-Eye Sunglasses",
    category: "accessories",
    categoryLabel: "Eyewear",
    price: 1899,
    origPrice: 2499,
    rating: 4.5,
    reviewsCount: 53,
    badge: "Limited Edition",
    badgeColor: "bg-amber-900 text-white",
    image: "https://images.unsplash.com/photo-1508296695146-257a814070b4?auto=format&fit=crop&w=800&q=80",
    description: "Sculpted bevel frames made from plant-based Takiron acetate with 7-barrel hinges and 100% UVA/UVB polarized anti-reflective lenses.",
    colors: [
      { name: "Havana Tortoise", hex: "#634735" },
      { name: "Gloss Jet", hex: "#111111" }
    ],
    sizes: ["Standard Fit"],
    inStock: true,
    stockCount: 8
  },
  {
    id: 11,
    title: "Pure Cashmere Ribbed Scarf & Beanie Winter Set",
    category: "accessories",
    categoryLabel: "Knit Accessories",
    price: 2499,
    origPrice: 3199,
    rating: 4.9,
    reviewsCount: 67,
    badge: "Combo Deal",
    badgeColor: "bg-rose-900 text-white",
    image: "https://images.unsplash.com/photo-1520975954732-35dd22299614?auto=format&fit=crop&w=800&q=80",
    description: "Matching 7-gauge knit beanie and oversized ribbed winter scarf. Exceptionally insulating, breathable, and cloud-soft against delicate skin.",
    colors: [
      { name: "Oatmeal Heather", hex: "#D6C7B2" },
      { name: "Charcoal Grey", hex: "#3D3D3D" }
    ],
    sizes: ["One Size"],
    inStock: true,
    stockCount: 10
  },
  {
    id: 12,
    title: "Pure French Washed-Linen Cuban Collar Resort Shirt",
    category: "men",
    categoryLabel: "Men's Collection",
    price: 1999,
    origPrice: 2499,
    rating: 4.8,
    reviewsCount: 89,
    badge: "Trending",
    badgeColor: "bg-emerald-800 text-white",
    image: "https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?auto=format&fit=crop&w=800&q=80",
    description: "Woven from Normandy flax and garment-washed for broken-in softness from day one. Features an open retro camp collar and straight vented hem, ideal for warm Indian summers.",
    colors: [
      { name: "Crisp Chalk", hex: "#F7F7F7" },
      { name: "Goa Azure", hex: "#4A7C9B" },
      { name: "Jaipur Terracotta", hex: "#B85C43" }
    ],
    sizes: ["S", "M", "L", "XL"],
>>>>>>> 02d1a97168d2b2e17ce9334821464c3c161ca305
    inStock: true,
    stockCount: 14
  }
];

// Valid Mock Promo Codes for India Region
const VALID_PROMO_CODES = {
  "FASHION20": {
    code: "FASHION20",
    type: "percent",
    value: 20,
    description: "20% Discount applied to your order"
  },
  "SAVE10": {
    code: "SAVE10",
    type: "fixed",
    value: 500,
    description: "₹500.00 Flat Discount applied"
  },
  "FREESHIP": {
    code: "FREESHIP",
    type: "shipping",
    value: 100,
    description: "Free Standard Shipping applied (₹149 saved)"
  }
};
