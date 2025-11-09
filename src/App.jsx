import React, { useState, useEffect } from "react";
import "./styles.css";
import data from "../public/data/localdb.json";

export default function App() {
  const [password, setPassword] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [search, setSearch] = useState("");

  const handleLogin = () => {
    if (password === "26061984") setUnlocked(true);
    else alert("Falsches Passwort!");
  };

  if (!unlocked) {
    return (
      <div className="login-container">
        <h2>🔒 Geschützte Seite</h2>
        <input
          type="password"
          placeholder="Passwort eingeben"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button onClick={handleLogin}>Anmelden</button>
      </div>
    );
  }

  const filtered = data.filter((item) =>
    item.bezeichnung.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="container">
      <h1>🛢️ Öl-Datenübersicht</h1>
      <input
        type="text"
        placeholder="Suche nach Bezeichnung..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <table>
        <thead>
          <tr>
            <th>Interne Nr</th>
            <th>Artikelnummer</th>
            <th>Hersteller</th>
            <th>Bezeichnung</th>
            <th>Kategorie</th>
            <th>Freigaben</th>
            <th>Netto EK</th>
            <th>VK1</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((oil) => (
            <tr key={oil.interne_nummer}>
              <td>{oil.interne_nummer}</td>
              <td>{oil.artikelnummer}</td>
              <td>{oil.hersteller}</td>
              <td>{oil.bezeichnung}</td>
              <td>{oil.kategorie}</td>
              <td>{oil.freigaben.join(", ")}</td>
              <td>{oil.preis_netto.toFixed(2)} €</td>
              <td>{oil.vk1.toFixed(2)} €</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
