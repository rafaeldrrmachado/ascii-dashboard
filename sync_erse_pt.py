#!/usr/bin/env python3
"""
ERSE Portugal Electricity Retail Tariffs Sync Script
Downloads official commercial offers and prices (CondComerciais.csv and Precos_ELEGN.csv)
directly from the ERSE price simulator (simuladorprecos.erse.pt),
extracts and normalizes residential electricity plans, and saves to data/erse_tariffs.json.

Usage:
    python sync_erse_pt.py
"""

import csv
import datetime
import io
import json
import os
import re
import sys
import urllib.parse
import urllib.request
import zipfile

# Ensure UTF-8 output on Windows consoles
if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

SETTINGS_URL = "https://simuladorprecos.erse.pt/config/Settings.json"
DATA_DIR = os.path.join(os.path.dirname(__file__), "data")
OUTPUT_FILE = os.path.join(DATA_DIR, "erse_tariffs.json")

# Mapping of ERSE supplier codes to clean brand names, metadata, and brand colors
SUPPLIERS_METADATA = {
    "TUR": {
        "name": "SU Eletricidade",
        "brand_display": "SU Eletricidade (Regulado)",
        "is_regulated": True,
        "color": "#00ffaa",
        "website": "https://sueletricidade.pt"
    },
    "EDPC": {
        "name": "EDP Comercial",
        "brand_display": "EDP Comercial",
        "is_regulated": False,
        "color": "#ff3b30",
        "website": "https://edp.pt"
    },
    "END": {
        "name": "Endesa",
        "brand_display": "Endesa",
        "is_regulated": False,
        "color": "#00aaff",
        "website": "https://endesa.pt"
    },
    "IBD": {
        "name": "Iberdrola",
        "brand_display": "Iberdrola",
        "is_regulated": False,
        "color": "#30d158",
        "website": "https://iberdrola.pt"
    },
    "ENIPLENITUDE": {
        "name": "Plenitude",
        "brand_display": "Plenitude (Eni)",
        "is_regulated": False,
        "color": "#ffd60a",
        "website": "https://eniplenitude.pt"
    },
    "GOLD": {
        "name": "Goldenergy",
        "brand_display": "Goldenergy",
        "is_regulated": False,
        "color": "#ff9f0a",
        "website": "https://goldenergy.pt"
    },
    "GALP": {
        "name": "Galp",
        "brand_display": "Galp",
        "is_regulated": False,
        "color": "#ff6900",
        "website": "https://galp.com"
    },
    "REPSOL": {
        "name": "Repsol",
        "brand_display": "Repsol",
        "is_regulated": False,
        "color": "#ff453a",
        "website": "https://repsol.pt"
    },
    "COOP": {
        "name": "Coopérnico",
        "brand_display": "Coopérnico (Cooperativa)",
        "is_regulated": False,
        "color": "#32d74b",
        "website": "https://coopernico.org"
    },
    "LUZBOA": {
        "name": "Luzboa",
        "brand_display": "Luzboa",
        "is_regulated": False,
        "color": "#bf5af2",
        "website": "https://luzboa.pt"
    }
}

# Preferred proposal codes for domestic consumers representing primary standard offers
PREFERRED_PROPOSALS = {
    "TUR": ["TUR"],
    "EDPC": ["EDPC_10", "EDPC_08", "EDPC_01"],
    "END": ["END_03", "END_09", "END_04"],
    "IBD": ["IBD_03", "IBD_01", "IBD_02"],
    "ENIPLENITUDE": ["ENIPLENITUDE_05", "ENIPLENITUDE_03", "ENIPLENITUDE_06"],
    "GOLD": ["GOLD_05", "GOLD_02", "GOLD_08"],
    "GALP": ["GALP_04", "GALP_02", "GALP_01"],
    "REPSOL": ["REPSOL_04", "REPSOL_01", "REPSOL_02"],
    "COOP": ["COOP_02", "COOP_01"],
    "LUZBOA": ["LUZBOA_01", "LUZBOA_04", "LUZBOA_02"]
}

def parse_pt_float(val_str):
    """Parse comma-separated decimal string to float."""
    if not val_str:
        return 0.0
    s = val_str.strip().replace(",", ".")
    try:
        return float(s)
    except ValueError:
        return 0.0

def get_latest_csv_zip_url():
    """Fetch Settings.json from ERSE simulator to obtain the dynamic CSV zip URL."""
    req = urllib.request.Request(SETTINGS_URL, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"})
    try:
        with urllib.request.urlopen(req, timeout=12) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            raw_url = data.get("csvPath", "")
            if raw_url:
                # URL encode spaces if present
                encoded_url = urllib.parse.quote(raw_url, safe=":/%")
                return encoded_url
    except Exception as e:
        print(f"[!] Warning: Error reading ERSE Settings.json: {e}")
    return None

def sync_erse_tariffs():
    os.makedirs(DATA_DIR, exist_ok=True)
    zip_url = get_latest_csv_zip_url()

    if not zip_url:
        print("[!] Could not retrieve dynamic ERSE CSV URL from Settings.json")
        return False

    print(f"[*] Downloading official ERSE retail offers ZIP from:\n    {zip_url}")
    req = urllib.request.Request(zip_url, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"})

    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            zip_bytes = resp.read()
            zf = zipfile.ZipFile(io.BytesIO(zip_bytes))
    except Exception as e:
        print(f"[!] Failed to download ERSE ZIP: {e}")
        return False

    print(f"[+] Downloaded {len(zip_bytes)} bytes. Parsing CSV files...")

    # 1. Parse CondComerciais.csv
    proposals_meta = {}
    try:
        with zf.open("csv/CondComerciais.csv") as f:
            text = f.read().decode("utf-8-sig", errors="ignore")
            reader = csv.reader(text.splitlines(), delimiter=";")
            header = next(reader)
            for row in reader:
                if len(row) > 21:
                    com = row[0].strip()
                    cod = row[1].strip()
                    nome = row[2].strip()
                    seg = row[4].strip()
                    fornec = row[10].strip()
                    renov = row[19].strip().upper() == "S"
                    indexada = row[21].strip().upper() == "S"
                    website = row[44].strip() if len(row) > 44 else ""

                    if fornec in ["ELE", "DUAL", ""] and seg in ["Dom", "Tod", ""]:
                        proposals_meta[(com, cod)] = {
                            "com": com,
                            "cod": cod,
                            "nome": nome,
                            "renovavel": renov,
                            "indexada": indexada,
                            "website": website
                        }
    except Exception as e:
        print(f"[!] Error reading CondComerciais.csv: {e}")
        return False

    print(f"[+] Loaded {len(proposals_meta)} domestic commercial proposals.")

    # 2. Parse Precos_ELEGN.csv
    # Structure: prices[(com, cod)][pot][contagem] = { tf, tv, tv_vazio }
    prices_map = {}
    try:
        with zf.open("csv/Precos_ELEGN.csv") as f:
            text = f.read().decode("utf-8-sig", errors="ignore")
            reader = csv.reader(text.splitlines(), delimiter=";")
            header = next(reader)
            for row in reader:
                if len(row) >= 8:
                    com = row[0].strip()
                    pot_raw = row[1].strip().replace(",", ".")
                    cod = row[4].strip()
                    contagem = row[5].strip() # 1=Simples, 2=Bi-horário
                    tf = parse_pt_float(row[6])
                    tv = parse_pt_float(row[7])
                    tv_vazio = parse_pt_float(row[8]) if len(row) > 8 else 0.0

                    if pot_raw in ["3.45", "4.6", "6.9"] and contagem in ["1", "2"]:
                        pot_key = "4.60" if pot_raw == "4.6" else ("6.90" if pot_raw == "6.9" else "3.45")
                        key = (com, cod)
                        if key not in prices_map:
                            prices_map[key] = {}
                        if pot_key not in prices_map[key]:
                            prices_map[key][pot_key] = {}

                        prices_map[key][pot_key][contagem] = {
                            "tf": tf,
                            "tv": tv,
                            "tv_vazio": tv_vazio
                        }
    except Exception as e:
        print(f"[!] Error reading Precos_ELEGN.csv: {e}")
        return False

    # 3. Select best domestic proposals per target supplier
    selected_tariffs = []

    for com_code, meta in SUPPLIERS_METADATA.items():
        candidates = PREFERRED_PROPOSALS.get(com_code, [])

        # Find first matching proposal code with valid pricing for 3.45 kVA
        chosen_cod = None
        for cand in candidates:
            if (com_code, cand) in prices_map and "3.45" in prices_map[(com_code, cand)]:
                p_345 = prices_map[(com_code, cand)]["3.45"]
                if p_345.get("1", {}).get("tf", 0) > 0 and p_345.get("1", {}).get("tv", 0) > 0:
                    chosen_cod = cand
                    break

        # Fallback: find any proposal for this supplier that has complete prices
        if not chosen_cod:
            for (c, cod), p_data in prices_map.items():
                if c == com_code and "3.45" in p_data and "4.60" in p_data and "6.90" in p_data:
                    if p_data["3.45"].get("1", {}).get("tf", 0) > 0:
                        chosen_cod = cod
                        break

        if not chosen_cod:
            print(f"[!] No complete tariff found for {com_code}, skipping.")
            continue

        p_info = proposals_meta.get((com_code, chosen_cod), {})
        p_prices = prices_map.get((com_code, chosen_cod), {})

        plan_display = p_info.get("nome", chosen_cod)
        # Clean plan names for terminal display
        clean_plan_name = plan_display.replace("Condições de preço regulado", "Tarifa Regulada")
        clean_plan_name = clean_plan_name.replace("Eletricidade - Oferta de Preço Fixo durante 12 meses", "Plano Fixo 12M")
        clean_plan_name = clean_plan_name.replace("Mais Casa e Mais Casa Gás (Oferta 60€) - FE e DDC", "Mais Casa FE+DD")

        tariff_entry = {
            "id": f"{com_code.lower()}_{chosen_cod.lower()}",
            "com_code": com_code,
            "supplier": meta["brand_display"],
            "plan_name": clean_plan_name,
            "proposal_code": chosen_cod,
            "is_regulated": meta["is_regulated"],
            "is_indexed": p_info.get("indexada", False),
            "green_energy": p_info.get("renovavel", False),
            "color": meta["color"],
            "website": meta["website"],
            "rates": {
                "3.45": {
                    "simple": {
                        "tf": p_prices.get("3.45", {}).get("1", {}).get("tf", 0.1917),
                        "tv": p_prices.get("3.45", {}).get("1", {}).get("tv", 0.1711)
                    },
                    "dual": {
                        "tf": p_prices.get("3.45", {}).get("2", {}).get("tf", p_prices.get("3.45", {}).get("1", {}).get("tf", 0.1917)),
                        "tv_fora_vazio": p_prices.get("3.45", {}).get("2", {}).get("tv", 0.2045),
                        "tv_vazio": p_prices.get("3.45", {}).get("2", {}).get("tv_vazio", 0.1143)
                    }
                },
                "4.60": {
                    "simple": {
                        "tf": p_prices.get("4.60", {}).get("1", {}).get("tf", 0.2499),
                        "tv": p_prices.get("4.60", {}).get("1", {}).get("tv", 0.1711)
                    },
                    "dual": {
                        "tf": p_prices.get("4.60", {}).get("2", {}).get("tf", p_prices.get("4.60", {}).get("1", {}).get("tf", 0.2499)),
                        "tv_fora_vazio": p_prices.get("4.60", {}).get("2", {}).get("tv", 0.2045),
                        "tv_vazio": p_prices.get("4.60", {}).get("2", {}).get("tv_vazio", 0.1143)
                    }
                },
                "6.90": {
                    "simple": {
                        "tf": p_prices.get("6.90", {}).get("1", {}).get("tf", 0.3659),
                        "tv": p_prices.get("6.90", {}).get("1", {}).get("tv", 0.1711)
                    },
                    "dual": {
                        "tf": p_prices.get("6.90", {}).get("2", {}).get("tf", p_prices.get("6.90", {}).get("1", {}).get("tf", 0.3659)),
                        "tv_fora_vazio": p_prices.get("6.90", {}).get("2", {}).get("tv", 0.2045),
                        "tv_vazio": p_prices.get("6.90", {}).get("2", {}).get("tv_vazio", 0.1143)
                    }
                }
            }
        }
        selected_tariffs.append(tariff_entry)

    # 4. Save normalized dataset to data/erse_tariffs.json
    payload = {
        "market": "ERSE_PT",
        "source": "ERSE (simuladorprecos.erse.pt)",
        "download_url": zip_url,
        "last_updated": datetime.datetime.now().isoformat(),
        "total_suppliers": len(selected_tariffs),
        "regulated_supplier": "TUR",
        "tariffs": selected_tariffs
    }

    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2, ensure_ascii=False)

    print(f"[OK] Successfully saved {len(selected_tariffs)} verified ERSE retail tariffs to:\n    {OUTPUT_FILE}")
    for t in selected_tariffs:
        tag = "[REGULADO]" if t["is_regulated"] else ("[INDEXADO]" if t["is_indexed"] else "[FIXO]")
        print(f"  + {t['supplier']} :: {t['plan_name']} {tag} (3.45 kVA: TF={t['rates']['3.45']['simple']['tf']:.4f}€, TV={t['rates']['3.45']['simple']['tv']:.4f}€)")

    return True

if __name__ == "__main__":
    sync_erse_tariffs()
