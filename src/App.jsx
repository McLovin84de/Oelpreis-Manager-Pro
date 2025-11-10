import React, { useState, useEffect } from "react";
import Fuse from "fuse.js";

function App() {
  const [data, setData] = useState(null);
  const [search, setSearch] = useState("");
  const [filtered, setFiltered] = useState([]);

  // === JSON LADEN ===
  useEffect(() => {
    fetch("./data/localdb.json")
      .then((res) => res.json())
      .then((json) => {
        console.log("✅ JSON geladen:", json);
        setData(json);
        if (json && json.daten) {
          setFiltered(json.daten);
        } else {
          console.warn("⚠️ Keine gültigen Datensätze gefunden!");
          setFiltered([]);
        }
      })
      .catch((err) => {
        console.error("❌ Fehler beim Laden der localdb.json:", err);
      });
  }, []);

  // === SUCHE MIT FUZZY-LOGIK ===
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

  // === HERVORHEBUNG IN DER SUCHE ===
  const highlight = (text) => {
    if (!text) return "";
    if (!search) return text;
    const regex = new RegExp(`(${search})`, "gi");
    return text.replace(regex, (match) => `<mark style="background:yellow">${match}</mark>`);
  };

  // === FEHLER / KEINE DATEN ===
  if (!data) {
    return (
      <div className="p-4 text-gray-600 font-sans">
        <h1 className="text-xl font-semibold mb-2">Ölpreis-Manager Pro</h1>
        <p>Daten werden geladen …</p>
      </div>
    );
  }

  // === DATENSTAND ERKENNEN ===
  const standDatum =
    (data.stand_datum && String(data.stand_datum).trim()) ||
    (data["stand_datum"] && String(data["stand_datum"]).trim()) ||
    "Unbekannt";

  return (
    <div className="p-4 font-sans">
      <h1 className="text-2xl font-bold mb-4">Ölpreis-Manager Pro</h1>

      {/* 📅 DATUMSANZEIGE */}
      <div className="mb-4 p-2 bg-gray-100 rounded-md text-gray-700 text-sm inline-block shadow-sm">
        📅 <span className="font-semibold">Datenstand:</span> {standDatum}
      </div>

      {/* 🔍 SUCHE */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="Suche nach Freigabe, Hersteller, Artikelnummer..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border p-2 rounded w-full max-w-md shadow-sm"
        />
      </div>

      {/* 📋 TABELLE */}
      {filtered.length > 0 ? (
        <table className="min-w-full border-collapse border border-gray-300">
          <thead className="bg-gray-200">
            <tr>
              <th className="border p-2 text-left">Interne Nr.</th>
              <th className="border p-2 text-left">Artikelnummer</th>
              <th className="border p-2 text-left">Hersteller</th>
              <th className="border p-2 text-left w-56">Bezeichnung</th>
              <th className="border p-2 text-left">Kategorie</th>
              <th className="border p-2 text-left w-96">Freigaben</th>
              <th className="border p-2 text-right">EK (Netto)</th>
              <th className="border p-2 text-right">VK 1</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((oil) => (
              <tr key={oil.interne_nummer} className="hover:bg-gray-50">
                <td className="border p-2">{oil.interne_nummer}</td>
                <td className="border p-2">{oil.artikelnummer}</td>
                <td className="border p-2">{oil.hersteller}</td>
                <td
                  className="border p-2"
                  dangerouslySetInnerHTML={{
                    __html: highlight(oil.bezeichnung || ""),
                  }}
                ></td>
                <td className="border p-2">{oil.kategorie}</td>
                <td
                  className="border p-2"
                  dangerouslySetInnerHTML={{
                    __html: highlight(oil.freigaben || ""),
                  }}
                ></td>
                <td className="border p-2 text-right">
                  {oil.nettopreis ? `${oil.nettopreis.toFixed(2)} €` : "-"}
                </td>
                <td className="border p-2 text-right">
                  {oil.vk1 ? `${oil.vk1.toFixed(2)} €` : "-"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="mt-4 text-gray-500 italic">
          Keine Treffer oder keine Daten verfügbar.
        </p>
      )}
    </div>
  );
}

export default App;
