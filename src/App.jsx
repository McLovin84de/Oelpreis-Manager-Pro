import React, { useState, useEffect } from "react";
import Fuse from "fuse.js";

function App() {
  const [data, setData] = useState({ stand_datum: "unbekannt", daten: [] });
  const [search, setSearch] = useState("");
  const [filtered, setFiltered] = useState([]);

  useEffect(() => {
    fetch("./data/localdb.json")
      .then((res) => res.json())
      .then((json) => {
        if (!json.daten) json.daten = [];
        setData(json);
        setFiltered(json.daten);
      })
      .catch((err) => console.error("❌ Fehler beim Laden:", err));
  }, []);

  useEffect(() => {
    if (!data || !data.daten) return;
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
    return text.replace(regex, (m) => `<mark style='background:yellow;'>${m}</mark>`);
  };

  return (
    <div style={{ fontFamily: "Arial, sans-serif", padding: 20, background: "#111", color: "#eee", minHeight: "100vh" }}>
      <h1 style={{ fontSize: 28, marginBottom: 10 }}>Ölpreis-Manager Pro</h1>
      <div style={{ background: "#222", padding: "6px 10px", borderRadius: 8, display: "inline-block", marginBottom: 15 }}>
        📅 <b>Datenstand:</b> {data.stand_datum || "unbekannt"}
      </div>

      <div style={{ marginBottom: 15 }}>
        <input
          type="text"
          placeholder="Suche nach Freigabe, Hersteller oder Artikelnummer..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            padding: "8px",
            borderRadius: 6,
            border: "1px solid #444",
            width: 350,
            background: "#222",
            color: "#fff",
          }}
        />
      </div>

      <table style={{ width: "100%", borderCollapse: "collapse", background: "#1a1a1a" }}>
        <thead style={{ background: "#333", color: "#fff" }}>
          <tr>
            {["Interne Nr.", "Artikelnummer", "Bezeichnung", "Freigaben", "Hersteller", "Kategorie", "VK1 (€)"].map((h) => (
              <th key={h} style={{ border: "1px solid #444", padding: 8, textAlign: "left" }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filtered.length > 0 ? (
            filtered.map((oil, i) => (
              <tr key={i} style={{ borderBottom: "1px solid #333" }}>
                <td style={{ padding: 6 }}>{oil.interne_nummer}</td>
                <td style={{ padding: 6 }}>{oil.artikelnummer}</td>
                <td style={{ padding: 6 }} dangerouslySetInnerHTML={{ __html: highlight(oil.bezeichnung || "") }} />
                <td style={{ padding: 6 }} dangerouslySetInnerHTML={{ __html: highlight(oil.freigaben || "") }} />
                <td style={{ padding: 6 }}>{oil.hersteller}</td>
                <td style={{ padding: 6 }}>{oil.kategorie}</td>
                <td style={{ padding: 6, textAlign: "right" }}>{oil.vk1 ? `${oil.vk1.toFixed(2)} €` : "-"}</td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan="7" style={{ textAlign: "center", padding: 20, color: "#999" }}>
                Keine Daten gefunden oder Datei leer.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export default App;
