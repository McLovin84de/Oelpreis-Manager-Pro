import React, { useState, useEffect } from "react";
import Fuse from "fuse.js";

function App() {
  const [data, setData] = useState(null);
  const [search, setSearch] = useState("");
  const [filtered, setFiltered] = useState([]);

  // JSON laden
  useEffect(() => {
    fetch("./data/localdb.json")
      .then((res) => res.json())
      .then((json) => {
        setData(json);
        setFiltered(json.daten || []);
      })
      .catch((err) => console.error("Fehler beim Laden:", err));
  }, []);

  // Fuzzy Suche
  useEffect(() => {
    if (!data) return;
    const fuse = new Fuse(data.daten, {
      keys: ["freigaben", "bezeichnung", "hersteller", "artikelnummer"],
      threshold: 0.3,
    });
    if (search.trim() === "") {
      setFiltered(data.daten);
    } else {
      const results = fuse.search(search);
      setFiltered(results.map((r) => r.item));
    }
  }, [search, data]);

  const highlight = (text) => {
    if (!search) return text;
    const regex = new RegExp(`(${search})`, "gi");
    return text.replace(regex, (m) => `<mark style="background:yellow">${m}</mark>`);
  };

  if (!data) return <div className="p-4 text-gray-600">Lade Daten...</div>;

  return (
    <div style={{ fontFamily: "Arial, sans-serif", padding: "20px", background: "#111", color: "#eee" }}>
      <h1 style={{ fontSize: "28px", marginBottom: "10px", color: "#fff" }}>Ölpreis-Manager Pro</h1>

      {/* 📅 Datenstand */}
      <div style={{ marginBottom: "15px", padding: "8px 12px", background: "#222", borderRadius: "8px", display: "inline-block" }}>
        📅 <b>Datenstand:</b> {data.stand_datum ? data.stand_datum : "unbekannt"}
      </div>

      {/* 🔍 Suche */}
      <div style={{ marginBottom: "15px" }}>
        <input
          type="text"
          placeholder="Suche nach Freigabe, Hersteller oder Artikelnummer..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            padding: "10px",
            borderRadius: "6px",
            border: "1px solid #444",
            width: "350px",
            background: "#222",
            color: "#fff"
          }}
        />
      </div>

      {/* Tabelle */}
      <table style={{ width: "100%", borderCollapse: "collapse", background: "#1a1a1a" }}>
        <thead style={{ background: "#333", color: "#fff" }}>
          <tr>
            {["Interne Nr.", "Artikelnummer", "Bezeichnung", "Freigaben", "Hersteller", "Kategorie", "VK1 (€)"].map((h) => (
              <th key={h} style={{ border: "1px solid #444", padding: "8px", textAlign: "left" }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filtered.map((oil) => (
            <tr key={oil.interne_nummer} style={{ borderBottom: "1px solid #333" }}>
              <td style={{ padding: "6px" }}>{oil.interne_nummer}</td>
              <td style={{ padding: "6px" }}>{oil.artikelnummer}</td>
              <td style={{ padding: "6px" }} dangerouslySetInnerHTML={{ __html: highlight(oil.bezeichnung || "") }} />
              <td style={{ padding: "6px" }} dangerouslySetInnerHTML={{ __html: highlight(oil.freigaben || "") }} />
              <td style={{ padding: "6px" }}>{oil.hersteller}</td>
              <td style={{ padding: "6px" }}>{oil.kategorie}</td>
              <td style={{ padding: "6px", textAlign: "right" }}>{oil.vk1 ? `${oil.vk1.toFixed(2)} €` : "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {filtered.length === 0 && <p style={{ marginTop: "20px", color: "#aaa" }}>Keine Treffer gefunden.</p>}
    </div>
  );
}

export default App;
