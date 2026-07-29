#!/usr/bin/env python3
"""
NotificationHub – Python-Hilfsbibliothek + Beispiele
Install: pip install requests

Usage:
  NHUB_URL=http://localhost:3000 NHUB_TOKEN=your-token python3 examples/notify.py
"""
import os
import requests
from dataclasses import dataclass, field
from typing import Any, Optional

NHUB_URL   = os.getenv("NHUB_URL",   "http://localhost:3000")
NHUB_TOKEN = os.getenv("NHUB_TOKEN", "changeme")


@dataclass
class NotificationHubClient:
    base_url: str = NHUB_URL
    token: str    = NHUB_TOKEN
    timeout: int  = 5

    def _headers(self) -> dict:
        return {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.token}",
        }

    def login(self, email: str, password: str) -> None:
        """Token via Login holen und im Client setzen."""
        resp = requests.post(
            f"{self.base_url}/api/v1/auth/login",
            json={"email": email, "password": password},
            timeout=self.timeout,
        )
        resp.raise_for_status()
        self.token = resp.json()["token"]

    def notify(
        self,
        source: str,
        title: str,
        message: str,
        priority: str = "INFO",
        service: Optional[str] = None,
        hostname: Optional[str] = None,
        tags: list[str] = field(default_factory=list),
        extra: dict[str, Any] = field(default_factory=dict),
        **kwargs,
    ) -> dict:
        payload = {
            "source":   source,
            "title":    title,
            "message":  message,
            "priority": priority,
            "tags":     tags or [],
            "extra":    extra or {},
        }
        if service:  payload["service"]  = service
        if hostname: payload["hostname"] = hostname
        payload.update(kwargs)

        resp = requests.post(
            f"{self.base_url}/api/v1/notify",
            headers=self._headers(),
            json=payload,
            timeout=self.timeout,
        )
        resp.raise_for_status()
        return resp.json()

    def get_notifications(self, page: int = 1, limit: int = 20, **filters) -> dict:
        params = {"page": page, "limit": limit, **filters}
        resp = requests.get(
            f"{self.base_url}/api/v1/notifications",
            headers=self._headers(),
            params=params,
            timeout=self.timeout,
        )
        resp.raise_for_status()
        return resp.json()

    def get_stats(self) -> dict:
        resp = requests.get(
            f"{self.base_url}/api/v1/notifications/stats/summary",
            headers=self._headers(),
            timeout=self.timeout,
        )
        resp.raise_for_status()
        return resp.json()

    def acknowledge(self, notification_id: str) -> dict:
        resp = requests.post(
            f"{self.base_url}/api/v1/notifications/{notification_id}/acknowledge",
            headers=self._headers(),
            timeout=self.timeout,
        )
        resp.raise_for_status()
        return resp.json()


# ---- Beispiele --------------------------------------------------------------
if __name__ == "__main__":
    import json

    hub = NotificationHubClient()

    # Optional: Token via Login holen statt direkt übergeben
    # hub.login("admin@localhost", "changeme")

    print("--- Proxmox Backup OK ---")
    result = hub.notify(
        source="Proxmox",
        service="vzdump",
        title="Backup vm-100 erfolgreich",
        message="Backup von vm-100 fertig. Dauer: 4m 12s, Größe: 8.3 GB.",
        priority="SUCCESS",
        hostname="pve01",
        tags=["backup", "proxmox"],
    )
    print(json.dumps(result, indent=2))

    print("\n--- Disk kritisch ---")
    result = hub.notify(
        source="NodeExporter",
        service="filesystem",
        title="Disk /data auf nas01 kritisch",
        message="/data ist zu 97% belegt. Noch 58 GB frei.",
        priority="CRITICAL",
        hostname="nas01",
        tags=["disk", "storage"],
        extra={"percent": 97, "free_gb": 58},
    )
    print(json.dumps(result, indent=2))

    print("\n--- Stats ---")
    stats = hub.get_stats()
    print(f"Heute: {stats['today']} | Critical: {stats['critical']} | Warnings: {stats['warnings']}")
