const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');
const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

console.log('🚀 TENNISSHOP SERVER STARTUP - DEBUG INFO');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('PORT:', process.env.PORT);
console.log('OPENAI_API_KEY present:', !!process.env.OPENAI_API_KEY);

// ==================== MIDDLEWARE CON CORS MULTI-DOMAIN ====================
app.use(cors({
  origin: [
    'http://localhost:3000',
    'https://assistente-digitale.it',
    'https://www.assistente-digitale.it',
    'https://assistente-digitale-e-commerce-demo.onrender.com',
    'https://assistente-digitale.it/e-commerce-demo'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-session-id', 'cache-control']
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Middleware per logging e redirect intelligente
app.use((req, res, next) => {
  const host = req.get('host');
  const fullPath = req.path;
  
  console.log(`${new Date().toISOString()} - ${req.method} ${host}${fullPath}`);
  
  // Se è assistente-digitale.it ma NON ha /e-commerce-demo E NON è API, redirect
  if (host === 'assistente-digitale.it' && !fullPath.startsWith('/e-commerce-demo') && fullPath !== '/' && !fullPath.startsWith('/api/')) {
    return res.redirect(301, `/e-commerce-demo${fullPath}`);
  }
  
  next();
});

// ==================== OPENAI CONFIGURATION ====================
let openai = null;

function initializeOpenAI() {
  if (!process.env.OPENAI_API_KEY) {
    console.log('⚠️ OPENAI_API_KEY non configurata');
    return null;
  }
  
  try {
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    console.log('✅ OpenAI inizializzato correttamente');
    return openai;
  } catch (error) {
    console.error('❌ Errore inizializzazione OpenAI:', error);
    return null;
  }
}

openai = initializeOpenAI();

// ==================== PRODUCT INFO LOADER ====================
let productInfo = {};

function loadProductInfo() {
  try {
    const productInfoPath = path.join(__dirname, 'product-info.json');
    console.log('Tentativo caricamento product-info da:', productInfoPath);
    
    if (fs.existsSync(productInfoPath)) {
      const data = fs.readFileSync(productInfoPath, 'utf8');
      productInfo = JSON.parse(data);
      console.log('✅ Product info caricato:', Object.keys(productInfo));
    } else {
      console.log('⚠️ File product-info.json non trovato, uso defaults minimi');
      productInfo = getMinimalFallback();
    }
    return productInfo;
  } catch (error) {
    console.error('❌ Errore caricamento product-info.json:', error);
    productInfo = getMinimalFallback();
    return productInfo;
  }
}

function getMinimalFallback() {
  console.log('⚠️ ATTENZIONE: Usando fallback minimali. Verificare product-info.json!');
  return {
    store: {
      nome: "TennisShop Pro",
      descrizione: "Il tuo negozio specializzato per tennis e racchettismo",
      settore: "Abbigliamento e Attrezzatura Sportiva - Tennis",
      fondato: "2019",
      slogan: "Performance. Passione. Professionalità.",
      telefono: "+39 02 1234 5678",
      email: "info@tennisshoppro.it",
      indirizzo: "Via del Tennis 10, Milano (MI)",
      spedizioni: "Spedizione gratuita per ordini sopra €50"
    },
    categorie: {
      racchette: {
        nome: "Racchette da Tennis",
        descrizione: "Racchette professionali per ogni livello",
        icona: "fas fa-table-tennis"
      },
      abbigliamento: {
        nome: "Abbigliamento Tennis",
        descrizione: "Vestiario tecnico e alla moda",
        icona: "fas fa-tshirt"
      },
      scarpe: {
        nome: "Scarpe da Tennis",
        descrizione: "Calzature per ogni superficie",
        icona: "fas fa-shoe-prints"
      },
      accessori: {
        nome: "Accessori Tennis",
        descrizione: "Grip, palline, borse e altro",
        icona: "fas fa-briefcase"
      }
    },
    servizi: {
      consulenza_prodotti: {
        nome: "Consulenza Prodotti",
        descrizione: "Ti aiutiamo a scegliere l'attrezzatura perfetta"
      },
      spedizione_gratuita: {
        nome: "Spedizione Gratuita",
        descrizione: "Spedizione gratuita per ordini superiori a €50"
      }
    },
    brands: {
      wilson: { nome: "Wilson", specialita: "Racchette professionali" },
      babolat: { nome: "Babolat", specialita: "Corde e racchette" },
      nike: { nome: "Nike", specialita: "Abbigliamento e calzature" }
    },
    flow_types: {
      product_consultation: {
        nome: "Consulenza Prodotto",
        descrizione: "Ti aiutiamo a trovare il prodotto perfetto"
      },
      size_guide: {
        nome: "Guida Taglie",
        descrizione: "Assistenza per la scelta della taglia"
      },
      order_support: {
        nome: "Supporto Ordine",
        descrizione: "Aiuto per ordini e spedizioni"
      }
    }
  };
}

loadProductInfo();

// ==================== SESSION MANAGEMENT ====================
const sessions = new Map();

function getOrCreateSession(req) {
  const sessionId = req.headers['x-session-id'] || 'default';
  
  if (!sessions.has(sessionId)) {
    sessions.set(sessionId, {
      id: sessionId,
      createdAt: new Date(),
      tokenCount: 0,
      flowCount: 0,
      chatCount: 0,
      conversationHistory: [],
      currentFlow: null,
      flowData: {},
      flowStep: 0,
      isExpired: false,
      lastActivity: new Date(),
      totalCost: 0,
      currentChatCost: 0,
      userPreferences: {
        level: null,
        budget: null,
        playingSurface: null,
        playingStyle: null
      }
    });
    console.log(`📝 Nuova sessione creata: ${sessionId}`);
  }
  
  const session = sessions.get(sessionId);
  session.lastActivity = new Date();
  
  const timeoutMs = (parseInt(process.env.SESSION_TIMEOUT_MINUTES) || 45) * 60 * 1000;
  if (Date.now() - session.createdAt.getTime() > timeoutMs) {
    session.isExpired = true;
  }
  
  return session;
}

function checkSessionLimits(session) {
  const maxTokens = parseInt(process.env.MAX_TOKENS_PER_SESSION) || 8000;
  const maxFlows = parseInt(process.env.MAX_FLOWS_PER_SESSION) || 5;
  const maxChats = parseInt(process.env.MAX_CHATS_PER_SESSION) || 3;
  const maxCostPerChat = parseFloat(process.env.MAX_COST_PER_CHAT) || 0.05;
  
  const currentChatCost = session.currentChatCost || 0;
  
  return {
    tokenLimitReached: session.tokenCount >= maxTokens,
    flowLimitReached: session.flowCount >= maxFlows,
    chatLimitReached: session.chatCount >= maxChats,
    costLimitReached: currentChatCost >= maxCostPerChat,
    sessionExpired: session.isExpired,
    currentChatCost: currentChatCost,
    remainingChats: maxChats - session.chatCount,
    remainingBudget: maxCostPerChat - currentChatCost
  };
}

function calculateCost(inputTokens, outputTokens) {
  const inputCost = parseFloat(process.env.INPUT_TOKEN_COST) || 0.00015;
  const outputCost = parseFloat(process.env.OUTPUT_TOKEN_COST) || 0.0006;
  
  return (inputTokens * inputCost / 1000) + (outputTokens * outputCost / 1000);
}

function resetCurrentChat(session) {
  session.chatCount += 1;
  session.currentChatCost = 0;
  session.conversationHistory = [];
  session.currentFlow = null;
  session.flowData = {};
  session.flowStep = 0;
  
  console.log(`🔄 Chat ${session.chatCount}/3 iniziata per sessione ${session.id}`);
  
  return session;
}

// ==================== SISTEMA PROMPT E-COMMERCE TENNIS ====================
function generateDynamicSystemPrompt(session, productInfo, context = {}) {
  const store = productInfo.store || {};
  const categorie = productInfo.categorie || {};
  const servizi = productInfo.servizi || {};
  const brands = productInfo.brands || {};
  
  // ==================== DATA/ORA ITALIANA COMPLETA ====================
  const ora = new Date();
  const orarioItalia = new Date(ora.toLocaleString("en-US", {timeZone: "Europe/Rome"}));
  
  const giorni = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];
  const mesi = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 
                'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
  
  const annoCorrente = orarioItalia.getFullYear();
  const meseCorrente = orarioItalia.getMonth() + 1;
  const giornoCorrente = orarioItalia.getDate();
  const giornoSettimana = orarioItalia.getDay();
  const oreCorrente = orarioItalia.getHours();
  const minutiCorrente = orarioItalia.getMinutes();
  
  const dataCompleta = `${giorni[giornoSettimana]} ${giornoCorrente} ${mesi[orarioItalia.getMonth()]} ${annoCorrente}`;
  const oraCompleta = `${oreCorrente.toString().padStart(2, '0')}:${minutiCorrente.toString().padStart(2, '0')}`;
  
  // Stato negozio (e-commerce sempre aperto)
  const statoNegozio = '🟢 NEGOZIO ONLINE SEMPRE APERTO';
  
  // Genera lista categorie
  const categorieList = Object.values(categorie).map(c => `- ${c.nome}: ${c.descrizione}`).join('\n');
  
  // Genera lista servizi
  const serviziList = Object.values(servizi).map(s => `- ${s.nome}: ${s.descrizione}`).join('\n');
  
  // Genera lista brands
  const brandsList = Object.values(brands).map(b => `- ${b.nome}: ${b.specialita || 'Brand di qualità'}`).join('\n');
  
  // Informazioni prodotti dal context
  const productCatalogInfo = context.productCatalog && context.productCatalog.length > 0 
    ? `\nPRODOTTI IN EVIDENZA (primi 5):\n${context.productCatalog.map(p => `- ${p.name}: €${p.price} (${p.category})`).join('\n')}`
    : '';

  // User preferences
  const userPrefs = context.userPreferences || session.userPreferences || {};
  let userContext = '';
  if (userPrefs.level || userPrefs.budget) {
    userContext = `\nCONTESTO UTENTE:
- Livello di gioco: ${userPrefs.level || 'Non specificato'}
- Budget: ${userPrefs.budget || 'Non specificato'}
- Superficie preferita: ${userPrefs.playingSurface || 'Non specificato'}
- Stile di gioco: ${userPrefs.playingStyle || 'Non specificato'}`;
  }

  return `Sei l'assistente virtuale specializzato di ${store.nome}.

🕒 DATA E ORA ATTUALE (ITALIA):
• DATA: ${dataCompleta}
• ORA: ${oraCompleta}
• STATO NEGOZIO: ${statoNegozio}

INFORMAZIONI NEGOZIO (SEMPRE AGGIORNATE da product-info.json):
- Nome: ${store.nome}
- Descrizione: ${store.descrizione}
- Settore: ${store.settore}
- Fondato: ${store.fondato}
- Slogan: ${store.slogan}
- Telefono: ${store.telefono || '+39 02 1234 5678'}
- Email: ${store.email || 'info@tennisshoppro.it'}
- Indirizzo: ${store.indirizzo || 'Via del Tennis 10, Milano'}
- Spedizioni: ${store.spedizioni || 'Spedizione gratuita sopra €50'}

CATEGORIE PRODOTTI:
${categorieList}

SERVIZI DISPONIBILI:
${serviziList}

BRANDS PRINCIPALI:
${brandsList}

${productCatalogInfo}

${userContext}

INFO SPEDIZIONI E CONSEGNE:
- Spedizione GRATUITA per ordini superiori a €50
- Consegna in 24-48h in tutta Italia
- Tracking completo dell'ordine
- Reso gratuito entro 30 giorni
- Pagamento sicuro con carte e PayPal

GESTIONE FLOW (SE ATTIVO):
${session.currentFlow ? `
🔄 FLOW ATTIVO: ${session.currentFlow.toUpperCase()}
⚠️ IMPORTANTE: Questo flow gestisce la conversazione guidata per consulenza prodotti.
` : 'Nessun flow attivo - rispondi normalmente usando le informazioni sopra.'}

REGOLE COMPORTAMENTO SPECIALIZZATO TENNIS:
1. Sei un ESPERTO di tennis e attrezzature sportive
2. Conosci tutti i prodotti: racchette, scarpe, abbigliamento, accessori
3. Sai consigliare in base a: livello di gioco, budget, superficie, stile
4. Fornisci sempre consigli tecnici specifici e dettagliati
5. Usa terminologia tecnica del tennis quando appropriato
6. Considera peso racchetta, tensione corde, tipo suola scarpe, ecc.
7. Risposte BREVI ma TECNICHE (max 3-4 righe)
8. USA SEMPRE emoji tennis appropriate 🎾🏆👟
9. HTML: <br> per nuove righe, <strong> per grassetto
10. SEMPRE professionale ma entusiasta del tennis

ESEMPI DI CONSULENZA TENNIS:
- "Per principianti consiglio racchette 260-280g, head 100+ sq.in"
- "Su terra battuta serve suola specifica con pattern herringbone"
- "Tensione corde: 24-26kg per potenza, 26-28kg per controllo"
- "Wilson Pro Staff per giocatori tecnici, Babolat Pure Drive per potenza"

FLOW DI CONSULENZA PRODOTTI:
Se l'utente chiede consigli, avvia flow guidato:
1. Livello di gioco (principiante/intermedio/avanzato/professionale)
2. Budget orientativo (sotto €50, €50-100, €100-200, oltre €200)
3. Raccomandazioni specifiche con add-to-cart

Rispondi SEMPRE in italiano, con passione per il tennis e conoscenza tecnica approfondita.`;
}

// ==================== SISTEMA FLOW E-COMMERCE ====================

function detectFlowIntent(message, session) {
  const msg = message.toLowerCase();
  if (session.currentFlow) {
    return { continue: true, flow: session.currentFlow };
  }
  if (msg.includes('consigli') || msg.includes('consiglio') || msg.includes('aiuto a scegliere') ||
      msg.includes('che racchetta') || msg.includes('che scarpe') || msg.includes('consulenza')) {
    return { start: true, flow: 'product_consultation' };
  }
  if (msg.includes('taglie') || msg.includes('taglia') || msg.includes('misura') || msg.includes('size')) {
    return { start: true, flow: 'size_guide' };
  }
  if (msg.includes('spedizione') || msg.includes('consegna') || msg.includes('reso') || msg.includes('ordine')) {
    return { start: true, flow: 'order_support' };
  }
  return { continue: false, flow: null };
}

function getFlowSteps(flowType) {
  const steps = {
    product_consultation: [
      {
        field: 'level',
        question: '🎾 Perfetto! Per consigliarti al meglio, dimmi il tuo livello di gioco:<br><br>🟢 <strong>Principiante</strong> - Ho appena iniziato<br>🟡 <strong>Intermedio</strong> - Gioco da qualche anno<br>🟠 <strong>Avanzato</strong> - Gioco regolarmente<br>🔴 <strong>Professionale</strong> - Livello agonistico',
        validation: /^(principiante|intermedio|avanzato|professionale|beginner|intermediate|advanced|professional|1|2|3|4)$/i,
        error: 'Per favore scegli tra: principiante, intermedio, avanzato, professionale'
      },
      {
        field: 'budget',
        question: '💰 Ottimo! Qual è il tuo budget orientativo?<br><br>💚 <strong>Fino a €50</strong><br>💛 <strong>€50 - €100</strong><br>🧡 <strong>€100 - €200</strong><br>❤️ <strong>Oltre €200</strong>',
        validation: /^(fino a \€?50|sotto 50|meno di 50|under50|50[\s\-]100|tra 50 e 100|50to100|100[\s\-]200|tra 100 e 200|100to200|oltre \€?200|sopra 200|più di 200|over200|tutti|100|200|da 100 a 200|oltre i 200)$/i,
        error: 'Per favore indica un range di budget valido'
      },
      {
        field: 'category',
        question: '🛍️ Che tipo di prodotto stai cercando?<br><br>🎾 <strong>Racchette</strong><br>👕 <strong>Abbigliamento</strong><br>👟 <strong>Scarpe</strong><br>🎒 <strong>Accessori</strong>',
        validation: /^(racchette?|abbigliamento|scarpe?|accessori|racket|clothing|shoes|accessories)$/i,
        error: 'Per favore scegli tra: racchette, abbigliamento, scarpe, accessori'
      }
    ],
    size_guide: [
      {
        field: 'product_type',
        question: '📏 Per quale tipo di prodotto ti serve la guida taglie?<br><br>👕 <strong>Abbigliamento</strong> (maglie, pantaloni, giacche)<br>👟 <strong>Scarpe</strong> (da tennis)<br>🧢 <strong>Accessori</strong> (cappelli, polsini)',
        validation: /^(abbigliamento|scarpe?|accessori|clothing|shoes|accessories)$/i,
        error: 'Per favore scegli tra: abbigliamento, scarpe, accessori'
      }
    ],
    order_support: [
      {
        field: 'support_type',
        question: '💬 Come posso aiutarti con il tuo ordine?<br><br>📦 <strong>Tracking spedizione</strong><br>↩️ <strong>Reso/Cambio</strong><br>💳 <strong>Pagamento</strong><br>❓ <strong>Domanda generale</strong>',
        validation: /^(tracking|spedizione|reso|cambio|pagamento|generale|shipping|return|payment|general)$/i,
        error: 'Per favore scegli tra: tracking, reso, pagamento, generale'
      }
    ]
  };
  return steps[flowType] || [];
}

function processFlowStep(session, message) {
  if (!session.currentFlow) return null;
  const steps = getFlowSteps(session.currentFlow);
  if (!steps.length) return null;
  const currentStep = steps[session.flowStep];
  if (!currentStep) return null;

  // Normalizza input utente
  const normalizedMessage = message.trim().toLowerCase();

  // Mappings per input flessibile
  const levelMappings = {
    'principiante': 'principiante', 'beginner': 'principiante', '1': 'principiante',
    'intermedio': 'intermedio', 'intermediate': 'intermedio', '2': 'intermedio',
    'avanzato': 'avanzato', 'advanced': 'avanzato', '3': 'avanzato',
    'professionale': 'professionale', 'professional': 'professionale', '4': 'professionale'
  };
  const budgetMappings = {
    'fino a 50': 'under50', 'sotto 50': 'under50', 'meno di 50': 'under50', 'under50': 'under50',
    '50 100': '50to100', '50-100': '50to100', 'tra 50 e 100': '50to100', '50to100': '50to100', '50': '50to100',
    '100 200': '100to200', '100-200': '100to200', 'tra 100 e 200': '100to200', '100to200': '100to200', '100': '100to200',
    'oltre 200': 'over200', 'sopra 200': 'over200', 'più di 200': 'over200', 'over200': 'over200', '200': 'over200',
    'da 100 a 200': '100to200', 'oltre i 200': 'over200', 'tutti': 'over200'
  };

  let processedValue = normalizedMessage;
  if (currentStep.field === 'level' && levelMappings[normalizedMessage]) {
    processedValue = levelMappings[normalizedMessage];
  } else if (currentStep.field === 'budget' && budgetMappings[normalizedMessage]) {
    processedValue = budgetMappings[normalizedMessage];
  }

  let isValid = currentStep.validation.test(processedValue);

  if (!isValid) {
    return {
      response: `❌ ${currentStep.error}<br><br>${currentStep.question}`,
      invalid: true
    };
  }

  // Salva dato validato
  session.flowData[currentStep.field] = processedValue;
  session.flowStep++;

  // Aggiorna user preferences
  if (currentStep.field === 'level') {
    session.userPreferences.level = processedValue;
  } else if (currentStep.field === 'budget') {
    session.userPreferences.budget = processedValue;
  }

  // Controlla se ci sono altri step
  if (session.flowStep < steps.length) {
    const nextStep = steps[session.flowStep];
    return {
      response: nextStep.question,
      continue: true,
      progress: `${session.flowStep + 1}/${steps.length}`
    };
  } else {
    // Flow completato - genera raccomandazioni
    return generateFlowCompletion(session);
  }
}

function generateFlowCompletion(session) {
  const flowType = session.currentFlow;
  const flowData = { ...session.flowData };

  // Reset flow
  session.currentFlow = null;
  session.flowData = {};
  session.flowStep = 0;
  session.flowCount++;

  if (flowType === 'product_consultation') {
    return generateProductRecommendations(flowData, session);
  } else if (flowType === 'size_guide') {
    return generateSizeGuide(flowData);
  } else if (flowType === 'order_support') {
    return generateOrderSupport(flowData);
  }

  return {
    response: '✅ Consulenza completata! Come posso aiutarti ancora?',
    completed: true
  };
}

function generateProductRecommendations(flowData, session) {
  const { level, budget, category } = flowData;

  // Logica raccomandazioni testuale (come già presente)
  let recommendations = '';
  if (category === 'racchette') {
    if (level === 'principiante') {
      recommendations = `🎾 <strong>Racchette per Principianti</strong><br><br>
        Ti consiglio racchette con:<br>
        • <strong>Peso:</strong> 260-280g (più facili da manovrare)<br>
        • <strong>Head size:</strong> 100+ sq.in (area di impatto maggiore)<br>
        • <strong>Pattern corde:</strong> 16x19 (più potenza, più tolleranza)<br><br>
        🏆 <strong>Modelli consigliati:</strong><br>
        • Babolat Drive Max (€89) - Perfetta per iniziare<br>
        • Wilson Clash 100 (€199) - Comfort superiore<br>
        • Head Ti S6 (€69) - Ottimo rapporto qualità/prezzo`;
    } else if (level === 'professionale') {
      recommendations = `🏆 <strong>Racchette Professionali</strong><br><br>
        Per il tuo livello ti serve:<br>
        • <strong>Peso:</strong> 300+ g (controllo e precisione)<br>
        • <strong>Head size:</strong> 95-100 sq.in (controllo ottimale)<br>
        • <strong>Pattern corde:</strong> 18x20 (massimo controllo)<br><br>
        🥇 <strong>Modelli top:</strong><br>
        • Wilson Pro Staff RF97 (€299) - La racchetta di Federer<br>
        • Babolat Pure Strike (€249) - Precisione chirurgica<br>
        • Head Prestige MP (€279) - Classico atemporale`;
    }
  } else if (category === 'scarpe') {
    recommendations = `👟 <strong>Scarpe da Tennis</strong><br><br>
      Caratteristiche essenziali:<br>
      • <strong>Suola:</strong> Herringbone per terra battuta, All Court per cemento<br>
      • <strong>Ammortizzazione:</strong> Importante per articolazioni<br>
      • <strong>Stabilità:</strong> Supporto laterale per cambi direzione<br><br>
      🏃‍♂️ <strong>Modelli top:</strong><br>
      • Nike Air Zoom Vapor Cage 4 (€139)<br>
      • Adidas Barricade 2022 (€119)<br>
      • Asics Gel Resolution 8 (€149)`;
  }

  // Trova i prodotti reali dal catalogo
  let products = [];
  if (productInfo && productInfo.prodotti) {
    products = productInfo.prodotti.filter(p => {
      let match = true;
      if (category) match = match && p.category === category;
      if (level) {
        if (level === 'principiante') match = match && !p.name.toLowerCase().includes('pro');
        if (level === 'professionale') match = match && (p.name.toLowerCase().includes('pro') || p.price > 200);
      }
      if (budget) {
        if (budget === 'under50') match = match && p.price <= 50;
        if (budget === '50to100') match = match && p.price > 50 && p.price <= 100;
        if (budget === '100to200') match = match && p.price > 100 && p.price <= 200;
        if (budget === 'over200') match = match && p.price > 200;
      }
      return match;
    }).slice(0, 3); // massimo 3 prodotti consigliati
  }

  const response = `✅ <strong>Consulenza completata!</strong><br><br>
    📋 <strong>Il tuo profilo:</strong><br>
    • Livello: ${level}<br>
    • Budget: ${budget}<br>
    • Categoria: ${category}<br><br>
    ${recommendations}<br><br>
    🛒 <strong>Vuoi vedere questi prodotti nel catalogo?</strong><br>
    💬 <strong>Hai altre domande tecniche?</strong>`;

  return {
    response: response,
    completed: true,
    recommendations: recommendations,
    products // <-- array di prodotti consigliati
  };
}

function generateSizeGuide(flowData) {
  const { product_type } = flowData;
  let guide = '';
  if (product_type === 'abbigliamento') {
    guide = `👕 <strong>Guida Taglie Abbigliamento</strong><br><br>
      <strong>UOMO:</strong><br>
      • S: Torace 88-96cm<br>
      • M: Torace 96-104cm<br>
      • L: Torace 104-112cm<br>
      • XL: Torace 112-120cm<br><br>
      <strong>DONNA:</strong><br>
      • S: Torace 82-90cm<br>
      • M: Torace 90-98cm<br>
      • L: Torace 98-106cm<br>
      • XL: Torace 106-114cm<br><br>
      📏 <strong>Come misurare:</strong> Torace nel punto più largo`;
  } else if (product_type === 'scarpe') {
    guide = `👟 <strong>Guida Taglie Scarpe</strong><br><br>
      <strong>CONVERSIONE EU/US:</strong><br>
      • EU 40 = US 7 = 25.5cm<br>
      • EU 41 = US 8 = 26cm<br>
      • EU 42 = US 8.5 = 26.5cm<br>
      • EU 43 = US 9.5 = 27cm<br>
      • EU 44 = US 10 = 27.5cm<br>
      • EU 45 = US 11 = 28cm<br><br>
      📏 <strong>Consiglio:</strong> Misura i piedi la sera (sono più gonfi)`;
  }
  return {
    response: `✅ <strong>Guida Taglie</strong><br><br>${guide}<br><br>❓ <strong>Hai ancora dubbi sulla taglia?</strong> Scrivimi!`,
    completed: true
  };
}

function generateOrderSupport(flowData, message = '') {
  const { support_type } = flowData;
  let supportInfo = '';

  // Cerca un codice ordine nel messaggio
  const orderCodeRegex = /\bTS\d{6,}\b/i;
  const orderCodeMatch = message && message.match ? message.match(orderCodeRegex) : null;

  if (support_type === 'tracking') {
    if (!orderCodeMatch) {
      // Chiedi il numero ordine se non presente
      supportInfo = `📦 <strong>Tracking Spedizione</strong><br><br>
        Per aiutarti, inserisci il <strong>numero del tuo ordine</strong> (es: <code>TS123456</code>).<br><br>
        🔎 <em>Scrivi qui sotto il codice ordine che vuoi tracciare!</em>`;
      return {
        response: supportInfo,
        completed: false,
        askOrderNumber: true
      };
    } else {
      // (Qui puoi opzionalmente gestire la risposta se il codice è già presente)
      supportInfo = `🔎 Sto verificando il tuo ordine <strong>${orderCodeMatch[0]}</strong>...`;
      return {
        response: supportInfo,
        completed: false
      };
    }
  } else if (support_type === 'reso') {
    supportInfo = `↩️ <strong>Reso e Cambio</strong><br><br>
      • <strong>Tempo:</strong> 30 giorni dalla consegna<br>
      • <strong>Condizioni:</strong> Prodotti non utilizzati con etichette<br>
      • <strong>Costo:</strong> Reso GRATUITO con etichetta prepagata<br>
      • <strong>Rimborso:</strong> 3-5 giorni lavorativi<br><br>
      📧 <strong>Per iniziare:</strong> Contatta ${productInfo.store?.email || 'info@tennisshoppro.it'}`;
  }
  return {
    response: `✅ <strong>Supporto Ordini</strong><br><br>${supportInfo}<br><br>📞 <strong>Serve altro aiuto?</strong> Chiamaci: ${productInfo.store?.telefono || '+39 02 1234 5678'}`,
    completed: true
  };
}

// ==================== EMAIL TRANSPORTER ====================
let transporter = null;

function initializeEmailTransporter() {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.log('⚠️ Email non configurata - modalità sviluppo');
    return null;
  }

  try {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT || 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
    
    console.log('✅ Email transporter inizializzato');
    return transporter;
  } catch (error) {
    console.error('❌ Errore inizializzazione email:', error);
    return null;
  }
}

transporter = initializeEmailTransporter();

// ==================== API ENDPOINTS ====================

// Health check endpoint
app.get('/api/health', (req, res) => {
  console.log('🔍 Health check richiesto');
  res.json({ 
    status: 'OK',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    port: port,
    host: req.get('host'),
    path: req.path,
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    maxTokensPerSession: process.env.MAX_TOKENS_PER_SESSION || 8000,
    maxChatsPerSession: process.env.MAX_CHATS_PER_SESSION || 3,
    maxFlowsPerSession: process.env.MAX_FLOWS_PER_SESSION || 5,
    activeSessions: sessions.size,
    productInfoLoaded: Object.keys(productInfo).length > 0,
    emailConfigured: !!transporter,
    openaiConfigured: !!process.env.OPENAI_API_KEY,
    ecommerceFlowActive: true,
    storeType: 'tennis_ecommerce'
  });
});

// Product info endpoint
app.get('/api/product-info', (req, res) => {
  try {
    res.json(productInfo);
    console.log('✅ Product info inviato via API');
  } catch (error) {
    console.error('❌ Errore product-info endpoint:', error);
    res.status(500).json({ error: 'Unable to load product info' });
  }
});

// Session info endpoint
app.get('/api/session-info', (req, res) => {
  try {
    const sessionId = req.headers['x-session-id'] || 'default';
    const session = sessions.get(sessionId);
    
    if (!session) {
      return res.json({
        sessionId: sessionId,
        tokenCount: 0,
        maxTokens: parseInt(process.env.MAX_TOKENS_PER_SESSION) || 8000,
        currentFlow: null,
        flowData: {},
        flowStep: 0,
        chatCount: 0,
        maxChats: parseInt(process.env.MAX_CHATS_PER_SESSION) || 3,
        totalCost: 0,
        userPreferences: {
          level: null,
          budget: null,
          playingSurface: null,
          playingStyle: null
        },
        isNew: true
      });
    }
    
    res.json({
      sessionId: session.id,
      tokenCount: session.tokenCount || 0,
      maxTokens: parseInt(process.env.MAX_TOKENS_PER_SESSION) || 8000,
      currentFlow: session.currentFlow,
      flowData: session.flowData || {},
      flowStep: session.flowStep || 0,
      chatCount: session.chatCount || 0,
      maxChats: parseInt(process.env.MAX_CHATS_PER_SESSION) || 3,
      totalCost: session.totalCost || 0,
      currentChatCost: session.currentChatCost || 0,
      lastActivity: session.lastActivity,
      isExpired: session.isExpired || false,
      userPreferences: session.userPreferences || {}
    });
    
    console.log(`✅ Session info inviato per: ${sessionId}`);
    
  } catch (error) {
    console.error('❌ Errore session-info endpoint:', error);
    res.status(500).json({ 
      error: 'Unable to load session info',
      sessionId: req.headers['x-session-id'] || 'default',
      tokenCount: 0,
      maxTokens: 8000
    });
  }
});

// Reset session endpoint
app.post('/api/reset-session', (req, res) => {
  const sessionId = req.headers['x-session-id'] || 'default';
  
  if (sessions.has(sessionId)) {
    const session = sessions.get(sessionId);
    resetCurrentChat(session);
    
    console.log(`🔄 Chat resettata: ${sessionId} (Chat ${session.chatCount}/3)`);
    
    res.json({ 
      success: true, 
      message: `Chat ${session.chatCount}/3 iniziata`,
      chatInfo: {
        currentChat: session.chatCount,
        maxChats: 3,
        remainingChats: 3 - session.chatCount
      }
    });
  } else {
    res.json({ success: true, message: 'Nuova sessione creata' });
  }
});

// ==================== MAIN CHAT ENDPOINT E-COMMERCE ====================
app.post('/api/chat', async (req, res) => {
  try {
    const { message, forceNewSession = false, context = {} } = req.body;

    if (forceNewSession) {
      const sessionId = req.headers['x-session-id'] || 'default';
      const oldSession = sessions.get(sessionId);
      if (oldSession) {
        resetCurrentChat(oldSession);
      }
    }

    const session = getOrCreateSession(req);

    if (session.currentChatCost === undefined) {
      session.currentChatCost = 0;
    }

    const limits = checkSessionLimits(session);

    console.log(`💬 [${session.id}] Chat ${session.chatCount + 1}/3 - Messaggio: "${message.substring(0, 50)}..."`);
    console.log(`💰 [${session.id}] Costo chat: $${limits.currentChatCost.toFixed(4)}, Chat rimanenti: ${limits.remainingChats}`);

    if (!openai) {
      return res.json({
        response: "🤖 Servizio AI non configurato. Contatta l'amministratore del negozio.",
        error: true
      });
    }

    // Controlli limiti
    if (limits.chatLimitReached) {
      return res.json({
        response: `🚫 <strong>Limite raggiunto!</strong><br>
                   Hai utilizzato tutte le 3 chat disponibili per questa sessione.<br><br>
                   💰 Budget utilizzato: €${(session.totalCost * 0.92).toFixed(3)}<br>
                   📞 Per continuare, contattaci: ${productInfo.store?.telefono || '+39 02 1234 5678'}<br>
                   📧 Email: ${productInfo.store?.email || 'info@tennisshoppro.it'}`,
        limitReached: true,
        chatLimitReached: true
      });
    }

    if (limits.costLimitReached) {
      resetCurrentChat(session);

      if (session.chatCount >= 3) {
        return res.json({
          response: `💰 <strong>Budget esaurito!</strong><br>
                     Limite sessione raggiunto (3 chat utilizzate).<br>
                     📞 Contattaci: ${productInfo.store?.telefono || '+39 02 1234 5678'}`,
          limitReached: true,
          chatLimitReached: true
        });
      }

      return res.json({
        response: `💰 <strong>Budget chat esaurito!</strong><br>
                   ✅ <strong>Nuova chat avviata!</strong> (${session.chatCount}/3)<br><br>
                   🎾 Riprova il tuo messaggio per continuare!`,
        newChatStarted: true,
        chatInfo: {
          currentChat: session.chatCount,
          maxChats: 3,
          remainingChats: 3 - session.chatCount
        }
      });
    }

    // ==================== PATCH: GESTIONE CODICE ORDINE DEMO ====================
    const orderDemo = productInfo.ordine_demo;
    const orderCodeRegex = /\bTS\d{6,}\b/i;
    const orderCodeMatch = message.match(orderCodeRegex);

    if (orderDemo && orderCodeMatch) {
      if (orderCodeMatch[0].toUpperCase() === orderDemo.numero_ordine.toUpperCase()) {
        return res.json({
          response: `
            📦 <strong>Tracking ordine ${orderDemo.numero_ordine}</strong><br>
            <strong>Stato:</strong> ${orderDemo.stato}<br>
            <strong>Corriere:</strong> GLS<br>
            <strong>Tracking:</strong> <a href="${orderDemo.link_tracking}" target="_blank">${orderDemo.tracking}</a><br>
            <strong>Ultimo aggiornamento:</strong> In transito<br><br>
            🔗 <a href="${orderDemo.link_tracking}" target="_blank">Clicca qui per tracciare il tuo ordine</a>
          `,
          orderTracking: true,
          orderNumber: orderDemo.numero_ordine,
          trackingCode: orderDemo.tracking,
          trackingLink: orderDemo.link_tracking,
          orderStatus: orderDemo.stato
        });
      } else {
        return res.json({
          response: `❌ Il codice ordine <strong>${orderCodeMatch[0]}</strong> non risulta nei nostri sistemi demo.<br>Verifica di aver inserito il codice corretto o contattaci per assistenza.<br><br>📧 Email: ${productInfo.store?.email || 'info@tennisshoppro.it'}<br>📞 Tel: ${productInfo.store?.telefono || '+39 02 1234 5678'}`,
          orderTracking: false
        });
      }
    }

    // ==================== GESTIONE FLOW E-COMMERCE ====================
    if (session.currentFlow) {
      const flowResult = processFlowStep(session, message);
      if (flowResult) {
        console.log(`🔄 [${session.id}] Flow step processato: ${flowResult.invalid ? 'INVALID' : 'VALID'}`);
        return res.json({
          response: flowResult.response,
          currentFlow: session.currentFlow,
          flowData: session.flowData,
          flowStep: session.flowStep,
          flowCompleted: flowResult.completed || false,
          recommendations: flowResult.recommendations || null,
          products: flowResult.products || [],
          sessionId: session.id,
          chatInfo: {
            currentChat: session.chatCount || 1,
            maxChats: parseInt(process.env.MAX_CHATS_PER_SESSION) || 3,
            remainingChats: (parseInt(process.env.MAX_CHATS_PER_SESSION) || 3) - (session.chatCount || 0)
          }
        });
      }
    }

    // Rileva nuovo flow
    const flowIntent = detectFlowIntent(message, session);

    if (flowIntent.start) {
      session.currentFlow = flowIntent.flow;
      session.flowData = {};
      session.flowStep = 0;

      console.log(`🔄 [${session.id}] Nuovo flow avviato: ${flowIntent.flow}`);

      const steps = getFlowSteps(flowIntent.flow);
      if (steps.length > 0) {
        return res.json({
          response: steps[0].question,
          currentFlow: session.currentFlow,
          flowData: session.flowData,
          flowStep: session.flowStep,
          sessionId: session.id,
          chatInfo: {
            currentChat: session.chatCount || 1,
            maxChats: parseInt(process.env.MAX_CHATS_PER_SESSION) || 3,
            remainingChats: (parseInt(process.env.MAX_CHATS_PER_SESSION) || 3) - (session.chatCount || 0)
          }
        });
      }
    }

    // ==================== RISPOSTA AI SPECIALIZZATA TENNIS ====================
    const systemPrompt = generateDynamicSystemPrompt(session, productInfo, context);

    const messages = [
      { role: 'system', content: systemPrompt },
      ...session.conversationHistory.slice(-6),
      { role: 'user', content: message }
    ];

    console.log(`🤖 [${session.id}] Chiamata GPT-4o-mini specializzato tennis...`);

    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      messages: messages,
      max_tokens: parseInt(process.env.OPENAI_MAX_TOKENS) || 800,
      temperature: parseFloat(process.env.OPENAI_TEMPERATURE) || 0.7,
    });

    const response = completion.choices[0].message.content;
    const inputTokens = completion.usage.prompt_tokens;
    const outputTokens = completion.usage.completion_tokens;
    const totalTokens = completion.usage.total_tokens;

    const costThisCall = calculateCost(inputTokens, outputTokens);
    session.currentChatCost += costThisCall;
    session.totalCost += costThisCall;

    console.log(`✅ [${session.id}] Risposta AI tennis (${totalTokens} token, $${costThisCall.toFixed(4)})`);

    // Aggiorna cronologia
    session.conversationHistory.push(
      { role: 'user', content: message },
      { role: 'assistant', content: response }
    );
    session.tokenCount += totalTokens;

    // Mantieni solo ultimi 12 messaggi
    if (session.conversationHistory.length > 12) {
      session.conversationHistory = session.conversationHistory.slice(-12);
    }

    res.json({
      response: response,
      tokensUsed: totalTokens,
      totalTokens: session.tokenCount,
      remainingTokens: (parseInt(process.env.MAX_TOKENS_PER_SESSION) || 8000) - session.tokenCount,
      currentFlow: session.currentFlow,
      flowData: session.flowData,
      userPreferences: session.userPreferences,
      sessionId: session.id,
      costInfo: {
        thisCall: costThisCall,
        currentChatCost: session.currentChatCost,
        totalSessionCost: session.totalCost,
        remainingBudget: parseFloat(process.env.MAX_COST_PER_CHAT) - session.currentChatCost
      },
      chatInfo: {
        currentChat: session.chatCount || 1,
        maxChats: parseInt(process.env.MAX_CHATS_PER_SESSION) || 3,
        remainingChats: (parseInt(process.env.MAX_CHATS_PER_SESSION) || 3) - (session.chatCount || 0)
      }
    });

  } catch (error) {
    console.error('❌ Errore ChatGPT:', error);

    res.status(500).json({
      response: `🤖 Mi dispiace, sto avendo problemi tecnici.<br>📞 Per assistenza: ${productInfo.store?.telefono || '+39 02 1234 5678'}<br>📧 Email: ${productInfo.store?.email || 'info@tennisshoppro.it'}`,
      error: true
    });
  }
});

// ==================== SERVE STATIC FILES ====================
// Per assistente-digitale.it/e-commerce-demo/
app.use('/e-commerce-demo', express.static(__dirname, {
  dotfiles: 'ignore',
  etag: false,
  extensions: ['html', 'js', 'css', 'json'],
  index: ['index.html'],
  maxAge: '1d',
  setHeaders: function (res, path, stat) {
    res.set('x-timestamp', Date.now());
    res.set('x-served-from', 'ecommerce-subdirectory');
  }
}));

// Per il dominio Render diretto
app.use(express.static(__dirname, {
  dotfiles: 'ignore',
  etag: false,
  extensions: ['html', 'js', 'css', 'json'],
  index: ['index.html'],
  maxAge: '1d',
  setHeaders: function (res, path, stat) {
    res.set('x-timestamp', Date.now());
    res.set('x-served-from', 'root');
  }
}));

// ==================== ROOT ROUTES ====================
app.get('/e-commerce-demo', (req, res) => {
  console.log('🏠 Root e-commerce-demo richiesto');
  const indexPath = path.join(__dirname, 'index.html');
  
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).send('index.html not found');
  }
});

app.get('/', (req, res) => {
  console.log('🏠 Root richiesto');
  const host = req.get('host');
  
  // Se è assistente-digitale.it redirect a /e-commerce-demo/
  if (host === 'assistente-digitale.it') {
    return res.redirect(301, '/e-commerce-demo/');
  }
  
  // Altrimenti servi index.html normalmente
  const indexPath = path.join(__dirname, 'index.html');
  
  if (fs.existsExists(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).send('index.html not found');
  }
});

// ==================== ERROR HANDLERS ====================
app.use((req, res) => {
  console.log(`❌ 404 - Path non trovato: ${req.path}`);
  res.status(404).json({ error: 'Path not found', path: req.path });
});

app.use((error, req, res, next) => {
  console.error('❌ Errore server:', error);
  res.status(500).json({ error: 'Internal server error', message: error.message });
});

// ==================== SESSION CLEANUP ====================
setInterval(() => {
  const now = Date.now();
  const timeoutMs = (parseInt(process.env.SESSION_TIMEOUT_MINUTES) || 45) * 60 * 1000;
  
  for (const [sessionId, session] of sessions.entries()) {
    if (now - session.lastActivity.getTime() > timeoutMs) {
      sessions.delete(sessionId);
      console.log(`🗑️ Sessione rimossa per inattività: ${sessionId}`);
    }
  }
}, 10 * 60 * 1000);

// ==================== SERVER START ====================
app.listen(port, '0.0.0.0', () => {
  console.log('🚀 ===================================');
  console.log(`🎾 TENNISSHOP PRO - ASSISTENTE DIGITALE`);
  console.log('🚀 ===================================');
  console.log(`🌐 Render URL: https://assistente-digitale-e-commerce-demo.onrender.com`);
  console.log(`🌐 Custom URL: https://assistente-digitale.it/e-commerce-demo/`);
  console.log(`🤖 Modello: ${process.env.OPENAI_MODEL || 'gpt-4o-mini'}`);
  console.log(`📊 Token/sessione: ${process.env.MAX_TOKENS_PER_SESSION || 8000}`);
  console.log(`💬 Chat/sessione: ${process.env.MAX_CHATS_PER_SESSION || 3}`);
  console.log(`💰 Budget/chat: €${((parseFloat(process.env.MAX_COST_PER_CHAT) || 0.05) * 0.92).toFixed(3)}`);
  console.log(`📋 Product info: ${Object.keys(productInfo).length} sezioni`);
  console.log(`📧 Email: ${transporter ? 'CONFIGURATO' : 'SVILUPPO'}`);
  console.log(`🔑 OpenAI: ${openai ? 'CONFIGURATO' : 'NON CONFIGURATO'}`);
  console.log(`🔄 E-commerce Flow: ATTIVATO (consulenza prodotti)`);
  console.log(`🎾 Specializzazione: TENNIS & RACCHETTISMO`);
  console.log(`🛒 Features: Product consultation, Size guide, Order support`);
  console.log('🚀 ===================================');
});

process.on('SIGTERM', () => {
  console.log('🛑 TennisShop server in chiusura...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('🛑 TennisShop server interrotto...');
  process.exit(0);
});