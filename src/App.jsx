import React, { useEffect, useState } from "react";

// 🔍 Vereinheitlichung von Text (entfernt Punkte, Bindestriche & Leerzeichen)
const normalize = (text) => {
  if (!text) return "";
  return text.toLowerCase().replace(/[\s.\-]/g, "");
};

// 🔠 Unscharfe Suche (Backup bei Tippfehlern)
const fuzzyMatch = (text, query) => {
  if (!text) return false;
  text = normalize(text);
  query = normalize(query);
  let ti = 0;
  for (let qi = 0; qi < query.length; qi++) {
    ti = text.indexOf(query[qi], ti);
    if (ti === -1) return false;
    ti++;
  }
  return true;
};

// ✨ Text-Hervorhebung der Treffer
const highlightText = (text, query) => {
  if (!text || !query) return text;
  const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
  return text.split(regex).map((part, i) =>
    regex.test(part) ? (
      <mark key={i} style={{ backgroundColor: "#ffd54f", color: "black" }}>
        {part}
      </mark>
    ) : (
      part
    )
  );
};

function App() {
  const [data, setData] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // 📦 JSON laden
  useEffect(() => {
    fetch("/data/localdb.json")
      .then((res) => {
        if (!res.ok) throw new Error("Fehler beim Laden der Datei");
        return res.json();
      })
      .then((json) => {
        setData(json);
        setFiltered(json);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Fehler beim Laden der JSON:", err);
        setError(err.message);
        setLoading(false);
      });
  }, []);

  // 🔎 Zweistufige Suche (exakt → fuzzy, Punkte & Bindestriche ignoriert)
  const handleSearch = (value) => {
    setSearch(value);
    const query = normalize(value.trim());
    if (!query) {
      setFiltered(data);
      return;
    }

    const exactResults = [];
    const fuzzyResults = [];

    data.forEach((öl) => {
      const freigabenStr = Array.isArray(öl.freigaben)
        ? öl.freigaben.join(", ")
        : (öl.freigaben || "");
      const fields = [
        freigabenStr,
        öl.hersteller || "",
        öl.bezeichnung || "",
        öl.kategorie || "",
        öl.artikelnummer || "",
        öl.interne_nummer || "",
      ];

      // Normalisierte Felder für Vergleich
      const normalizedFields = fields.map((f) => normalize(f));

      if (normalizedFields.some((f) => f.includes(query))) {
        exactResults.push(öl);
      } else if (normalizedFields.some((f) => fuzzyMatch(f, query))) {
        fuzzyResults.push(öl);
      }
    });

    setFiltered(exactResults.length > 0 ? exactResults : fuzzyResults);
  };

  if (loading)
    return <div style={{ color: "white", padding: 20 }}>Daten werden geladen...</div>;
  if (error)
    return <div style={{ color: "red", padding: 20 }}>Fehler: {error}</div>;

  return (
    <div
      style={{
        fontFamily: "Segoe UI, sans-serif",
        backgroundColor: "#0e0e0e",
        color: "#fff",
        minHeight: "100vh",
        padding: "20px",
      }}
    >
      <h1 style={{ marginBottom: "5px" }}>Ölpreis-Manager Pro</h1>
      <p style={{ color: "#aaa", marginBottom: "15px" }}>
        Aktuelle Daten aus der WAP-Exportdatei
      </p>

      <input
        type="text"
        value={search}
        onChange={(e) => handleSearch(e.target.value)}
        placeholder="Suchen nach Freigaben, Hersteller, Artikelnummer..."
        style={{
          width: "100%",
          maxWidth: "500px",
          padding: "8px",
          marginBottom: "20px",
          borderRadius: "6px",
          border: "1px solid #555",
          backgroundColor: "#222",
          color: "white",
        }}
      />

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ backgroundColor: "#222" }}>
              <th style={{ borderBottom: "1px solid #444", padding: "8px", textAlign: "left" }}>
                Interne Nr.
              </th>
              <th style={{ borderBottom: "1px solid #444", padding: "8px", textAlign: "left" }}>
                Artikelnummer
              </th>
              <th style={{ borderBottom: "1px solid #444", padding: "8px", width: "20%", textAlign: "left" }}>
                Bezeichnung
              </th>
              <th style={{ borderBottom: "1px solid #444", padding: "8px", width: "25%", textAlign: "left" }}>
                Freigaben
              </th>
              <th style={{ borderBottom: "1px solid #444", padding: "8px", textAlign: "left" }}>
                Hersteller
              </th>
              <th style={{ borderBottom: "1px solid #444", padding: "8px", textAlign: "left" }}>
                Kategorie
              </th>
              <th style={{ borderBottom: "1px solid #444", padding: "8px", textAlign: "right" }}>
                VK1 (€)
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.length > 0 ? (
              filtered.map((öl, i) => {
                const vk1 = parseFloat(öl.vk1);
                const vkDisplay = isNaN(vk1) ? "–" : vk1.toFixed(2);
                const freigabenStr = Array.isArray(öl.freigaben)
                  ? öl.freigaben.join(", ")
                  : (öl.freigaben || "–");

                return (
                  <tr
                    key={i}
                    style={{
                      borderBottom: "1px solid #333",
                      backgroundColor: i % 2 === 0 ? "#181818" : "#121212",
                    }}
                  >
                    <td style={{ padding: "6px 8px" }}>
                      {highlightText(öl.interne_nummer || "–", search)}
                    </td>
                    <td style={{ padding: "6px 8px" }}>
                      {highlightText(öl.artikelnummer || "–", search)}
                    </td>
                    <td style={{ padding: "6px 8px" }}>
                      {highlightText(öl.bezeichnung || "–", search)}
                    </td>
                    <td style={{ padding: "6px 8px", whiteSpace: "pre-wrap" }}>
                      {highlightText(freigabenStr, search)}
                    </td>
                    <td style={{ padding: "6px 8px" }}>
                      {highlightText(öl.hersteller || "–", search)}
                    </td>
                    <td style={{ padding: "6px 8px" }}>
                      {highlightText(öl.kategorie || "–", search)}
                    </td>
                    <td style={{ padding: "6px 8px", textAlign: "right" }}>
                      {vkDisplay}
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td
                  colSpan="7"
                  style={{ textAlign: "center", padding: "15px", color: "#888" }}
                >
                  Keine passenden Ergebnisse gefunden.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default App;
