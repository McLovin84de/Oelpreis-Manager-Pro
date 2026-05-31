import React, { useState, useEffect } from "react";
import Fuse from "fuse.js";

function App() {
  const [data, setData] = useState({ stand_datum: "Unbekannt", daten: [] });
  const [search, setSearch] = useState("");
  const [filtered, setFiltered] = useState([]);
  const [sortConfig, setSortConfig] = useState({ key: "artikelnummer", direction: "asc" });
  const [expandedFreigaben, setExpandedFreigaben] = useState({});

  const toNumber = (value) => {
    if (typeof value === "number") return Number.isFinite(value) ? value : 0;
    if (value === null || value === undefined || value === "") return 0;
    const raw = String(value).trim();
    if (!raw) return 0;

    const normalized = raw
      .replace(/€/g, "")
      .replace(/\s/g, "")
      .replace(/\.(?=\d{3}(?:\D|$))/g, "")
      .replace(",", ".");

    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const hasValue = (value) => value !== null && value !== undefined && String(value).trim() !== "";

  const formatEuro = (value) => {
    if (!hasValue(value)) return "–";
    const n = toNumber(value);
    return `${n.toFixed(2)} €`;
  };

  const formatPercent = (value) => {
    if (!hasValue(value)) return "–";
    const n = toNumber(value);
    return `${n.toFixed(1)} %`;
  };

  const getEk = (oil) => toNumber(oil.nettopreis ?? oil.nettopreislieferant ?? oil.nettopreis_lieferant);
  const getVk = (oil) => toNumber(oil.vk1);

  const getRohertrag = (oil) => {
    if (oil.rohertrag !== undefined && oil.rohertrag !== null && oil.rohertrag !== "") return toNumber(oil.rohertrag);
    const vk = getVk(oil);
    const ek = getEk(oil);
    if (!vk || !ek) return null;
    return vk - ek;
  };

  const getMargeProzent = (oil) => {
    if (oil.marge_prozent !== undefined && oil.marge_prozent !== null && oil.marge_prozent !== "") return toNumber(oil.marge_prozent);
    const vk = getVk(oil);
    const ek = getEk(oil);
    if (!vk || !ek) return null;
    return ((vk - ek) / vk) * 100;
  };

  const getMargeStyle = (percent) => {
    const p = toNumber(percent);
    if (p < 45) return styles.badgeRed;
    if (p < 60) return styles.badgeYellow;
    return styles.badgeGreen;
  };

  const parseLiters = (oil) => {
    const direct = toNumber(oil.gebinde_l);
    if (direct > 0) return direct;
    const text = String(oil.bezeichnung || "").toLowerCase();
    const packMatch = text.match(/(\d+(?:[.,]\d+)?)\s*[x×]\s*(\d+(?:[.,]\d+)?)\s*l\b/);
    if (packMatch) {
      const packs = toNumber(packMatch[1]);
      const litersEach = toNumber(packMatch[2]);
      if (packs > 0 && litersEach > 0) return packs * litersEach;
    }
    const singleMatch = text.match(/(\d+(?:[.,]\d+)?)\s*l\b/);
    if (!singleMatch) return 0;
    return toNumber(singleMatch[1]);
  };

  const getMargeProLiter = (oil) => {
    const hasEkPerLiter = hasValue(oil.ek_pro_liter);
    const hasVkPerLiter = hasValue(oil.preis_pro_liter);

    if (hasEkPerLiter && hasVkPerLiter) {
      return toNumber(oil.preis_pro_liter) - toNumber(oil.ek_pro_liter);
    }

    if (hasEkPerLiter !== hasVkPerLiter) return null;

    const liters = parseLiters(oil);
    if (!liters) return null;
    return getRohertrag(oil) / liters;
  };

  const formatEuroPerLiter = (value) => {
    if (value === null || value === undefined) return "–";
    return `${toNumber(value).toFixed(2)} € /L`;
  };

  const normalizeSearchText = (value) =>
    String(value ?? "")
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "");

  const normalizeViskositaet = (value) => {
    const match = String(value || "").match(/\b(\d{1,3})\s*w\s*-?\s*(\d{2,3})\b/i);
    if (!match) return "";
    return `${match[1].toUpperCase()}W-${match[2]}`;
  };

  const detectViskositaet = (oil) => {
    const direct = normalizeViskositaet(oil.viskositaet);
    if (direct) return direct;

    const fromFluidTyp = normalizeViskositaet(oil.fluid_typ);
    if (fromFluidTyp) return fromFluidTyp;

    return normalizeViskositaet([oil.bezeichnung, oil.freigaben, oil.bemerkungen].join(" "));
  };

  const detectFluidTyp = (oil) => {
    const existing = String(oil.fluid_typ || "").trim();
    const isViscosity = Boolean(normalizeViskositaet(existing));
    if (existing && !isViscosity) return existing;

    const text = String(oil.bezeichnung || "").toLowerCase();
    if (text.includes("motoröl") || text.includes("motorol")) return "Motoröl";
    if (text.includes("getriebeöl") || text.includes("getriebeoel") || text.includes("getriebe") || text.includes("atf")) {
      return "Getriebeöl";
    }
    if (
      text.includes("kühlmittel") ||
      text.includes("kuehlmittel") ||
      text.includes("kühlerfrostschutz") ||
      text.includes("kuehlerfrostschutz") ||
      text.includes("frostschutz") ||
      text.includes("g12") ||
      text.includes("g13") ||
      text.includes("g40") ||
      text.includes("d40")
    ) {
      return "Kühlmittel";
    }
    if (text.includes("bremsflüssigkeit") || text.includes("bremsfluessigkeit") || text.includes("dot")) {
      return "Bremsflüssigkeit";
    }
    return "Sonstiges";
  };

  const normalizeOil = (oil) => {
    const freigaben = Array.isArray(oil.freigaben) ? oil.freigaben.join(", ") : oil.freigaben || "";
    const fluidTyp = detectFluidTyp(oil);
    const viskositaet = detectViskositaet({ ...oil, freigaben });
    const searchText = [
      oil.artikelnummer,
      oil.interne_nummer,
      oil.hersteller_artikelnummer,
      oil.hersteller,
      oil.bezeichnung,
      freigaben,
      oil.kategorie,
      fluidTyp,
      viskositaet,
    ].join(" ");

    return {
      ...oil,
      artikelnummer: oil.artikelnummer || oil.interne_nummer || "",
      interne_nummer: oil.interne_nummer || oil.artikelnummer || "",
      hersteller_artikelnummer: oil.hersteller_artikelnummer || "",
      hersteller: oil.hersteller || "",
      bezeichnung: oil.bezeichnung || "",
      freigaben,
      kategorie: oil.kategorie || "",
      fluid_typ: fluidTyp,
      viskositaet,
      search_text: normalizeSearchText(searchText),
    };
  };

  useEffect(() => {
    fetch("/data/localdb.json")
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP-Fehler: ${res.status}`);
        return res.json();
      })
      .then((json) => {
        const daten = Array.isArray(json?.daten) ? json.daten.map(normalizeOil) : [];
        setData({ stand_datum: json?.stand_datum || "Unbekannt", daten });
        setFiltered(daten);
      })
      .catch((err) => {
        console.error("❌ Fehler beim Laden der JSON:", err);
        setData({ stand_datum: "Unbekannt", daten: [] });
        setFiltered([]);
      });
  }, []);

  useEffect(() => {
    if (!data?.daten?.length) return;

    const fuse = new Fuse(data.daten, {
      keys: [
        "freigaben",
        "bezeichnung",
        "hersteller",
        "artikelnummer",
        "hersteller_artikelnummer",
        "kategorie",
        "fluid_typ",
        "viskositaet",
      ],
      threshold: 0.3,
    });

    if (!search.trim()) {
      setFiltered(data.daten);
      return;
    }

    const normalizedSearch = normalizeSearchText(search);
    const directMatches = normalizedSearch
      ? data.daten.filter((oil) => oil.search_text.includes(normalizedSearch))
      : [];
    const fuzzyMatches = fuse.search(search).map((r) => r.item);
    const mergedMatches = new Map();

    [...directMatches, ...fuzzyMatches].forEach((oil) => {
      mergedMatches.set(`${oil.interne_nummer}-${oil.artikelnummer}`, oil);
    });

    setFiltered([...mergedMatches.values()]);
  }, [search, data]);

  const escapeHtml = (value) =>
    String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");

  const escapeRegExp = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  const highlight = (text) => {
    const rawText = Array.isArray(text) ? text.join(", ") : String(text || "");
    if (!rawText) return "";

    const safeText = escapeHtml(rawText);
    if (!search) return safeText;

    const escapedSearch = escapeRegExp(escapeHtml(search));
    const regex = new RegExp(`(${escapedSearch})`, "gi");
    return safeText.replace(regex, (m) => `<span style="background-color: #ffeb3b; color: black; font-weight: 600;">${m}</span>`);
  };

  const getDisplayBezeichnung = (oil) => {
    const bezeichnung = String(oil.bezeichnung || "");
    const viskositaet = normalizeViskositaet(oil.viskositaet);
    const match = viskositaet.match(/^(\d{1,3})W-(\d{2,3})$/i);

    if (!bezeichnung || !match) return bezeichnung;

    const pattern = `${match[1]}\\s*W\\s*-?\\s*${match[2]}`;
    return bezeichnung
      .replace(new RegExp(`(^|[^A-Za-z0-9])${pattern}(?=$|[^A-Za-z0-9])`, "i"), "$1")
      .replace(/\s+([,;:])/g, "$1")
      .replace(/([([{])\s*([)\]}])/g, "")
      .replace(/\s{2,}/g, " ")
      .trim();
  };

  const getFreigabenKey = (oil) => oil.artikelnummer || oil.interne_nummer || "";

  const getFreigabenPreview = (freigaben) => {
    const text = String(freigaben || "").trim();
    if (!text) return { text: "", isTruncated: false };

    if (text.length > 140) {
      const previewByLength = text.slice(0, 140).replace(/\s+\S*$/, "").replace(/[,\s]+$/, "");
      return { text: `${previewByLength || text.slice(0, 140).trim()}...`, isTruncated: true };
    }

    return { text, isTruncated: false };
  };

  const renderFreigaben = (oil) => {
    const text = String(oil.freigaben || "").trim();
    if (!text) return "–";

    const key = getFreigabenKey(oil);
    const isExpanded = Boolean(expandedFreigaben[key]);
    const preview = getFreigabenPreview(text);
    const displayText = isExpanded || !preview.isTruncated ? text : preview.text;

    return (
      <>
        <span dangerouslySetInnerHTML={{ __html: highlight(displayText) }} />
        {preview.isTruncated ? (
          <button
            type="button"
            style={styles.freigabenToggle}
            onClick={() => setExpandedFreigaben((current) => ({ ...current, [key]: !isExpanded }))}
          >
            {isExpanded ? "weniger" : "mehr"}
          </button>
        ) : null}
      </>
    );
  };

  const sortAccessors = {
    artikelnummer: (oil) => oil.artikelnummer || oil.interne_nummer || "",
    hersteller_artikelnummer: (oil) => oil.hersteller_artikelnummer || "",
    bezeichnung: (oil) => oil.bezeichnung || "",
    freigaben: (oil) => oil.freigaben || "",
    hersteller: (oil) => oil.hersteller || "",
    kategorie: (oil) => oil.kategorie || "",
    fluid_typ: (oil) => oil.fluid_typ || "",
    viskositaet: (oil) => oil.viskositaet || "",
    ek: getEk,
    vk: getVk,
    rohertrag: getRohertrag,
    marge: getMargeProzent,
  };

  const numericSortKeys = new Set(["ek", "vk", "rohertrag", "marge"]);
  const collator = new Intl.Collator("de", { numeric: true, sensitivity: "base" });

  const sortedFiltered = [...filtered].sort((a, b) => {
    const accessor = sortAccessors[sortConfig.key];
    if (!accessor) return 0;

    const direction = sortConfig.direction === "desc" ? -1 : 1;
    const valueA = accessor(a);
    const valueB = accessor(b);

    if (numericSortKeys.has(sortConfig.key)) {
      return (toNumber(valueA) - toNumber(valueB)) * direction;
    }

    return collator.compare(String(valueA), String(valueB)) * direction;
  });

  const handleSort = (key) => {
    setSortConfig((current) => ({
      key,
      direction: current.key === key && current.direction === "asc" ? "desc" : "asc",
    }));
  };

  const renderSortHeader = (key, label) => {
    const isActive = sortConfig.key === key;
    const indicator = isActive ? (sortConfig.direction === "asc" ? "▲" : "▼") : "↕";

    return (
      <button type="button" onClick={() => handleSort(key)} style={styles.sortButton} title={`${label} sortieren`}>
        <span>{label}</span>
        <span style={isActive ? styles.sortIconActive : styles.sortIcon}>{indicator}</span>
      </button>
    );
  };

  return (
    <div style={styles.page}>
      <h1 style={styles.title}>Ölpreis-Manager Pro</h1>

      <div style={styles.infoBox}>
        📅 <strong>Datenstand:</strong> {data?.stand_datum || "Unbekannt"} | <strong>Artikel:</strong> {data?.daten?.length || 0} | <strong>Treffer:</strong> {filtered.length}
      </div>

      <input
        type="text"
        placeholder="🔍 Suche nach Artikelnummer, HArtNr, Freigabe, Hersteller..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={styles.search}
      />

      {filtered.length > 0 ? (
        <div style={styles.tableContainer}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>{renderSortHeader("artikelnummer", "Artikelnummer")}</th>
                <th style={styles.th}>{renderSortHeader("hersteller_artikelnummer", "Hersteller-Art.-Nr.")}</th>
                <th style={styles.th}>{renderSortHeader("bezeichnung", "Bezeichnung")}</th>
                <th style={styles.th}>{renderSortHeader("freigaben", "Freigaben")}</th>
                <th style={styles.th}>{renderSortHeader("hersteller", "Hersteller")}</th>
                <th style={styles.th}>{renderSortHeader("kategorie", "Kategorie")}</th>
                <th style={styles.th}>{renderSortHeader("fluid_typ", "Typ")}</th>
                <th style={styles.th}>{renderSortHeader("viskositaet", "Viskosität")}</th>
                <th style={styles.th}>{renderSortHeader("ek", "EK netto")}</th>
                <th style={styles.th}>{renderSortHeader("vk", "VK1 netto")}</th>
                <th style={styles.th}>{renderSortHeader("rohertrag", "Rohertrag")}</th>
                <th style={styles.th}>{renderSortHeader("marge", "Marge")}</th>
              </tr>
            </thead>
            <tbody>
              {sortedFiltered.map((oil, i) => {
                const marge = getMargeProzent(oil);
                return (
                  <tr key={i} style={i % 2 ? styles.trAlt : styles.tr} className="row">
                    <td style={styles.td}>{oil.artikelnummer || oil.interne_nummer || "–"}</td>
                    <td style={styles.td}>{oil.hersteller_artikelnummer || "–"}</td>
                    <td style={styles.td} dangerouslySetInnerHTML={{ __html: highlight(getDisplayBezeichnung(oil)) }} />
                    <td style={styles.freigabenTd}>{renderFreigaben(oil)}</td>
                    <td style={styles.td}>{oil.hersteller || "–"}</td>
                    <td style={styles.td}>{oil.kategorie || "–"}</td>
                    <td style={styles.td}>{oil.fluid_typ || "–"}</td>
                    <td style={styles.td}>{oil.viskositaet || "–"}</td>
                    <td style={{ ...styles.td, textAlign: "right" }}>{formatEuro(getEk(oil))}</td>
                    <td style={{ ...styles.td, textAlign: "right" }}>{formatEuro(getVk(oil))}</td>
                    <td style={{ ...styles.td, textAlign: "right" }}>{formatEuro(getRohertrag(oil))}</td>
                    <td style={{ ...styles.td, textAlign: "right" }}>
                      <span style={{ ...styles.badge, ...getMargeStyle(marge) }}>{formatPercent(marge)}</span>
                      <div style={styles.subValue}>{formatEuroPerLiter(getMargeProLiter(oil))}</div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p style={styles.noData}>Keine Treffer oder keine Daten verfügbar.</p>
      )}
    </div>
  );
}

const styles = {
  page: { backgroundColor: "#121212", color: "#e0e0e0", fontFamily: "Segoe UI, Roboto, sans-serif", padding: "30px", minHeight: "100vh" },
  title: { fontSize: "28px", fontWeight: "bold", color: "#ffeb3b", marginBottom: "10px" },
  infoBox: { backgroundColor: "#1e1e1e", display: "inline-block", padding: "6px 12px", borderRadius: "6px", marginBottom: "15px", color: "#ccc" },
  search: { padding: "10px", borderRadius: "6px", width: "100%", maxWidth: "620px", border: "1px solid #444", backgroundColor: "#1e1e1e", color: "#e0e0e0", marginBottom: "20px" },
  tableContainer: { overflowX: "auto", borderRadius: "8px", border: "1px solid #333", backgroundColor: "#1c1c1c" },
  table: { width: "100%", borderCollapse: "collapse" },
  th: { textAlign: "left", backgroundColor: "#222", color: "#ffeb3b", padding: "10px", borderBottom: "2px solid #333", position: "sticky", top: 0 },
  sortButton: { display: "inline-flex", alignItems: "center", gap: "6px", width: "100%", border: 0, padding: 0, background: "transparent", color: "inherit", font: "inherit", fontWeight: 700, textAlign: "left", cursor: "pointer" },
  sortIcon: { color: "#777", fontSize: "11px" },
  sortIconActive: { color: "#ffeb3b", fontSize: "11px" },
  td: { padding: "8px 10px", borderBottom: "1px solid #333", verticalAlign: "top" },
  freigabenTd: { padding: "8px 10px", borderBottom: "1px solid #333", verticalAlign: "top", maxWidth: 320, whiteSpace: "normal" },
  freigabenToggle: { display: "inline-block", marginLeft: "8px", border: "1px solid #555", borderRadius: "4px", padding: "2px 7px", backgroundColor: "#242424", color: "#ffeb3b", cursor: "pointer", font: "inherit", fontSize: "12px" },
  tr: { backgroundColor: "#1a1a1a" },
  trAlt: { backgroundColor: "#181818" },
  noData: { marginTop: "20px", fontStyle: "italic", color: "#aaa" },
  badge: { display: "inline-block", minWidth: "70px", padding: "3px 8px", borderRadius: "999px", fontWeight: 700, textAlign: "center" },
  badgeRed: { backgroundColor: "#4a1515", color: "#ffb3b3", border: "1px solid #8a2b2b" },
  badgeYellow: { backgroundColor: "#4a3d12", color: "#ffe28a", border: "1px solid #8a742b" },
  badgeGreen: { backgroundColor: "#153d24", color: "#9af0b8", border: "1px solid #2f8a50" },
  subValue: { fontSize: "12px", color: "#b8bec9", marginTop: "4px" },
};

export default App;
