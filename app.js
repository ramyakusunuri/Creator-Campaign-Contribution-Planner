// ATELIER 24 INDIA - Complete Interactive E-Commerce & Checkout Engine with Multi-Image Gallery

// Currency Formatter for Indian Rupees
function formatINR(amount) {
  if (isNaN(amount) || amount === null) return '₹0';
  return '₹' + Math.round(amount).toLocaleString('en-IN');
}

// Fallback image helper
const DEFAULT_FALLBACK_IMG = "assets/images/fallback.jpg";

// Application State
const state = {
  products: PRODUCTS,
  filteredProducts: PRODUCTS,
  activeCategory: 'all',
  searchQuery: '',
  priceFilter: 'all',
  sortBy: 'featured',
  
  // Cart & Pricing
  cart: [
    {
      id: "cart-init-1",
      productId: 1,
      title: "Performance Athletic Track Pants",
      price: 1499,
      origPrice: 1999,
      image: "assets/images/products/fitness-track-pants.jpg",
      fallbackUrl: "assets/images/fallback.jpg",
      selectedSize: "M",
      selectedColor: "Onyx Black",
      colorHex: "#1A1A1A",
      quantity: 1
    }
  ],
  wishlist: [2, 5, 7],
  
  // Promo Engine
  appliedPromo: null,
  promoInput: '',
  promoMessage: null,
  
  // Navigation & Views
  currentView: 'catalog', // 'catalog' | 'checkout' | 'confirmation'
  isCartDrawerOpen: false,
  quickViewProduct: null,
  isTrackingModalOpen: false,
  
  // Checkout State
  checkoutStep: 1, // 1: Delivery, 2: Payment, 3: Review
  shippingMethod: 'standard', // 'standard' (₹149 or free) | 'express' (₹299)
  isProcessingPayment: false,
  processingStepText: 'Verifying UPI / Card payment...',
  
  shippingData: {
    firstName: 'Ananya',
    lastName: 'Sharma',
    email: 'ananya.sharma@example.com',
    phone: '+91 98765 43210',
    address: 'Flat 402, Palm Heights, 12th Main Rd',
    apt: 'Indiranagar (Near Metro)',
    city: 'Bengaluru',
    state: 'Karnataka',
    zip: '560038',
    country: 'India'
  },
  
  paymentData: {
    method: 'upi', // 'upi' | 'card' | 'cod' | 'netbanking'
    upiId: 'ananya.sharma@okhdfcbank',
    cardName: 'ANANYA SHARMA',
    cardNumber: '5312 8901 2345 6789',
    expDate: '09/29',
    cvv: '582',
    saveCard: true
  },
  
  // Completed Order Record
  completedOrder: null,
  
  // Toasts
  toasts: []
};

// Initialize Application
document.addEventListener('DOMContentLoaded', () => {
  renderNavbar();
  renderCatalog();
  renderCartDrawer();
  updateCartBadge();
  setupEventListeners();
  
  // Welcome toast
  showToast("Namaste from ATELIER 24", "Complimentary express delivery across India on orders over ₹1,999!", "info");
});

// Toast Manager
function showToast(title, message, type = 'success') {
  const toastContainer = document.getElementById('toastContainer');
  if (!toastContainer) return;

  const id = 'toast-' + Date.now() + Math.random().toString(36).substr(2, 4);
  const toastEl = document.createElement('div');
  toastEl.id = id;
  
  let iconHtml = '';
  let borderClass = 'border-slate-800';

  if (type === 'success') {
    borderClass = 'border-emerald-500/40 bg-emerald-950/90 text-white';
    iconHtml = `<svg class="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>`;
  } else if (type === 'error') {
    borderClass = 'border-rose-500/40 bg-rose-950/90 text-white';
    iconHtml = `<svg class="w-5 h-5 text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>`;
  } else {
    borderClass = 'border-slate-700 bg-slate-900/95 text-white';
    iconHtml = `<svg class="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>`;
  }

  toastEl.className = `flex items-start gap-3 p-4 rounded-xl shadow-2xl backdrop-blur-md border ${borderClass} transform translate-y-4 opacity-0 transition-all duration-300 max-w-sm pointer-events-auto z-50`;
  toastEl.innerHTML = `
    <div class="mt-0.5 shrink-0">${iconHtml}</div>
    <div class="flex-1">
      <h4 class="text-sm font-semibold tracking-wide">${title}</h4>
      <p class="text-xs text-slate-300 mt-0.5 leading-relaxed">${message}</p>
    </div>
    <button onclick="dismissToast('${id}')" class="text-slate-400 hover:text-white transition p-1">
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
    </button>
  `;

  toastContainer.appendChild(toastEl);
  
  requestAnimationFrame(() => {
    toastEl.classList.remove('translate-y-4', 'opacity-0');
  });

  setTimeout(() => {
    dismissToast(id);
  }, 3800);
}

function dismissToast(id) {
  const toast = document.getElementById(id);
  if (toast) {
    toast.classList.add('opacity-0', 'translate-y-2');
    setTimeout(() => toast.remove(), 300);
  }
}

// Price & Totals Engine (INR Region)
function calculateTotals() {
  const subtotal = state.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  
  // Base shipping fee: ₹149 standard, ₹299 express
  let baseShipping = state.shippingMethod === 'express' ? 299 : 149;
  let shipping = subtotal > 0 ? baseShipping : 0;
  
  // Free standard delivery if subtotal >= ₹1,999
  let isFreeShippingThreshold = subtotal >= 1999;
  if (isFreeShippingThreshold && state.shippingMethod === 'standard') {
    shipping = 0;
  }

  // Promo Calculation
  let discount = 0;
  let promoShippingDiscount = 0;

  if (state.appliedPromo) {
    if (state.appliedPromo.code === 'FASHION20') {
      discount = Math.round(subtotal * 0.20); // 20% off subtotal
    } else if (state.appliedPromo.code === 'SAVE10') {
      discount = Math.min(subtotal, 500); // ₹500 flat discount
    } else if (state.appliedPromo.code === 'FREESHIP') {
      if (state.shippingMethod === 'standard') {
        promoShippingDiscount = shipping;
        shipping = 0;
      } else if (state.shippingMethod === 'express') {
        promoShippingDiscount = 149; // ₹149 waiver off express
        shipping = Math.max(0, shipping - 149);
      }
    }
  }

  const taxableAmount = Math.max(0, subtotal - discount);
  const tax = taxableAmount > 0 ? Math.round(taxableAmount * 0.12) : 0; // 12% GST
  const total = Math.max(0, taxableAmount + shipping + tax);

  return {
    subtotal,
    discount,
    shipping,
    promoShippingDiscount,
    isFreeShippingThreshold,
    tax,
    total
  };
}

// Promo Code Handlers
async function applyPromoCode(codeToApply) {
  const code = (codeToApply || state.promoInput || '').trim().toUpperCase();
  
  if (!code) {
    state.promoMessage = { type: 'error', text: 'Please enter a coupon code.' };
    renderCartDrawer();
    if (state.currentView === 'checkout') renderCheckout();
    return;
  }

  // First, check with backend proxy (/api/check) which securely holds C24_WEBSITE_KEY server-side
  let backendCheck = null;
  try {
    const res = await fetch(`/api/check?code=${encodeURIComponent(code)}`);
    if (res.ok) {
      backendCheck = await res.json();
    }
  } catch (err) {
    console.warn('Backend proxy check unreachable, checking local presets:', err);
  }

  if (backendCheck && backendCheck.valid) {
    // Website owns and applies its discount (e.g. 20% campaign discount)
    state.appliedPromo = {
      code: code,
      type: 'percent',
      value: 20,
      description: `Official Influencer Campaign Promo (20% Off)`
    };
    state.promoInput = code;
    state.promoMessage = {
      type: 'success',
      text: `Code '${code}' is active! 20% discount applied to your cart.`
    };
    showToast(`Promo Applied: ${code}`, `20% influencer discount applied!`, 'success');
  } else if (VALID_PROMO_CODES[code]) {
    state.appliedPromo = VALID_PROMO_CODES[code];
    state.promoInput = code;
    
    let extraDetail = "";
    if (code === "FASHION20") extraDetail = "20% discount applied to your order!";
    if (code === "SAVE10") extraDetail = "₹500 flat discount applied!";
    if (code === "FREESHIP") extraDetail = "Free delivery applied to your order!";

    state.promoMessage = {
      type: 'success',
      text: `Code '${code}' applied successfully! ${extraDetail}`
    };
    showToast(`Coupon Applied: ${code}`, extraDetail, 'success');
  } else {
    const reasonText = backendCheck && backendCheck.reason === 'expired'
      ? `Promo code '${code}' has expired.`
      : backendCheck && backendCheck.reason === 'not_yet_valid'
      ? `Promo code '${code}' is not active yet.`
      : `Invalid code '${code}'. Try AARAV10, DIYA15, or FASHION20.`;

    state.promoMessage = {
      type: 'error',
      text: reasonText
    };
    showToast("Invalid Promo Code", reasonText, "error");
  }

  renderCartDrawer();
  if (state.currentView === 'checkout') renderCheckout();
}

function removePromoCode() {
  const removedCode = state.appliedPromo ? state.appliedPromo.code : '';
  state.appliedPromo = null;
  state.promoInput = '';
  state.promoMessage = {
    type: 'info',
    text: `Coupon ${removedCode} removed.`
  };
  
  showToast("Coupon Removed", "Discount has been removed from your cart.", "info");
  renderCartDrawer();
  if (state.currentView === 'checkout') renderCheckout();
}

function quickApplyPromo(code) {
  state.promoInput = code;
  applyPromoCode(code);
}

// Navigation & View Routing
function navigateTo(view) {
  state.currentView = view;
  state.isCartDrawerOpen = false;
  window.scrollTo({ top: 0, behavior: 'smooth' });

  const catalogView = document.getElementById('catalogView');
  const checkoutView = document.getElementById('checkoutView');
  const confirmationView = document.getElementById('confirmationView');

  if (catalogView) catalogView.classList.toggle('hidden', view !== 'catalog');
  if (checkoutView) checkoutView.classList.toggle('hidden', view !== 'checkout');
  if (confirmationView) confirmationView.classList.toggle('hidden', view !== 'confirmation');

  if (view === 'catalog') {
    renderCatalog();
  } else if (view === 'checkout') {
    renderCheckout();
  } else if (view === 'confirmation') {
    renderConfirmation();
  }

  renderNavbar();
}

// Cart Drawer Controls
function toggleCartDrawer(open) {
  state.isCartDrawerOpen = typeof open === 'boolean' ? open : !state.isCartDrawerOpen;
  const drawer = document.getElementById('cartDrawer');
  const backdrop = document.getElementById('cartBackdrop');
  
  if (drawer && backdrop) {
    if (state.isCartDrawerOpen) {
      backdrop.classList.remove('hidden');
      requestAnimationFrame(() => {
        backdrop.classList.remove('opacity-0');
        drawer.classList.remove('translate-x-full');
      });
      renderCartDrawer();
    } else {
      drawer.classList.add('translate-x-full');
      backdrop.classList.add('opacity-0');
      setTimeout(() => backdrop.classList.add('hidden'), 300);
    }
  }
}

// Cart Operations
function addToCart(productId, customSize, customColor, customColorHex, quantity = 1, openDrawer = true) {
  const product = state.products.find(p => p.id === productId);
  if (!product) return;

  const size = customSize || product.sizes[0];
  const color = customColor || product.colors[0].name;
  const colorHex = customColorHex || product.colors[0].hex;

  const existingIndex = state.cart.findIndex(item => 
    item.productId === productId && item.selectedSize === size && item.selectedColor === color
  );

  if (existingIndex > -1) {
    state.cart[existingIndex].quantity += quantity;
  } else {
    state.cart.push({
      id: 'cart-' + Date.now() + Math.random().toString(36).substr(2, 4),
      productId: product.id,
      title: product.title,
      price: product.price,
      origPrice: product.origPrice,
      image: product.image,
      fallbackUrl: product.fallbackUrl,
      selectedSize: size,
      selectedColor: color,
      colorHex: colorHex,
      quantity: quantity
    });
  }

  updateCartBadge();
  showToast("Added to Bag", `${product.title} (${size}) added.`, 'success');

  if (openDrawer) {
    toggleCartDrawer(true);
  } else {
    renderCartDrawer();
  }
}

// Quick "Buy Now" Action
function buyNow(productId, customSize, customColor, customColorHex) {
  const product = state.products.find(p => p.id === productId);
  if (!product) return;

  const size = customSize || product.sizes[0];
  const color = customColor || product.colors[0].name;
  const colorHex = customColorHex || product.colors[0].hex;

  const existing = state.cart.find(item => 
    item.productId === productId && item.selectedSize === size && item.selectedColor === color
  );

  if (!existing) {
    state.cart.push({
      id: 'cart-' + Date.now(),
      productId: product.id,
      title: product.title,
      price: product.price,
      origPrice: product.origPrice,
      image: product.image,
      fallbackUrl: product.fallbackUrl,
      selectedSize: size,
      selectedColor: color,
      colorHex: colorHex,
      quantity: 1
    });
  }

  updateCartBadge();
  state.checkoutStep = 1;
  navigateTo('checkout');
  showToast("Instant Checkout", `Proceeding directly with ${product.title}`, 'info');
}

function updateCartQuantity(cartItemId, delta) {
  const itemIndex = state.cart.findIndex(item => item.id === cartItemId);
  if (itemIndex === -1) return;

  state.cart[itemIndex].quantity += delta;
  if (state.cart[itemIndex].quantity <= 0) {
    const removedItem = state.cart[itemIndex];
    state.cart.splice(itemIndex, 1);
    showToast("Removed from Bag", `${removedItem.title} was removed.`, 'info');
  }

  updateCartBadge();
  renderCartDrawer();
  if (state.currentView === 'checkout') renderCheckout();
}

function removeCartItem(cartItemId) {
  const itemIndex = state.cart.findIndex(item => item.id === cartItemId);
  if (itemIndex > -1) {
    const item = state.cart[itemIndex];
    state.cart.splice(itemIndex, 1);
    showToast("Removed from Bag", `${item.title} removed.`, 'info');
    updateCartBadge();
    renderCartDrawer();
    if (state.currentView === 'checkout') renderCheckout();
  }
}

function toggleWishlist(productId) {
  const idx = state.wishlist.indexOf(productId);
  if (idx > -1) {
    state.wishlist.splice(idx, 1);
    showToast("Wishlist Updated", "Item removed from your saved wishlist.", "info");
  } else {
    state.wishlist.push(productId);
    showToast("Saved to Wishlist", "Item added to your favorites.", "success");
  }
  renderCatalog();
  renderNavbar();
}

function updateCartBadge() {
  const totalCount = state.cart.reduce((sum, item) => sum + item.quantity, 0);
  const badges = document.querySelectorAll('.cart-badge');
  badges.forEach(badge => {
    badge.textContent = totalCount;
    badge.classList.toggle('hidden', totalCount === 0);
  });
}

// Setup Event Listeners
function setupEventListeners() {
  const searchInput = document.getElementById('catalogSearchInput');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      state.searchQuery = e.target.value.toLowerCase();
      applyFilters();
    });
  }
}

// Filter and Sort Engine
function setCategory(category) {
  state.activeCategory = category;
  applyFilters();
  updateCategoryPillsUI();
}

function updateCategoryPillsUI() {
  const btns = document.querySelectorAll('.category-btn');
  btns.forEach(btn => {
    const cat = btn.getAttribute('data-cat');
    if (cat === state.activeCategory) {
      btn.className = "category-btn px-4 py-2 rounded-xl text-xs font-semibold uppercase tracking-wider transition bg-slate-900 text-white shadow-sm";
    } else {
      btn.className = "category-btn px-4 py-2 rounded-xl text-xs font-semibold uppercase tracking-wider transition bg-white border border-slate-200 text-slate-700 hover:border-slate-400";
    }
  });
}

function setPriceFilter(filter) {
  state.priceFilter = filter;
  applyFilters();
}

function setSortBy(sortBy) {
  state.sortBy = sortBy;
  applyFilters();
}

function applyFilters() {
  let list = [...state.products];

  // Category filter
  if (state.activeCategory !== 'all') {
    list = list.filter(p => p.category === state.activeCategory);
  }

  // Search filter
  if (state.searchQuery) {
    list = list.filter(p => 
      p.title.toLowerCase().includes(state.searchQuery) ||
      p.categoryLabel.toLowerCase().includes(state.searchQuery) ||
      p.description.toLowerCase().includes(state.searchQuery)
    );
  }

  // Price range (INR)
  if (state.priceFilter === 'under-1000') {
    list = list.filter(p => p.price < 1000);
  } else if (state.priceFilter === '1000-1300') {
    list = list.filter(p => p.price >= 1000 && p.price <= 1300);
  } else if (state.priceFilter === 'above-1300') {
    list = list.filter(p => p.price > 1300);
  }

  // Sorting
  if (state.sortBy === 'price-low') {
    list.sort((a, b) => a.price - b.price);
  } else if (state.sortBy === 'price-high') {
    list.sort((a, b) => b.price - a.price);
  } else if (state.sortBy === 'rating') {
    list.sort((a, b) => b.rating - a.rating);
  } else if (state.sortBy === 'name') {
    list.sort((a, b) => a.title.localeCompare(b.title));
  }

  state.filteredProducts = list;
  renderCatalog();
}

// Render Navigation Bar
function renderNavbar() {
  const wishlistCount = state.wishlist.length;
  const wishlistBadge = document.getElementById('wishlistBadge');
  if (wishlistBadge) {
    wishlistBadge.textContent = wishlistCount;
    wishlistBadge.classList.toggle('hidden', wishlistCount === 0);
  }
}

// Render Catalog Grid with High-Quality Cards & Image Transitions
function renderCatalog() {
  const container = document.getElementById('productsGrid');
  const countEl = document.getElementById('productsCount');
  const emptyState = document.getElementById('emptyCatalogState');

  if (!container) return;

  if (countEl) {
    countEl.textContent = `${state.filteredProducts.length} ${state.filteredProducts.length === 1 ? 'item' : 'items'} found`;
  }

  if (state.filteredProducts.length === 0) {
    container.innerHTML = '';
    if (emptyState) emptyState.classList.remove('hidden');
    return;
  }

  if (emptyState) emptyState.classList.add('hidden');

  container.innerHTML = state.filteredProducts.map(p => {
    const isWishlisted = state.wishlist.includes(p.id);
    const hasDiscount = p.origPrice !== null;
    const discountPercent = hasDiscount ? Math.round(((p.origPrice - p.price) / p.origPrice) * 100) : 0;
    const secondaryImage = p.images && p.images[1] ? p.images[1] : p.image;

    return `
      <div class="product-card group relative flex flex-col bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300">
        <!-- Image Container with Hover Angle Dissolve & Zoom -->
        <div class="relative w-full aspect-[3/4] bg-slate-100 overflow-hidden cursor-pointer" onclick="openQuickView(${p.id})">
          
          <!-- Primary Image -->
          <img 
            src="${p.image}" 
            alt="${p.title}" 
            class="img-zoom w-full h-full object-cover object-top transition-opacity duration-500 group-hover:opacity-0"
            loading="lazy"
            onerror="this.onerror=null; this.src='${p.fallbackUrl || DEFAULT_FALLBACK_IMG}';"
          />

          <!-- Secondary Angle View on Hover -->
          <img 
            src="${secondaryImage}" 
            alt="${p.title} detail angle" 
            class="w-full h-full object-cover object-top absolute inset-0 opacity-0 group-hover:opacity-100 transition-all duration-500 group-hover:scale-105"
            loading="lazy"
            onerror="this.onerror=null; this.src='${p.fallbackUrl || DEFAULT_FALLBACK_IMG}';"
          />

          <!-- Live Badges -->
          <div class="absolute top-3 left-3 flex flex-col gap-1.5 z-10 pointer-events-none">
            ${p.badge ? `<span class="px-2.5 py-1 text-[11px] font-semibold tracking-wider uppercase rounded-full shadow-sm ${p.badgeColor}">${p.badge}</span>` : ''}
            ${hasDiscount ? `<span class="px-2.5 py-1 text-[11px] font-bold tracking-wider uppercase rounded-full shadow-sm bg-rose-600 text-white">-${discountPercent}%</span>` : ''}
          </div>

          <!-- Wishlist Button -->
          <button 
            onclick="event.stopPropagation(); toggleWishlist(${p.id})" 
            class="absolute top-3 right-3 p-2.5 rounded-full bg-white/90 backdrop-blur-md text-slate-700 hover:text-rose-600 hover:bg-white shadow-md transition-all duration-200 z-10"
            title="${isWishlisted ? 'Remove from wishlist' : 'Save to wishlist'}"
          >
            <svg class="w-4 h-4 ${isWishlisted ? 'fill-rose-500 text-rose-500' : 'fill-none stroke-current'}" viewBox="0 0 24 24" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
          </button>

          <!-- Quick View Hover Overlay Button -->
          <div class="absolute inset-x-3 bottom-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10">
            <button 
              onclick="event.stopPropagation(); openQuickView(${p.id})"
              class="w-full py-2.5 px-4 bg-white/95 backdrop-blur text-slate-900 rounded-xl text-xs font-semibold tracking-wide uppercase shadow-lg hover:bg-white transition flex items-center justify-center gap-1.5"
            >
              <svg class="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
              Quick Preview & Angles
            </button>
          </div>
        </div>

        <!-- Product Details -->
        <div class="p-5 flex-1 flex flex-col justify-between">
          <div>
            <div class="flex items-center justify-between text-xs text-slate-500 mb-1.5">
              <span>${p.categoryLabel}</span>
              <div class="flex items-center gap-1 text-amber-500 font-medium">
                <svg class="w-3.5 h-3.5 fill-current" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>
                <span>${p.rating}</span>
                <span class="text-slate-400 font-normal">(${p.reviewsCount})</span>
              </div>
            </div>

            <h3 class="font-medium text-slate-900 text-sm leading-snug line-clamp-2 hover:text-slate-700 cursor-pointer" onclick="openQuickView(${p.id})">
              ${p.title}
            </h3>

            <!-- Color Swatches Preview -->
            <div class="flex items-center gap-1.5 mt-2.5">
              ${p.colors.map(c => `
                <span class="w-3 h-3 rounded-full border border-slate-300 shadow-inner" style="background-color: ${c.hex}" title="${c.name}"></span>
              `).join('')}
              <span class="text-[11px] text-slate-400 ml-1">+${p.sizes.length} sizes</span>
            </div>
          </div>

          <!-- Price (INR) & Dual Actions -->
          <div class="mt-4 pt-3 border-t border-slate-100">
            <div class="flex items-baseline gap-2 mb-3">
              <span class="text-lg font-bold text-slate-900">${formatINR(p.price)}</span>
              ${hasDiscount ? `<span class="text-xs text-slate-400 line-through font-normal">${formatINR(p.origPrice)}</span>` : ''}
              <span class="text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded font-medium">Free Delivery</span>
            </div>

            <div class="grid grid-cols-2 gap-2">
              <button 
                onclick="addToCart(${p.id})" 
                class="py-2 px-3 rounded-xl border border-slate-900 text-slate-900 text-xs font-semibold hover:bg-slate-900 hover:text-white transition flex items-center justify-center gap-1"
                title="Add to shopping bag"
              >
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"/></svg>
                Add to Cart
              </button>
              <button 
                onclick="buyNow(${p.id})" 
                class="py-2 px-3 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition shadow-sm flex items-center justify-center gap-1"
                title="Instant Checkout"
              >
                <svg class="w-3.5 h-3.5 text-amber-300" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clip-rule="evenodd"/></svg>
                Buy Now
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// Quick View Modal & Multi-Image Gallery
function openQuickView(productId) {
  const product = state.products.find(p => p.id === productId);
  if (!product) return;

  state.quickViewProduct = {
    ...product,
    activeImage: product.image,
    selectedSize: product.sizes[0],
    selectedColor: product.colors[0].name,
    selectedColorHex: product.colors[0].hex,
    quantity: 1
  };

  renderQuickViewModal();
  const modal = document.getElementById('quickViewModal');
  if (modal) {
    modal.classList.remove('hidden');
    requestAnimationFrame(() => modal.classList.remove('opacity-0'));
  }
}

function closeQuickView() {
  const modal = document.getElementById('quickViewModal');
  if (modal) {
    modal.classList.add('opacity-0');
    setTimeout(() => {
      modal.classList.add('hidden');
      state.quickViewProduct = null;
    }, 200);
  }
}

function setQuickViewActiveImage(imgSrc) {
  if (state.quickViewProduct) {
    state.quickViewProduct.activeImage = imgSrc;
    const mainImg = document.getElementById('quickViewMainImg');
    if (mainImg) {
      mainImg.style.opacity = '0.3';
      setTimeout(() => {
        mainImg.src = imgSrc;
        mainImg.style.opacity = '1';
      }, 150);
    }
    // Update thumbnail active ring
    const thumbs = document.querySelectorAll('.qv-thumb-btn');
    thumbs.forEach(t => {
      if (t.dataset.img === imgSrc) {
        t.classList.add('border-slate-900', 'ring-2', 'ring-slate-900/30');
        t.classList.remove('border-slate-200');
      } else {
        t.classList.remove('border-slate-900', 'ring-2', 'ring-slate-900/30');
        t.classList.add('border-slate-200');
      }
    });
  }
}

function renderQuickViewModal() {
  const qv = state.quickViewProduct;
  const container = document.getElementById('quickViewContent');
  if (!qv || !container) return;

  const imagesList = qv.images && qv.images.length > 0 ? qv.images : [qv.image];

  container.innerHTML = `
    <div class="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
      
      <!-- Gallery Column with Multi-Image Thumbnails -->
      <div class="space-y-4">
        <!-- Main Large Image View -->
        <div class="relative aspect-[3/4] bg-slate-100 rounded-2xl overflow-hidden shadow-inner border border-slate-100">
          <img 
            id="quickViewMainImg" 
            src="${qv.activeImage || qv.image}" 
            alt="${qv.title}" 
            class="w-full h-full object-cover object-top transition-opacity duration-200" 
            onerror="this.onerror=null; this.src='${qv.fallbackUrl || DEFAULT_FALLBACK_IMG}';"
          />
          <div class="absolute top-3 left-3">
            ${qv.badge ? `<span class="px-3 py-1 text-xs font-semibold rounded-full ${qv.badgeColor}">${qv.badge}</span>` : ''}
          </div>
        </div>

        <!-- Thumbnails Selector Row -->
        <div class="flex items-center gap-3 overflow-x-auto pb-1">
          ${imagesList.map((img, idx) => `
            <button 
              type="button" 
              data-img="${img}"
              onclick="setQuickViewActiveImage('${img}')"
              class="qv-thumb-btn w-16 h-20 rounded-xl overflow-hidden border-2 transition-all shrink-0 ${qv.activeImage === img ? 'border-slate-900 ring-2 ring-slate-900/30 scale-105' : 'border-slate-200 hover:border-slate-400'}"
            >
              <img src="${img}" alt="Angle ${idx + 1}" class="w-full h-full object-cover object-top" onerror="this.onerror=null; this.src='${DEFAULT_FALLBACK_IMG}';" />
            </button>
          `).join('')}
        </div>
      </div>

      <!-- Detail Column -->
      <div class="flex flex-col justify-between h-full">
        <div>
          <div class="flex items-center justify-between text-xs text-slate-500 mb-2">
            <span>${qv.categoryLabel}</span>
            <div class="flex items-center gap-1 text-amber-500 font-semibold">
              <svg class="w-4 h-4 fill-current" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>
              <span>${qv.rating}</span>
              <span class="text-slate-400">(${qv.reviewsCount} customer reviews)</span>
            </div>
          </div>

          <h2 class="text-2xl font-serif font-semibold text-slate-900 mb-3">${qv.title}</h2>
          
          <div class="flex items-baseline gap-3 mb-4">
            <span class="text-2xl font-bold text-slate-900">${formatINR(qv.price)}</span>
            ${qv.origPrice ? `<span class="text-sm text-slate-400 line-through">${formatINR(qv.origPrice)}</span>` : ''}
            <span class="text-xs text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md font-medium">In Stock (${qv.stockCount} units left)</span>
          </div>

          <p class="text-sm text-slate-600 leading-relaxed mb-6">${qv.description}</p>

          <!-- Color Selector -->
          <div class="mb-5">
            <label class="block text-xs font-semibold text-slate-900 uppercase tracking-wider mb-2">
              Color: <span class="font-normal text-slate-600">${qv.selectedColor}</span>
            </label>
            <div class="flex items-center gap-3">
              ${qv.colors.map(c => `
                <button 
                  onclick="selectQuickViewColor('${c.name}', '${c.hex}')"
                  class="w-8 h-8 rounded-full border-2 transition-transform ${qv.selectedColor === c.name ? 'border-slate-900 scale-110 shadow-md ring-2 ring-slate-900/20' : 'border-slate-200 hover:scale-105'}"
                  style="background-color: ${c.hex}"
                  title="${c.name}"
                ></button>
              `).join('')}
            </div>
          </div>

          <!-- Size Selector -->
          <div class="mb-6">
            <div class="flex items-center justify-between mb-2">
              <label class="text-xs font-semibold text-slate-900 uppercase tracking-wider">Select Size (Standard Indian Fit)</label>
              <button class="text-xs text-slate-500 underline hover:text-slate-900">Size Chart</button>
            </div>
            <div class="flex flex-wrap gap-2">
              ${qv.sizes.map(s => `
                <button 
                  onclick="selectQuickViewSize('${s}')"
                  class="px-4 py-2 rounded-xl text-xs font-semibold border transition ${qv.selectedSize === s ? 'bg-slate-900 text-white border-slate-900' : 'border-slate-200 text-slate-700 hover:border-slate-400'}"
                >
                  ${s}
                </button>
              `).join('')}
            </div>
          </div>

          <!-- Quantity Stepper -->
          <div class="mb-6 flex items-center gap-4">
            <span class="text-xs font-semibold text-slate-900 uppercase tracking-wider">Quantity:</span>
            <div class="flex items-center border border-slate-200 rounded-xl overflow-hidden bg-slate-50">
              <button onclick="updateQuickViewQty(-1)" class="px-3 py-1.5 text-slate-600 hover:bg-slate-200 font-bold transition">−</button>
              <span class="px-4 py-1.5 text-sm font-semibold text-slate-900">${qv.quantity}</span>
              <button onclick="updateQuickViewQty(1)" class="px-3 py-1.5 text-slate-600 hover:bg-slate-200 font-bold transition">+</button>
            </div>
          </div>
        </div>

        <!-- Action CTAs -->
        <div class="grid grid-cols-2 gap-3 pt-4 border-t border-slate-100">
          <button 
            onclick="addQuickViewToCart()" 
            class="py-3 px-4 rounded-xl border border-slate-900 text-slate-900 font-semibold text-sm hover:bg-slate-900 hover:text-white transition flex items-center justify-center gap-2"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"/></svg>
            Add to Bag
          </button>
          <button 
            onclick="buyNowQuickView()" 
            class="py-3 px-4 rounded-xl bg-slate-900 text-white font-semibold text-sm hover:bg-slate-800 transition shadow-md flex items-center justify-center gap-2"
          >
            <svg class="w-4 h-4 text-amber-300" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clip-rule="evenodd"/></svg>
            Instant Buy
          </button>
        </div>
      </div>
    </div>
  `;
}

function selectQuickViewSize(size) {
  if (state.quickViewProduct) {
    state.quickViewProduct.selectedSize = size;
    renderQuickViewModal();
  }
}

function selectQuickViewColor(name, hex) {
  if (state.quickViewProduct) {
    state.quickViewProduct.selectedColor = name;
    state.quickViewProduct.selectedColorHex = hex;
    renderQuickViewModal();
  }
}

function updateQuickViewQty(delta) {
  if (state.quickViewProduct) {
    state.quickViewProduct.quantity = Math.max(1, state.quickViewProduct.quantity + delta);
    renderQuickViewModal();
  }
}

function addQuickViewToCart() {
  const qv = state.quickViewProduct;
  if (!qv) return;
  addToCart(qv.id, qv.selectedSize, qv.selectedColor, qv.selectedColorHex, qv.quantity, true);
  closeQuickView();
}

function buyNowQuickView() {
  const qv = state.quickViewProduct;
  if (!qv) return;
  addToCart(qv.id, qv.selectedSize, qv.selectedColor, qv.selectedColorHex, qv.quantity, false);
  closeQuickView();
  state.checkoutStep = 1;
  navigateTo('checkout');
}

// Render Cart Drawer
function renderCartDrawer() {
  const container = document.getElementById('cartDrawerItems');
  const summaryContainer = document.getElementById('cartDrawerSummary');
  const emptyState = document.getElementById('cartDrawerEmpty');
  const footerEl = document.getElementById('cartDrawerFooter');

  if (!container) return;

  if (state.cart.length === 0) {
    container.innerHTML = '';
    if (emptyState) emptyState.classList.remove('hidden');
    if (footerEl) footerEl.classList.add('hidden');
    return;
  }

  if (emptyState) emptyState.classList.add('hidden');
  if (footerEl) footerEl.classList.remove('hidden');

  // Render items
  container.innerHTML = state.cart.map(item => `
    <div class="flex gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100 relative group">
      <img 
        src="${item.image}" 
        alt="${item.title}" 
        class="w-20 h-24 object-cover object-top rounded-xl bg-white shrink-0 border border-slate-200" 
        onerror="this.onerror=null; this.src='${item.fallbackUrl || DEFAULT_FALLBACK_IMG}';"
      />
      <div class="flex-1 flex flex-col justify-between">
        <div>
          <div class="flex items-start justify-between gap-2">
            <h4 class="text-sm font-semibold text-slate-900 leading-snug line-clamp-1">${item.title}</h4>
            <button 
              onclick="removeCartItem('${item.id}')" 
              class="text-slate-400 hover:text-rose-600 transition p-1"
              title="Remove item"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            </button>
          </div>
          <p class="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
            <span class="w-2.5 h-2.5 rounded-full inline-block border border-slate-300" style="background-color: ${item.colorHex || '#ccc'}"></span>
            ${item.selectedColor} • Size: <span class="font-medium text-slate-700">${item.selectedSize}</span>
          </p>
        </div>

        <div class="flex items-center justify-between mt-3 pt-2 border-t border-slate-200/60">
          <div class="flex items-center border border-slate-300 rounded-lg bg-white overflow-hidden">
            <button onclick="updateCartQuantity('${item.id}', -1)" class="px-2.5 py-1 text-slate-600 hover:bg-slate-100 text-xs font-bold transition">−</button>
            <span class="px-3 py-1 text-xs font-semibold text-slate-900">${item.quantity}</span>
            <button onclick="updateCartQuantity('${item.id}', 1)" class="px-2.5 py-1 text-slate-600 hover:bg-slate-100 text-xs font-bold transition">+</button>
          </div>
          <span class="text-sm font-bold text-slate-900">${formatINR(item.price * item.quantity)}</span>
        </div>
      </div>
    </div>
  `).join('');

  // Calculations
  const totals = calculateTotals();
  const freeShippingThreshold = 1999;
  const amountNeededForFreeShip = Math.max(0, freeShippingThreshold - totals.subtotal);
  const freeShipProgressPercent = Math.min(100, Math.round((totals.subtotal / freeShippingThreshold) * 100));

  // Render Promo Section & Order Totals
  if (summaryContainer) {
    summaryContainer.innerHTML = `
      <!-- Free Shipping Tracker -->
      <div class="p-3.5 bg-slate-100 rounded-xl mb-4 border border-slate-200">
        <div class="flex items-center justify-between text-xs font-medium text-slate-700 mb-1.5">
          <span class="flex items-center gap-1.5">
            <svg class="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"/></svg>
            ${totals.isFreeShippingThreshold || (state.appliedPromo && state.appliedPromo.code === 'FREESHIP') 
              ? '<span class="text-emerald-700 font-semibold">🎉 You have unlocked Free Express Delivery across India!</span>' 
              : `Add <span class="font-bold text-slate-900">${formatINR(amountNeededForFreeShip)}</span> more for Free Delivery`
            }
          </span>
          <span class="text-[11px] text-slate-500">${freeShipProgressPercent}%</span>
        </div>
        <div class="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
          <div class="bg-emerald-600 h-full rounded-full transition-all duration-500" style="width: ${totals.isFreeShippingThreshold || (state.appliedPromo && state.appliedPromo.code === 'FREESHIP') ? '100%' : freeShipProgressPercent + '%'}"></div>
        </div>
      </div>

      <!-- Promo Code Engine Section -->
      <div class="mb-4 p-3.5 bg-white rounded-xl border border-slate-200 shadow-sm">
        <label class="block text-xs font-semibold text-slate-800 uppercase tracking-wider mb-2 flex items-center justify-between">
          <span>Apply Promo / Coupon Code</span>
          <span class="text-[11px] text-slate-400 font-normal">Active mock coupons</span>
        </label>

        <div class="flex gap-2">
          <div class="relative flex-1">
            <input 
              type="text" 
              id="drawerPromoInput" 
              placeholder="e.g. FASHION20" 
              value="${state.promoInput || ''}" 
              class="w-full pl-8 pr-3 py-2 text-xs uppercase font-medium bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 focus:bg-white transition"
              onkeydown="if(event.key==='Enter'){ applyPromoCode(this.value); }"
            />
            <svg class="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"/></svg>
          </div>
          <button 
            onclick="applyPromoCode(document.getElementById('drawerPromoInput').value)" 
            class="px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-semibold hover:bg-slate-800 transition"
          >
            Apply
          </button>
        </div>

        <!-- Quick Presets Clickable Tags -->
        <div class="mt-2.5 pt-2 border-t border-slate-100 flex flex-wrap items-center gap-1.5 text-[11px]">
          <span class="text-slate-400">Presets:</span>
          <button onclick="quickApplyPromo('FASHION20')" class="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-mono transition">FASHION20 (-20%)</button>
          <button onclick="quickApplyPromo('SAVE10')" class="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-mono transition">SAVE10 (-₹500)</button>
          <button onclick="quickApplyPromo('FREESHIP')" class="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-mono transition">FREESHIP</button>
        </div>

        <!-- Promo Message Status -->
        ${state.promoMessage ? `
          <div class="mt-2 p-2 rounded-lg text-xs flex items-start justify-between gap-2 ${
            state.promoMessage.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' :
            state.promoMessage.type === 'error' ? 'bg-rose-50 text-rose-800 border border-rose-200' :
            'bg-slate-100 text-slate-800'
          }">
            <div class="flex items-center gap-1.5">
              ${state.promoMessage.type === 'success' 
                ? '<svg class="w-4 h-4 text-emerald-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>' 
                : '<svg class="w-4 h-4 text-rose-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>'
              }
              <span>${state.promoMessage.text}</span>
            </div>
            ${state.appliedPromo ? `
              <button onclick="removePromoCode()" class="text-slate-400 hover:text-slate-900 font-semibold text-xs ml-1 underline">Remove</button>
            ` : ''}
          </div>
        ` : ''}
      </div>

      <!-- Financial Breakdown in INR -->
      <div class="space-y-2 text-xs text-slate-600 mb-4 pt-2 border-t border-slate-200">
        <div class="flex justify-between">
          <span>Subtotal</span>
          <span class="font-medium text-slate-900">${formatINR(totals.subtotal)}</span>
        </div>

        ${totals.discount > 0 ? `
          <div class="flex justify-between text-emerald-600 font-medium">
            <span class="flex items-center gap-1">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"/></svg>
              Coupon Discount (${state.appliedPromo ? state.appliedPromo.code : ''})
            </span>
            <span>-${formatINR(totals.discount)}</span>
          </div>
        ` : ''}

        <div class="flex justify-between">
          <span class="flex items-center gap-1">
            Shipping & Delivery
            ${totals.shipping === 0 ? '<span class="text-[10px] bg-emerald-100 text-emerald-800 font-semibold px-1.5 py-0.2 rounded">FREE</span>' : ''}
          </span>
          <span class="font-medium text-slate-900">
            ${totals.shipping === 0 ? 'FREE' : formatINR(totals.shipping)}
          </span>
        </div>

        <div class="flex justify-between">
          <span>Estimated GST (12%)</span>
          <span class="font-medium text-slate-900">${formatINR(totals.tax)}</span>
        </div>

        <div class="pt-2 border-t border-slate-200 flex justify-between text-base font-bold text-slate-900">
          <span>Total Payable</span>
          <span class="text-xl">${formatINR(totals.total)}</span>
        </div>
      </div>
    `;
  }
}

// Render Checkout Page
function renderCheckout() {
  const container = document.getElementById('checkoutContainer');
  if (!container) return;

  if (state.cart.length === 0) {
    container.innerHTML = `
      <div class="text-center py-20 bg-white rounded-3xl border border-slate-100 p-8 shadow-sm">
        <svg class="w-16 h-16 text-slate-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"/></svg>
        <h2 class="text-2xl font-serif font-bold text-slate-900 mb-2">Your Shopping Bag is Empty</h2>
        <p class="text-sm text-slate-500 mb-6">Discover trendy apparel & accessories from our collection.</p>
        <button onclick="navigateTo('catalog')" class="px-6 py-3 bg-slate-900 text-white rounded-xl text-sm font-semibold hover:bg-slate-800 transition">Return to Store</button>
      </div>
    `;
    return;
  }

  const totals = calculateTotals();

  container.innerHTML = `
    <!-- Top Breadcrumb / Navigation -->
    <div class="mb-8 flex items-center justify-between">
      <button onclick="navigateTo('catalog')" class="flex items-center gap-2 text-xs font-semibold text-slate-600 hover:text-slate-900 transition uppercase tracking-wider">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"/></svg>
        Back to Shopping
      </button>

      <!-- Stepper Indicator -->
      <div class="flex items-center gap-2 text-xs">
        <div class="flex items-center gap-1.5 ${state.checkoutStep >= 1 ? 'text-slate-900 font-bold' : 'text-slate-400'}">
          <span class="w-5 h-5 rounded-full ${state.checkoutStep >= 1 ? 'bg-slate-900 text-white' : 'bg-slate-200 text-slate-600'} flex items-center justify-center text-[10px]">1</span>
          <span>Delivery</span>
        </div>
        <span class="text-slate-300">──</span>
        <div class="flex items-center gap-1.5 ${state.checkoutStep >= 2 ? 'text-slate-900 font-bold' : 'text-slate-400'}">
          <span class="w-5 h-5 rounded-full ${state.checkoutStep >= 2 ? 'bg-slate-900 text-white' : 'bg-slate-200 text-slate-600'} flex items-center justify-center text-[10px]">2</span>
          <span>Payment</span>
        </div>
        <span class="text-slate-300">──</span>
        <div class="flex items-center gap-1.5 ${state.checkoutStep >= 3 ? 'text-slate-900 font-bold' : 'text-slate-400'}">
          <span class="w-5 h-5 rounded-full ${state.checkoutStep >= 3 ? 'bg-slate-900 text-white' : 'bg-slate-200 text-slate-600'} flex items-center justify-center text-[10px]">3</span>
          <span>Review</span>
        </div>
      </div>
    </div>

    <!-- Main Grid: Form (Col 1) and Sticky Order Summary (Col 2) -->
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
      
      <!-- Checkout Interactive Form (Col 1 - 7 cols) -->
      <div class="lg:col-span-7 bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-sm">
        
        ${state.checkoutStep === 1 ? renderShippingStep() : ''}
        ${state.checkoutStep === 2 ? renderPaymentStep() : ''}
        ${state.checkoutStep === 3 ? renderReviewStep(totals) : ''}

      </div>

      <!-- Sticky Order Summary Sidebar (Col 2 - 5 cols) -->
      <div class="lg:col-span-5 space-y-6">
        
        <div class="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm sticky top-28">
          <div class="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
            <h3 class="font-serif font-bold text-lg text-slate-900">Order Summary</h3>
            <span class="text-xs text-slate-500 font-medium">${state.cart.reduce((s, i) => s + i.quantity, 0)} items</span>
          </div>

          <!-- Items Mini List with Fallback -->
          <div class="space-y-3.5 max-h-60 overflow-y-auto pr-1 mb-5">
            ${state.cart.map(item => `
              <div class="flex items-center gap-3">
                <div class="relative shrink-0">
                  <img 
                    src="${item.image}" 
                    alt="${item.title}" 
                    class="w-14 h-16 object-cover object-top rounded-xl bg-slate-100 border border-slate-200" 
                    onerror="this.onerror=null; this.src='${item.fallbackUrl || DEFAULT_FALLBACK_IMG}';"
                  />
                  <span class="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-slate-900 text-white text-[10px] font-bold flex items-center justify-center shadow-sm">${item.quantity}</span>
                </div>
                <div class="flex-1 min-w-0">
                  <h4 class="text-xs font-semibold text-slate-900 truncate">${item.title}</h4>
                  <p class="text-[11px] text-slate-500 mt-0.5">${item.selectedColor} • Size: ${item.selectedSize}</p>
                </div>
                <div class="text-right">
                  <span class="text-xs font-bold text-slate-900">${formatINR(item.price * item.quantity)}</span>
                </div>
              </div>
            `).join('')}
          </div>

          <!-- Promo Code Engine in Checkout -->
          <div class="p-4 bg-slate-50 rounded-2xl border border-slate-200/70 mb-5">
            <div class="flex items-center justify-between text-xs font-semibold text-slate-800 uppercase tracking-wider mb-2">
              <span>Apply Coupon</span>
              <span class="text-[11px] text-emerald-700 font-normal">Active codes</span>
            </div>
            
            <div class="flex gap-2">
              <input 
                type="text" 
                id="checkoutPromoInput" 
                placeholder="FASHION20, SAVE10, FREESHIP" 
                value="${state.promoInput || ''}" 
                class="w-full px-3 py-2 text-xs uppercase font-medium bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-slate-900 focus:outline-none"
                onkeydown="if(event.key==='Enter'){ applyPromoCode(this.value); }"
              />
              <button 
                onclick="applyPromoCode(document.getElementById('checkoutPromoInput').value)" 
                class="px-4 py-2 bg-slate-900 text-white text-xs font-semibold rounded-xl hover:bg-slate-800 transition"
              >
                Apply
              </button>
            </div>

            <!-- Quick Pill Buttons for Testing -->
            <div class="flex flex-wrap gap-1.5 mt-2.5 pt-2 border-t border-slate-200 text-[11px]">
              <span class="text-slate-400">Presets:</span>
              <button onclick="quickApplyPromo('FASHION20')" class="px-2 py-0.5 rounded-md bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-mono transition">FASHION20 (-20%)</button>
              <button onclick="quickApplyPromo('SAVE10')" class="px-2 py-0.5 rounded-md bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-mono transition">SAVE10 (-₹500)</button>
              <button onclick="quickApplyPromo('FREESHIP')" class="px-2 py-0.5 rounded-md bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-mono transition">FREESHIP</button>
            </div>

            <!-- Feedback Message -->
            ${state.promoMessage ? `
              <div class="mt-2 p-2 rounded-xl text-xs flex items-center justify-between gap-2 ${
                state.promoMessage.type === 'success' ? 'bg-emerald-100 text-emerald-900' :
                state.promoMessage.type === 'error' ? 'bg-rose-100 text-rose-900' : 'bg-slate-200 text-slate-900'
              }">
                <span class="font-medium">${state.promoMessage.text}</span>
                ${state.appliedPromo ? `<button onclick="removePromoCode()" class="text-xs font-bold underline">Remove</button>` : ''}
              </div>
            ` : ''}
          </div>

          <!-- Totals Breakdown (INR) -->
          <div class="space-y-2.5 text-xs text-slate-600 pt-2 border-t border-slate-100">
            <div class="flex justify-between">
              <span>Subtotal</span>
              <span class="font-semibold text-slate-900">${formatINR(totals.subtotal)}</span>
            </div>

            ${totals.discount > 0 ? `
              <div class="flex justify-between text-emerald-600 font-semibold">
                <span class="flex items-center gap-1">
                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"/></svg>
                  Discount Applied (${state.appliedPromo.code})
                </span>
                <span>-${formatINR(totals.discount)}</span>
              </div>
            ` : ''}

            <div class="flex justify-between">
              <span class="flex items-center gap-1.5">
                Shipping (${state.shippingMethod === 'express' ? 'Priority Express' : 'Standard Delivery'})
                ${totals.shipping === 0 ? '<span class="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded">FREE</span>' : ''}
              </span>
              <span class="font-semibold text-slate-900">
                ${totals.shipping === 0 ? 'FREE' : formatINR(totals.shipping)}
              </span>
            </div>

            <div class="flex justify-between">
              <span>Goods & Services Tax (GST 12%)</span>
              <span class="font-semibold text-slate-900">${formatINR(totals.tax)}</span>
            </div>

            <div class="pt-3 border-t border-slate-200 flex justify-between text-base font-bold text-slate-900">
              <span>Total Payable</span>
              <span class="text-2xl text-slate-900 font-bold">${formatINR(totals.total)}</span>
            </div>
          </div>

          <!-- Trust Badges -->
          <div class="mt-6 pt-4 border-t border-slate-100 flex items-center justify-around text-slate-400 text-[11px]">
            <div class="flex items-center gap-1">
              <svg class="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>
              <span>100% Genuine & Encrypted</span>
            </div>
            <span>•</span>
            <div class="flex items-center gap-1">
              <svg class="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
              <span>Easy 15-Day Returns</span>
            </div>
          </div>
        </div>

      </div>

    </div>
  `;
}

// Step 1: Shipping Form (India)
function renderShippingStep() {
  const s = state.shippingData;

  return `
    <div>
      <div class="flex items-center justify-between mb-6 pb-4 border-b border-slate-100">
        <div>
          <h2 class="text-xl font-serif font-bold text-slate-900">1. Delivery Address across India</h2>
          <p class="text-xs text-slate-500 mt-0.5">Please provide your delivery destination</p>
        </div>
        <button 
          type="button" 
          onclick="autoFillSampleShipping()" 
          class="px-3 py-1.5 rounded-xl bg-amber-50 text-amber-900 border border-amber-200 text-xs font-semibold hover:bg-amber-100 transition flex items-center gap-1.5 shadow-sm"
        >
          <svg class="w-3.5 h-3.5 text-amber-600" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clip-rule="evenodd"/></svg>
          ⚡ Auto-Fill Sample Address
        </button>
      </div>

      <form id="shippingForm" onsubmit="event.preventDefault(); proceedToPayment();" class="space-y-4">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label class="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">First Name *</label>
            <input 
              type="text" 
              id="shipFirstName" 
              required 
              value="${s.firstName}" 
              class="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-slate-900 focus:outline-none"
            />
          </div>
          <div>
            <label class="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">Last Name *</label>
            <input 
              type="text" 
              id="shipLastName" 
              required 
              value="${s.lastName}" 
              class="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-slate-900 focus:outline-none"
            />
          </div>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label class="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">Email (For Order Updates) *</label>
            <input 
              type="email" 
              id="shipEmail" 
              required 
              value="${s.email}" 
              class="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-slate-900 focus:outline-none"
            />
          </div>
          <div>
            <label class="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">Mobile Number (With +91) *</label>
            <input 
              type="tel" 
              id="shipPhone" 
              required 
              value="${s.phone}" 
              class="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-slate-900 focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label class="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">Flat, House No., Building, Street *</label>
          <input 
            type="text" 
            id="shipAddress" 
            required 
            value="${s.address}" 
            placeholder="e.g. Flat 402, Palm Heights, 12th Main Rd"
            class="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-slate-900 focus:outline-none"
          />
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label class="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">Landmark / Locality</label>
            <input 
              type="text" 
              id="shipApt" 
              value="${s.apt}" 
              placeholder="e.g. Near Indiranagar Metro"
              class="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-slate-900 focus:outline-none"
            />
          </div>
          <div>
            <label class="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">City *</label>
            <input 
              type="text" 
              id="shipCity" 
              required 
              value="${s.city}" 
              class="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-slate-900 focus:outline-none"
            />
          </div>
          <div>
            <label class="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">State & PIN Code *</label>
            <div class="flex gap-2">
              <input 
                type="text" 
                id="shipState" 
                required 
                value="${s.state}" 
                placeholder="Karnataka"
                class="w-1/2 px-3 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-slate-900 focus:outline-none"
              />
              <input 
                type="text" 
                id="shipZip" 
                required 
                value="${s.zip}" 
                placeholder="560038"
                class="w-1/2 px-3 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-slate-900 focus:outline-none"
              />
            </div>
          </div>
        </div>

        <!-- Shipping Speed Options (India) -->
        <div class="mt-6 pt-5 border-t border-slate-100">
          <label class="block text-xs font-semibold text-slate-800 uppercase tracking-wider mb-3">Select Delivery Speed</label>
          <div class="space-y-3">
            <label class="flex items-center justify-between p-3.5 rounded-2xl border cursor-pointer transition ${state.shippingMethod === 'standard' ? 'border-slate-900 bg-slate-50 ring-1 ring-slate-900' : 'border-slate-200 hover:border-slate-300'}">
              <div class="flex items-center gap-3">
                <input 
                  type="radio" 
                  name="shippingOption" 
                  value="standard" 
                  ${state.shippingMethod === 'standard' ? 'checked' : ''} 
                  onchange="setShippingMethod('standard')" 
                  class="text-slate-900 focus:ring-slate-900"
                />
                <div>
                  <div class="text-sm font-semibold text-slate-900">Standard Air Express (3–5 Days)</div>
                  <div class="text-xs text-slate-500">Tracked air-express via BlueDart / Delhivery</div>
                </div>
              </div>
              <div class="text-sm font-bold text-slate-900">
                ${state.appliedPromo && state.appliedPromo.code === 'FREESHIP' ? '<span class="text-emerald-600">FREE (Coupon)</span>' : (calculateTotals().isFreeShippingThreshold ? '<span class="text-emerald-600">FREE (Over ₹1,999)</span>' : '₹149')}
              </div>
            </label>

            <label class="flex items-center justify-between p-3.5 rounded-2xl border cursor-pointer transition ${state.shippingMethod === 'express' ? 'border-slate-900 bg-slate-50 ring-1 ring-slate-900' : 'border-slate-200 hover:border-slate-300'}">
              <div class="flex items-center gap-3">
                <input 
                  type="radio" 
                  name="shippingOption" 
                  value="express" 
                  ${state.shippingMethod === 'express' ? 'checked' : ''} 
                  onchange="setShippingMethod('express')" 
                  class="text-slate-900 focus:ring-slate-900"
                />
                <div>
                  <div class="text-sm font-semibold text-slate-900 flex items-center gap-2">
                    Priority Next-Day Air Express (1–2 Days)
                    <span class="text-[10px] bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded-full">FASTEST</span>
                  </div>
                  <div class="text-xs text-slate-500">Guaranteed expedited transit to major metro cities</div>
                </div>
              </div>
              <div class="text-sm font-bold text-slate-900">
                ${state.appliedPromo && state.appliedPromo.code === 'FREESHIP' ? '₹150 <span class="text-xs text-emerald-600 font-normal">(-₹149 promo)</span>' : '₹299'}
              </div>
            </label>
          </div>
        </div>

        <div class="pt-6">
          <button 
            type="submit" 
            class="w-full py-4 bg-slate-900 text-white rounded-2xl font-semibold text-sm hover:bg-slate-800 transition shadow-lg flex items-center justify-center gap-2"
          >
            <span>Proceed to Payment Method</span>
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3"/></svg>
          </button>
        </div>
      </form>
    </div>
  `;
}

function setShippingMethod(method) {
  state.shippingMethod = method;
  renderCheckout();
}

function autoFillSampleShipping() {
  state.shippingData = {
    firstName: 'Ananya',
    lastName: 'Sharma',
    email: 'ananya.sharma@example.com',
    phone: '+91 98765 43210',
    address: 'Flat 402, Palm Heights, 12th Main Rd',
    apt: 'Indiranagar (Near Metro)',
    city: 'Bengaluru',
    state: 'Karnataka',
    zip: '560038',
    country: 'India'
  };
  showToast("Address Loaded", "Sample Bengaluru delivery details populated.", "success");
  renderCheckout();
}

function proceedToPayment() {
  const fn = document.getElementById('shipFirstName');
  const ln = document.getElementById('shipLastName');
  const em = document.getElementById('shipEmail');
  const ph = document.getElementById('shipPhone');
  const ad = document.getElementById('shipAddress');
  const ap = document.getElementById('shipApt');
  const ci = document.getElementById('shipCity');
  const st = document.getElementById('shipState');
  const zp = document.getElementById('shipZip');

  if (fn && ln && em && ad) {
    state.shippingData = {
      firstName: fn.value,
      lastName: ln.value,
      email: em.value,
      phone: ph ? ph.value : '',
      address: ad.value,
      apt: ap ? ap.value : '',
      city: ci ? ci.value : '',
      state: st ? st.value : '',
      zip: zp ? zp.value : '',
      country: 'India'
    };
  }

  state.checkoutStep = 2;
  renderCheckout();
  window.scrollTo({ top: 120, behavior: 'smooth' });
}

// Step 2: Payment Form (India: UPI, Cards, NetBanking, COD)
function renderPaymentStep() {
  const p = state.paymentData;

  return `
    <div>
      <div class="flex items-center justify-between mb-6 pb-4 border-b border-slate-100">
        <div>
          <h2 class="text-xl font-serif font-bold text-slate-900">2. Indian Payment Gateway</h2>
          <p class="text-xs text-slate-500 mt-0.5">Instant UPI, RuPay/Cards, NetBanking, or COD</p>
        </div>
        <button 
          type="button" 
          onclick="autoFillSampleCard()" 
          class="px-3 py-1.5 rounded-xl bg-amber-50 text-amber-900 border border-amber-200 text-xs font-semibold hover:bg-amber-100 transition flex items-center gap-1.5 shadow-sm"
        >
          <svg class="w-3.5 h-3.5 text-amber-600" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clip-rule="evenodd"/></svg>
          ⚡ Auto-Fill Test Payment
        </button>
      </div>

      <!-- Payment Method Selection Tabs -->
      <div class="grid grid-cols-4 gap-2 mb-6">
        <button 
          type="button" 
          onclick="setPaymentMethodType('upi')" 
          class="py-3 px-2 rounded-2xl border text-xs font-semibold flex flex-col items-center gap-1 transition ${p.method === 'upi' ? 'border-slate-900 bg-slate-900 text-white shadow-md' : 'border-slate-200 text-slate-700 hover:border-slate-300'}"
        >
          <span class="text-sm font-bold text-emerald-400">UPI / QR</span>
          <span class="text-[10px] text-slate-400">GPay, PhonePe</span>
        </button>
        <button 
          type="button" 
          onclick="setPaymentMethodType('card')" 
          class="py-3 px-2 rounded-2xl border text-xs font-semibold flex flex-col items-center gap-1 transition ${p.method === 'card' ? 'border-slate-900 bg-slate-900 text-white shadow-md' : 'border-slate-200 text-slate-700 hover:border-slate-300'}"
        >
          <span class="text-sm font-bold">RuPay / Card</span>
          <span class="text-[10px] text-slate-400">Credit / Debit</span>
        </button>
        <button 
          type="button" 
          onclick="setPaymentMethodType('netbanking')" 
          class="py-3 px-2 rounded-2xl border text-xs font-semibold flex flex-col items-center gap-1 transition ${p.method === 'netbanking' ? 'border-slate-900 bg-slate-900 text-white shadow-md' : 'border-slate-200 text-slate-700 hover:border-slate-300'}"
        >
          <span class="text-sm font-bold text-sky-400">NetBanking</span>
          <span class="text-[10px] text-slate-400">HDFC, ICICI, SBI</span>
        </button>
        <button 
          type="button" 
          onclick="setPaymentMethodType('cod')" 
          class="py-3 px-2 rounded-2xl border text-xs font-semibold flex flex-col items-center gap-1 transition ${p.method === 'cod' ? 'border-slate-900 bg-slate-900 text-white shadow-md' : 'border-slate-200 text-slate-700 hover:border-slate-300'}"
        >
          <span class="text-sm font-bold text-amber-400">COD</span>
          <span class="text-[10px] text-slate-400">Pay on Delivery</span>
        </button>
      </div>

      ${p.method === 'upi' ? `
        <!-- UPI Payment Form & Quick Apps -->
        <div class="p-5 bg-slate-50 rounded-2xl border border-slate-200 mb-6">
          <div class="flex items-center justify-between mb-4">
            <span class="text-xs font-bold uppercase tracking-wider text-slate-800">Instant UPI Payment</span>
            <div class="flex items-center gap-2 text-xs font-medium text-slate-500">
              <span class="px-2 py-0.5 bg-white rounded border text-emerald-700 font-bold">Google Pay</span>
              <span class="px-2 py-0.5 bg-white rounded border text-indigo-700 font-bold">PhonePe</span>
              <span class="px-2 py-0.5 bg-white rounded border text-sky-700 font-bold">Paytm</span>
            </div>
          </div>

          <label class="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">Enter Virtual Payment Address (VPA / UPI ID) *</label>
          <div class="relative mb-3">
            <input 
              type="text" 
              id="payUpiId" 
              required 
              value="${p.upiId || 'ananya.sharma@okhdfcbank'}" 
              placeholder="e.g. mobile@upi or yourname@okhdfcbank"
              class="w-full pl-3.5 pr-24 py-2.5 text-sm bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-slate-900 focus:outline-none"
            />
            <button 
              type="button" 
              onclick="showToast('UPI Verified', 'VPA verified with NPCI bank network.', 'success')" 
              class="absolute right-2 top-2 px-3 py-1 bg-slate-900 text-white text-xs font-semibold rounded-lg hover:bg-slate-800"
            >
              Verify
            </button>
          </div>
          <p class="text-[11px] text-slate-500">A payment collect request will be simulated on your UPI app after clicking Review.</p>
        </div>
      ` : ''}

      ${p.method === 'card' ? `
        <!-- Live Interactive Card Preview Graphic -->
        <div class="mb-6">
          <div class="credit-card-mockup p-6 max-w-sm mx-auto aspect-[1.58/1] flex flex-col justify-between shadow-2xl">
            <div class="flex items-center justify-between">
              <div class="chip"></div>
              <div class="flex items-center gap-2">
                <span class="text-[10px] bg-white/20 px-2 py-0.5 rounded text-white tracking-widest">RuPay / VISA</span>
                <span class="font-serif text-lg tracking-widest font-bold text-white/90">ATELIER 24</span>
              </div>
            </div>

            <div class="my-auto pt-2">
              <div class="text-xl sm:text-2xl font-mono tracking-widest text-slate-100 font-medium" id="cardDisplayNumber">
                ${p.cardNumber || '•••• •••• •••• ••••'}
              </div>
            </div>

            <div class="flex items-end justify-between text-xs tracking-wider uppercase text-slate-300">
              <div>
                <div class="text-[9px] text-slate-400 font-sans">Cardholder</div>
                <div class="font-semibold text-white tracking-wider" id="cardDisplayName">${p.cardName || 'ANANYA SHARMA'}</div>
              </div>
              <div>
                <div class="text-[9px] text-slate-400 font-sans">Valid Thru</div>
                <div class="font-semibold text-white" id="cardDisplayExp">${p.expDate || 'MM/YY'}</div>
              </div>
              <div class="font-bold text-base text-white/90 italic tracking-wider">
                RuPay
              </div>
            </div>
          </div>
        </div>

        <!-- Card Inputs Form -->
        <div class="space-y-4 mb-6">
          <div>
            <label class="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">Cardholder Name *</label>
            <input 
              type="text" 
              id="payCardName" 
              required 
              value="${p.cardName}" 
              placeholder="ANANYA SHARMA"
              oninput="document.getElementById('cardDisplayName').textContent = this.value.toUpperCase() || 'YOUR NAME'"
              class="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-slate-900 focus:outline-none uppercase"
            />
          </div>

          <div>
            <label class="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">Card Number *</label>
            <div class="relative">
              <input 
                type="text" 
                id="payCardNumber" 
                required 
                maxlength="19"
                value="${p.cardNumber}" 
                placeholder="5312 •••• •••• 6789"
                oninput="formatCardInput(this)"
                class="w-full pl-3.5 pr-12 py-2.5 text-sm font-mono bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-slate-900 focus:outline-none"
              />
              <div class="absolute right-3.5 top-2.5 text-slate-400 font-bold text-xs">
                RuPay/Visa
              </div>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">Expiry Date *</label>
              <input 
                type="text" 
                id="payExpDate" 
                required 
                maxlength="5"
                value="${p.expDate}" 
                placeholder="MM/YY"
                oninput="formatExpInput(this)"
                class="w-full px-3.5 py-2.5 text-sm font-mono bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-slate-900 focus:outline-none"
              />
            </div>
            <div>
              <label class="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">CVV / CVV2 *</label>
              <input 
                type="password" 
                id="payCvv" 
                required 
                maxlength="4"
                value="${p.cvv}" 
                placeholder="582"
                class="w-full px-3.5 py-2.5 text-sm font-mono bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-slate-900 focus:outline-none"
              />
            </div>
          </div>
        </div>
      ` : ''}

      ${p.method === 'netbanking' ? `
        <div class="p-5 bg-slate-50 rounded-2xl border border-slate-200 mb-6 space-y-3">
          <label class="block text-xs font-semibold text-slate-800 uppercase tracking-wider">Select Bank</label>
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <button type="button" class="p-3 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 hover:border-slate-900">HDFC Bank</button>
            <button type="button" class="p-3 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 hover:border-slate-900">ICICI Bank</button>
            <button type="button" class="p-3 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 hover:border-slate-900">State Bank of India</button>
            <button type="button" class="p-3 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 hover:border-slate-900">Axis Bank</button>
          </div>
        </div>
      ` : ''}

      ${p.method === 'cod' ? `
        <div class="p-5 bg-amber-50 rounded-2xl border border-amber-200 mb-6 flex items-start gap-3">
          <svg class="w-6 h-6 text-amber-700 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
          <div>
            <h4 class="text-sm font-bold text-amber-900">Cash on Delivery (COD) Available</h4>
            <p class="text-xs text-amber-800 mt-1 leading-relaxed">Pay with cash or UPI QR code directly to the courier executive upon doorstep delivery. No advance payment required.</p>
          </div>
        </div>
      ` : ''}

      <div class="pt-4 grid grid-cols-2 gap-3">
        <button 
          type="button" 
          onclick="state.checkoutStep = 1; renderCheckout();" 
          class="py-3.5 px-4 rounded-xl border border-slate-300 text-slate-700 font-semibold text-xs hover:bg-slate-100 transition"
        >
          ← Back to Delivery
        </button>
        <button 
          type="button" 
          onclick="proceedToReview()" 
          class="py-3.5 px-4 bg-slate-900 text-white rounded-xl font-semibold text-xs hover:bg-slate-800 transition shadow-lg flex items-center justify-center gap-2"
        >
          <span>Continue to Review</span>
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3"/></svg>
        </button>
      </div>
    </div>
  `;
}

function formatCardInput(input) {
  let val = input.value.replace(/\D/g, '');
  let formatted = '';
  for (let i = 0; i < val.length; i++) {
    if (i > 0 && i % 4 === 0) formatted += ' ';
    formatted += val[i];
  }
  input.value = formatted;
  const display = document.getElementById('cardDisplayNumber');
  if (display) display.textContent = formatted || '•••• •••• •••• ••••';
}

function formatExpInput(input) {
  let val = input.value.replace(/\D/g, '');
  if (val.length >= 2) {
    val = val.substring(0, 2) + '/' + val.substring(2, 4);
  }
  input.value = val;
  const display = document.getElementById('cardDisplayExp');
  if (display) display.textContent = val || 'MM/YY';
}

function setPaymentMethodType(method) {
  state.paymentData.method = method;
  renderCheckout();
}

function autoFillSampleCard() {
  state.paymentData = {
    method: 'upi',
    upiId: 'ananya.sharma@okhdfcbank',
    cardName: 'ANANYA SHARMA',
    cardNumber: '5312 8901 2345 6789',
    expDate: '09/29',
    cvv: '582',
    saveCard: true
  };
  showToast("Sample Payment Loaded", "UPI ID & RuPay details populated.", "success");
  renderCheckout();
}

function proceedToReview() {
  const upi = document.getElementById('payUpiId');
  const cn = document.getElementById('payCardName');
  const num = document.getElementById('payCardNumber');
  const exp = document.getElementById('payExpDate');
  const cvv = document.getElementById('payCvv');

  if (upi) state.paymentData.upiId = upi.value;
  if (cn) state.paymentData.cardName = cn.value.toUpperCase();
  if (num) state.paymentData.cardNumber = num.value;
  if (exp) state.paymentData.expDate = exp.value;
  if (cvv) state.paymentData.cvv = cvv.value;

  state.checkoutStep = 3;
  renderCheckout();
  window.scrollTo({ top: 120, behavior: 'smooth' });
}

// Step 3: Review & Place Order
function renderReviewStep(totals) {
  const s = state.shippingData;
  const p = state.paymentData;
  const last4 = (p.cardNumber.replace(/\s/g, '').slice(-4)) || '6789';

  let paymentSummaryHtml = '';
  if (p.method === 'upi') {
    paymentSummaryHtml = `
      <div class="text-sm font-semibold text-slate-900 flex items-center gap-2">
        <span class="text-xs font-bold bg-emerald-700 text-white px-2 py-0.5 rounded">UPI</span>
        <span>${p.upiId || 'ananya.sharma@okhdfcbank'}</span>
      </div>
      <div class="text-xs text-slate-600 mt-1">Instant App Verification • Zero Surcharge</div>
    `;
  } else if (p.method === 'card') {
    paymentSummaryHtml = `
      <div class="text-sm font-semibold text-slate-900 flex items-center gap-2">
        <span class="text-xs font-bold bg-slate-900 text-white px-2 py-0.5 rounded">RuPay / VISA</span>
        <span>Ending in •••• ${last4}</span>
      </div>
      <div class="text-xs text-slate-600 mt-1">
        Name: <span class="font-medium text-slate-800">${p.cardName}</span> • Exp: ${p.expDate}
      </div>
    `;
  } else if (p.method === 'cod') {
    paymentSummaryHtml = `
      <div class="text-sm font-semibold text-amber-900 flex items-center gap-2">
        <span class="text-xs font-bold bg-amber-600 text-white px-2 py-0.5 rounded">COD</span>
        <span>Cash / UPI on Delivery</span>
      </div>
      <div class="text-xs text-slate-600 mt-1">Pay when your order arrives at doorstep</div>
    `;
  } else {
    paymentSummaryHtml = `
      <div class="text-sm font-semibold text-slate-900">NetBanking (HDFC Bank)</div>
      <div class="text-xs text-slate-600 mt-1">Direct bank debit via secure 2FA</div>
    `;
  }

  return `
    <div>
      <div class="mb-6 pb-4 border-b border-slate-100">
        <h2 class="text-xl font-serif font-bold text-slate-900">3. Final Review & Place Order</h2>
        <p class="text-xs text-slate-500 mt-0.5">Please review your delivery and payment details</p>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <!-- Shipping Summary -->
        <div class="p-4 bg-slate-50 rounded-2xl border border-slate-200">
          <div class="flex items-center justify-between mb-2">
            <span class="text-xs font-semibold uppercase text-slate-500 tracking-wider">Delivery To</span>
            <button onclick="state.checkoutStep = 1; renderCheckout();" class="text-xs font-semibold text-slate-900 underline">Edit</button>
          </div>
          <div class="text-sm font-semibold text-slate-900">${s.firstName} ${s.lastName}</div>
          <div class="text-xs text-slate-600 mt-1 leading-relaxed">
            ${s.address} ${s.apt ? ', ' + s.apt : ''}<br />
            ${s.city}, ${s.state} — ${s.zip}<br />
            ${s.phone} • ${s.email}
          </div>
          <div class="mt-2 text-xs font-medium text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg inline-block">
            ${state.shippingMethod === 'express' ? 'Priority Express (1–2 Days)' : 'Standard Air Express (3–5 Days)'}
          </div>
        </div>

        <!-- Payment Summary -->
        <div class="p-4 bg-slate-50 rounded-2xl border border-slate-200">
          <div class="flex items-center justify-between mb-2">
            <span class="text-xs font-semibold uppercase text-slate-500 tracking-wider">Payment Mode</span>
            <button onclick="state.checkoutStep = 2; renderCheckout();" class="text-xs font-semibold text-slate-900 underline">Edit</button>
          </div>
          ${paymentSummaryHtml}
          <div class="mt-2 text-xs text-slate-500 flex items-center gap-1">
            <svg class="w-3.5 h-3.5 text-emerald-600" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 1.944A11.954 11.954 0 012.166 5C2.056 5.649 2 6.319 2 7c0 5.225 3.34 9.67 8 11.317C14.66 16.67 18 12.225 18 7c0-.682-.057-1.35-.166-2.001A11.954 11.954 0 0110 1.944zM11 14a1 1 0 11-2 0 1 1 0 012 0zm0-7a1 1 0 10-2 0v3a1 1 0 102 0V7z" clip-rule="evenodd"/></svg>
            <span>RBI / NPCI 256-bit encryption verified</span>
          </div>
        </div>
      </div>

      <!-- Applied Promo Banner (if active) -->
      ${state.appliedPromo ? `
        <div class="mb-6 p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div class="p-2 bg-emerald-600 text-white rounded-xl">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"/></svg>
            </div>
            <div>
              <div class="text-xs font-bold uppercase tracking-wider">Coupon Code Active: ${state.appliedPromo.code}</div>
              <div class="text-xs text-emerald-700">${state.appliedPromo.description}</div>
            </div>
          </div>
          <span class="text-xs font-bold bg-white text-emerald-800 px-3 py-1 rounded-full shadow-sm">
            Saved ${totals.discount > 0 ? formatINR(totals.discount) : '₹149'}
          </span>
        </div>
      ` : ''}

      <!-- Final Place Order Button with Loading State -->
      <div class="pt-2">
        <button 
          id="btnPlaceOrder"
          onclick="executePlaceOrder()" 
          class="w-full py-4 px-6 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl font-bold text-base shadow-xl transition-all duration-300 flex items-center justify-center gap-3 relative overflow-hidden group"
          ${state.isProcessingPayment ? 'disabled' : ''}
        >
          ${state.isProcessingPayment ? `
            <div class="flex items-center gap-3">
              <svg class="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span id="processingStatusLabel" class="tracking-wide">${state.processingStepText}</span>
            </div>
          ` : `
            <span class="tracking-wide">Complete Purchase & Place Order • ${formatINR(totals.total)}</span>
            <svg class="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3"/></svg>
          `}
        </button>

        <p class="text-center text-[11px] text-slate-400 mt-3">
          By placing your order, you agree to ATELIER 24's Terms of Sale, GST Compliance, and Privacy Policy.
        </p>
      </div>
    </div>
  `;
}

// Complete Purchase Simulation (Loading State & Transition)
function executePlaceOrder() {
  if (state.isProcessingPayment) return;
  state.isProcessingPayment = true;
  state.processingStepText = "Connecting to Indian Payment Gateway...";
  renderCheckout();

  setTimeout(() => {
    state.processingStepText = "Securing inventory & reserving pieces...";
    const label = document.getElementById('processingStatusLabel');
    if (label) label.textContent = state.processingStepText;
  }, 500);

  setTimeout(() => {
    state.processingStepText = "Generating GST tax invoice receipt...";
    const label = document.getElementById('processingStatusLabel');
    if (label) label.textContent = state.processingStepText;
  }, 1000);

  setTimeout(() => {
    const totals = calculateTotals();
    const mockOrderId = "#ORD-IN" + Math.floor(10000 + Math.random() * 90000);
    const last4 = (state.paymentData.cardNumber.replace(/\s/g, '').slice(-4)) || '6789';

    state.completedOrder = {
      orderId: mockOrderId,
      orderDate: new Date().toLocaleDateString('en-IN', { month: 'long', day: 'numeric', year: 'numeric' }),
      orderTime: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
      items: [...state.cart],
      totals: { ...totals },
      shippingAddress: { ...state.shippingData },
      shippingMethod: state.shippingMethod,
      paymentSummary: {
        method: state.paymentData.method,
        upiId: state.paymentData.upiId,
        cardName: state.paymentData.cardName,
        last4: last4
      },
      appliedPromo: state.appliedPromo ? { ...state.appliedPromo } : null
    };

    // Report redemption to C24 Promo Tracking Service (backend integration)
    if (state.appliedPromo) {
      const promoCode = state.appliedPromo.code;
      const cleanOrderId = mockOrderId.replace('#', '');
      const pseudoCustomerId = 'CUST-' + Math.floor(1000 + Math.random() * 9000);
      const nowIso = new Date().toISOString();
      const subtotalVal = totals.subtotal || 1;
      const discountVal = totals.discount || 0;

      const reportPayload = {
        order_id: cleanOrderId,
        customer_id: pseudoCustomerId,
        promo_code: promoCode,
        used_at: nowIso,
        payment_confirmed_at: nowIso,
        discount_inr: discountVal,
        items: (() => {
          let allocatedDiscSoFar = 0;
          return state.cart.map((it, idx) => {
            let lineDisc = 0;
            if (idx === state.cart.length - 1) {
              lineDisc = Math.max(0, Math.round((discountVal - allocatedDiscSoFar) * 100) / 100);
            } else {
              const lineGross = it.price * it.quantity;
              lineDisc = Math.round(((discountVal * lineGross) / subtotalVal) * 100) / 100;
              allocatedDiscSoFar += lineDisc;
            }
            return {
              product_id: 'PRD-' + it.productId,
              name: it.title,
              unit_price_inr: it.price,
              quantity: it.quantity,
              line_discount_inr: lineDisc
            };
          });
        })()
      };

      // Report via secure backend proxy (/api/order) which injects C24_WEBSITE_KEY server-side
      fetch('/api/order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(reportPayload)
      }).then(r => r.json()).then(data => {
        console.log('[C24 Promo Sync] Order reported securely through backend proxy:', data);
      }).catch(err => {
        console.warn('[C24 Promo Sync] Failed to report order via proxy:', err);
      });
    }

    // Reset Cart & State
    state.cart = [];
    state.appliedPromo = null;
    state.promoInput = '';
    state.promoMessage = null;
    state.isProcessingPayment = false;
    state.checkoutStep = 1;
    updateCartBadge();

    // Navigate to confirmation page
    navigateTo('confirmation');

    // Confetti celebration
    triggerConfetti();

    showToast("Order Confirmed!", `Order ${mockOrderId} placed successfully.`, "success");
  }, 1600);
}

// Confetti Effect
function triggerConfetti() {
  if (typeof confetti === 'function') {
    confetti({
      particleCount: 140,
      spread: 75,
      origin: { y: 0.6 }
    });
    setTimeout(() => {
      confetti({
        particleCount: 70,
        angle: 60,
        spread: 55,
        origin: { x: 0 }
      });
      confetti({
        particleCount: 70,
        angle: 120,
        spread: 55,
        origin: { x: 1 }
      });
    }, 250);
  }
}

// Render Order Confirmation Page
function renderConfirmation() {
  const container = document.getElementById('confirmationContainer');
  if (!container || !state.completedOrder) return;

  const order = state.completedOrder;
  const s = order.shippingAddress;
  const p = order.paymentSummary;

  let paymentText = 'Online Payment';
  if (p.method === 'upi') paymentText = `UPI (${p.upiId || 'Verified'})`;
  else if (p.method === 'card') paymentText = `RuPay / Visa ending in •••• ${p.last4}`;
  else if (p.method === 'cod') paymentText = 'Cash / UPI on Delivery';
  else paymentText = 'NetBanking';

  container.innerHTML = `
    <div id="printableReceipt" class="max-w-3xl mx-auto bg-white rounded-3xl p-6 sm:p-10 border border-slate-200/80 shadow-lg">
      
      <!-- Success Icon & Header -->
      <div class="text-center pb-8 border-b border-slate-100">
        <div class="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4 ring-8 ring-emerald-50">
          <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/></svg>
        </div>

        <span class="text-xs font-bold uppercase tracking-widest text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full">Order Verified • GST Invoice Generated</span>
        <h1 class="text-3xl sm:text-4xl font-serif font-bold text-slate-900 mt-3 mb-2">Thank you for your order!</h1>
        <p class="text-sm text-slate-500 max-w-md mx-auto">
          We've received your order and sent SMS & Email confirmations to <span class="font-semibold text-slate-800">${s.phone}</span> and <span class="font-semibold text-slate-800">${s.email}</span>.
        </p>

        <!-- Mock Order ID Tag -->
        <div class="mt-4 inline-flex items-center gap-2 bg-slate-100 px-4 py-2 rounded-2xl border border-slate-200">
          <span class="text-xs text-slate-500 uppercase font-semibold">Order ID:</span>
          <span class="text-base font-mono font-bold text-slate-900 tracking-wider">${order.orderId}</span>
        </div>
      </div>

      <!-- Quick Delivery & Address Grid -->
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 py-6 border-b border-slate-100 text-xs">
        <div>
          <span class="font-semibold uppercase tracking-wider text-slate-400 block mb-1">Date & Time</span>
          <span class="font-medium text-slate-900 text-sm">${order.orderDate}</span>
          <span class="text-slate-500 block text-[11px]">${order.orderTime} IST</span>
        </div>
        <div>
          <span class="font-semibold uppercase tracking-wider text-slate-400 block mb-1">Delivering To</span>
          <span class="font-medium text-slate-900 text-sm">${s.firstName} ${s.lastName}</span>
          <span class="text-slate-500 block text-[11px]">${s.address}, ${s.city}, ${s.state} — ${s.zip}</span>
        </div>
        <div>
          <span class="font-semibold uppercase tracking-wider text-slate-400 block mb-1">Payment Method</span>
          <span class="font-medium text-slate-900 text-sm">${paymentText}</span>
          <span class="text-slate-500 block text-[11px]">Authorized & GST Paid</span>
        </div>
      </div>

      <!-- Itemized Purchased Products List -->
      <div class="py-6 border-b border-slate-100">
        <h3 class="text-sm font-bold uppercase tracking-wider text-slate-900 mb-4">Ordered Pieces</h3>
        <div class="space-y-4">
          ${order.items.map(item => `
            <div class="flex items-center justify-between gap-4">
              <div class="flex items-center gap-3">
                <img 
                  src="${item.image}" 
                  alt="${item.title}" 
                  class="w-14 h-16 object-cover object-top rounded-xl bg-slate-100 border border-slate-200 shrink-0" 
                  onerror="this.onerror=null; this.src='${item.fallbackUrl || DEFAULT_FALLBACK_IMG}';"
                />
                <div>
                  <h4 class="text-sm font-semibold text-slate-900">${item.title}</h4>
                  <p class="text-xs text-slate-500 mt-0.5">${item.selectedColor} • Size: ${item.selectedSize} • Qty: ${item.quantity}</p>
                </div>
              </div>
              <div class="text-right">
                <span class="text-sm font-bold text-slate-900">${formatINR(item.price * item.quantity)}</span>
                ${item.quantity > 1 ? `<span class="block text-[11px] text-slate-400">(${formatINR(item.price)} each)</span>` : ''}
              </div>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- Financial Recap in INR -->
      <div class="py-6 border-b border-slate-100 space-y-2.5 text-xs text-slate-600">
        <div class="flex justify-between">
          <span>Subtotal</span>
          <span class="font-semibold text-slate-900">${formatINR(order.totals.subtotal)}</span>
        </div>

        ${order.totals.discount > 0 ? `
          <div class="flex justify-between text-emerald-600 font-semibold">
            <span>Coupon Discount (${order.appliedPromo ? order.appliedPromo.code : 'PROMO'})</span>
            <span>-${formatINR(order.totals.discount)}</span>
          </div>
        ` : ''}

        <div class="flex justify-between">
          <span>Delivery (${order.shippingMethod === 'express' ? 'Priority Express' : 'Standard Delivery'})</span>
          <span class="font-semibold text-slate-900">
            ${order.totals.shipping === 0 ? '<span class="text-emerald-600">FREE</span>' : formatINR(order.totals.shipping)}
          </span>
        </div>

        <div class="flex justify-between">
          <span>Goods & Services Tax (GST 12%)</span>
          <span class="font-semibold text-slate-900">${formatINR(order.totals.tax)}</span>
        </div>

        <div class="pt-3 border-t border-slate-200 flex justify-between text-base font-bold text-slate-900">
          <span>Total Paid (Inclusive of Taxes)</span>
          <span class="text-2xl text-slate-900 font-bold">${formatINR(order.totals.total)}</span>
        </div>
      </div>

      <!-- Action Buttons (Print, Track, Shop Again) -->
      <div class="mt-8 flex flex-col sm:flex-row items-center justify-between gap-3 no-print">
        <button 
          onclick="window.print()" 
          class="w-full sm:w-auto py-3 px-5 rounded-xl border border-slate-300 text-slate-700 font-semibold text-xs hover:bg-slate-50 transition flex items-center justify-center gap-2"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/></svg>
          Print GST Tax Invoice
        </button>

        <div class="w-full sm:w-auto flex items-center gap-2">
          <button 
            onclick="openTrackingModal()" 
            class="flex-1 sm:flex-initial py-3 px-5 rounded-xl border border-slate-900 text-slate-900 font-semibold text-xs hover:bg-slate-900 hover:text-white transition flex items-center justify-center gap-2"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>
            Track Shipment
          </button>
          
          <button 
            onclick="navigateTo('catalog')" 
            class="flex-1 sm:flex-initial py-3 px-6 rounded-xl bg-slate-900 text-white font-semibold text-xs hover:bg-slate-800 transition shadow-md flex items-center justify-center gap-2"
          >
            <span>Continue Shopping</span>
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3"/></svg>
          </button>
        </div>
      </div>

    </div>
  `;
}

// Mock Tracking Modal
function openTrackingModal() {
  const modal = document.getElementById('trackingModal');
  if (modal && state.completedOrder) {
    const order = state.completedOrder;
    document.getElementById('trackOrderId').textContent = order.orderId;
    modal.classList.remove('hidden');
    requestAnimationFrame(() => modal.classList.remove('opacity-0'));
  }
}

function closeTrackingModal() {
  const modal = document.getElementById('trackingModal');
  if (modal) {
    modal.classList.add('opacity-0');
    setTimeout(() => modal.classList.add('hidden'), 200);
  }
}
