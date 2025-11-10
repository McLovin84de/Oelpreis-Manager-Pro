import React, { useState, useEffect } from "react";
import Fuse from "fuse.js";

function App() {
  const [data, setData] = useState(null);
  const [search, setSearch] = useState("");
  const [filtered, setFiltered] = useState([]);

  // JSON laden
  useEffect(() => {
    fetch("/data/localdb.json")
      .then((res) => res.json())
      .then((json) => {
        console.log("✅ JSON geladen:", json);
        setData(json);
        setFiltered(json?.daten || []);
      })
      .catch((err) => console.error("❌ Fehler beim Laden der JSON:", err));
  }, []);

  // Fuzzy Suche
  useEffect(() => {
    if (!data?.daten) return;
    const fuse = new Fuse(data.daten, {
      keys: ["freigaben", "bezeichnung", "hersteller", "artikelnummer"],
      threshold: 0.3,
    });
    if (!search.trim()) setFiltered(data.daten);
    else setFiltered(fuse.search(search).map((r) => r.item));
  }, [search, data]);

  // Hervorhebung
  const highlight = (text) => {
    if (!text) return "";
    if (!search) return text;
    const regex = new RegExp(`(${search})`, "gi");
    return text.replace(
      regex,
      (m) =>
        `<span style="background-color: #ffeb3b; color: black; font-weight: 600;">${m}</span>`
    );
  };

  const standDatum = data?.stand_datum || "Unbekannt";

  return (
    <div style={styles.page}>
      <h1 style={styles.title}>Ölpreis-Manager Pro</h1>

      <div style={styles.infoBox}>
        📅 <strong>Datenstand:</strong> {standDatum}
      </div>

      <input
        type="text"
        placeholder="🔍 Suche nach Freigabe, Hersteller oder Artikelnummer..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={styles.search}
      />

      {filtered.length > 0 ? (
        <div style={styles.tableContainer}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Interne Nr.</th>
                <th style={styles.th}>Artikelnummer</th>
                <th style={styles.th}>Bezeichnung</th>
                <th style={styles.th}>Freigaben</th>
                <th style={styles.th}>Hersteller</th>
                <th style={styles.th}>Kategorie</th>
                <th style={styles.th}>EK (Netto)</th>
                <th style={styles.th}>VK1 (€)</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((oil, i) => (
                <tr
                  key={i}
                  style={i % 2 ? styles.trAlt : styles.tr}
                  className="row"
                >
                  <td style={styles.td}>{oil.interne_nummer}</td>
                  <td style={styles.td}>{oil.artikelnummer}</td>
                  <td
                    style={styles.td}
                    dangerouslySetInnerHTML={{
                      __html: highlight(oil.bezeichnung || ""),
                    }}
                  ></td>
                  <td
                    style={{ ...styles.td, maxWidth: 300, whiteSpace: "normal" }}
                    dangerouslySetInnerHTML={{
                      __html: highlight(oil.freigaben || ""),
                    }}
                  ></td>
                  <td style={styles.td}>{oil.hersteller}</td>
                  <td style={styles.td}>{oil.kategorie}</td>
                  <td style={{ ...styles.td, textAlign: "right" }}>
                    {oil.nettopreis
                      ? `${oil.nettopreis.toFixed(2)} €`
                      : "–"}
                  </td>
                  <td style={{ ...styles.td, textAlign: "right" }}>
                    {oil.vk1 ? `${oil.vk1.toFixed(2)} €` : "–"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p style={styles.noData}>Keine Treffer oder keine Daten verfügbar.</p>
      )}
    </div>
  );
}

const styles = {
  page: {
    backgroundColor: "#121212",
    color: "#e0e0e0",
    fontFamily: "Segoe UI, Roboto, sans-serif",
    padding: "30px",
    minHeight: "100vh",
  },
  title: {
    fontSize: "28px",
    fontWeight: "bold",
    color: "#ffeb3b",
    marginBottom: "10px",
  },
  infoBox: {
    backgroundColor: "#1e1e1e",
    display: "inline-block",
    padding: "6px 12px",
    borderRadius: "6px",
    marginBottom: "15px",
    color: "#ccc",
  },
  search: {
    padding: "10px",
    borderRadius: "6px",
    width: "100%",
    maxWidth: "420px",
    border: "1px solid #444",
    backgroundColor: "#1e1e1e",
    color: "#e0e0e0",
    marginBottom: "20px",
  },
  tableContainer: {
    overflowX: "auto",
    borderRadius: "8px",
    border: "1px solid #333",
    backgroundColor: "#1c1c1c",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
  },
  th: {
    textAlign: "left",
    backgroundColor: "#222",
    color: "#ffeb3b",
    padding: "10px",
    borderBottom: "2px solid #333",
    position: "sticky",
    top: 0,
  },
  td: {
    padding: "8px 10px",
    borderBottom: "1px solid #333",
    verticalAlign: "top",
  },
  tr: {
    backgroundColor: "#1a1a1a",
  },
  trAlt: {
    backgroundColor: "#181818",
  },
  noData: {
    marginTop: "20px",
    fontStyle: "italic",
    color: "#aaa",
  },
};

export default App;
