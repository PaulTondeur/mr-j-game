#!/bin/bash
# Auto-commit script: slaat elke paar minuten automatisch je werk op
# Gebruik: ./autocommit.sh (draait op de achtergrond)

INTERVAL=${1:-120}  # standaard elke 2 minuten

echo "Auto-commit gestart! Elke ${INTERVAL} seconden wordt je werk opgeslagen."
echo "Druk Ctrl+C om te stoppen."

while true; do
  sleep "$INTERVAL"
  if [ -n "$(git status --porcelain)" ]; then
    git add -A
    git commit -m "auto: werk opgeslagen $(date '+%H:%M:%S')"
    echo "Opgeslagen om $(date '+%H:%M:%S')"
  fi
done
