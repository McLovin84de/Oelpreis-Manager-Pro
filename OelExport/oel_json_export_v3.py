import pandas as pd
import json
import os
import shutil
from datetime import datetime

# Basisordner (da liegt auch die Artikel.XLSX)
BASE_DIR = r"C:\Users\stefa\OneDrive\Documents\Öl Export WAP"
EXCEL_FILE = os.path.join(BASE_DIR, "Artikel.XLSX")

# Ausgabeordner
OUT_DIR = os.path.join(BASE_DIR, "Bearbeitet")
BACKUP_DIR = os.path.join(OUT_DIR, "backups")
LOG_FILE = os.path.join(OUT_DIR, "export_log.txt")

# Zielpfade im Projekt
PROJECT_DIR = r"C:\Users\stefa\OneDrive\Documents\GitHub\Oelpreis-Manager-Pro"
PUBLIC_JSON = os.path.join(PROJECT_DIR, "public", "data", "localdb.json")
SRC_JSON = os.path.join(PROJECT_DIR, "src", "data", "localdb.json")

# Sicherstellen, dass Ausgabeordner existiert
os.makedirs(OUT_DIR, exist_ok=True)
os.makedirs(BACKUP_DIR, exist_ok=True)
os.makedirs(os.path.dirname(PUBLIC_JSON), exist_ok=True)
os.makedirs(os.path.dirname(SRC_JSON), exist_ok=True)


def log(msg: str):
    """Schreibt Meldungen in die Konsole und in die Logdatei."""
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    line = f"[{timestamp}] {msg}"
    print(line)
    with open(LOG_FILE, "a", encoding="utf-8") as f:
        f.write(line + "\n")


def read_excel(path):
    log(f"📖 Lese Excel-Datei: {path}")
    try:
        df = pd.read_excel(path)
        df.columns = [str(c).strip() for c in df.columns]
        log(f"✅ Excel geladen. Spalten: {', '.join(df.columns)}")
        return df
    except Exception as e:
        log(f"❌ Fehler beim Lesen der Excel-Datei: {e}")
        return None


def safe_str(value):
    if pd.isna(value):
        return ""
    return str(value).strip()


def safe_float(value):
    if pd.isna(value) or value == "":
        return None
    try:
        return float(str(value).replace(",", "."))
    except Exception:
        return None


def parse_freigaben(text):
    if not isinstance(text, str):
        return []

    txt = text.strip()
    if not txt:
        return []

    # zuerst Semikolon in Komma vereinheitlichen
    txt = txt.replace(";", ",")

    # dann anhand von Kommas trennen
    parts = [p.strip() for p in txt.split(",") if p.strip()]
    return parts


def auto_kategorie(bezeichnung: str):
    if not isinstance(bezeichnung, str):
        return "Standard"

    txt = bezeichnung.lower()

    if "premium" in txt or "hochleistung" in txt:
        return "Premium/Hochleistung"

    if "longlife/spezial" in txt or "longlife" in txt or "spezial" in txt:
        return "Longlife/Spezial"

    if "standard" in txt:
        return "Standard"

    # fallback-Heuristik
    if "0w" in txt or "5w-30" in txt or "5w20" in txt or "0w20" in txt or "0w30" in txt:
        return "Longlife/Spezial"

    return "Standard"


def load_existing_internal_numbers():
    """Lädt bestehende interne Nummern aus der aktuellen Website-JSON, damit sie stabil bleiben."""
    if not os.path.exists(PUBLIC_JSON):
        return {}

    try:
        with open(PUBLIC_JSON, "r", encoding="utf-8") as f:
            existing = json.load(f)

        if isinstance(existing, dict):
            existing_data = existing.get("daten", [])
        elif isinstance(existing, list):
            existing_data = existing
        else:
            existing_data = []

        mapping = {}
        for item in existing_data:
            artikelnummer = safe_str(item.get("artikelnummer", ""))
            interne_nummer = safe_str(item.get("interne_nummer", ""))
            if artikelnummer and interne_nummer:
                mapping[artikelnummer] = interne_nummer

        log(f"🔁 Bestehende interne Nummern geladen: {len(mapping)}")
        return mapping
    except Exception as e:
        log(f"⚠️ Konnte bestehende interne Nummern nicht laden: {e}")
        return {}


def next_free_internal_number(existing_map, used_numbers):
    """Ermittelt die nächste freie OEL-Nummer."""
    max_no = 0

    for no in list(existing_map.values()) + list(used_numbers):
        if no.startswith("OEL-"):
            try:
                n = int(no.replace("OEL-", ""))
                max_no = max(max_no, n)
            except Exception:
                pass

    return f"OEL-{max_no + 1:03d}"


def main():
    df = read_excel(EXCEL_FILE)
    if df is None:
        return

    existing_map = load_existing_internal_numbers()
    used_numbers = set(existing_map.values())

    daten = []
    unvoll = 0

    for _, row in df.iterrows():
        # relevante Felder aus WAP
        artikelnummer = safe_str(row.get("ArtikelNrOrder", "")) or safe_str(row.get("HArtNr", "")) or safe_str(row.get("ArtikelNr", ""))
        hersteller = safe_str(row.get("Hersteller", ""))
        bezeichnung = safe_str(row.get("Bezeichnung", ""))
        bemerkungen = safe_str(row.get("Bemerkungen", ""))

        freigaben = parse_freigaben(bemerkungen)
        kategorie = auto_kategorie(bezeichnung)

        ek = safe_float(row.get("nettopreislieferant", None))
        vk1 = safe_float(row.get("vk1", None))

        # interne Nummer stabil halten
        if artikelnummer in existing_map:
            interne_nummer = existing_map[artikelnummer]
        else:
            interne_nummer = next_free_internal_number(existing_map, used_numbers)
            existing_map[artikelnummer] = interne_nummer
            used_numbers.add(interne_nummer)

        fehlend = []
        if not artikelnummer:
            fehlend.append("Artikelnummer")
        if not hersteller:
            fehlend.append("Hersteller")
        if not bezeichnung:
            fehlend.append("Bezeichnung")
        if ek in [None, "", 0]:
            fehlend.append("EK-Preis")
        if not freigaben:
            fehlend.append("Freigaben")

        status = "Unvollständig" if fehlend else "OK"
        if status != "OK":
            unvoll += 1

        ds = {
            "interne_nummer": interne_nummer,
            "artikelnummer": artikelnummer,
            "hersteller": hersteller,
            "bezeichnung": bezeichnung,
            "freigaben": freigaben,
            "kategorie": kategorie,
            "nettopreis": ek,
            "vk1": vk1,
            "bemerkungen": bemerkungen,
            "status": status,
            "unvollstaendig": ", ".join(fehlend)
        }
        daten.append(ds)

    export_obj = {
        "stand_datum": datetime.now().strftime("%Y-%m-%d %H:%M"),
        "daten": daten
    }

    # 1) JSON für Bearbeitet
    json_path = os.path.join(OUT_DIR, "localdb.json")
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(export_obj, f, ensure_ascii=False, indent=2)
    log(f"✅ JSON geschrieben: {json_path}")

    # 2) Backup
    backup_name = f"localdb_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    backup_path = os.path.join(BACKUP_DIR, backup_name)
    with open(backup_path, "w", encoding="utf-8") as f:
        json.dump(export_obj, f, ensure_ascii=False, indent=2)
    log(f"💾 Backup geschrieben: {backup_path}")

    # 3) Analyse als CSV
    analyse_rows = []
    for d in daten:
        analyse_rows.append({
            "interne_nummer": d["interne_nummer"],
            "artikelnummer": d["artikelnummer"],
            "hersteller": d["hersteller"],
            "bezeichnung": d["bezeichnung"],
            "kategorie": d["kategorie"],
            "freigaben": ", ".join(d["freigaben"]),
            "nettopreis": d["nettopreis"],
            "vk1": d["vk1"],
            "bemerkungen": d["bemerkungen"],
            "status": d["status"],
            "unvollstaendig": d["unvollstaendig"],
        })

    analyse_df = pd.DataFrame(analyse_rows)
    analyse_path = os.path.join(OUT_DIR, "analyse.csv")
    analyse_df.to_csv(analyse_path, sep=";", index=False, encoding="utf-8-sig")
    log(f"📊 Analyse geschrieben: {analyse_path}")

    # 4) Statistik
    kat_counts = {}
    for d in daten:
        kat_counts[d["kategorie"]] = kat_counts.get(d["kategorie"], 0) + 1

    stats_path = os.path.join(OUT_DIR, "statistik.txt")
    with open(stats_path, "w", encoding="utf-8") as f:
        f.write(f"Statistik – Öl-Datenexport ({datetime.now():%Y-%m-%d %H:%M})\n")
        f.write(f"Gesamtanzahl Öle: {len(daten)}\n")
        f.write(f"Unvollständige Datensätze: {unvoll}\n\n")
        f.write("Verteilung nach Kategorien:\n")
        for k, v in kat_counts.items():
            f.write(f"  {k}: {v}\n")
    log(f"📄 Statistik geschrieben: {stats_path}")

    # 5) Automatisch in Projekt kopieren
    shutil.copy2(json_path, PUBLIC_JSON)
    log(f"✅ localdb.json auch nach {PUBLIC_JSON} kopiert.")

    shutil.copy2(json_path, SRC_JSON)
    log(f"✅ localdb.json auch nach {SRC_JSON} kopiert.")

    log("✅ Export fertig.")


if __name__ == "__main__":
    main()