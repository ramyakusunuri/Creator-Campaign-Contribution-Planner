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
    inStock: true,
    stockCount: 12
  },
  {
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
    inStock: true,
    stockCount: 8
  },
  {
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
