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

  // === FUZZY-SUCHE ===
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

  // === HERVORHEBUNG ===
  const highlight = (text) => {
    if (!text) return "";
    if (!search) return text;
    const regex = new RegExp(`(${search})`, "gi");
    return text.replace(
      regex,
      (m) => `<mark style="background:#ffd54f;color:black">${m}</mark>`
    );
  };

  // === DATUM ===
  const standDatum = data?.stand_datum?.trim?.() || "Unbekannt";

  return (
    <div className="min-h-screen bg-[#121212] text-gray-100 font-sans p-6">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-4 text-yellow-400">
          Ölpreis-Manager Pro
        </h1>

        {/* DATENSTAND */}
        <div className="mb-6 flex items-center gap-2 text-sm text-gray-300">
          <span className="bg-gray-800 px-3 py-1 rounded-md shadow">
            📅 <strong>Datenstand:</strong> {standDatum}
          </span>
        </div>

        {/* SUCHFELD */}
        <input
          type="text"
          placeholder="🔍 Suche nach Freigabe, Hersteller oder Artikelnummer..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-md p-2 mb-6 rounded-md bg-gray-800 border border-gray-700 focus:ring-2 focus:ring-yellow-400 text-gray-200 placeholder-gray-400 focus:outline-none"
        />

        {/* TABELLE */}
        {filtered.length > 0 ? (
          <div className="overflow-x-auto rounded-lg shadow-lg border border-gray-800">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-900 sticky top-0">
                <tr>
                  {[
                    "Interne Nr.",
                    "Artikelnummer",
                    "Bezeichnung",
                    "Freigaben",
                    "Hersteller",
                    "Kategorie",
                    "EK (Netto)",
                    "VK 1 (€)",
                  ].map((col) => (
                    <th
                      key={col}
                      className="px-3 py-2 text-left font-semibold text-gray-300 border-b border-gray-700"
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((oil, i) => (
                  <tr
                    key={i}
                    className={`${
                      i % 2 === 0 ? "bg-gray-800" : "bg-gray-850"
                    } hover:bg-gray-700 transition-colors`}
                  >
                    <td className="px-3 py-2">{oil.interne_nummer}</td>
                    <td className="px-3 py-2">{oil.artikelnummer}</td>
                    <td
                      className="px-3 py-2"
                      dangerouslySetInnerHTML={{
                        __html: highlight(oil.bezeichnung || ""),
                      }}
                    ></td>
                    <td
                      className="px-3 py-2"
                      dangerouslySetInnerHTML={{
                        __html: highlight(oil.freigaben || ""),
                      }}
                    ></td>
                    <td className="px-3 py-2">{oil.hersteller}</td>
                    <td className="px-3 py-2">{oil.kategorie}</td>
                    <td className="px-3 py-2 text-right">
                      {oil.nettopreis
                        ? `${oil.nettopreis.toFixed(2)} €`
                        : "–"}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {oil.vk1 ? `${oil.vk1.toFixed(2)} €` : "–"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-8 text-gray-500 italic">
            Keine Treffer oder keine Daten verfügbar.
          </p>
        )}
      </div>
    </div>
  );
}

export default App;
