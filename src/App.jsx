import React, { useEffect, useState } from "react";

function App() {
  const [data, setData] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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
    const lower = value.toLowerCase();
    const result = data.filter(
      (öl) =>
        (öl.hersteller && öl.hersteller.toLowerCase().includes(lower)) ||
        (öl.bezeichnung && öl.bezeichnung.toLowerCase().includes(lower)) ||
        (öl.kategorie && öl.kategorie.toLowerCase().includes(lower)) ||
        (öl.interne_nummer && öl.interne_nummer.toLowerCase().includes(lower))
    );
    setFiltered(result);
  };

  if (loading) return <div style={{ color: "white", padding: 20 }}>Daten werden geladen...</div>;
  if (error) return <div style={{ color: "red", padding: 20 }}>Fehler: {error}</div>;

  return (
    <div style={{ fontFamily: "Segoe UI, sans-serif", backgroundColor: "#111", color: "#fff", minHeight: "100vh", padding: "20px" }}>
      <h1 style={{ marginBottom: "5px" }}>Ölpreis-Manager Pro</h1>
      <p style={{ color: "#aaa", marginBottom: "15px" }}>Aktuelle Daten aus der WAP-Exportdatei</p>

      <input
        type="text"
        value={search}
        onChange={(e) => handleSearch(e.target.value)}
        placeholder="Suchen nach Hersteller, Bezeichnung oder Kategorie..."
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

      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ backgroundColor: "#222" }}>
            <th style={{ borderBottom: "1px solid #444", padding: "8px", textAlign: "left" }}>Interne Nr.</th>
            <th style={{ borderBottom: "1px solid #444", padding: "8px", textAlign: "left" }}>Hersteller</th>
            <th style={{ borderBottom: "1px solid #444", padding: "8px", textAlign: "left" }}>Bezeichnung</th>
            <th style={{ borderBottom: "1px solid #444", padding: "8px", textAlign: "left" }}>Kategorie</th>
            <th style={{ borderBottom: "1px solid #444", padding: "8px", textAlign: "right" }}>VK1 (€)</th>
          </tr>
        </thead>
        <tbody>
          {filtered.length > 0 ? (
            filtered.map((öl, i) => {
              const vk1 = parseFloat(öl.vk1);
              const vkDisplay = isNaN(vk1) ? "–" : vk1.toFixed(2);

              return (
                <tr key={i} style={{ borderBottom: "1px solid #333", backgroundColor: i % 2 === 0 ? "#181818" : "#121212" }}>
                  <td style={{ padding: "6px 8px" }}>{öl.interne_nummer || "–"}</td>
                  <td style={{ padding: "6px 8px" }}>{öl.hersteller || "–"}</td>
                  <td style={{ padding: "6px 8px" }}>{öl.bezeichnung || "–"}</td>
                  <td style={{ padding: "6px 8px" }}>{öl.kategorie || "–"}</td>
                  <td style={{ padding: "6px 8px", textAlign: "right" }}>{vkDisplay}</td>
                </tr>
              );
            })
          ) : (
            <tr>
              <td colSpan="5" style={{ textAlign: "center", padding: "15px", color: "#888" }}>
                Keine passenden Ergebnisse gefunden.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export default App;
