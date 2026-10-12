#!/usr/bin/env python3
"""
OMIE Portugal Electricity Market Sync Script
Downloads official day-ahead marginal price files (MARGINALPDBCPT) from OMIE,
extracts Portugal's specific spot price (PRICE_PT), and saves them to data/omie_pt.json.

Usage:
    python sync_omie_pt.py
"""

import datetime
import json
import os
import urllib.request

OMIE_DOWNLOAD_URL = "https://www.omie.es/pt/file-download?parents%5B0%5D=marginalpdbcpt&filename=marginalpdbcpt_{date_str}.1"
DATA_DIR = os.path.join(os.path.dirname(__file__), "data")
OUTPUT_FILE = os.path.join(DATA_DIR, "omie_pt.json")

def fetch_omie_day(target_date):
    """Fetch and parse OMIE marginalpdbcpt file for a specific date."""
    date_str = target_date.strftime("%Y%m%d")
    url = OMIE_DOWNLOAD_URL.format(date_str=date_str)
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

                        # Period 1..96 (15-min intervals)
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
    except Exception as err:
        return []

def sync_data(days_back=31):
    os.makedirs(DATA_DIR, exist_ok=True)
    today = datetime.date.today()
    tomorrow = today + datetime.timedelta(days=1)

    print(f"[*] Syncing official OMIE Portugal electricity prices...")
    all_points = []
    decoupled_days = 0

    # Fetch from days_back to tomorrow (day-ahead)
    dates_to_fetch = [today - datetime.timedelta(days=d) for d in range(days_back, 0, -1)]
    dates_to_fetch.extend([today, tomorrow])

    for d in dates_to_fetch:
        pts = fetch_omie_day(d)
        if pts:
            is_decoupled = any(p.get("decoupled") for p in pts)
            if is_decoupled:
                decoupled_days += 1
            all_points.extend(pts)
            tag = "[DECOUPLED]" if is_decoupled else "[COUPLED]"
            print(f"  [+] {d.isoformat()}: {len(pts)} points {tag}")

    # Remove any duplicate datetimes and sort
    seen = set()
    unique_points = []
    for p in sorted(all_points, key=lambda x: x["datetime"]):
        if p["datetime"] not in seen:
            seen.add(p["datetime"])
            unique_points.append(p)

    payload = {
        "market": "MIBEL_PT",
        "source": "OMIE (marginalpdbcpt)",
        "currency": "EUR/MWh",
        "last_updated": datetime.datetime.now().isoformat(),
        "total_points": len(unique_points),
        "values": unique_points
    }

    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2)

    print(f"[OK] Saved {len(unique_points)} Portuguese price points to {OUTPUT_FILE}")
    print(f"[i] Days with PT/ES price decoupling: {decoupled_days}")

if __name__ == "__main__":
    sync_data()

