#!/bin/bash
# deploy.sh — pull + build + restart pianoapp
set -e

APP_DIR="/data/apps/piano"
LOG="/tmp/pianoapp-deploy.log"

echo "[deploy] $(date) — iniciando deploy" | tee -a "$LOG"

cd "$APP_DIR"

# Pull latest develop
git pull origin develop >> "$LOG" 2>&1

# Build
node_modules/.bin/vite build >> "$LOG" 2>&1

# Restart systemd service (o proceso directo si no hay service)
if systemctl is-active --quiet pianoapp.service 2>/dev/null; then
    systemctl restart pianoapp.service
    echo "[deploy] Servicio pianoapp reiniciado." | tee -a "$LOG"
else
    # Fallback: kill viejo y relanzar
    pkill -f "vite preview.*3020" 2>/dev/null || true
    sleep 1
    nohup bash -c "cd $APP_DIR && node_modules/.bin/vite preview --port 3020 --host 127.0.0.1" >> "$LOG" 2>&1 &
    echo "[deploy] Proceso relanzado (PID $!)" | tee -a "$LOG"
fi

echo "[deploy] Deploy completado." | tee -a "$LOG"
