import json
import os
import re
import shutil
from datetime import datetime

import pandas as pd

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
BASE_DIR = os.environ.get("OEL_EXPORT_BASE_DIR", SCRIPT_DIR)
EXCEL_FILE = os.path.join(BASE_DIR, "Artikel.XLSX")
OUT_DIR = os.path.join(BASE_DIR, "Bearbeitet")
BACKUP_DIR = os.path.join(OUT_DIR, "backups")
LOG_FILE = os.path.join(OUT_DIR, "export_log.txt")
PROJECT_DIR = os.environ.get("OEL_PROJECT_DIR", os.path.dirname(SCRIPT_DIR))
PUBLIC_JSON = os.path.join(PROJECT_DIR, "public", "data", "localdb.json")
SRC_JSON = os.path.join(PROJECT_DIR, "src", "data", "localdb.json")

os.makedirs(OUT_DIR, exist_ok=True)
os.makedirs(BACKUP_DIR, exist_ok=True)


def log(msg: str):
    ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    line = f"[{ts}] {msg}"
    print(line)
    with open(LOG_FILE, "a", encoding="utf-8") as f:
        f.write(line + "\n")


def safe_get(row, col):
    return row[col] if col in row.index else ""


def to_float(value):
    if value is None:
        return 0.0
    text = str(value).strip()
    if not text or text.lower() == "nan":
        return 0.0
    text = text.replace("€", "").replace(" ", "")
    text = text.replace(".", "").replace(",", ".") if "," in text and "." in text else text.replace(",", ".")
    try:
        return float(text)
    except ValueError:
        return 0.0


def parse_liters(bezeichnung):
    text = str(bezeichnung or "").lower()
    if "fassware" in text:
        return 1.0
    match = re.search(r"(\d+(?:[.,]\d+)?)\s*l\b", text)
    if match:
        return float(match.group(1).replace(",", "."))
    return 1.0


def apply_sale_price_rules(vk1, kategorie, gebinde_l):
    price_table = {
        ("Longlife/Spezial", 1.0): 25.0,
        ("Longlife/Spezial", 5.0): 125.0,
        ("Longlife/Spezial", 6.0): 150.0,
        ("Premium/Hochleistung", 1.0): 35.0,
        ("Premium/Hochleistung", 5.0): 175.0,
        ("Standard", 5.0): 87.5,
    }
    return price_table.get((kategorie, round(gebinde_l, 2)), vk1)


def load_existing_internal_numbers():
    mapping = {}
    used_numbers = set()

    for path in [PUBLIC_JSON, SRC_JSON, os.path.join(OUT_DIR, "localdb.json")]:
        if not os.path.exists(path):
            continue

        try:
            with open(path, "r", encoding="utf-8") as f:
                payload = json.load(f)
        except Exception:
            continue

        rows = payload.get("daten", payload) if isinstance(payload, dict) else payload
        if not isinstance(rows, list):
            continue

        for item in rows:
            if not isinstance(item, dict):
                continue

            internal = str(item.get("interne_nummer", "")).strip()
            if internal.startswith("OEL-"):
                used_numbers.add(internal)

            for key in [
                item.get("artikelnummer", ""),
                item.get("hersteller_artikelnummer", ""),
                item.get("wap_artikelnummer", ""),
            ]:
                key = str(key).strip()
                if key and internal:
                    mapping.setdefault(key, internal)

    return mapping, used_numbers


def next_internal_number(used_numbers):
    highest = 0
    for number in used_numbers:
        match = re.match(r"^OEL-(\d+)$", str(number))
        if match:
            highest = max(highest, int(match.group(1)))

    while True:
        highest += 1
        candidate = f"OEL-{highest:03d}"
        if candidate not in used_numbers:
            used_numbers.add(candidate)
            return candidate


def detect_fluid_typ(bezeichnung):
    text = str(bezeichnung or "").lower()
    if "motoröl" in text or "motorol" in text:
        return "Motoröl"
    if "getriebeöl" in text or "getriebeoel" in text or "getriebe" in text or "atf" in text:
        return "Getriebeöl"
    if (
        "kühlmittel" in text
        or "kuehlmittel" in text
        or "kühlerfrostschutz" in text
        or "kuehlerfrostschutz" in text
        or "frostschutz" in text
        or "g12" in text
        or "g13" in text
        or "g40" in text
        or "d40" in text
    ):
        return "Kühlmittel"
    if "bremsflüssigkeit" in text or "bremsfluessigkeit" in text or "dot" in text:
        return "Bremsflüssigkeit"
    return "Sonstiges"


def detect_viskositaet(*values):
    text = " ".join(str(value or "") for value in values)
    match = re.search(r"\b(\d{1,3})\s*w\s*-?\s*(\d{2,3})\b", text, flags=re.IGNORECASE)
    if not match:
        return ""
    return f"{match.group(1).upper()}W-{match.group(2)}"


def detect_category(bezeichnung, freigaben):
    text = f"{bezeichnung or ''} {freigaben or ''}".lower()
    if "premium/longlife" in text:
        return "Longlife/Spezial"
    performance_terms = ["0w-40", "10w-60", "vw 511", "511 00", "porsche a40", "porsche c40", "amg", "rs", "m-power", "motorsport", "renn"]
    special_terms = ["0w-20", "0w-30", "vw 508", "508 00", "vw 509", "509 00", "porsche c20", "acea c5", "acea c6", "psa b71 2010", "ford wss", "longlife", "spezial"]
    if any(term in text for term in performance_terms):
        return "Premium/Hochleistung"
    if any(term in text for term in special_terms):
        return "Longlife/Spezial"
    return "Standard"


def export_json(df):
    daten = []
    existing_numbers, used_numbers = load_existing_internal_numbers()

    for _, row in df.iterrows():
        wap_artikelnummer = str(safe_get(row, "ArtikelNrOrder") or safe_get(row, "ArtikelNr")).strip()
        hersteller_artikelnummer = str(safe_get(row, "HArtNr")).strip()
        hersteller = str(safe_get(row, "Hersteller")).strip()
        bezeichnung = str(safe_get(row, "Bezeichnung")).strip()
        freigaben = str(safe_get(row, "Bemerkungen")).strip()

        if "sensor" in bezeichnung.lower():
            continue

        provided_internal = wap_artikelnummer if wap_artikelnummer.startswith("OEL-") else ""
        artikelnummer = (
            existing_numbers.get(hersteller_artikelnummer)
            or existing_numbers.get(wap_artikelnummer)
            or provided_internal
            or next_internal_number(used_numbers)
        )
        if hersteller_artikelnummer:
            existing_numbers.setdefault(hersteller_artikelnummer, artikelnummer)
        if wap_artikelnummer:
            existing_numbers.setdefault(wap_artikelnummer, artikelnummer)

        nettopreis_raw = safe_get(row, "nettopreislieferant") or safe_get(row, "nettopreis_lieferant") or safe_get(row, "nettopreis")
        nettopreis = to_float(nettopreis_raw)
        gebinde_l = parse_liters(bezeichnung)
        fluid_typ = detect_fluid_typ(bezeichnung)
        viskositaet = detect_viskositaet(bezeichnung, freigaben)
        kategorie = detect_category(bezeichnung, freigaben)
        vk1 = apply_sale_price_rules(to_float(safe_get(row, "vk1")), kategorie, gebinde_l)

        rohertrag = (vk1 - nettopreis) if vk1 > 0 else 0
        marge_prozent = (((vk1 - nettopreis) / vk1) * 100) if vk1 > 0 else 0
        preis_pro_liter = (vk1 / gebinde_l) if gebinde_l > 0 else vk1
        ek_pro_liter = (nettopreis / gebinde_l) if gebinde_l > 0 else nettopreis
        marge_pro_liter = preis_pro_liter - ek_pro_liter

        ds = {
            "interne_nummer": artikelnummer,
            "artikelnummer": artikelnummer,
            "hersteller_artikelnummer": hersteller_artikelnummer,
            "wap_artikelnummer": wap_artikelnummer,
            "hersteller": hersteller,
            "bezeichnung": bezeichnung,
            "freigaben": freigaben,
            "bemerkungen": freigaben,
            "kategorie": kategorie,
            "fluid_typ": fluid_typ,
            "viskositaet": viskositaet,
            "gebinde_l": round(gebinde_l, 2),
            "nettopreis": round(nettopreis, 2),
            "vk1": round(vk1, 2),
            "preis_pro_liter": round(preis_pro_liter, 2),
            "ek_pro_liter": round(ek_pro_liter, 2),
            "rohertrag": round(rohertrag, 2),
            "marge_prozent": round(marge_prozent, 1),
            "marge_pro_liter": round(marge_pro_liter, 2),
        }
        daten.append(ds)

    return {"stand_datum": datetime.now().strftime("%Y-%m-%d %H:%M"), "daten": daten}


def write_outputs(export_obj):
    json_path = os.path.join(OUT_DIR, "localdb.json")
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(export_obj, f, ensure_ascii=False, indent=2)
    log(f"✅ JSON geschrieben: {json_path}")

    backup_name = f"localdb_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    backup_path = os.path.join(BACKUP_DIR, backup_name)
    with open(backup_path, "w", encoding="utf-8") as f:
        json.dump(export_obj, f, ensure_ascii=False, indent=2)
    log(f"💾 Backup geschrieben: {backup_path}")

    for target in [PUBLIC_JSON, SRC_JSON]:
        try:
            os.makedirs(os.path.dirname(target), exist_ok=True)
            shutil.copy2(json_path, target)
            log(f"✅ localdb.json kopiert nach: {target}")
        except Exception as e:
            log(f"⚠️ Konnte nicht nach {target} kopieren: {e}")


def main():
    log(f"📖 Lese Excel-Datei: {EXCEL_FILE}")
    try:
        df = pd.read_excel(EXCEL_FILE, dtype=str)
        df.columns = [str(c).strip() for c in df.columns]
        log(f"✅ Excel geladen. Spalten: {', '.join(df.columns)}")
    except Exception as e:
        log(f"❌ Fehler beim Lesen der Excel-Datei: {e}")
        return

    export_obj = export_json(df)
    write_outputs(export_obj)
    log(f"✅ Export fertig. Datensätze: {len(export_obj.get('daten', []))}")


if __name__ == "__main__":
    main()
