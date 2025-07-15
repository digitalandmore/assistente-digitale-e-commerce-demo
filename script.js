/* ==================== GLOBAL VARIABLES ==================== */
let cart = [];
let products = [];
let currentFilter = 'all';

/* ==================== INITIALIZATION ==================== */
document.addEventListener('DOMContentLoaded', async function() {
  await loadProductsFromAPI();
  loadCartFromStorage();
  updateCartDisplay();
  setupEventListeners();
  setupDisclaimer();
  setupProductFilters();
  initializeApp();
  console.log('🎾 TennisShop Pro initialized successfully');
});

/* ==================== LOAD PRODUCTS FROM BACKEND ==================== */
async function loadProductsFromAPI() {
  try {
    const res = await fetch('/api/product-info');
    const data = await res.json();
    products = Array.isArray(data.prodotti) ? data.prodotti : [];
    window.products = products; // Espone i prodotti globalmente per chat.js e altri script
    window.getProductById = id => products.find(p => p.id === id); // Utile per la chat
    renderProducts(products);
    console.log(`✅ Prodotti caricati: ${products.length}`);
  } catch (error) {
    console.error('❌ Errore caricamento prodotti:', error);
    products = [];
    window.products = products;
    renderProducts(products);
  }
}

/* ==================== RENDER PRODUCTS ==================== */
function renderProducts(productsToRender) {
  const grid = document.getElementById('productsGrid');
  if (!grid) return;
  grid.innerHTML = '';
  if (!productsToRender.length) {
    grid.innerHTML = '<div class="empty-products">Nessun prodotto disponibile.</div>';
    return;
  }
  productsToRender.forEach(product => {
    const card = document.createElement('div');
    card.className = 'product-card';
    card.innerHTML = `
      <img src="${product.image}" alt="${product.name}">
      <div class="product-info">
        <h4>${product.name}</h4>
        <p>${product.description}</p>
        <div class="product-meta">
          <span class="product-price">€${product.price.toFixed(2)}</span>
          <button class="add-to-cart-btn" onclick="addToCart(${product.id})">Aggiungi al Carrello</button>
        </div>
      </div>
    `;
    grid.appendChild(card);
  });
}


/* ==================== DISCLAIMER CHIUSURA ==================== */
document.addEventListener('DOMContentLoaded', function() {
  const closeBtn = document.querySelector('.disclaimer-close');
  const banner = document.querySelector('.disclaimer-banner');
  if (closeBtn && banner) {
    closeBtn.addEventListener('click', function() {
      banner.style.display = 'none';
    });
  }
});

/* ==================== SEARCH BAR ==================== */
document.addEventListener('DOMContentLoaded', function() {
  const searchInput = document.getElementById('searchInput');
  if (!searchInput) return;
  let previewBox = document.getElementById('searchPreviewBox');
  if (!previewBox) {
    previewBox = document.createElement('div');
    previewBox.id = 'searchPreviewBox';
    previewBox.style.position = 'absolute';
    previewBox.style.background = '#fff';
    previewBox.style.boxShadow = '0 4px 16px rgba(0,0,0,0.10)';
    previewBox.style.borderRadius = '8px';
    previewBox.style.zIndex = '1200';
    previewBox.style.width = searchInput.offsetWidth + 'px';
    previewBox.style.maxHeight = '320px';
    previewBox.style.overflowY = 'auto';
    previewBox.style.display = 'none';
    document.body.appendChild(previewBox);
  }

  function positionPreviewBox() {
    const rect = searchInput.getBoundingClientRect();
    previewBox.style.width = rect.width + 'px';
    previewBox.style.left = rect.left + window.scrollX + 'px';
    previewBox.style.top = rect.bottom + window.scrollY + 'px';
  }

  searchInput.addEventListener('input', function() {
    const query = this.value.trim().toLowerCase();
    positionPreviewBox();
    if (!query) {
      previewBox.style.display = 'none';
      window.filterProducts('category', currentFilter);
      return;
    }
    const filtered = products.filter(p =>
      (p.name && p.name.toLowerCase().includes(query)) ||
      (p.description && p.description.toLowerCase().includes(query))
    );
    if (filtered.length === 0) {
      previewBox.innerHTML = '<div style="padding: 12px; color: #888;">Nessun prodotto trovato</div>';
      previewBox.style.display = 'block';
      return;
    }
    previewBox.innerHTML = filtered.slice(0, 5).map(p => `
      <div class="search-preview-item" style="display:flex;align-items:center;gap:12px;padding:10px 14px;cursor:pointer;border-bottom:1px solid #f0f0f0;" data-id="${p.id}">
        <img src="${p.image}" alt="${p.name}" style="width:40px;height:40px;object-fit:cover;border-radius:6px;">
        <div style="flex:1;min-width:0;">
          <div style="font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${p.name}</div>
          <div style="font-size:13px;color:#888;">€${p.price.toFixed(2)}</div>
        </div>
        <span class="add-to-cart-icon" title="Aggiungi al carrello" style="color:#1a8917;font-size:20px;min-width:24px;display:flex;align-items:center;justify-content:center;cursor:pointer;">
          <i class="fas fa-cart-plus"></i>
        </span>
      </div>
    `).join('');
    previewBox.style.display = 'block';

    // Click su preview: filtra e scrolla ai prodotti
    previewBox.querySelectorAll('.search-preview-item').forEach(item => {
      item.addEventListener('click', function(e) {
        // Se il click è sull'icona carrello, aggiungi al carrello
        if (e.target.closest('.add-to-cart-icon')) {
          const id = parseInt(this.getAttribute('data-id'));
          addToCart(id);
          // Effetto feedback (es: cambia colore icona per 1s)
          const icon = this.querySelector('.add-to-cart-icon');
          if (icon) {
            icon.style.color = '#ff9800';
            setTimeout(() => { icon.style.color = '#1a8917'; }, 800);
          }
          return;
        }
        // Altrimenti filtra per prodotto
        const id = parseInt(this.getAttribute('data-id'));
        const prod = products.find(p => p.id === id);
        if (prod) {
          renderProducts([prod]);
          previewBox.style.display = 'none';
          searchInput.value = prod.name;
          const productsSection = document.getElementById('products');
          if (productsSection) productsSection.scrollIntoView({ behavior: 'smooth' });
        }
      });
    });
  });

  window.addEventListener('scroll', positionPreviewBox);
  window.addEventListener('resize', positionPreviewBox);

  searchInput.addEventListener('blur', function() {
    setTimeout(() => { previewBox.style.display = 'none'; }, 200);
  });
  previewBox.addEventListener('mousedown', function(e) {
    e.preventDefault();
  });
});

/* ==================== CATEGORIES FILTER ==================== */
document.addEventListener('DOMContentLoaded', function() {
  document.querySelectorAll('.categories-grid .category-card').forEach(card => {
    card.style.cursor = 'pointer';
    card.addEventListener('click', function() {
      const category = this.getAttribute('data-category');
      if (category) {
        window.filterProducts('category', category);
        document.querySelectorAll('.filter-btn').forEach(btn => {
          if (btn.getAttribute('data-filter') === category) {
            btn.classList.add('active');
          } else {
            btn.classList.remove('active');
          }
        });
        const productsSection = document.getElementById('products');
        if (productsSection) {
          productsSection.scrollIntoView({ behavior: 'smooth' });
        }
      }
    });
  });
});

/* ==================== FILTER PRODUCTS ==================== */
function setupProductFilters() {
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      this.classList.add('active');
      const filter = this.getAttribute('data-filter');
      currentFilter = filter;
      window.filterProducts('category', filter);
    });
  });
}

window.filterProducts = function(type, value) {
  let filtered = [];
  if (type === 'category') {
    if (value === 'all') {
      filtered = products;
    } else {
      filtered = products.filter(p =>
        (p.category || '').toLowerCase() === value.toLowerCase()
      );
    }
  } else if (type === 'brand') {
    filtered = products.filter(p =>
      (p.brand || '').toLowerCase() === value.toLowerCase()
    );
  }
  renderProducts(filtered);
};

/* ==================== CART FUNCTIONS ==================== */
function addToCart(productId) {
  if (!products || products.length === 0) {
    alert('Prodotti non ancora caricati. Riprova tra qualche secondo.');
    return;
  }
  const product = products.find(p => p.id === productId);
  if (!product) return;
  const existing = cart.find(item => item.id === productId);
  if (existing) {
    existing.qty += 1;
  } else {
    cart.push({ ...product, qty: 1 });
  }
  saveCartToStorage();
  updateCartDisplay();
  openCart();
  console.log(`✅ Added ${product.name} to cart`);
}

function updateCartDisplay() {
  const cartSidebar = document.getElementById('cartSidebar');
  const cartItems = document.getElementById('cartItems');
  const cartFooter = document.getElementById('cartFooter');
  const cartCount = document.getElementById('cartCount');
  if (!cartItems) return;

  cartItems.innerHTML = '';
  if (!cart.length) {
    cartItems.innerHTML = `
      <div class="cart-empty">
        <i class="fas fa-shopping-cart"></i>
        <p>Il tuo carrello è vuoto</p>
        <small>Aggiungi alcuni prodotti per iniziare!</small>
      </div>
    `;
    if (cartFooter) cartFooter.style.display = 'none';
    if (cartCount) cartCount.textContent = '0';
    return;
  }

  let subtotal = 0;
  let totalQty = 0;
  cart.forEach(item => {
    subtotal += item.price * item.qty;
    totalQty += item.qty;
    const row = document.createElement('div');
    row.className = 'cart-item-row';
    row.innerHTML = `
      <div class="cart-item-info">
        <span class="cart-item-name">${item.name}</span>
        <span class="cart-item-qty">x${item.qty}</span>
      </div>
      <div class="cart-item-actions">
        <span class="cart-item-price">€${(item.price * item.qty).toFixed(2)}</span>
        <button class="cart-remove-btn" onclick="removeFromCart(${item.id})" aria-label="Rimuovi"><i class="fas fa-trash"></i></button>
      </div>
    `;
    cartItems.appendChild(row);
  });

 if (cartFooter) {
    cartFooter.style.display = 'block';
    document.getElementById('cartSubtotal').textContent = `€${subtotal.toFixed(2)}`;
    // Spedizione gratis sopra i 50€
    if (subtotal >= 50) {
      document.getElementById('cartShipping').textContent = 'Gratuita';
      document.getElementById('cartShipping').style.color = '#1a8917';
    } else {
      document.getElementById('cartShipping').textContent = '€4.90';
      document.getElementById('cartShipping').style.color = '#e53935';
    }
    document.getElementById('cartTotal').textContent = `€${subtotal.toFixed(2)}`;
  }
  if (cartCount) cartCount.textContent = totalQty;
}

function removeFromCart(productId) {
  cart = cart.filter(item => item.id !== productId);
  saveCartToStorage();
  updateCartDisplay();
}

function saveCartToStorage() {
  localStorage.setItem('cart', JSON.stringify(cart));
}

function loadCartFromStorage() {
  const stored = localStorage.getItem('cart');
  if (stored) {
    cart = JSON.parse(stored);
    console.log(`📦 Cart loaded from storage: ${cart.length} items`);
  }
}

/* ==================== CART SIDEBAR TOGGLE ==================== */
function toggleCart() {
  const cartSidebar = document.getElementById('cartSidebar');
  const cartOverlay = document.getElementById('cartOverlay');
  if (cartSidebar && cartOverlay) {
    const isActive = cartSidebar.classList.contains('active');
    if (isActive) {
      closeCart();
    } else {
      openCart();
    }
  }
}

function openCart() {
  const cartSidebar = document.getElementById('cartSidebar');
  const cartOverlay = document.getElementById('cartOverlay');
  if (cartSidebar && cartOverlay) {
    cartSidebar.classList.add('active');
    cartOverlay.classList.add('active');
    document.body.style.overflow = 'auto';
  }
}

function closeCart() {
  const cartSidebar = document.getElementById('cartSidebar');
  const cartOverlay = document.getElementById('cartOverlay');
  if (cartSidebar && cartOverlay) {
    cartSidebar.classList.remove('active');
    cartOverlay.classList.remove('active');
    document.body.style.overflow = 'auto';
  }
}

window.toggleCart = toggleCart;
window.openCart = openCart;
window.closeCart = closeCart;
window.addToCart = addToCart;
window.removeFromCart = removeFromCart;

/* ==================== EVENT LISTENERS & MISC ==================== */
function setupEventListeners() {
  // Altri listener globali se necessari
}

function setupDisclaimer() {
  // Mostra disclaimer o banner se necessario
}

function initializeApp() {
  // Inizializza eventuali componenti aggiuntivi
}
