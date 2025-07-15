// ==================== UI MANAGER E-COMMERCE TENNIS ====================

let uiStoreInfo = {};
let currentDate = new Date();
let promotionalData = {};
let cartInfo = { items: 0, total: 0 };

document.addEventListener('DOMContentLoaded', () => {
  loadAndUpdateEcommerceUI();
});

// ==================== MAIN LOAD FUNCTION ====================
async function loadAndUpdateEcommerceUI() {
  try {
    const response = await fetch('product-info.json');
    uiStoreInfo = await response.json();
    updateAllEcommerceElements();
    console.log('✅ UI E-commerce aggiornata con dati dinamici');
  } catch (error) {
    console.error('❌ Errore caricamento UI E-commerce:', error);
    setEcommerceFallbackValues();
  }
}

function updateAllEcommerceElements() {
  updateStoreElements();
  updateCategoryGrid();
  updateServiceCards();
  updateBrandShowcase();
  updateShippingInfo();
  updateNavigationElements();
}

function setEcommerceFallbackValues() {
  uiStoreInfo = {
    store: {
      nome: 'TennisShop Pro',
      descrizione: 'Il tuo negozio specializzato per tennis e racchettismo',
      slogan: 'Performance. Passione. Professionalità.',
      telefono: '+39 02 1234 5678',
      email: 'info@tennisshoppro.it'
    },
    categorie: {
      racchette: { nome: 'Racchette', icona: 'fas fa-table-tennis' },
      abbigliamento: { nome: 'Abbigliamento', icona: 'fas fa-tshirt' },
      scarpe: { nome: 'Scarpe', icona: 'fas fa-shoe-prints' },
      accessori: { nome: 'Accessori', icona: 'fas fa-briefcase' }
    }
  };
  updateAllEcommerceElements();
}

// ==================== STORE ELEMENTS UPDATE ====================
function updateStoreElements() {
  updateStoreName();
  updateStoreSlogan();
  updateStoreDescription();
  updateContactInfo();
}

function updateStoreName() {
  const nomeStore = uiStoreInfo.store?.nome || 'TennisShop Pro';
  const elements = [
    { id: 'store-name', content: nomeStore },
    { id: 'store-title', content: nomeStore },
    { id: 'chat-title', content: `Assistente Digitale - ${nomeStore}` },
    { id: 'popup-store-title', content: createStoreTitleWithLogo(nomeStore) },
    { id: 'header-store-name', content: nomeStore },
    { id: 'footer-store-name', content: nomeStore }
  ];
  elements.forEach(({ id, content }) => {
    const element = document.getElementById(id);
    if (element) {
      if (id === 'popup-store-title') {
        element.innerHTML = content;
      } else {
        element.textContent = content;
      }
    }
  });
}

function createStoreTitleWithLogo(nomeStore) {
  return `<img src="images/tennis-logo.png" alt="Logo Tennis" style="width: 32px; height: 32px; border-radius: 50%; vertical-align: middle; margin-right: 12px;">${nomeStore}`;
}

function updateStoreSlogan() {
  const slogan = uiStoreInfo.store?.slogan || 'Performance. Passione. Professionalità.';
  const elements = ['store-slogan', 'hero-slogan', 'header-slogan'];
  elements.forEach(id => {
    const element = document.getElementById(id);
    if (element) element.textContent = slogan;
  });
}

function updateStoreDescription() {
  const descrizione = uiStoreInfo.store?.descrizione || 'Il tuo negozio specializzato per tennis e racchettismo';
  const elements = ['store-description', 'hero-description', 'about-description'];
  elements.forEach(id => {
    const element = document.getElementById(id);
    if (element) element.textContent = descrizione;
  });
}

function updateContactInfo() {
  const store = uiStoreInfo.store || {};
  const telefono = store.telefono || '+39 02 1234 5678';
  const phoneElements = document.querySelectorAll('.phone-number, #contact-phone');
  phoneElements.forEach(element => {
    element.textContent = telefono;
    if (element.tagName === 'A') element.href = `tel:${telefono.replace(/\s/g, '')}`;
  });
  const email = store.email || 'info@tennisshoppro.it';
  const emailElements = document.querySelectorAll('.email-address, #contact-email');
  emailElements.forEach(element => {
    element.textContent = email;
    if (element.tagName === 'A') element.href = `mailto:${email}`;
  });
  const indirizzo = store.indirizzo || 'Via del Tennis 10, Milano (MI)';
  const addressElements = document.querySelectorAll('.store-address, #contact-address');
  addressElements.forEach(element => {
    element.textContent = indirizzo;
  });
}

// ==================== CATEGORY GRID UPDATE ====================
function updateCategoryGrid() {
  const container = document.getElementById('categories-grid');
  if (!container || !uiStoreInfo.categorie) return;
  const categorie = Object.entries(uiStoreInfo.categorie);
  container.innerHTML = categorie.map(([key, categoria]) => 
    createCategoryCardHTML(key, categoria)
  ).join('');
  setTimeout(updateCategoryProductCounts, 500);
}

function createCategoryCardHTML(key, categoria) {
  return `
    <div class="category-card" data-category="${key}">
      <div class="category-icon">
        <i class="${categoria.icona || 'fas fa-shopping-bag'}"></i>
      </div>
      <div class="category-content">
        <h3>${categoria.nome}</h3>
        <p>${categoria.descrizione || 'Scopri la nostra selezione'}</p>
        <div class="category-stats">
          <span class="product-count" id="count-${key}">Caricamento...</span>
        </div>
      </div>
      <button class="category-cta" onclick="filterByCategory('${key}')">
        <i class="fas fa-arrow-right"></i>
        Esplora
      </button>
    </div>
  `;
}

function updateCategoryProductCounts() {
  if (!window.products) return;
  const counts = {};
  window.products.forEach(product => {
    const category = product.category;
    counts[category] = (counts[category] || 0) + 1;
  });
  Object.entries(counts).forEach(([category, count]) => {
    const countElement = document.getElementById(`count-${category}`);
    if (countElement) countElement.textContent = `${count} prodotti`;
  });
}

// ==================== SERVICE CARDS UPDATE ====================
function updateServiceCards() {
  const container = document.getElementById('services-grid');
  if (!container || !uiStoreInfo.servizi) return;
  const servizi = Object.entries(uiStoreInfo.servizi);
  container.innerHTML = servizi.map(([key, servizio]) => 
    createServiceCardHTML(key, servizio)
  ).join('');
}

function createServiceCardHTML(key, servizio) {
  return `
    <div class="service-card">
      <div class="service-icon">
        <i class="${servizio.icona || 'fas fa-cog'}"></i>
      </div>
      <div class="service-content">
        <h4>${servizio.nome}</h4>
        <p>${servizio.descrizione}</p>
        ${servizio.prezzo ? `<div class="service-price">${servizio.prezzo}</div>` : ''}
        ${servizio.tempo ? `<div class="service-time"><i class="fas fa-clock"></i> ${servizio.tempo}</div>` : ''}
      </div>
    </div>
  `;
}

// ==================== BRAND SHOWCASE UPDATE ====================
function updateBrandShowcase() {
  const container = document.getElementById('brands-showcase');
  if (!container || !uiStoreInfo.brands) return;
  const brands = Object.entries(uiStoreInfo.brands);
  container.innerHTML = brands.map(([key, brand]) => 
    createBrandCardHTML(key, brand)
  ).join('');
}

function createBrandCardHTML(key, brand) {
  return `
    <div class="brand-card" data-brand="${key}">
      <div class="brand-logo">
        <img src="images/brands/${key}-logo.png" alt="${brand.nome}" 
             onerror="this.src='https://via.placeholder.com/120x60/f0f0f0/666?text=${brand.nome}'"
             loading="lazy">
      </div>
      <div class="brand-content">
        <h5>${brand.nome}</h5>
        <p>${brand.descrizione || brand.specialita}</p>
      </div>
      <button class="brand-filter-btn" onclick="filterByBrand('${key}')">
        <i class="fas fa-filter"></i>
        Vedi Prodotti
      </button>
    </div>
  `;
}

// ==================== SHIPPING INFO UPDATE ====================
function updateShippingInfo() {
  const container = document.getElementById('shipping-info');
  if (!container) return;
  const store = uiStoreInfo.store || {};
  const shippingHTML = `
    <div class="shipping-grid">
      <div class="shipping-item">
        <div class="shipping-icon">
          <i class="fas fa-shipping-fast"></i>
        </div>
        <div class="shipping-content">
          <h4>Spedizione Veloce</h4>
          <p>${store.spedizioni || 'Spedizione gratuita sopra €50'}</p>
          <small>Consegna in 24-48h</small>
        </div>
      </div>
      <div class="shipping-item">
        <div class="shipping-icon">
          <i class="fas fa-undo-alt"></i>
        </div>
        <div class="shipping-content">
          <h4>Reso Gratuito</h4>
          <p>Reso entro 30 giorni</p>
          <small>Rimborso garantito</small>
        </div>
      </div>
      <div class="shipping-item">
        <div class="shipping-icon">
          <i class="fas fa-headset"></i>
        </div>
        <div class="shipping-content">
          <h4>Supporto Clienti</h4>
          <p>Assistenza specializzata</p>
          <small>Chat e telefono</small>
        </div>
      </div>
      <div class="shipping-item">
        <div class="shipping-icon">
          <i class="fas fa-shield-alt"></i>
        </div>
        <div class="shipping-content">
          <h4>Pagamenti Sicuri</h4>
          <p>SSL certificato</p>
          <small>Carte e PayPal</small>
        </div>
      </div>
    </div>
  `;
  container.innerHTML = shippingHTML;
}

// ==================== NAVIGATION ELEMENTS ====================
function updateNavigationElements() {
  updateCartBadge();
  updateNavLinks();
  updateMobileMenu();
}

function updateCartBadge() {
  const cartCount = document.getElementById('cartCount');
  if (cartCount) {
    cartCount.textContent = window.cart ? window.cart.reduce((sum, item) => sum + item.qty, 0) : 0;
    cartCount.style.display = (cartCount.textContent !== '0') ? 'inline' : 'none';
  }
}

function updateNavLinks() {
  const navContainer = document.getElementById('main-navigation');
  if (!navContainer || !uiStoreInfo.categorie) return;
  const navItems = Object.entries(uiStoreInfo.categorie).map(([key, categoria]) => `
    <a href="#" class="nav-link" onclick="scrollToCategory('${key}')" data-category="${key}">
      <i class="${categoria.icona}"></i>
      ${categoria.nome}
    </a>
  `).join('');
  navContainer.innerHTML = `
    <a href="#" class="nav-link" onclick="scrollToTop()">
      <i class="fas fa-home"></i>
      Home
    </a>
    ${navItems}
    <a href="#" class="nav-link" onclick="scrollToSection('contact')">
      <i class="fas fa-phone"></i>
      Contatti
    </a>
  `;
}

function updateMobileMenu() {
  const mobileMenu = document.getElementById('mobile-menu-items');
  if (!mobileMenu || !uiStoreInfo.categorie) return;
  const mobileItems = Object.entries(uiStoreInfo.categorie).map(([key, categoria]) => `
    <a href="#" class="mobile-nav-link" onclick="filterByCategory('${key}'); closeMobileMenu();">
      <i class="${categoria.icona}"></i>
      <span>${categoria.nome}</span>
    </a>
  `).join('');
  mobileMenu.innerHTML = `
    <a href="#" class="mobile-nav-link" onclick="scrollToTop(); closeMobileMenu();">
      <i class="fas fa-home"></i>
      <span>Home</span>
    </a>
    ${mobileItems}
    <a href="#" class="mobile-nav-link" onclick="scrollToSection('contact'); closeMobileMenu();">
      <i class="fas fa-phone"></i>
      <span>Contatti</span>
    </a>
    <a href="#" class="mobile-nav-link" onclick="openCart(); closeMobileMenu();">
      <i class="fas fa-shopping-cart"></i>
      <span>Carrello (<span id="cartCountMobile">${window.cart ? window.cart.reduce((sum, item) => sum + item.qty, 0) : 0}</span>)</span>
    </a>
  `;
}

// ==================== GLOBAL NAVIGATION FUNCTIONS ====================
window.filterByCategory = function(category) {
  if (window.filterProducts) {
    window.filterProducts('category', category);
  }
  // Sincronizza lo stato dei pulsanti filtro sopra la griglia prodotti
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
};

window.filterByBrand = function(brand) {
  if (window.filterProducts) {
    window.filterProducts('brand', brand);
  }
  const productsSection = document.getElementById('products');
  if (productsSection) {
    productsSection.scrollIntoView({ behavior: 'smooth' });
  }
};

window.scrollToCategory = function(category) {
  window.filterByCategory(category);
};

window.scrollToSection = function(sectionId) {
  const section = document.getElementById(sectionId);
  if (section) {
    section.scrollIntoView({ behavior: 'smooth' });
  }
};

window.scrollToTop = function() {
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

window.closeMobileMenu = function() {
  const mobileMenu = document.getElementById('mobile-menu');
  if (mobileMenu) {
    mobileMenu.classList.remove('active');
  }
};

window.openCart = function() {
  const cartSidebar = document.getElementById('cartSidebar');
  const cartOverlay = document.getElementById('cartOverlay');
  if (cartSidebar && cartOverlay) {
    cartSidebar.classList.add('active');
    cartOverlay.classList.add('active');
    document.body.style.overflow = 'hidden';
  }
};

// ==================== CONSOLE LOG ====================
console.log('✅ UI Manager E-commerce Tennis caricato');
console.log('🎾 Category grids e brand showcase ready');
console.log('🛒 Cart integration e navigation ready');
console.log('📱 Mobile-optimized popups e tabs ready');