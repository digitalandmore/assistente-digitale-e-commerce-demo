#!/bin/bash

echo "🚀 Avvio Assistente Digitale TennisShop..."
echo

# Verifica se Node.js è installato
if ! command -v node &> /dev/null; then
    echo "❌ Node.js non è installato. Scaricalo da: https://nodejs.org/"
    exit 1
fi

# Verifica se le dipendenze sono installate
if [ ! -d "node_modules" ]; then
    echo "📦 Installazione dipendenze..."
    npm install
fi

# Avvia il server solo se non è già in esecuzione
if lsof -i:3000 &> /dev/null; then
    echo "⚠️  Il server sembra già in esecuzione sulla porta 3000."
else
    echo "🚀 Avvio server..."
    npm start &
    SERVER_PID=$!
    sleep 3
fi

# Apertura browser solo se non già aperto
URL="http://localhost:3000"
echo "🌐 Apertura browser su $URL ..."
if command -v open &> /dev/null; then
    open "$URL"
elif command -v xdg-open &> /dev/null; then
    xdg-open "$URL"
else
    echo "🔗 Apri manualmente: $URL"
fi

wait $SERVER_PID
