// ==================== API CONFIGURATION ====================
const API_BASE_URL = window.location.hostname === 'localhost' 
  ? 'http://localhost:3000' 
  : 'https://assistente-digitale-e-commerce-demo.onrender.com';

// ==================== GLOBAL VARIABLES ====================
let messageHistory = [];
let displayedMessages = 0;
let loadMoreButton = null;
const MESSAGES_PER_PAGE = 10;
const LOAD_MORE_THRESHOLD = 15;

// ==================== PAGINATION INTEGRATION ====================
function initializeMessagePagination() {
  messageHistory = [];
  displayedMessages = 0;
  hideLoadMoreButton();
}

function addToMessageHistory(type, text, timestamp = new Date()) {
  const message = {
    id: generateMessageId(),
    type: type,
    text: text,
    timestamp: timestamp,
    displayed: false
  };
  messageHistory.push(message);
}

function generateMessageId() {
  return 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

function shouldShowLoadMoreButton() {
  const totalMessages = messageHistory.length;
  const hiddenMessages = totalMessages - displayedMessages;
  return hiddenMessages > 0 && displayedMessages >= LOAD_MORE_THRESHOLD;
}

function createLoadMoreButton() {
  if (loadMoreButton) return loadMoreButton;
  
  loadMoreButton = document.createElement('div');
  loadMoreButton.className = 'load-more-container';
  loadMoreButton.id = 'load-more-container';
  
  const hiddenCount = messageHistory.length - displayedMessages;
  
  loadMoreButton.innerHTML = `
    <button class="load-more-btn" onclick="loadMoreMessages()" aria-label="Carica messaggi precedenti">
      <i class="fas fa-chevron-up"></i>
      <span class="load-more-text">Carica ${hiddenCount} messaggi precedenti</span>
      <div class="load-more-indicator">
        <div class="load-more-dots">
          <span class="dot"></span>
          <span class="dot"></span>
          <span class="dot"></span>
        </div>
      </div>
    </button>
  `;
  
  return loadMoreButton;
}

function showLoadMoreButton() {
  const chatBody = document.getElementById('chatBody');
  if (!chatBody) return;
  
  hideLoadMoreButton();
  const button = createLoadMoreButton();
  chatBody.insertBefore(button, chatBody.firstChild);
  
  setTimeout(() => {
    button.classList.add('show');
  }, 100);
}

function hideLoadMoreButton() {
  const existingButton = document.getElementById('load-more-container');
  if (existingButton) {
    existingButton.remove();
    loadMoreButton = null;
  }
}

window.loadMoreMessages = async function() {
  const button = document.getElementById('load-more-container');
  if (!button) return;
  
  button.classList.add('loading');
  const textElement = button.querySelector('.load-more-text');
  const originalText = textElement.textContent;
  textElement.textContent = 'Caricamento...';
  
  try {
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const messagesToLoad = Math.min(MESSAGES_PER_PAGE, messageHistory.length - displayedMessages);
    const startIndex = messageHistory.length - displayedMessages - messagesToLoad;
    const endIndex = messageHistory.length - displayedMessages;
    
    const messagesSlice = messageHistory.slice(startIndex, endIndex);
    
    const chatBody = document.getElementById('chatBody');
    const messagesContainer = document.createElement('div');
    messagesContainer.className = 'loaded-messages';
    
    for (const message of messagesSlice) {
      const messageElement = createMessageElement(message.type, message.text);
      messageElement.classList.add('loaded-message');
      messagesContainer.appendChild(messageElement);
      message.displayed = true;
    }
    
    chatBody.insertBefore(messagesContainer, button.nextSibling);
    displayedMessages += messagesToLoad;
    
    setTimeout(() => {
      messagesContainer.querySelectorAll('.loaded-message').forEach((msg, index) => {
        setTimeout(() => {
          msg.classList.add('show');
        }, index * 100);
      });
    }, 100);
    
    if (displayedMessages >= messageHistory.length) {
      hideLoadMoreButton();
    } else {
      const hiddenCount = messageHistory.length - displayedMessages;
      textElement.textContent = `Carica ${hiddenCount} messaggi precedenti`;
      button.classList.remove('loading');
    }
    
  } catch (error) {
    console.error('❌ Errore nel caricamento messaggi:', error);
    button.classList.remove('loading');
    textElement.textContent = originalText;
  }
};

function createMessageElement(type, text) {
  const messageDiv = document.createElement('div');
  messageDiv.className = `message ${type}`;
  messageDiv.innerHTML = text;
  return messageDiv;
}

// ==================== UI FUNCTIONS WITH PAGINATION ====================
async function showTypingIndicator(text = "") {
  const typing = document.createElement('div');
  typing.className = 'message bot typing-indicator';
  typing.innerHTML = `
    <div class="typing-animation" style="
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 12px 16px;
    ">
      <span class="typing-dot" style="
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: #0077cc;
        animation: typing 1.4s infinite ease-in-out;
      "></span>
      <span class="typing-dot" style="
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: #0077cc;
        animation: typing 1.4s infinite ease-in-out 0.2s;
      "></span>
      <span class="typing-dot" style="
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: #0077cc;
        animation: typing 1.4s infinite ease-in-out 0.4s;
      "></span>
    </div>
  `;
  
  const chatBody = document.getElementById('chatBody');
  if (chatBody) {
    chatBody.appendChild(typing);
    chatBody.scrollTop = chatBody.scrollHeight;
    
    const duration = Math.min(Math.max(800, text.length * 50), 2500);
    await new Promise(resolve => setTimeout(resolve, duration));
    typing.remove();
  }
}

async function appendMessage(type, text) {
  // Aggiungi alla cronologia per paginazione
  addToMessageHistory(type, text);
  
  if (type === 'bot') await showTypingIndicator(text);

  const msg = document.createElement('div');
  msg.className = `message ${type}`;
  msg.innerHTML = text;
  
  const chatBody = document.getElementById('chatBody');
  if (chatBody) {
    chatBody.appendChild(msg);
    
    // Incrementa contatore
    displayedMessages++;
    
    // Controlla se mostrare load more
    if (shouldShowLoadMoreButton()) {
      showLoadMoreButton();
    }
    
    // Setup bottoni interattivi
    if (text.includes('data-action') || text.includes('data-level') || text.includes('data-budget')) {
      setupInteractiveButtons();
    }
    
    chatBody.scrollTop = chatBody.scrollHeight;
  }
}

function setupInteractiveButtons() {
  setTimeout(() => {
    // Setup action buttons
    document.querySelectorAll('.chat-option-btn[data-action]').forEach(btn => {
      if (!btn.hasAttribute('data-listener-added')) {
        btn.setAttribute('data-listener-added', 'true');
        btn.addEventListener('click', function(e) {
          e.preventDefault();
          const action = this.getAttribute('data-action');
          if (window.handleQuickAction) {
            window.handleQuickAction(action);
          }
        });
      }
    });
    
    // Setup level buttons
    document.querySelectorAll('.chat-option-btn[data-level]').forEach(btn => {
      if (!btn.hasAttribute('data-listener-added')) {
        btn.setAttribute('data-listener-added', 'true');
        btn.addEventListener('click', function(e) {
          e.preventDefault();
          const level = this.getAttribute('data-level');
          if (window.handleLevelSelection) {
            window.handleLevelSelection(level);
          }
        });
      }
    });
    
    // Setup budget buttons
    document.querySelectorAll('.chat-option-btn[data-budget]').forEach(btn => {
      if (!btn.hasAttribute('data-listener-added')) {
        btn.setAttribute('data-listener-added', 'true');
        btn.addEventListener('click', function(e) {
          e.preventDefault();
          const budget = this.getAttribute('data-budget');
          if (window.handleBudgetSelection) {
            window.handleBudgetSelection(budget);
          }
        });
      }
    });
    
    // Setup add to cart buttons
    document.querySelectorAll('.add-to-cart-chat-btn').forEach(btn => {
      if (!btn.hasAttribute('data-listener-added')) {
        btn.setAttribute('data-listener-added', 'true');
        btn.addEventListener('click', function(e) {
          e.preventDefault();
          const productId = parseInt(this.getAttribute('data-product-id'));
          if (window.handleChatAddToCart) {
            window.handleChatAddToCart(productId);
          }
        });
      }
    });
  }, 100);
}

function showInitialOptions() {
  // Controlla se i pulsanti esistono già
  if (document.getElementById('command-buttons')) {
    return; // Non creare duplicati
  }
  
  setTimeout(() => {
    const chatBody = document.getElementById('chatBody');
    if (!chatBody) return;
    
    const container = document.createElement('div');
    container.id = 'command-buttons';
    container.style.cssText = 'display: flex; flex-wrap: wrap; gap: 10px; margin-top: 10px;';

    const options = [
      "🎾 Consigli per Prodotti", 
      "📏 Guida alle Taglie", 
      "🚚 Info Spedizioni", 
      "🎁 Offerte Speciali", 
      "💬 Supporto Ordine"
    ];

    options.forEach(text => {
      const button = document.createElement('button');
      button.textContent = text;
      button.className = 'chat-option-btn';
      button.style.cssText = `
        background: linear-gradient(135deg, #0077cc, #005aa7);
        color: white;
        border: none;
        padding: 10px 15px;
        border-radius: 20px;
        cursor: pointer;
        font-size: 13px;
        font-weight: 500;
        transition: all 0.3s ease;
        min-width: 120px;
        text-align: center;
      `;
      button.addEventListener('click', () => {
        disableCommandButtons();
        const input = document.getElementById('chatInput');
        if (input && window.sendChatMessage) {
          input.value = text;
          window.sendChatMessage();
        }
      });
      container.appendChild(button);
    });

    chatBody.appendChild(container);
    chatBody.scrollTop = chatBody.scrollHeight;
  }, 1000);
}

function disableCommandButtons() {
  const buttons = document.querySelectorAll('#command-buttons button');
  buttons.forEach(btn => {
    btn.disabled = true;
    btn.style.cssText += 'opacity: 0.5; cursor: not-allowed;';
  });
}

// ==================== E-COMMERCE VALIDATION FUNCTIONS ====================
function isValidEmail(email) {
  if (!email || typeof email !== 'string') return false;
  
  // Regex per email valide
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  
  return emailRegex.test(email) && 
         !email.includes('..') && 
         email.length >= 5 && 
         email.length <= 254 &&
         email.indexOf('@') > 0 &&
         email.lastIndexOf('@') === email.indexOf('@');
}

function isValidPhone(phone) {
  if (!phone || typeof phone !== 'string') return false;
  
  // Rimuovi spazi, trattini, parentesi
  const cleanPhone = phone.replace(/[\s\-\(\)\.]/g, '');
  
  // Gestisci prefisso +39
  const phoneWithoutPrefix = cleanPhone.replace(/^\+39/, '').replace(/^0039/, '');
  
  // Formato italiano: deve essere di 8-11 cifre dopo aver rimosso +39
  if (phoneWithoutPrefix.length < 8 || phoneWithoutPrefix.length > 11) {
    return false;
  }
  
  // Solo cifre
  if (!/^\d+$/.test(phoneWithoutPrefix)) {
    return false;
  }
  
  // Evita numeri ripetitivi (es: 1111111111)
  if (/(\d)\1{6,}/.test(phoneWithoutPrefix)) {
    return false;
  }
  
  // Controlla formati validi italiani
  const validPatterns = [
    /^3\d{8,9}$/,        // Cellulari (3xx xxx xxxx)
    /^0\d{8,10}$/,       // Fissi (0xx xxxx xxxx)
    /^[1-9]\d{7,9}$/     // Altri formati
  ];
  
  return validPatterns.some(pattern => pattern.test(phoneWithoutPrefix));
}

function formatPhoneForDisplay(phone) {
  const cleanPhone = phone.replace(/[\s\-\(\)\.]/g, '');
  const phoneWithoutPrefix = cleanPhone.replace(/^\+39/, '').replace(/^0039/, '');
  
  // Formatta per display
  if (phoneWithoutPrefix.length === 10 && phoneWithoutPrefix.startsWith('3')) {
    // Cellulare: 3xx xxx xxxx
    return `+39 ${phoneWithoutPrefix.substring(0, 3)} ${phoneWithoutPrefix.substring(3, 6)} ${phoneWithoutPrefix.substring(6)}`;
  } else if (phoneWithoutPrefix.startsWith('0')) {
    // Fisso: 0xx xxxx xxxx
    return `+39 ${phoneWithoutPrefix}`;
  }
  
  return `+39 ${phoneWithoutPrefix}`;
}

// ==================== PRODUCT SEARCH & FILTERING ====================
function searchProducts(query, catalog) {
  if (!query || !catalog) return [];
  
  const searchTerm = query.toLowerCase().trim();
  
  return catalog.filter(product => {
    const name = product.name.toLowerCase();
    const description = product.description.toLowerCase();
    const category = product.category.toLowerCase();
    
    return name.includes(searchTerm) || 
           description.includes(searchTerm) || 
           category.includes(searchTerm);
  });
}

function filterProductsByPrice(products, minPrice = 0, maxPrice = Infinity) {
  return products.filter(product => 
    product.price >= minPrice && product.price <= maxPrice
  );
}

function filterProductsByCategory(products, category) {
  if (!category || category === 'all') return products;
  return products.filter(product => product.category === category);
}

function getProductRecommendations(userPreferences, catalog) {
  if (!userPreferences || !catalog) return [];
  
  let filtered = [...catalog];
  
  // Filtro budget
  if (userPreferences.budget) {
    switch (userPreferences.budget) {
      case 'under50':
        filtered = filterProductsByPrice(filtered, 0, 50);
        break;
      case '50to100':
        filtered = filterProductsByPrice(filtered, 50, 100);
        break;
      case '100to200':
        filtered = filterProductsByPrice(filtered, 100, 200);
        break;
      case 'over200':
        filtered = filterProductsByPrice(filtered, 200);
        break;
    }
  }
  
  // Filtro livello
  if (userPreferences.level) {
    filtered = filtered.filter(product => {
      const productName = product.name.toLowerCase();
      switch (userPreferences.level) {
        case 'beginner':
          return !productName.includes('pro') && !productName.includes('professional');
        case 'professional':
          return productName.includes('pro') || productName.includes('rf97') || product.price > 200;
        default:
          return true;
      }
    });
  }
  
  // Ordina per rilevanza (prezzo crescente per principianti, decrescente per professionisti)
  if (userPreferences.level === 'beginner') {
    filtered.sort((a, b) => a.price - b.price);
  } else if (userPreferences.level === 'professional') {
    filtered.sort((a, b) => b.price - a.price);
  }
  
  return filtered.slice(0, 6); // Max 6 raccomandazioni
}

// ==================== CART INTEGRATION HELPERS ====================
function formatProductForChat(product) {
  if (!product) return '';
  
  return `
    <div class="chat-product-card" style="
      border: 1px solid #e0e0e0;
      border-radius: 8px;
      padding: 12px;
      margin: 8px 0;
      background: #f9f9f9;
      display: flex;
      gap: 12px;
      align-items: center;
    ">
      <img src="${product.image}" alt="${product.name}" style="
        width: 60px;
        height: 60px;
        object-fit: cover;
        border-radius: 6px;
      " onerror="this.src='https://via.placeholder.com/60x60?text=🎾'">
      <div style="flex: 1;">
        <h4 style="margin: 0 0 4px 0; color: #333; font-size: 14px;">${product.name}</h4>
        <p style="margin: 0 0 8px 0; color: #666; font-size: 12px;">${product.description}</p>
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span style="color: #0077cc; font-weight: 600; font-size: 16px;">€${product.price.toFixed(2)}</span>
          <button class="add-to-cart-chat-btn" data-product-id="${product.id}" style="
            background: #0077cc;
            color: white;
            border: none;
            padding: 6px 12px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
            font-weight: 500;
          ">🛒 Aggiungi</button>
        </div>
      </div>
    </div>
  `;
}

function generateProductListHtml(products, title = "Prodotti consigliati") {
  if (!products || products.length === 0) {
    return `<p style="color: #666; text-align: center; padding: 20px;">😅 Nessun prodotto trovato per i tuoi criteri.</p>`;
  }
  
  let html = `<div class="product-recommendations"><h4>${title}</h4>`;
  
  products.forEach(product => {
    html += formatProductForChat(product);
  });
  
  html += `
    <p style="margin-top: 15px; font-size: 13px; color: #666; text-align: center;">
      💡 <em>Hai domande su questi prodotti? Chiedimi pure!</em>
    </p>
  </div>`;
  
  return html;
}

// ==================== DATA PROCESSING FUNCTIONS ====================
function processFieldData(field, userMessage) {
  switch (field) {
    case 'nome':
      return processNameField(userMessage);
    
    case 'telefono':
      return processPhoneField(userMessage);
    
    case 'email':
      return processEmailField(userMessage);
    
    case 'indirizzo':
    case 'note':
    case 'preferenze':
      return processTextField(userMessage);
    
    default:
      return { valid: true, value: userMessage.trim() };
  }
}

function processNameField(message) {
  const name = message.trim();
  
  // Validazione nome
  if (name.length < 2) {
    return { 
      valid: false, 
      errorMessage: '❌ Il nome deve essere di almeno 2 caratteri. Puoi ripetere?' 
    };
  }
  
  if (!/^[a-zA-ZàáâãäåèéêëìíîïòóôõöùúûüÀÁÂÃÄÅÈÉÊËÌÍÎÏÒÓÔÕÖÙÚÛÜ\s\'-]+$/.test(name)) {
    return { 
      valid: false, 
      errorMessage: '❌ Il nome contiene caratteri non validi. Usa solo lettere, per favore.' 
    };
  }
  
  if (name.length > 50) {
    return { 
      valid: false, 
      errorMessage: '❌ Il nome è troppo lungo. Puoi abbreviarlo?' 
    };
  }
  
  return { valid: true, value: name };
}

function processPhoneField(message) {
  // Cerca numero di telefono nel messaggio
  const phoneMatch = message.match(/[\d\s\-\+\(\)\.]{8,}/);
  
  if (!phoneMatch) {
    return { 
      valid: false, 
      errorMessage: '❌ Non riesco a trovare un numero di telefono. Puoi scriverlo di nuovo?' 
    };
  }
  
  const phone = phoneMatch[0].trim();
  
  if (!isValidPhone(phone)) {
    return { 
      valid: false, 
      errorMessage: `❌ Il numero "${phone}" non sembra valido per l'Italia. Controlla e riprova (es: 348 123 4567 oppure 02 1234 5678).` 
    };
  }
  
  const formatted = formatPhoneForDisplay(phone);
  return { 
    valid: true, 
    value: formatted,
    successMessage: `✅ Perfetto! Ho salvato il numero: ${formatted}`
  };
}

function processEmailField(message) {
  // Cerca email nel messaggio
  const emailMatch = message.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  
  if (!emailMatch) {
    return { 
      valid: false, 
      errorMessage: '❌ Non riesco a trovare un indirizzo email. Puoi scriverlo di nuovo?' 
    };
  }
  
  const email = emailMatch[0].toLowerCase();
  
  if (!isValidEmail(email)) {
    return { 
      valid: false, 
      errorMessage: `❌ L'email "${email}" non sembra valida. Controlla e riprova (es: nome@esempio.it).` 
    };
  }
  
  return { 
    valid: true, 
    value: email,
    successMessage: `✅ Ottimo! Ho salvato l'email: ${email}`
  };
}

function processTextField(message) {
  const text = message.trim();
  
  if (text.length < 3) {
    return { 
      valid: false, 
      errorMessage: '❌ La risposta è troppo breve. Puoi essere più specifico?' 
    };
  }
  
  return { valid: true, value: text };
}

// ==================== UTILITY FUNCTIONS ====================
function formatPrice(price) {
  return `€${price.toFixed(2)}`;
}

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

function generateSessionId() {
  return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

function formatTimestamp(date) {
  return new Intl.DateTimeFormat('it-IT', {
    dateStyle: 'short',
    timeStyle: 'short'
  }).format(date);
}

// ==================== NOTIFICATION FUNCTIONS ====================
function showNotification(message, type = 'info', duration = 3000) {
  const notification = document.createElement('div');
  notification.className = 'chat-notification';
  
  const colors = {
    success: '#28a745',
    error: '#dc3545',
    warning: '#ffc107',
    info: '#17a2b8'
  };
  
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: ${colors[type] || colors.info};
    color: white;
    padding: 12px 20px;
    border-radius: 6px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    z-index: 10000;
    font-size: 14px;
    font-weight: 500;
    animation: slideInFromRight 0.3s ease;
    max-width: 300px;
  `;
  
  notification.textContent = message;
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.style.animation = 'slideOutToRight 0.3s ease';
    setTimeout(() => {
      if (document.body.contains(notification)) {
        document.body.removeChild(notification);
      }
    }, 300);
  }, duration);
}

// ==================== API FUNCTIONS ====================
async function sendEmailNotification(type, data) {
  try {
    const emailData = {
      type: type,
      data: data,
      timestamp: new Date().toISOString(),
      to: 'digitalandmoreit@gmail.com'
    };
    
    const response = await fetch(`${API_BASE_URL}/api/send-email`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(emailData)
    });
    
    if (response.ok) {
      console.log('📧 Email di notifica inviata');
      showNotification('✅ Richiesta inviata con successo!', 'success');
    } else {
      throw new Error('Failed to send email');
    }
  } catch (error) {
    console.error('❌ Errore invio email:', error);
    showNotification('⚠️ Problema nell\'invio. Riprova più tardi.', 'warning');
  }
}

// ==================== KEYBOARD HANDLING ====================
document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && e.target.id === 'chatInput' && !e.shiftKey) {
    e.preventDefault();
    if (window.sendChatMessage) {
      window.sendChatMessage();
    }
  }
});

// ==================== CSS ANIMATIONS ====================
const animationStyles = `
  @keyframes typing {
    0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
    30% { transform: translateY(-10px); opacity: 1; }
  }
  
  @keyframes slideInFromRight {
    from { transform: translateX(100%); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
  }
  
  @keyframes slideOutToRight {
    from { transform: translateX(0); opacity: 1; }
    to { transform: translateX(100%); opacity: 0; }
  }
  
  .chat-option-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 119, 204, 0.3);
  }
  
  .chat-product-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }
  
  .add-to-cart-chat-btn:hover {
    background: #005aa7 !important;
    transform: scale(1.05);
  }
`;

// Inject animations
const animationStyleSheet = document.createElement('style');
animationStyleSheet.textContent = animationStyles;
document.head.appendChild(animationStyleSheet);

console.log('✅ Functions.js per E-commerce Tennis caricato');
console.log('🎾 Product filtering e validation ready');
console.log('🛒 Cart integration functions available');
console.log('📱 Mobile-optimized animations loaded');