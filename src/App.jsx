import React, { useEffect, useState } from "react";

function App() {
  const [data, setData] = useState([]);
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
        setLoading(false);
      })
      .catch((err) => {
        console.error("Fehler beim Laden der JSON:", err);
        setError(err.message);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div style={{ color: "white", padding: "20px" }}>
        <h1>Ölpreis-Manager Pro</h1>
        <p>Daten werden geladen...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ color: "white", padding: "20px" }}>
        <h1>Ölpreis-Manager Pro</h1>
        <p style={{ color: "red" }}>Fehler: {error}</p>
      </div>
    );
  }

  return (
    <div style={{ color: "white", padding: "20px", backgroundColor: "#111", minHeight: "100vh" }}>
      <h1>Ölpreis-Manager Pro</h1>
      <p style={{ color: "#999" }}>Aktuelle Daten aus der WAP-Exportdatei</p>

      {data.length > 0 ? (
        <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "20px" }}>
          <thead>
            <tr style={{ backgroundColor: "#222" }}>
              <th style={{ borderBottom: "1px solid #666", padding: "8px", textAlign: "left" }}>Interne Nr.</th>
              <th style={{ borderBottom: "1px solid #666", padding: "8px", textAlign: "left" }}>Hersteller</th>
              <th style={{ borderBottom: "1px solid #666", padding: "8px", textAlign: "left" }}>Bezeichnung</th>
              <th style={{ borderBottom: "1px solid #666", padding: "8px", textAlign: "left" }}>Kategorie</th>
              <th style={{ borderBottom: "1px solid #666", padding: "8px", textAlign: "right" }}>VK1 (€)</th>
            </tr>
          </thead>
          <tbody>
            {data.map((öl, index) => {
              const vk1 = parseFloat(öl.vk1);
              const vkDisplay = isNaN(vk1) ? "–" : vk1.toFixed(2);

              return (
                <tr key={index} style={{ borderBottom: "1px solid #333" }}>
                  <td style={{ padding: "6px 8px" }}>{öl.interne_nummer || "–"}</td>
                  <td style={{ padding: "6px 8px" }}>{öl.hersteller || "–"}</td>
                  <td style={{ padding: "6px 8px" }}>{öl.bezeichnung || "–"}</td>
                  <td style={{ padding: "6px 8px" }}>{öl.kategorie || "–"}</td>
                  <td style={{ padding: "6px 8px", textAlign: "right" }}>{vkDisplay}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      ) : (
        <p>Keine Daten gefunden.</p>
      )}
    </div>
  );
}

export default App;
