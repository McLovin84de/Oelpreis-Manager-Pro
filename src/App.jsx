import React, { useState, useEffect } from "react";
import Fuse from "fuse.js";

function App() {
  const [data, setData] = useState([]);
  const [meta, setMeta] = useState({});
  const [search, setSearch] = useState("");

  // JSON laden
  useEffect(() => {
    fetch("./data/localdb.json")
      .then((res) => res.json())
      .then((json) => {
        if (Array.isArray(json)) {
          setData(json);
          setMeta({ stand_datum: "unbekannt" });
        } else {
          setData(json.daten || []);
          setMeta({ stand_datum: json.stand_datum || "unbekannt" });
        }
      })
      .catch((err) => console.error("Fehler beim Laden:", err));
  }, []);

  // Fuzzy Suche
  const fuse = new Fuse(data, {
    keys: ["freigaben", "bezeichnung", "hersteller", "artikelnummer"],
    threshold: 0.3,
  });
  const results = search.trim()
    ? fuse.search(search).map((r) => r.item)
    : data;

  // Treffer markieren
  const highlight = (text) => {
    if (!search) return text;
    const regex = new RegExp(`(${search})`, "gi");
    return text.replace(regex, (match) => `<mark style="background:yellow">${match}</mark>`);
  };

  if (!data.length) return <div className="p-4 text-gray-600">Lade Daten...</div>;

  return (
    <div className="p-4 font-sans">
      <h1 className="text-2xl font-bold mb-4">Ölpreis-Manager Pro</h1>

      {/* Datum */}
      <div className="mb-4 p-2 bg-gray-100 rounded-md text-gray-700 text-sm inline-block shadow-sm">
        📅 <span className="font-semibold">Datenstand:</span> {meta.stand_datum}
      </div>

      {/* Suche */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="Suche nach Freigabe, Hersteller, Artikelnummer..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border p-2 rounded w-full max-w-md shadow-sm"
        />
      </div>

      {/* Tabelle */}
      <table className="min-w-full border-collapse border border-gray-300">
        <thead className="bg-gray-200">
          <tr>
            <th className="border p-2 text-left">Interne Nr.</th>
            <th className="border p-2 text-left">Artikelnummer</th>
            <th className="border p-2 text-left">Hersteller</th>
            <th className="border p-2 text-left w-64">Bezeichnung</th>
            <th className="border p-2 text-left w-96">Freigaben</th>
            <th className="border p-2 text-left">Kategorie</th>
            <th className="border p-2 text-right">EK (Netto)</th>
            <th className="border p-2 text-right">VK 1</th>
          </tr>
        </thead>
        <tbody>
          {results.map((oil) => (
            <tr key={oil.interne_nummer} className="hover:bg-gray-50">
              <td className="border p-2">{oil.interne_nummer}</td>
              <td className="border p-2">{oil.artikelnummer}</td>
              <td className="border p-2">{oil.hersteller}</td>
              <td
                className="border p-2"
                dangerouslySetInnerHTML={{ __html: highlight(oil.bezeichnung || "") }}
              ></td>
              <td
                className="border p-2"
                dangerouslySetInnerHTML={{ __html: highlight((oil.freigaben || []).join(", ")) }}
              ></td>
              <td className="border p-2">{oil.kategorie}</td>
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

      {results.length === 0 && (
        <p className="mt-4 text-gray-500 italic">Keine Treffer gefunden.</p>
      )}
    </div>
  );
}

export default App;
