#!/usr/bin/env node
/**
 * NotificationHub – Node.js Client-Klasse + Beispiele
 *
 * Usage:
 *   NHUB_URL=http://localhost:3000 NHUB_TOKEN=your-token node examples/notify.js
 */

const NHUB_URL   = process.env.NHUB_URL   ?? 'http://localhost:3000';
const NHUB_TOKEN = process.env.NHUB_TOKEN ?? 'changeme';

class NotificationHub {
  constructor(baseUrl = NHUB_URL, token = NHUB_TOKEN) {
    this.baseUrl = baseUrl;
    this.token   = token;
  }

  #headers() {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.token}`,
    };
  }

  async login(email, password) {
    const res = await fetch(`${this.baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) throw new Error(await res.text());
    const data = await res.json();
    this.token = data.token;
    return data.user;
  }

  async notify({ source, title, message, priority = 'INFO', ...rest }) {
    const res = await fetch(`${this.baseUrl}/api/v1/notify`, {
      method: 'POST',
      headers: this.#headers(),
      body: JSON.stringify({ source, title, message, priority, ...rest }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }

  async getNotifications({ page = 1, limit = 20, ...filters } = {}) {
    const params = new URLSearchParams({ page, limit, ...filters });
    const res = await fetch(`${this.baseUrl}/api/v1/notifications?${params}`, {
      headers: this.#headers(),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }

  async getStats() {
    const res = await fetch(`${this.baseUrl}/api/v1/notifications/stats/summary`, {
      headers: this.#headers(),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }

  async acknowledge(id) {
    const res = await fetch(`${this.baseUrl}/api/v1/notifications/${id}/acknowledge`, {
      method: 'POST', headers: this.#headers(),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }
}

// ---- Beispiele ---------------------------------------------------------------
const hub = new NotificationHub();

(async () => {
  console.log('--- Proxmox: Node offline ---');
  const r1 = await hub.notify({
    source:   'Proxmox',
    service:  'pve-manager',
    title:    'Node pve03 nicht erreichbar',
    message:  'pve03 antwortet nicht mehr auf Cluster-Heartbeats. Letzter Kontakt vor 2 Minuten.',
    priority: 'EMERGENCY',
    hostname: 'pve03',
    tags:     ['cluster', 'node', 'offline'],
  });
  console.log(r1);

  console.log('\n--- Zertifikat läuft ab ---');
  const r2 = await hub.notify({
    source:   'CertBot',
    title:    'TLS-Zertifikat läuft in 7 Tagen ab',
    message:  'Das Zertifikat für example.com läuft am 2026-08-05 ab. Bitte erneuern.',
    priority: 'WARNING',
    hostname: 'proxy01',
    tags:     ['ssl', 'certificate'],
    extra:    { domain: 'example.com', expires: '2026-08-05' },
  });
  console.log(r2);

  console.log('\n--- Stats ---');
  const stats = await hub.getStats();
  console.log(`Heute: ${stats.today} | Critical: ${stats.critical} | Warnings: ${stats.warnings}`);
})().catch(console.error);
