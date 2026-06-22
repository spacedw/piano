#!/bin/bash
# deploy.sh — build + restart pianoapp (siempre desde archivos locales)
# Uso:
#   bash scripts/deploy.sh          → solo build + restart
#   bash scripts/deploy.sh --pull   → git pull + build + restart
set -e

APP_DIR="/data/apps/piano"
LOG="/tmp/pianoapp-deploy.log"
SUDO_PASS=$(grep SUDO_PASSWORD /data/openclaw/.env 2>/dev/null | cut -d'=' -f2-)

echo "[deploy] $(date) — iniciando" | tee -a "$LOG"
cd "$APP_DIR"

# Pull opcional
if [[ "$1" == "--pull" ]]; then
    echo "[deploy] git pull..." | tee -a "$LOG"
    git pull origin develop >> "$LOG" 2>&1
fi

# Build
echo "[deploy] building..." | tee -a "$LOG"
node_modules/.bin/vite build >> "$LOG" 2>&1
echo "[deploy] build OK" | tee -a "$LOG"

# Restart
if echo "$SUDO_PASS" | sudo -S systemctl restart pianoapp.service 2>/dev/null; then
    echo "[deploy] servicio reiniciado." | tee -a "$LOG"
else
    pkill -f "vite preview.*3020" 2>/dev/null || true
    sleep 1
    nohup bash -c "cd $APP_DIR && node_modules/.bin/vite preview --port 3020 --host 127.0.0.1" >> "$LOG" 2>&1 &
    echo "[deploy] proceso relanzado (PID $!)" | tee -a "$LOG"
fi

echo "[deploy] listo — $(date)" | tee -a "$LOG"
