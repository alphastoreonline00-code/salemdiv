#!/bin/bash
# ═══════════════════════════════════════
#   SRR 330 - Instalador automático VPS
# ═══════════════════════════════════════

set -e

echo ""
echo "🚀 Instalando SRR 330 SYSTEM..."
echo ""

# Detecta se é root ou precisa sudo
SUDO=""
if [ "$EUID" -ne 0 ]; then SUDO="sudo"; fi

# 1. Atualiza sistema
echo "📦 Atualizando sistema..."
$SUDO apt update -y

# 2. Instala Node.js 20 se não tiver
if ! command -v node &> /dev/null || [ "$(node -v | cut -d. -f1 | tr -d 'v')" -lt "18" ]; then
  echo "📥 Instalando Node.js 20..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | $SUDO -E bash -
  $SUDO apt install -y nodejs
fi

echo "✅ Node $(node -v)"
echo "✅ NPM  $(npm -v)"
echo ""

# 3. Instala dependências do projeto
echo "📦 Instalando dependências (pode demorar 1-3 min)..."
npm install

# 4. Instala PM2 global
if ! command -v pm2 &> /dev/null; then
  echo "📥 Instalando PM2..."
  $SUDO npm install -g pm2
fi

echo ""
echo "═══════════════════════════════════════"
echo "✅ INSTALAÇÃO CONCLUÍDA!"
echo "═══════════════════════════════════════"
echo ""
echo "▶️  Para rodar agora:           node index.js"
echo "▶️  Para rodar em background:   pm2 start ecosystem.config.js"
echo "▶️  Ver logs:                   pm2 logs srr330"
echo "▶️  Iniciar com a VPS:          pm2 save && pm2 startup"
echo ""
