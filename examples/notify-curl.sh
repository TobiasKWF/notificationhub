#!/usr/bin/env bash
# =============================================================================
# NotificationHub – curl-Beispiele
# Aufruf: NHUB_URL=http://... NHUB_TOKEN=... bash examples/notify-curl.sh
# =============================================================================
NHUB_URL="${NHUB_URL:-http://localhost:3000}"
NHUB_TOKEN="${NHUB_TOKEN:-changeme}"

HEADERS=(
  -H "Content-Type: application/json"
  -H "Authorization: Bearer ${NHUB_TOKEN}"
)

echo "--- Login & Token holen ---"
TOKEN=$(curl -s -X POST "${NHUB_URL}/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@localhost","password":"changeme"}' | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
echo "Token: ${TOKEN:0:30}..."
HEADERS=(-H "Content-Type: application/json" -H "Authorization: Bearer ${TOKEN}")

echo
echo "--- INFO senden ---"
curl -s -X POST "${NHUB_URL}/api/v1/notify" "${HEADERS[@]}" -d '{
  "source": "Demo",
  "title": "Hallo von NotificationHub",
  "message": "Das ist eine Test-Benachrichtigung.",
  "priority": "INFO",
  "tags": ["demo", "test"]
}' | python3 -m json.tool

echo
echo "--- WARNING: Proxmox-Snapshot ---"
curl -s -X POST "${NHUB_URL}/api/v1/notify" "${HEADERS[@]}" -d '{
  "source": "Proxmox",
  "service": "qm",
  "title": "Snapshot vm-200 größer als 50 GB",
  "message": "Der Snapshot snap-2026-07-29 von VM 200 überschreitet 50 GB. Bitte alte Snapshots bereinigen.",
  "priority": "WARNING",
  "hostname": "pve01",
  "tags": ["snapshot", "vm-200", "disk"]
}' | python3 -m json.tool

echo
echo "--- CRITICAL: Disk voll ---"
curl -s -X POST "${NHUB_URL}/api/v1/notify" "${HEADERS[@]}" -d '{
  "source": "NodeExporter",
  "service": "disk",
  "title": "Disk /dev/sda1 98% voll",
  "message": "Partition /dev/sda1 auf server03 ist zu 98% belegt (476 GB / 487 GB). Sofortiger Handlungsbedarf.",
  "priority": "CRITICAL",
  "hostname": "server03",
  "tags": ["disk", "storage"],
  "extra": { "used_gb": 476, "total_gb": 487, "percent": 98 }
}' | python3 -m json.tool

echo
echo "--- Notifications lesen ---"
curl -s "${NHUB_URL}/api/v1/notifications?limit=5&page=1" "${HEADERS[@]}" | python3 -m json.tool

echo
echo "--- Stats ---"
curl -s "${NHUB_URL}/api/v1/notifications/stats/summary" "${HEADERS[@]}" | python3 -m json.tool
