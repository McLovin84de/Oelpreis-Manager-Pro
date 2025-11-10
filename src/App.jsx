import React, { useState, useEffect } from "react";
import Fuse from "fuse.js";

function App() {
  const [data, setData] = useState(null);
  const [search, setSearch] = useState("");
  const [filtered, setFiltered] = useState([]);

  // === JSON LADEN ===
  useEffect(() => {
    fetch("/data/localdb.json")
      .then((res) => res.json())
      .then((json) => {
        console.log("✅ JSON geladen:", json);
        setData(json);
        setFiltered(json?.daten || []);
      })
      .catch((err) => {
        console.error("❌ Fehler beim Laden der localdb.json:", err);
      });
  }, []);

  // === SUCHE MIT FUZZY ===
  useEffect(() => {
    if (!data?.daten) return;
    const fuse = new Fuse(data.daten, {
      keys: ["freigaben", "bezeichnung", "hersteller", "artikelnummer"],
      threshold: 0.3,
    });
    if (!search.trim()) {
      setFiltered(data.daten);
    } else {
      const results = fuse.search(search);
      setFiltered(results.map((r) => r.item));
    }
  }, [search, data]);

  // === TEXT HERVORHEBEN ===
  const highlight = (text) => {
    if (!text) return "";
    if (!search) return text;
    const regex = new RegExp(`(${search})`, "gi");
    return text.replace(regex, (m) => `<mark style="background:yellow">${m}</mark>`);
  };

  // === DATUM LESEN ===
  const standDatum = data?.stand_datum?.trim?.() || "Unbekannt";

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-6 font-sans">
      <h1 className="text-3xl font-bold mb-3 text-white">Ölpreis-Manager Pro</h1>

      {/* DATENSTAND */}
      <div className="mb-4 p-2 bg-gray-800 rounded-md inline-block">
        📅 <span className="font-semibold">Datenstand:</span> {standDatum}
      </div>

      {/* SUCHFELD */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="Suche nach Freigabe, Hersteller oder Artikelnummer..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-md p-2 rounded bg-gray-800 border border-gray-700 text-gray-200 focus:outline-none focus:ring-2 focus:ring-yellow-400"
        />
      </div>

      {/* TABELLE */}
      {filtered.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm border border-gray-700">
            <thead className="bg-gray-800 text-gray-300">
              <tr>
                <th className="border border-gray-700 p-2 text-left">Interne Nr.</th>
                <th className="border border-gray-700 p-2 text-left">Artikelnummer</th>
                <th className="border border-gray-700 p-2 text-left">Bezeichnung</th>
                <th className="border border-gray-700 p-2 text-left">Freigaben</th>
                <th className="border border-gray-700 p-2 text-left">Hersteller</th>
                <th className="border border-gray-700 p-2 text-left">Kategorie</th>
                <th className="border border-gray-700 p-2 text-right">VK1 (€)</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((oil) => (
                <tr key={oil.interne_nummer} className="hover:bg-gray-800">
                  <td className="border border-gray-700 p-2">{oil.interne_nummer}</td>
                  <td className="border border-gray-700 p-2">{oil.artikelnummer}</td>
                  <td
                    className="border border-gray-700 p-2"
                    dangerouslySetInnerHTML={{ __html: highlight(oil.bezeichnung || "") }}
                  ></td>
                  <td
                    className="border border-gray-700 p-2"
                    dangerouslySetInnerHTML={{ __html: highlight(oil.freigaben || "") }}
                  ></td>
                  <td className="border border-gray-700 p-2">{oil.hersteller}</td>
                  <td className="border border-gray-700 p-2">{oil.kategorie}</td>
                  <td className="border border-gray-700 p-2 text-right">
                    {oil.vk1 ? `${oil.vk1.toFixed(2)} €` : "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="mt-6 text-gray-400 italic">Keine Treffer oder keine Daten verfügbar.</p>
      )}
    </div>
  );
}

export default App;
