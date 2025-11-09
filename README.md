# 🛢️ Ölpreis-Manager Pro

Der **Ölpreis-Manager Pro** ist eine digitale Lösung zur Verwaltung und Preisermittlung von Motorölen auf Basis von Artikeldaten aus dem Werkstatt-Abrechnungssystem (WAP).  
Er bietet eine zentrale Übersicht, ermöglicht schnelle Suche nach Hersteller- oder Freigabedaten und unterstützt eine automatisierte Preiskalkulation auf Basis interner und externer Vergleichsdaten.

---

## 🚗 Funktionsübersicht

- Übersichtliche Web-Oberfläche für alle Ölsorten  
- Suche nach **Hersteller**, **Freigabe** oder **Artikelnummer**  
- Kategorisierung in **Standard**, **Longlife/Spezial** und **Premium/Hochleistung**  
- Automatische Preiszuordnung und Analyse  
- JSON-Datenbasis für schnelle Aktualisierungen  
- Integration in das WAP-Exportformat  

---

## 🛠️ Öl-Export-Tool (`/OelExport`)

Dieses Modul dient zur **Verarbeitung, Analyse und Konvertierung** von Öldaten aus dem WAP-Programm.

### 📂 Verzeichnisstruktur

| Ordner / Datei | Beschreibung |
|----------------|---------------|
| `Artikel.XLSX` | Exportdatei aus dem WAP mit allen Artikeldaten (Öle, Preise, Freigaben etc.) |
| `oel_json_export_v3.py` | Hauptskript zur Umwandlung der Excel-Datei in eine strukturierte JSON-Datenbank |
| `run_export.bat` | Batch-Datei zur automatischen Ausführung des Exports per Doppelklick |
| `Bearbeitet/` | Enthält automatisch generierte Dateien (Analyse, Logs, Statistik etc.) |
| `backups/` | Automatische Sicherungen der JSON-Datenbank |
| `localdb.json` | Arbeitsdatenbank im JSON-Format (wird bei jedem Lauf aktualisiert) |
| `analyse.csv` / `statistik.txt` | Analyse- und Statistik-Ergebnisse zum Datenstand |
| `readme.txt` | Kurze lokale Beschreibung zur Nutzung |

---

### 🚀 Nutzung

1. Die aktuelle **`Artikel.XLSX`** aus WAP in den Ordner `/OelExport` kopieren  
2. Die Datei **`run_export.bat`** per Doppelklick ausführen  
3. Das Tool generiert automatisch:
   - eine aktualisierte **JSON-Datenbank (`localdb.json`)**
   - eine **Analyse-Datei (`analyse.csv`)**
   - eine **Statistik-Datei (`statistik.txt`)**
   - ein **Backup** im Unterordner `/backups`

---

### ⚙️ Voraussetzungen

- **Python 3.10** oder neuer  
- Bibliotheken (bei Bedarf installieren):
  ```bash
  pip install pandas openpyxl
  ```

---

### 🧹 Hinweis

Die folgenden Dateien und Ordner werden automatisch von Git ausgeschlossen (siehe `.gitignore`):

```
OelExport/Bearbeitet/
OelExport/backups/
OelExport/analyse.csv
OelExport/statistik.txt
OelExport/localdb.json
OelExport/export_log.txt
```

---

### 👨‍🔧 Autor

**Stefan Schäfer**  
Autogalerie Schäfer – Sinsheim  
📧 [info@autogalerie-schaefer.de](mailto:info@autogalerie-schaefer.de)

---

© 2025 – Ölpreis-Manager Pro
