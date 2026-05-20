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


def detect_fluid_typ(bezeichnung):
    text = str(bezeichnung or "").lower()
    if "motoröl" in text or "motorol" in text:
        return "Motoröl"
    if "getriebe" in text or "atf" in text:
        return "Getriebeöl"
    if any(t in text for t in ["kühl", "kuehl", "frostschutz", "g12", "g13", "g40", "d40"]):
        return "Kühlmittel"
    if "bremsflüssigkeit" in text or "bremsfluessigkeit" in text or "dot" in text:
        return "Bremsflüssigkeit"
    return "Sonstiges"


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
    for _, row in df.iterrows():
        artikelnummer = str(safe_get(row, "ArtikelNr")).strip()
        hersteller_artikelnummer = str(safe_get(row, "HArtNr")).strip()
        hersteller = str(safe_get(row, "Hersteller")).strip()
        bezeichnung = str(safe_get(row, "Bezeichnung")).strip()
        freigaben = str(safe_get(row, "Bemerkungen")).strip()

        nettopreis_raw = safe_get(row, "nettopreislieferant") or safe_get(row, "nettopreis_lieferant") or safe_get(row, "nettopreis")
        nettopreis = to_float(nettopreis_raw)
        vk1 = to_float(safe_get(row, "vk1"))
        gebinde_l = parse_liters(bezeichnung)
        fluid_typ = detect_fluid_typ(bezeichnung)
        kategorie = detect_category(bezeichnung, freigaben)

        rohertrag = (vk1 - nettopreis) if vk1 > 0 else 0
        marge_prozent = (((vk1 - nettopreis) / vk1) * 100) if vk1 > 0 else 0
        preis_pro_liter = (vk1 / gebinde_l) if gebinde_l > 0 else vk1
        ek_pro_liter = (nettopreis / gebinde_l) if gebinde_l > 0 else nettopreis

        ds = {
            "interne_nummer": artikelnummer,
            "artikelnummer": artikelnummer,
            "hersteller_artikelnummer": hersteller_artikelnummer,
            "hersteller": hersteller,
            "bezeichnung": bezeichnung,
            "freigaben": freigaben,
            "kategorie": kategorie,
            "fluid_typ": fluid_typ,
            "gebinde_l": round(gebinde_l, 2),
            "nettopreis": round(nettopreis, 2),
            "vk1": round(vk1, 2),
            "preis_pro_liter": round(preis_pro_liter, 2),
            "ek_pro_liter": round(ek_pro_liter, 2),
            "rohertrag": round(rohertrag, 2),
            "marge_prozent": round(marge_prozent, 1),
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
