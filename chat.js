function getBaseURL() {
  const hostname = window.location.hostname;
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'http://localhost:3000';
  }
  if (hostname === 'assistente-digitale.it') {
    return 'https://assistente-digitale-e-commerce-demo.onrender.com';
  }
  if (hostname.includes('onrender.com')) {
    return `https://${hostname}`;
  }
  return window.location.origin;
}

const BASE_URL = getBaseURL();

let storeInfo = {};
let productCatalog = [];
let conversationState = {
  sessionId: 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
  currentFlow: null,
  flowData: {},
  tokenCount: 0,
  maxTokens: 8000,
  userPreferences: {
    level: null,
    budget: null,
    playingSurface: null,
    playingStyle: null
  }
};

document.addEventListener('DOMContentLoaded', async () => {
  try {
    await loadStoreInfo();
    await loadProductCatalog();
    await showWelcomeMessage();
    await loadSessionInfo();
    setupChatWidget();
  } catch (error) {
    console.error('❌ Errore inizializzazione chat:', error);
  }
});

async function loadStoreInfo() {
  try {
    const response = await fetch(`${BASE_URL}/api/product-info`, {
      headers: { 'Accept': 'application/json', 'Cache-Control': 'no-cache' }
    });
    if (!response.ok) throw new Error(`API failed: ${response.status}`);
    storeInfo = await response.json();
  } catch (error) {
    storeInfo = {
      store: {
        nome: 'TennisShop Pro',
        descrizione: 'Il tuo negozio specializzato per tennis',
        slogan: 'Performance. Passione. Professionalità.'
      }
    };
  }
}

async function loadProductCatalog() {
  try {
    if (window.products && window.products.length > 0) {
      productCatalog = window.products;
    } else {
      // Fallback: carica direttamente dall'API
      const response = await fetch(`${BASE_URL}/api/product-info`);
      const data = await response.json();
      productCatalog = Array.isArray(data.prodotti) ? data.prodotti : [];
    }
  } catch (error) {
    productCatalog = [];
  }
}

async function loadSessionInfo() {
  try {
    const response = await fetch(`${BASE_URL}/api/session-info`, {
      headers: {
        'x-session-id': conversationState.sessionId,
        'Accept': 'application/json',
        'Cache-Control': 'no-cache'
      }
    });
    if (!response.ok) throw new Error(`Session API failed: ${response.status}`);
    const sessionInfo = await response.json();
    conversationState.tokenCount = sessionInfo.tokenCount || 0;
    conversationState.maxTokens = sessionInfo.maxTokens || 8000;
    conversationState.currentFlow = sessionInfo.currentFlow || null;
    conversationState.flowData = sessionInfo.flowData || {};
  } catch (error) {
    conversationState.tokenCount = 0;
    conversationState.maxTokens = 8000;
  }
}

function setupChatWidget() {
  const chatWidgetButton = document.querySelector('.chat-widget-button');
  const chatWindow = document.getElementById('chatWindowWidget');
  const chatOverlay = document.getElementById('chatOverlayWidget');
  if (chatWidgetButton) {
    chatWidgetButton.addEventListener('click', toggleChat);
  }
  if (chatOverlay) {
    chatOverlay.addEventListener('click', closeChat);
  }
  const chatInput = document.getElementById('chatInput');
  if (chatInput) {
    chatInput.addEventListener('keypress', handleChatEnterKey);
    chatInput.addEventListener('input', handleTypingFeedback);
  }
  const sendButton = document.getElementById('chatSendButton');
  if (sendButton) {
    sendButton.addEventListener('click', sendChatMessage);
  }
}

async function showWelcomeMessage() {
  const storeNome = storeInfo.store?.nome || 'TennisShop Pro';
  const welcomeMsg = `🎾 Ciao! Sono l'assistente digitale di <strong>${storeNome}</strong>.<br>Sono qui per aiutarti a trovare l'attrezzatura tennis perfetta per te!`;
  await appendMessage('bot', welcomeMsg);
  setTimeout(showQuickOptions, 1200);
}

async function showQuickOptions() {
  const quickOptions = `
    <div class="quick-options" style="margin-top: 12px; display: flex; flex-direction: column; gap: 8px;">
      <button class="chat-option-btn" data-action="consulenza_prodotti">🎾 Consigli per Prodotti</button>
      <button class="chat-option-btn" data-action="guida_taglie">📏 Guida alle Taglie</button>
      <button class="chat-option-btn" data-action="spedizioni">🚚 Info Spedizioni</button>
      <button class="chat-option-btn" data-action="offerte">🎁 Offerte Speciali</button>
      <button class="chat-option-btn" data-action="supporto_ordine">💬 Supporto Ordine</button>
    </div>
  `;
  await appendMessage('bot', quickOptions);
  setupOptionButtonListeners();
}

function setupOptionButtonListeners() {
  setTimeout(() => {
    document.querySelectorAll('.chat-option-btn[data-action]').forEach(btn => {
      if (!btn.hasAttribute('data-listener-added')) {
        btn.setAttribute('data-listener-added', 'true');
        btn.addEventListener('click', function(e) {
          e.preventDefault();
          const action = this.getAttribute('data-action');
          handleQuickAction(action);
        });
      }
    });
  }, 100);
}

async function handleQuickAction(action) {
  const actionMessages = {
    'consulenza_prodotti': 'Vorrei consigli per scegliere prodotti tennis adatti a me',
    'guida_taglie': 'Ho bisogno di aiuto per le taglie di abbigliamento e scarpe',
    'spedizioni': 'Vorrei informazioni su spedizioni e consegne',
    'offerte': 'Ci sono offerte speciali o promozioni attive?',
    'supporto_ordine': 'Ho bisogno di supporto per un ordine'
  };
  if (actionMessages[action]) {
    await appendMessage('user', actionMessages[action]);
    disableQuickOptions();
    if (action === 'consulenza_prodotti') {
      await startProductConsultationFlow();
    } else {
      const response = await sendToAI(actionMessages[action]);
      await appendMessage('bot', response.response);
      updateSessionState(response);
    }
  }
}

async function startProductConsultationFlow() {
  conversationState.currentFlow = 'product_consultation';
  conversationState.flowData = { step: 'level_assessment' };
  const levelQuestion = `
    <div class="consultation-flow">
      <p>🎾 Perfetto! Per consigliarti al meglio, dimmi il tuo livello di gioco:</p>
      <div class="level-buttons" style="margin-top: 12px; display: flex; flex-direction: column; gap: 8px;">
        <button class="chat-option-btn" data-level="beginner">🟢 Principiante - Ho appena iniziato</button>
        <button class="chat-option-btn" data-level="intermediate">🟡 Intermedio - Gioco da qualche anno</button>
        <button class="chat-option-btn" data-level="advanced">🟠 Avanzato - Gioco regolarmente</button>
        <button class="chat-option-btn" data-level="professional">🔴 Professionale - Livello agonistico</button>
      </div>
    </div>
  `;
  await appendMessage('bot', levelQuestion);
  setupLevelButtonListeners();
}

function setupLevelButtonListeners() {
  setTimeout(() => {
    document.querySelectorAll('.chat-option-btn[data-level]').forEach(btn => {
      if (!btn.hasAttribute('data-listener-added')) {
        btn.setAttribute('data-listener-added', 'true');
        btn.addEventListener('click', function(e) {
          e.preventDefault();
          const level = this.getAttribute('data-level');
          handleLevelSelection(level);
        });
      }
    });
  }, 100);
}

async function handleLevelSelection(level) {
  conversationState.userPreferences.level = level;
  const levelNames = {
    'beginner': 'Principiante',
    'intermediate': 'Intermedio', 
    'advanced': 'Avanzato',
    'professional': 'Professionale'
  };
  await appendMessage('user', `Il mio livello è: ${levelNames[level]}`);
  disableQuickOptions();
  const budgetQuestion = `
    <div class="consultation-flow">
      <p>💰 Ottimo! Qual è il tuo budget orientativo?</p>
      <div class="budget-buttons" style="margin-top: 12px; display: flex; flex-direction: column; gap: 8px;">
        <button class="chat-option-btn" data-budget="under50">💚 Fino a €50</button>
        <button class="chat-option-btn" data-budget="50to100">💛 €50 - €100</button>
        <button class="chat-option-btn" data-budget="100to200">🧡 €100 - €200</button>
        <button class="chat-option-btn" data-budget="over200">❤️ Oltre €200</button>
      </div>
    </div>
  `;
  await appendMessage('bot', budgetQuestion);
  setupBudgetButtonListeners();
}

function setupBudgetButtonListeners() {
  setTimeout(() => {
    document.querySelectorAll('.chat-option-btn[data-budget]').forEach(btn => {
      if (!btn.hasAttribute('data-listener-added')) {
        btn.setAttribute('data-listener-added', 'true');
        btn.addEventListener('click', function(e) {
          e.preventDefault();
          const budget = this.getAttribute('data-budget');
          handleBudgetSelection(budget);
        });
      }
    });
  }, 100);
}

async function handleBudgetSelection(budget) {
  conversationState.userPreferences.budget = budget;
  const budgetNames = {
    'under50': 'Fino a €50',
    '50to100': '€50 - €100',
    '100to200': '€100 - €200',
    'over200': 'Oltre €200'
  };
  await appendMessage('user', `Budget: ${budgetNames[budget]}`);
  disableQuickOptions();
  await generateProductRecommendations();
}

// === CARD PRODOTTO PER CHAT (STILE E-COMMERCE) ===
function formatProductForChat(product) {
  return `
    <div class="chat-product-card" style="display:flex;gap:12px;align-items:flex-start;margin:12px 0;padding:12px 10px;background:#fff;border-radius:10px;box-shadow:0 2px 8px rgba(0,0,0,0.06);border:1px solid #eee;">
      <img src="${product.image}" alt="${product.name}" style="width:60px;height:60px;object-fit:contain;border-radius:8px;background:#f8f8f8;">
      <div style="flex:1;min-width:0;">
        <div style="font-weight:600;font-size:16px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${product.name}</div>
        <div style="font-size:13px;color:#888;margin:2px 0 6px 0;white-space:normal;line-height:1.3;">${product.description}</div>
        <div style="font-size:15px;color:#0077cc;font-weight:600;margin-bottom:6px;">€${product.price.toFixed(2)}</div>
        <button class="add-to-cart-chat-btn" data-product-id="${product.id}" style="background:#0077cc;color:#fff;border:none;padding:6px 16px;border-radius:6px;cursor:pointer;font-size:14px;">
          🛒 Aggiungi al Carrello
        </button>
      </div>
    </div>
  `;
}

async function generateProductRecommendations() {
  const { level, budget } = conversationState.userPreferences;
  const recommendedProducts = filterProductsByPreferences(productCatalog);
  if (recommendedProducts.length > 0) {
    let recommendationHtml = `
      <div class="product-recommendations">
        <p>🎯 <strong>Ecco i prodotti che consiglio per te:</strong></p>
        ${recommendedProducts.slice(0, 3).map(formatProductForChat).join('')}
        <p style="margin-top: 15px; font-size: 14px; color: #666;">
          💡 <em>Vuoi vedere altri prodotti o hai domande specifiche? Chiedimi pure!</em>
        </p>
      </div>
    `;
    await appendMessage('bot', recommendationHtml);
    setupAddToCartButtons();
  } else {
    await appendMessage('bot', '😅 Non ho trovato prodotti specifici per le tue preferenze, ma posso aiutarti comunque! Cosa stai cercando nello specifico?');
  }
}

function filterProductsByPreferences(products) {
  const { level, budget } = conversationState.userPreferences;
  return products.filter(product => {
    let budgetMatch = true;
    if (budget) {
      switch (budget) {
        case 'under50':
          budgetMatch = product.price <= 50;
          break;
        case '50to100':
          budgetMatch = product.price > 50 && product.price <= 100;
          break;
        case '100to200':
          budgetMatch = product.price > 100 && product.price <= 200;
          break;
        case 'over200':
          budgetMatch = product.price > 200;
          break;
      }
    }
    let levelMatch = true;
    if (level) {
      const productName = product.name.toLowerCase();
      switch (level) {
        case 'beginner':
          levelMatch = !productName.includes('pro') && !productName.includes('professional');
          break;
        case 'professional':
          levelMatch = productName.includes('pro') || productName.includes('rf97') || product.price > 200;
          break;
      }
    }
    return budgetMatch && levelMatch;
  });
}

function setupAddToCartButtons() {
  setTimeout(() => {
    document.querySelectorAll('.add-to-cart-chat-btn').forEach(btn => {
      if (!btn.hasAttribute('data-listener-added')) {
        btn.setAttribute('data-listener-added', 'true');
        btn.addEventListener('click', function(e) {
          e.preventDefault();
          const productId = parseInt(this.getAttribute('data-product-id'));
          handleChatAddToCart(productId);
        });
      }
    });
  }, 100);
}

async function handleChatAddToCart(productId) {
  if (window.addToCart) {
    window.addToCart(productId);
    const product = productCatalog.find(p => p.id === productId);
    if (product) {
      await appendMessage('bot', `✅ <strong>${product.name}</strong> aggiunto al carrello!<br>🛒 Puoi continuare lo shopping o procedere al checkout.`);
    }
  } else {
    await appendMessage('bot', '❌ Errore durante l\'aggiunta al carrello. Riprova più tardi.');
  }
}

function disableQuickOptions() {
  document.querySelectorAll('.chat-option-btn').forEach(btn => {
    btn.disabled = true;
    btn.style.opacity = '0.5';
    btn.style.cursor = 'not-allowed';
  });
}

// ==================== CHAT WIDGET FUNCTIONS ====================
function toggleChat() {
  const chatWindow = document.getElementById('chatWindowWidget');
  const chatOverlay = document.getElementById('chatOverlayWidget');
  const chatNotification = document.getElementById('chatNotification');
  if (chatWindow && chatOverlay) {
    const isActive = chatWindow.classList.contains('active');
    if (isActive) {
      closeChat();
    } else {
      openChat();
    }
  }
}

function openChat() {
  const chatWindow = document.getElementById('chatWindowWidget');
  const chatOverlay = document.getElementById('chatOverlayWidget');
  const chatNotification = document.getElementById('chatNotification');
  if (chatWindow && chatOverlay) {
    chatOverlay.classList.add('active');
    chatWindow.classList.add('active');
    if (chatNotification) {
      chatNotification.style.display = 'none';
    }
    const chatInput = document.getElementById('chatInput');
    if (chatInput) {
      setTimeout(() => chatInput.focus(), 300);
    }
  }
}

function closeChat() {
  const chatWindow = document.getElementById('chatWindowWidget');
  const chatOverlay = document.getElementById('chatOverlayWidget');
  if (chatWindow && chatOverlay) {
    chatOverlay.classList.remove('active');
    chatWindow.classList.remove('active');
  }
}

// ==================== MESSAGE FUNCTIONS ====================

async function sendChatMessage() {
  const input = document.getElementById('chatInput');
  const message = input.value.trim();
  if (!message) return;
  input.value = '';
  await appendMessage('user', message);
  const response = await sendToAI(message);

  // 1. Mostra tutte le card prodotto se la risposta contiene products
  if (response.products && Array.isArray(response.products) && response.products.length > 0) {
    const html = response.products.map(formatProductForChat).join('');
    await appendMessage('bot', html);
    setupAddToCartButtons();
    if (response.response) {
      await appendMessage('bot', response.response);
    }
    updateSessionState(response);
    return;
  }

  // 2. Se la risposta AI cita uno o più prodotti reali, mostra tutte le card trovate (ricerca "furba")
  if (response.response && productCatalog && productCatalog.length > 0) {
    const mentionedProducts = productCatalog.filter(p => {
      const productName = p.name.toLowerCase();
      const responseText = response.response.toLowerCase();
      // Match se almeno metà delle parole del nome prodotto sono presenti nella risposta
      const nameWords = productName.split(/\s+/).filter(w => w.length > 2);
      const matchCount = nameWords.filter(word => responseText.includes(word)).length;
      return matchCount >= Math.ceil(nameWords.length / 2);
    });
    if (mentionedProducts.length > 0) {
      const html = mentionedProducts.map(formatProductForChat).join('');
      await appendMessage('bot', html);
      setupAddToCartButtons();
    }
  }

  // 3. Mostra comunque il testo della risposta
  await appendMessage('bot', response.response);
  updateSessionState(response);
}

function handleChatEnterKey(event) {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    sendChatMessage();
  }
}

function handleTypingFeedback(event) {
  const input = event.target;
  const sendButton = document.getElementById('chatSendButton');
  if (sendButton) {
    if (input.value.trim()) {
      sendButton.style.background = 'var(--primary-color)';
      sendButton.style.transform = 'scale(1.05)';
    } else {
      sendButton.style.background = 'var(--text-light)';
      sendButton.style.transform = 'scale(1)';
    }
  }
}

// ==================== AI COMMUNICATION ====================
async function sendToAI(message) {
  try {
    await showTypingIndicator();
    const response = await fetch(`${BASE_URL}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-session-id': conversationState.sessionId,
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        message: message,
        context: {
          storeInfo: storeInfo,
          userPreferences: conversationState.userPreferences,
          currentFlow: conversationState.currentFlow,
          flowData: conversationState.flowData,
          productCatalog: productCatalog.slice(0, 5)
        }
      })
    });
    if (!response.ok) throw new Error(`Chat API failed: ${response.status} ${response.statusText}`);
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      throw new Error(`Invalid response content type: ${contentType}`);
    }
    const data = await response.json();
    return data;
  } catch (error) {
    return {
      response: `🤖 Mi dispiace, sto avendo problemi tecnici.<br>📞 Per assistenza contatta il nostro supporto.`,
      error: true
    };
  }
}

function updateSessionState(response) {
  if (response.totalTokens) {
    conversationState.tokenCount = response.totalTokens;
  }
  if (response.currentFlow) {
    conversationState.currentFlow = response.currentFlow;
  }
  if (response.flowData) {
    conversationState.flowData = response.flowData;
  }
}

// ==================== UI HELPER FUNCTIONS ====================
async function appendMessage(sender, content) {
  return new Promise((resolve) => {
    const chatBody = document.getElementById('chatBody');
    if (!chatBody) {
      resolve();
      return;
    }
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}`;
    messageDiv.innerHTML = content;
    chatBody.appendChild(messageDiv);
    setTimeout(() => {
      chatBody.scrollTop = chatBody.scrollHeight;
      resolve();
    }, 100);
  });
}

async function showTypingIndicator() {
  return new Promise((resolve) => {
    const typingHtml = `
      <div class="message bot typing-indicator">
        <div class="typing-animation">
          <span></span>
          <span></span>
          <span></span>
        </div>
      </div>
    `;
    const chatBody = document.getElementById('chatBody');
    if (chatBody) {
      chatBody.insertAdjacentHTML('beforeend', typingHtml);
      chatBody.scrollTop = chatBody.scrollHeight;
      setTimeout(() => {
        const typingIndicator = chatBody.querySelector('.typing-indicator');
        if (typingIndicator) {
          typingIndicator.remove();
        }
        resolve();
      }, 1200);
    } else {
      resolve();
    }
  });
}

// ==================== SESSION MANAGEMENT ====================
async function resetSession() {
  try {
    const chatBody = document.getElementById('chatBody');
    if (chatBody) {
      chatBody.innerHTML = '';
    }
    conversationState = {
      sessionId: 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
      currentFlow: null,
      flowData: {},
      tokenCount: 0,
      maxTokens: 8000,
      userPreferences: {
        level: null,
        budget: null,
        playingSurface: null,
        playingStyle: null
      }
    };
    await showWelcomeMessage();
  } catch (error) {
    // nothing
  }
}

// ==================== EXPOSED GLOBAL FUNCTIONS ====================
window.toggleChat = toggleChat;
window.closeChat = closeChat;
window.resetSession = resetSession;