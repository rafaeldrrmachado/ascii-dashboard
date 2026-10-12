#!/usr/bin/env python3
"""
ASCII Dashboard Local Server with Automatic OMIE Sync
Serves dashboard static files and automatically syncs official Portuguese OMIE prices
on startup, when entering the website, and on a recurring hourly schedule.

Usage:
    python server.py
"""

import datetime
import http.server
import json
import os
import socket
import socketserver
import threading
import time
import urllib.parse
import urllib.request

PORT = 8000
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "data")
OMIE_JSON_PATH = os.path.join(DATA_DIR, "omie_pt.json")
SYNC_LOCK = threading.Lock()
LAST_SYNC_TIME = 0

def get_local_ip():
    """Find the local IP address for easy mobile / old phone access."""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"

def fetch_omie_day(target_date):
    """Fetch and parse OMIE marginalpdbcpt file for a specific date."""
    date_str = target_date.strftime("%Y%m%d")
    url = f"https://www.omie.es/pt/file-download?parents%5B0%5D=marginalpdbcpt&filename=marginalpdbcpt_{date_str}.1"
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"})

    try:
        with urllib.request.urlopen(req, timeout=8) as resp:
            content = resp.read().decode("latin1")
            points = []
            for line in content.splitlines():
                if ";" in line and not line.startswith("MARGINAL") and not line.startswith("*"):
                    parts = line.split(";")
                    if len(parts) >= 6:
                        period = int(parts[3])
                        price_pt = float(parts[4])
                        price_es = float(parts[5])

                        hour = (period - 1) // 4
                        minute = ((period - 1) % 4) * 15
                        dt_iso = f"{target_date.isoformat()}T{hour:02d}:{minute:02d}:00"

                        points.append({
                            "datetime": dt_iso,
                            "value": price_pt,
                            "price_es": price_es,
                            "decoupled": abs(price_pt - price_es) > 0.01
                        })
            return points
    except Exception:
        return []

def run_omie_sync(days_back=7):
    """Sync OMIE Portugal prices in a thread-safe manner."""
    global LAST_SYNC_TIME
    with SYNC_LOCK:
        now = time.time()
        # Avoid syncing more frequently than every 15 minutes
        if now - LAST_SYNC_TIME < 15 * 60:
            return

        print("[*] Automatically syncing latest OMIE Portuguese market data...")
        os.makedirs(DATA_DIR, exist_ok=True)
        today = datetime.date.today()
        tomorrow = today + datetime.timedelta(days=1)

        dates = [today - datetime.timedelta(days=d) for d in range(days_back, 0, -1)]
        dates.extend([today, tomorrow])

        new_points = []
        for d in dates:
            pts = fetch_omie_day(d)
            if pts:
                new_points.extend(pts)

        if not new_points:
            print("[-] OMIE sync: No new points retrieved.")
            return

        # Load existing data if available to preserve history
        existing_points = {}
        if os.path.exists(OMIE_JSON_PATH):
            try:
                with open(OMIE_JSON_PATH, "r", encoding="utf-8") as f:
                    old_data = json.load(f)
                    for p in old_data.get("values", []):
                        existing_points[p["datetime"]] = p
            except Exception:
                pass

        for p in new_points:
            existing_points[p["datetime"]] = p

        merged = [existing_points[k] for k in sorted(existing_points.keys())]

        payload = {
            "market": "MIBEL_PT",
            "source": "OMIE (marginalpdbcpt)",
            "currency": "EUR/MWh",
            "last_updated": datetime.datetime.now().isoformat(),
            "total_points": len(merged),
            "values": merged
        }

        with open(OMIE_JSON_PATH, "w", encoding="utf-8") as f:
            json.dump(payload, f, indent=2)

        LAST_SYNC_TIME = now
        print(f"[+] OMIE sync completed: {len(merged)} Portuguese points saved to data/omie_pt.json")

def is_omie_data_stale():
    """Check if local data is missing today's current date or is older than 3 hours."""
    if not os.path.exists(OMIE_JSON_PATH):
        return True

    try:
        mtime = os.path.getmtime(OMIE_JSON_PATH)
        if time.time() - mtime > 3 * 3600:
            return True

        with open(OMIE_JSON_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
            today_str = datetime.date.today().isoformat()
            has_today = any(p["datetime"].startswith(today_str) for p in data.get("values", []))
            return not has_today
    except Exception:
        return True

class AutoSyncHandler(http.server.SimpleHTTPRequestHandler):
    """Custom HTTP handler that serves dashboard files and triggers OMIE sync on demand."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=BASE_DIR, **kwargs)

    def do_GET(self):
        # Auto-trigger sync when entering the website or requesting energy data
        if self.path in ("/", "/index.html", "/data/omie_pt.json", "/api/sync"):
            if is_omie_data_stale():
                threading.Thread(target=run_omie_sync, daemon=True).start()

        if self.path == "/api/sync":
            threading.Thread(target=run_omie_sync, args=(7,), daemon=True).start()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(b'{"status": "sync_triggered"}')
            return

        # Add CORS headers to all responses
        super().do_GET()

    def end_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Cache-Control", "no-cache, must-revalidate")
        super().end_headers()

def background_scheduler():
    """Hourly background worker to keep data fresh automatically."""
    while True:
        time.sleep(3600)
        try:
            run_omie_sync(days_back=2)
        except Exception as e:
            print("Background sync error:", e)

def main():
    # Initial background sync check on startup
    if is_omie_data_stale():
        threading.Thread(target=run_omie_sync, daemon=True).start()

    # Start background hourly scheduler
    threading.Thread(target=background_scheduler, daemon=True).start()

    local_ip = get_local_ip()
    print("=" * 65)
    print(" ⚡ ASCII DASHBOARD :: AMBIENT RETRO TERMINAL SERVER")
    print("=" * 65)
    print(f"  Local Desktop:  http://localhost:{PORT}")
    print(f"  Mobile / Phone: http://{local_ip}:{PORT}")
    print("  Auto-Sync:      Active (refreshes OMIE Portugal data automatically)")
    print("=" * 65)
    print("Press Ctrl+C to stop the server.\n")

    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("0.0.0.0", PORT), AutoSyncHandler) as httpd:
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nShutting down server.")

if __name__ == "__main__":
    main()

