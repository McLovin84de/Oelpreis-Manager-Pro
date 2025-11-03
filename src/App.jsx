import React, { useState, useEffect } from "react";
import "./styles.css";

export default function App() {
  const [data, setData] = useState([]);
  const [search, setSearch] = useState("");
  const [filtered, setFiltered] = useState([]);

  useEffect(() => {
    fetch("/api/localdb.json")
      .then((res) => res.json())
      .then((json) => {
        setData(json);
        setFiltered(json);
      })
      .catch(() => alert("Fehler bei Suche"));
  }, []);

  const handleSearch = (e) => {
    const value = e.target.value.toLowerCase();
    setSearch(value);
    setFiltered(
      data.filter(
        (item) =>
          item.hersteller.toLowerCase().includes(value) ||
          item.bezeichnung.toLowerCase().includes(value) ||
          item.artikelnummer.includes(value) ||
          item.freigaben.some((f) => f.toLowerCase().includes(value))
      )
    );
  };

  return (
    <div className="app">
      <h1>Ölpreis-Manager Pro</h1>
      <input
        type="text"
        placeholder="Suche nach Hersteller, Freigabe oder Artikelnummer..."
        value={search}
        onChange={handleSearch}
      />
      <table>
        <thead>
          <tr>
            <th>Artikelnummer</th>
            <th>Hersteller</th>
            <th>Bezeichnung</th>
            <th>Freigaben</th>
            <th>Kategorie</th>
            <th>Preis (netto)</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((item, i) => (
            <tr key={i}>
              <td>{item.artikelnummer}</td>
              <td>{item.hersteller}</td>
              <td>{item.bezeichnung}</td>
              <td>{item.freigaben.join(", ")}</td>
              <td>{item.kategorie}</td>
              <td>{item.preis_netto.toFixed(2)} €</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
