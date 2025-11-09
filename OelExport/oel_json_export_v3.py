import pandas as pd
import json
import os
from datetime import datetime

# Basisordner (da liegt auch die Artikel.XLSX)
BASE_DIR = r"C:\Users\stefa\OneDrive\Documents\Öl Export WAP"
EXCEL_FILE = os.path.join(BASE_DIR, "Artikel.XLSX")

# Ausgabeordner
OUT_DIR = os.path.join(BASE_DIR, "Bearbeitet")
BACKUP_DIR = os.path.join(OUT_DIR, "backups")
LOG_FILE = os.path.join(OUT_DIR, "export_log.txt")

# Sicherstellen, dass Ausgabeordner existiert
os.makedirs(OUT_DIR, exist_ok=True)
os.makedirs(BACKUP_DIR, exist_ok=True)

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
        return df
    except Exception as e:
        log(f"❌ Fehler beim Lesen der Excel-Datei: {e}")
        return None

def parse_freigaben(text):
    if isinstance(text, str):
        # Split nach Zeilenumbruch und Semikolon
        parts = (
            text.replace(";", "\n")
                .split("\n")
        )
        parts = [p.strip() for p in parts if len(p.strip()) > 2]
        return parts
    return []

def auto_kategorie(bezeichnung: str):
    if not isinstance(bezeichnung, str):
        return "Standard"
    txt = bezeichnung.lower()
    # grobe Heuristik
    if "premium" in txt or "0w-40" in txt:
        return "Premium/Hochleistung"
    if "longlife" in txt or "spezial" in txt or "0w" in txt or "5w-30" in txt:
        return "Longlife/Spezial"
    return "Standard"

def main():
    df = read_excel(EXCEL_FILE)
    if df is None:
        return

    daten = []
    unvoll = 0

    for i, row in df.iterrows():
        artikelnummer = str(row.get("HArtNr", "")).strip()
        hersteller = str(row.get("Hersteller", "")).strip()
        bezeichnung = str(row.get("Bezeichnung", "")).strip()
        bemerkungen = row.get("Bemerkungen", "")
        freigaben = parse_freigaben(bemerkungen)
        kategorie = auto_kategorie(bezeichnung)

        # Preise (als Text ausgeben, damit Excel nichts kaputt formatiert)
        ek = row.get("nettopreislieferant", None)
        vk1 = row.get("vk1", None)

        fehlend = []
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
            "interne_nummer": f"OEL-{i+1:03d}",
            "artikelnummer": artikelnummer,
            "hersteller": hersteller,
            "bezeichnung": bezeichnung,
            "freigaben": freigaben,
            "kategorie": kategorie,
            "nettopreislieferant": ek,
            "vk1": vk1,
            "bemerkungen": bemerkungen if isinstance(bemerkungen, str) else "",
            "status": status,
            "unvollstaendig": ", ".join(fehlend)
        }
        daten.append(ds)

    # 1) JSON für deine Webseite
    json_path = os.path.join(OUT_DIR, "localdb.json")
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(daten, f, ensure_ascii=False, indent=2)
    log(f"✅ JSON geschrieben: {json_path}")

    # 2) Backup
    backup_name = f"localdb_{datetime.now().strftime('%Y-%m-%d')}.json"
    backup_path = os.path.join(BACKUP_DIR, backup_name)
    with open(backup_path, "w", encoding="utf-8") as f:
        json.dump(daten, f, ensure_ascii=False, indent=2)
    log(f"💾 Backup geschrieben: {backup_path}")

    # 3) Analyse als CSV (mit Semikolon für deutsches Excel)
    analyse_rows = []
    for d in daten:
        analyse_rows.append({
            "interne_nummer": d["interne_nummer"],
            "artikelnummer": d["artikelnummer"],
            "hersteller": d["hersteller"],
            "bezeichnung": d["bezeichnung"],
            "kategorie": d["kategorie"],
            "freigaben": ", ".join(d["freigaben"]),
            "nettopreislieferant": d["nettopreislieferant"],
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

    log("✅ Export fertig.")

if __name__ == "__main__":
    main()
