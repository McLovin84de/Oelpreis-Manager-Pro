import React, { useEffect, useState } from "react";

// einfache unscharfe Suche: prüft, ob alle Zeichen der Suche in der richtigen Reihenfolge im Text vorkommen
const fuzzyMatch = (text, query) => {
  if (!text) return false;
  text = text.toLowerCase();
  query = query.toLowerCase();
  let ti = 0;
  for (let qi = 0; qi < query.length; qi++) {
    ti = text.indexOf(query[qi], ti);
    if (ti === -1) return false;
    ti++;
  }
  return true;
};

function App() {
  const [data, setData] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Daten aus public/data/localdb.json laden
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

  const handleSearch = (value) => {
    setSearch(value);
    const query = value.trim().toLowerCase();

    // wenn leer → alles anzeigen
    if (!query) {
      setFiltered(data);
      return;
    }

    const result = data.filter((öl) => {
      // freigaben können array oder string sein → immer in string umwandeln
      const freigabenStr = Array.isArray(öl.freigaben)
        ? öl.freigaben.join(", ")
        : (öl.freigaben || "");

      const felder = [
        freigabenStr,
        öl.hersteller || "",
        öl.bezeichnung || "",
        öl.kategorie || "",
        öl.artikelnummer || "",
        öl.interne_nummer || "",
      ].map((f) => f.toLowerCase());

      // harte Includes oder fuzzy – beides ok
      return felder.some(
        (f) => f.includes(query) || fuzzyMatch(f, query)
      );
    });

    setFiltered(result);
  };

  if (loading) {
    return (
      <div style={{ color: "white", padding: 20 }}>Daten werden geladen...</div>
    );
  }

  if (error) {
    return (
      <div style={{ color: "red", padding: 20 }}>Fehler: {error}</div>
    );
  }

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
        placeholder="Suchen nach Freigaben (z.B. WSS-M2C...), Hersteller, Artikelnummer..."
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
              <th
                style={{
                  borderBottom: "1px solid #444",
                  padding: "8px",
                  textAlign: "left",
                  width: "20%",
                }}
              >
                Bezeichnung
              </th>
              <th
                style={{
                  borderBottom: "1px solid #444",
                  padding: "8px",
                  textAlign: "left",
                  width: "25%",
                }}
              >
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
                      {öl.interne_nummer || "–"}
                    </td>
                    <td style={{ padding: "6px 8px" }}>
                      {öl.artikelnummer || "–"}
                    </td>
                    <td style={{ padding: "6px 8px" }}>
                      {öl.bezeichnung || "–"}
                    </td>
                    <td style={{ padding: "6px 8px", whiteSpace: "pre-wrap" }}>
                      {freigabenStr}
                    </td>
                    <td style={{ padding: "6px 8px" }}>
                      {öl.hersteller || "–"}
                    </td>
                    <td style={{ padding: "6px 8px" }}>
                      {öl.kategorie || "–"}
                    </td>
                    <td style={{ padding: "6px 8px", textAlign: "right" }}>
                      {vkDisplay}
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan="7" style={{ textAlign: "center", padding: "15px", color: "#888" }}>
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
