import React, { useState, useEffect } from "react";
import Fuse from "fuse.js";

const getDefaultFilters = () => ({ fluidTyp: "alle", kategorie: "alle", marge: "alle", issue: "alle" });
const fluidTypeOrder = ["Motoröl", "Getriebeöl", "Kühlmittel", "Bremsflüssigkeit", "Sonstiges"];
const margeFilterLabels = {
  kritisch: "Marge unter 45 %",
  beobachten: "Marge 45 bis 59 %",
  gut: "Marge ab 60 %",
  ohne: "Marge fehlt",
};
const issueFilterLabels = {
  preisFehlt: "Preis fehlt",
  spezifikationOffen: "Spezifikation offen",
  freigabenFehlen: "Freigaben fehlen",
  typPruefen: "Typ prüfen",
};
const quickFreigabeCandidates = [
  { label: "VW 504 00", query: "50400" },
  { label: "VW 507 00", query: "50700" },
  { label: "VW 508 00", query: "50800" },
  { label: "VW 509 00", query: "50900" },
  { label: "ACEA C3", query: "acea c3" },
  { label: "ACEA C5", query: "acea c5" },
  { label: "ACEA C6", query: "acea c6" },
  { label: "MB 229.51", query: "22951" },
  { label: "MB 229.52", query: "22952" },
  { label: "Porsche C30", query: "porsche c30" },
  { label: "API SN", query: "api sn" },
];

function App() {
  const [data, setData] = useState({ stand_datum: "Unbekannt", daten: [] });
  const [loadStatus, setLoadStatus] = useState("loading");
  const [loadError, setLoadError] = useState("");
  const [search, setSearch] = useState("");
  const [filtered, setFiltered] = useState([]);
  const [sortConfig, setSortConfig] = useState({ key: "artikelnummer", direction: "asc" });
  const [expandedFreigaben, setExpandedFreigaben] = useState({});
  const [filters, setFilters] = useState(getDefaultFilters);

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

  const renderRequiredEuro = (value, perLiter = null) => {
    const n = toNumber(value);
    if (n <= 0) return <span style={styles.inlineWarning}>fehlt</span>;
    return (
      <>
        <span>{formatEuro(n)}</span>
        {perLiter && perLiter > 0 ? <div style={styles.subValue}>{formatEuroPerLiter(perLiter)}</div> : null}
      </>
    );
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

  const hasMissingPrice = (oil) => getEk(oil) <= 0 || getVk(oil) <= 0;
  const needsSpezifikation = (oil) => oil.fluid_typ && oil.fluid_typ !== "Sonstiges";
  const hasOpenSpezifikation = (oil) => needsSpezifikation(oil) && !hasValue(oil.display_spezifikation);
  const hasMissingFreigaben = (oil) => !hasValue(oil.freigaben);

  const getMargeStyle = (percent) => {
    if (!hasValue(percent)) return styles.badgeNeutral;
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

  const getDisplayPricePerLiter = (oil, totalValue, explicitPerLiterKey) => {
    const explicitValue = toNumber(oil[explicitPerLiterKey]);
    if (explicitValue > 0) return explicitValue;

    const total = toNumber(totalValue);
    const liters = parseLiters(oil);
    if (total <= 0 || liters <= 0 || Math.abs(liters - 1) < 0.001) return null;

    return total / liters;
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

    const text = normalizeSearchText([oil.bezeichnung, oil.freigaben, oil.bemerkungen].join(" "));
    if (text.includes("bremsflussigkeit") || /dot(?:3|4|5|51)/.test(text)) {
      return "Bremsflüssigkeit";
    }
    if (
      text.includes("kuhlmittel") ||
      text.includes("kuehlmittel") ||
      text.includes("kuhlerfrostschutz") ||
      text.includes("kuehlerfrostschutz") ||
      text.includes("frostschutz") ||
      text.includes("g12") ||
      text.includes("g13") ||
      text.includes("g40") ||
      text.includes("d40")
    ) {
      return "Kühlmittel";
    }
    if (
      text.includes("getriebeol") ||
      text.includes("getriebeoel") ||
      text.includes("getriebe") ||
      text.includes("atf") ||
      text.includes("gl4") ||
      text.includes("gl5") ||
      /(?:75|80)w\d{2,3}/.test(text)
    ) {
      return "Getriebeöl";
    }
    if (text.includes("motorol") || text.includes("motoroel") || /(?:0|5|10|15)w\d{2}/.test(text)) return "Motoröl";
    return "Sonstiges";
  };

  const detectSpezifikation = (oil) => {
    const text = [oil.viskositaet, oil.bezeichnung, oil.freigaben, oil.bemerkungen].join(" ");
    const viskositaet = normalizeViskositaet(oil.viskositaet) || normalizeViskositaet(text);
    if (viskositaet) return viskositaet;

    const compactText = normalizeSearchText(text);
    if (compactText.includes("dot51")) return "DOT 5.1";
    if (compactText.includes("dot5")) return "DOT 5";
    if (compactText.includes("dot4")) return "DOT 4";
    if (compactText.includes("dot3")) return "DOT 3";

    const coolantMatch = text.match(/(?:^|[^a-z0-9])g\s*(12|13|40)\s*(\+\+|\+)?(?=$|[^a-z0-9])/i);
    if (coolantMatch) return `G${coolantMatch[1]}${coolantMatch[2] || ""}`;
    if (/(?:^|[^a-z0-9])d\s*40(?=$|[^a-z0-9])/i.test(text)) return "D40";

    const gearMatch = text.match(/(?:^|[^a-z0-9])gl\s*-?\s*([45])(?=$|[^a-z0-9])/i);
    if (gearMatch) return `GL-${gearMatch[1]}`;
    if (compactText.includes("atf")) return "ATF";

    return "";
  };

  const normalizeOil = (oil) => {
    const freigaben = Array.isArray(oil.freigaben) ? oil.freigaben.join(", ") : oil.freigaben || "";
    const fluidTyp = detectFluidTyp(oil);
    const viskositaet = detectViskositaet({ ...oil, freigaben });
    const displaySpezifikation = detectSpezifikation({ ...oil, freigaben, fluid_typ: fluidTyp, viskositaet });
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
      displaySpezifikation,
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
      display_spezifikation: displaySpezifikation,
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
        setLoadStatus("ready");
        setLoadError("");
      })
      .catch((err) => {
        console.error("❌ Fehler beim Laden der JSON:", err);
        setData({ stand_datum: "Unbekannt", daten: [] });
        setFiltered([]);
        setLoadStatus("error");
        setLoadError(err?.message || "Die Daten konnten nicht geladen werden.");
      });
  }, []);

  useEffect(() => {
    if (!data?.daten?.length) {
      setFiltered([]);
      return;
    }

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
        "display_spezifikation",
      ],
      threshold: 0.3,
    });

    let searchMatches = data.daten;

    if (search.trim()) {
      const normalizedSearch = normalizeSearchText(search);
      const directMatches = normalizedSearch
        ? data.daten.filter((oil) => oil.search_text.includes(normalizedSearch))
        : [];
      const fuzzyMatches = fuse.search(search).map((r) => r.item);
      const mergedMatches = new Map();

      [...directMatches, ...fuzzyMatches].forEach((oil) => {
        mergedMatches.set(`${oil.interne_nummer}-${oil.artikelnummer}`, oil);
      });

      searchMatches = [...mergedMatches.values()];
    }

    const nextFiltered = searchMatches.filter((oil) => {
      if (filters.fluidTyp !== "alle" && oil.fluid_typ !== filters.fluidTyp) return false;
      if (filters.kategorie !== "alle" && oil.kategorie !== filters.kategorie) return false;
      if (filters.issue === "preisFehlt" && !hasMissingPrice(oil)) return false;
      if (filters.issue === "spezifikationOffen" && !hasOpenSpezifikation(oil)) return false;
      if (filters.issue === "freigabenFehlen" && !hasMissingFreigaben(oil)) return false;
      if (filters.issue === "typPruefen" && oil.fluid_typ !== "Sonstiges") return false;

      const marge = getMargeProzent(oil);
      const hasMarge = hasValue(marge);

      if (filters.marge === "kritisch") return hasMarge && toNumber(marge) < 45;
      if (filters.marge === "beobachten") return hasMarge && toNumber(marge) >= 45 && toNumber(marge) < 60;
      if (filters.marge === "gut") return hasMarge && toNumber(marge) >= 60;
      if (filters.marge === "ohne") return !hasMarge;

      return true;
    });

    setFiltered(nextFiltered);
  }, [search, data, filters]);

  const escapeHtml = (value) =>
    String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");

  const highlight = (text) => {
    const rawText = Array.isArray(text) ? text.join(", ") : String(text || "");
    if (!rawText) return "";

    const normalizedNeedle = normalizeSearchText(search);
    if (!normalizedNeedle) return escapeHtml(rawText);

    let normalizedText = "";
    const indexMap = [];

    for (let i = 0; i < rawText.length; i += 1) {
      const normalizedChar = normalizeSearchText(rawText[i]);
      for (let j = 0; j < normalizedChar.length; j += 1) {
        normalizedText += normalizedChar[j];
        indexMap.push(i);
      }
    }

    const ranges = [];
    let matchIndex = normalizedText.indexOf(normalizedNeedle);
    while (matchIndex !== -1) {
      const matchEnd = matchIndex + normalizedNeedle.length - 1;
      ranges.push({ start: indexMap[matchIndex], end: indexMap[matchEnd] + 1 });
      matchIndex = normalizedText.indexOf(normalizedNeedle, matchIndex + normalizedNeedle.length);
    }

    if (!ranges.length) return escapeHtml(rawText);

    const mergedRanges = ranges.reduce((merged, range) => {
      const previous = merged[merged.length - 1];
      if (previous && range.start <= previous.end) {
        previous.end = Math.max(previous.end, range.end);
      } else {
        merged.push({ ...range });
      }
      return merged;
    }, []);

    let result = "";
    let cursor = 0;
    mergedRanges.forEach((range) => {
      result += escapeHtml(rawText.slice(cursor, range.start));
      result += `<span style="background-color: #ffeb3b; color: black; font-weight: 600;">${escapeHtml(
        rawText.slice(range.start, range.end)
      )}</span>`;
      cursor = range.end;
    });
    result += escapeHtml(rawText.slice(cursor));

    return result;
  };

  const getFirstNormalizedMatchRange = (text, query) => {
    const rawText = String(text || "");
    const normalizedNeedle = normalizeSearchText(query);
    if (!rawText || !normalizedNeedle) return null;

    let normalizedText = "";
    const indexMap = [];

    for (let i = 0; i < rawText.length; i += 1) {
      const normalizedChar = normalizeSearchText(rawText[i]);
      for (let j = 0; j < normalizedChar.length; j += 1) {
        normalizedText += normalizedChar[j];
        indexMap.push(i);
      }
    }

    const matchIndex = normalizedText.indexOf(normalizedNeedle);
    if (matchIndex === -1) return null;

    const matchEnd = matchIndex + normalizedNeedle.length - 1;
    return { start: indexMap[matchIndex], end: indexMap[matchEnd] + 1 };
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

  const getDisplayFreigaben = (freigaben) => {
    const parts = String(freigaben || "")
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);

    const seen = new Set();
    const uniqueParts = parts.filter((part) => {
      const key = part
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[().]/g, "")
        .replace(/\s+/g, " ")
        .trim();

      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    return uniqueParts.join(", ");
  };

  const getFreigabenPreview = (freigaben) => {
    const text = String(freigaben || "").trim();
    if (!text) return { text: "", isTruncated: false };

    if (text.length > 140) {
      const searchMatch = getFirstNormalizedMatchRange(text, search);
      if (searchMatch && searchMatch.end > 120) {
        let start = Math.max(0, searchMatch.start - 60);
        let end = Math.min(text.length, searchMatch.end + 80);

        while (start > 0 && !/[\s,]/.test(text[start - 1])) start -= 1;
        while (end < text.length && !/[\s,]/.test(text[end])) end += 1;

        const snippet = text.slice(start, end).replace(/^[,\s]+|[,\s]+$/g, "");
        return {
          text: `${start > 0 ? "... " : ""}${snippet}${end < text.length ? " ..." : ""}`,
          isTruncated: true,
        };
      }

      const previewByLength = text.slice(0, 140).replace(/\s+\S*$/, "").replace(/[,\s]+$/, "");
      return { text: `${previewByLength || text.slice(0, 140).trim()}...`, isTruncated: true };
    }

    return { text, isTruncated: false };
  };

  const renderFreigaben = (oil) => {
    const text = getDisplayFreigaben(oil.freigaben);
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
    spezifikation: (oil) => oil.display_spezifikation || oil.viskositaet || "",
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

  const fluidTypOptions = [...new Set(data.daten.map((oil) => oil.fluid_typ).filter(Boolean))].sort(collator.compare);
  const kategorieOptions = [...new Set(data.daten.map((oil) => oil.kategorie).filter(Boolean))].sort(collator.compare);
  const hasActiveControls = Boolean(
    search.trim() ||
      filters.fluidTyp !== "alle" ||
      filters.kategorie !== "alle" ||
      filters.marge !== "alle" ||
      filters.issue !== "alle"
  );
  const activeFilterItems = [
    search.trim()
      ? {
          key: "search",
          label: `Suche: ${search.trim()}`,
          clear: () => setSearch(""),
        }
      : null,
    filters.fluidTyp !== "alle"
      ? {
          key: "fluidTyp",
          label: `Typ: ${filters.fluidTyp}`,
          clear: () => setFilters((current) => ({ ...current, fluidTyp: "alle" })),
        }
      : null,
    filters.kategorie !== "alle"
      ? {
          key: "kategorie",
          label: `Kategorie: ${filters.kategorie}`,
          clear: () => setFilters((current) => ({ ...current, kategorie: "alle" })),
        }
      : null,
    filters.marge !== "alle"
      ? {
          key: "marge",
          label: margeFilterLabels[filters.marge],
          clear: () => setFilters((current) => ({ ...current, marge: "alle" })),
        }
      : null,
    filters.issue !== "alle"
      ? {
          key: "issue",
          label: issueFilterLabels[filters.issue],
          clear: () => setFilters((current) => ({ ...current, issue: "alle" })),
        }
      : null,
  ].filter(Boolean);

  const stats = data.daten.reduce(
    (acc, oil) => {
      const marge = getMargeProzent(oil);
      if (hasMissingPrice(oil)) acc.missingPrices += 1;
      if (hasOpenSpezifikation(oil)) acc.openSpezifikation += 1;
      if (hasMissingFreigaben(oil)) acc.missingFreigaben += 1;
      if (oil.fluid_typ === "Sonstiges") acc.unclearType += 1;
      if (hasValue(marge) && toNumber(marge) < 45) acc.lowMargin += 1;
      if (!hasValue(marge)) acc.missingMargin += 1;
      return acc;
    },
    { lowMargin: 0, missingPrices: 0, missingMargin: 0, openSpezifikation: 0, missingFreigaben: 0, unclearType: 0 }
  );

  const fluidTypeCounts = fluidTypeOrder
    .map((type) => ({ type, count: data.daten.filter((oil) => oil.fluid_typ === type).length }))
    .filter((item) => item.count > 0);
  const quickFreigabeChips = quickFreigabeCandidates
    .map((chip) => ({
      ...chip,
      count: data.daten.filter((oil) => oil.search_text.includes(normalizeSearchText(chip.query))).length,
    }))
    .filter((chip) => chip.count > 0);
  const quickHerstellerChips = [...new Set(data.daten.map((oil) => oil.hersteller).filter(Boolean))]
    .map((label) => ({
      label,
      query: label,
      count: data.daten.filter((oil) => oil.hersteller === label).length,
    }))
    .sort((a, b) => b.count - a.count || collator.compare(a.label, b.label));
  const quickSpezifikationChips = [...new Set(data.daten.map((oil) => oil.display_spezifikation).filter(Boolean))]
    .map((label) => ({
      label,
      query: label,
      count: data.daten.filter((oil) => oil.display_spezifikation === label).length,
    }))
    .sort((a, b) => collator.compare(a.label, b.label));

  const resetControls = () => {
    setSearch("");
    setFilters(getDefaultFilters());
  };

  const applyStatFilter = (nextFilters) => {
    setSearch("");
    setFilters({ ...getDefaultFilters(), ...nextFilters });
  };

  const applyFluidTypeFilter = (fluidTyp) => {
    setSearch("");
    setFilters({ ...getDefaultFilters(), fluidTyp });
  };

  const applyQuickSearch = (query) => {
    setSearch(query);
    setFilters(getDefaultFilters());
  };

  const renderStatCard = ({ label, value, isWarning, isActive, onClick, title }) => {
    const content = (
      <>
        <span style={styles.statLabel}>{label}</span>
        <strong style={isWarning ? styles.statValueWarning : styles.statValue}>{value}</strong>
      </>
    );
    const cardStyle = { ...styles.statCard, ...(isActive ? styles.statCardActive : null) };

    if (!onClick) return <div style={cardStyle}>{content}</div>;

    return (
      <button type="button" onClick={onClick} style={{ ...cardStyle, ...styles.statButton }} title={title}>
        {content}
      </button>
    );
  };

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
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Ölpreis-Manager Pro</h1>
          <div style={styles.metaLine}>Öle und Betriebsstoffe | Datenstand: {data?.stand_datum || "Unbekannt"}</div>
        </div>
      </div>

      <div style={styles.summaryGrid}>
        {renderStatCard({
          label: "Artikel",
          value: data?.daten?.length || 0,
          onClick: resetControls,
          title: "Alle Artikel anzeigen",
        })}
        {renderStatCard({ label: "Treffer", value: filtered.length })}
        {renderStatCard({
          label: "Marge kritisch",
          value: stats.lowMargin,
          isWarning: stats.lowMargin > 0,
          isActive: filters.marge === "kritisch",
          onClick: () => applyStatFilter({ marge: "kritisch" }),
          title: "Artikel mit kritischer Marge anzeigen",
        })}
        {renderStatCard({
          label: "Preis fehlt",
          value: stats.missingPrices,
          isWarning: stats.missingPrices > 0,
          isActive: filters.issue === "preisFehlt",
          onClick: () => applyStatFilter({ issue: "preisFehlt" }),
          title: "Artikel mit fehlendem Preis anzeigen",
        })}
        {renderStatCard({
          label: "Marge fehlt",
          value: stats.missingMargin,
          isWarning: stats.missingMargin > 0,
          isActive: filters.marge === "ohne",
          onClick: () => applyStatFilter({ marge: "ohne" }),
          title: "Artikel ohne berechenbare Marge anzeigen",
        })}
        {renderStatCard({
          label: "Spezifikation offen",
          value: stats.openSpezifikation,
          isWarning: stats.openSpezifikation > 0,
          isActive: filters.issue === "spezifikationOffen",
          onClick: () => applyStatFilter({ issue: "spezifikationOffen" }),
          title: "Artikel ohne Viskosität oder Spezifikation anzeigen",
        })}
        {renderStatCard({
          label: "Freigaben fehlen",
          value: stats.missingFreigaben,
          isWarning: stats.missingFreigaben > 0,
          isActive: filters.issue === "freigabenFehlen",
          onClick: () => applyStatFilter({ issue: "freigabenFehlen" }),
          title: "Artikel ohne Freigaben anzeigen",
        })}
        {stats.unclearType > 0
          ? renderStatCard({
              label: "Typ prüfen",
              value: stats.unclearType,
              isWarning: true,
              isActive: filters.issue === "typPruefen",
              onClick: () => applyStatFilter({ issue: "typPruefen" }),
              title: "Artikel mit unklarem Typ anzeigen",
            })
          : null}
      </div>

      {fluidTypeCounts.length > 0 ? (
        <div style={styles.typeFilterRow}>
          {fluidTypeCounts.map(({ type, count }) => (
            <button
              key={type}
              type="button"
              onClick={() => applyFluidTypeFilter(type)}
              style={{ ...styles.typeButton, ...(filters.fluidTyp === type ? styles.typeButtonActive : null) }}
              title={`${type} anzeigen`}
            >
              <span>{type}</span>
              <strong>{count}</strong>
            </button>
          ))}
        </div>
      ) : null}

      {quickHerstellerChips.length > 0 ? (
        <div style={styles.quickFilterRow}>
          <span style={styles.quickFilterLabel}>Hersteller:</span>
          {quickHerstellerChips.map((chip) => {
            const isActive = normalizeSearchText(search) === normalizeSearchText(chip.query);
            return (
              <button
                key={chip.label}
                type="button"
                onClick={() => applyQuickSearch(chip.query)}
                style={{ ...styles.quickFilterButton, ...(isActive ? styles.quickFilterButtonActive : null) }}
                title={`${chip.label} suchen`}
              >
                <span>{chip.label}</span>
                <strong>{chip.count}</strong>
              </button>
            );
          })}
        </div>
      ) : null}

      {quickSpezifikationChips.length > 0 ? (
        <div style={styles.quickFilterRow}>
          <span style={styles.quickFilterLabel}>Viskosität/Spez.:</span>
          {quickSpezifikationChips.map((chip) => {
            const isActive = normalizeSearchText(search) === normalizeSearchText(chip.query);
            return (
              <button
                key={chip.label}
                type="button"
                onClick={() => applyQuickSearch(chip.query)}
                style={{ ...styles.quickFilterButton, ...(isActive ? styles.quickFilterButtonActive : null) }}
                title={`${chip.label} suchen`}
              >
                <span>{chip.label}</span>
                <strong>{chip.count}</strong>
              </button>
            );
          })}
        </div>
      ) : null}

      {quickFreigabeChips.length > 0 ? (
        <div style={styles.quickFilterRow}>
          <span style={styles.quickFilterLabel}>Häufige Freigaben:</span>
          {quickFreigabeChips.map((chip) => {
            const isActive = normalizeSearchText(search) === normalizeSearchText(chip.query);
            return (
              <button
                key={chip.label}
                type="button"
                onClick={() => applyQuickSearch(chip.query)}
                style={{ ...styles.quickFilterButton, ...(isActive ? styles.quickFilterButtonActive : null) }}
                title={`${chip.label} suchen`}
              >
                <span>{chip.label}</span>
                <strong>{chip.count}</strong>
              </button>
            );
          })}
        </div>
      ) : null}

      <div style={styles.toolbar}>
        <input
          type="text"
          placeholder="Suche nach Artikelnummer, Hersteller-Art.-Nr., Freigabe, Hersteller, Typ..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={styles.search}
        />

        <select
          aria-label="Typ filtern"
          value={filters.fluidTyp}
          onChange={(e) => setFilters((current) => ({ ...current, fluidTyp: e.target.value }))}
          style={styles.select}
        >
          <option value="alle">Alle Typen</option>
          {fluidTypOptions.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>

        <select
          aria-label="Kategorie filtern"
          value={filters.kategorie}
          onChange={(e) => setFilters((current) => ({ ...current, kategorie: e.target.value }))}
          style={styles.select}
        >
          <option value="alle">Alle Kategorien</option>
          {kategorieOptions.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>

        <select
          aria-label="Marge filtern"
          value={filters.marge}
          onChange={(e) => setFilters((current) => ({ ...current, marge: e.target.value }))}
          style={styles.select}
        >
          <option value="alle">Alle Margen</option>
          <option value="kritisch">Unter 45 %</option>
          <option value="beobachten">45 bis 59 %</option>
          <option value="gut">Ab 60 %</option>
          <option value="ohne">Ohne Marge</option>
        </select>

      </div>

      {hasActiveControls ? (
        <div style={styles.activeFilters}>
          <span style={styles.activeFiltersLabel}>Aktiv:</span>
          {activeFilterItems.map((item) => (
            <span key={item.key} style={styles.activeFilterChip}>
              <span>{item.label}</span>
              <button type="button" onClick={item.clear} style={styles.activeFilterRemove} title={`${item.label} entfernen`}>
                ×
              </button>
            </span>
          ))}
          <button type="button" onClick={resetControls} style={styles.resetButton}>
            Zurücksetzen
          </button>
        </div>
      ) : null}

      {loadStatus === "loading" ? (
        <p style={styles.noData}>Daten werden geladen...</p>
      ) : loadStatus === "error" ? (
        <div style={styles.errorBox}>Daten konnten nicht geladen werden: {loadError}</div>
      ) : filtered.length > 0 ? (
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
                <th style={styles.th}>{renderSortHeader("spezifikation", "Viskosität/Spez.")}</th>
                <th style={styles.th}>{renderSortHeader("ek", "EK netto")}</th>
                <th style={styles.th}>{renderSortHeader("vk", "VK1 netto")}</th>
                <th style={styles.th}>{renderSortHeader("rohertrag", "Rohertrag")}</th>
                <th style={styles.th}>{renderSortHeader("marge", "Marge")}</th>
              </tr>
            </thead>
            <tbody>
              {sortedFiltered.map((oil, i) => {
                const ek = getEk(oil);
                const vk = getVk(oil);
                const marge = getMargeProzent(oil);
                return (
                  <tr key={oil.artikelnummer || oil.interne_nummer || i} style={i % 2 ? styles.trAlt : styles.tr} className="row">
                    <td style={styles.td} dangerouslySetInnerHTML={{ __html: highlight(oil.artikelnummer || oil.interne_nummer || "–") }} />
                    <td style={styles.td} dangerouslySetInnerHTML={{ __html: highlight(oil.hersteller_artikelnummer || "–") }} />
                    <td style={styles.td} dangerouslySetInnerHTML={{ __html: highlight(getDisplayBezeichnung(oil)) }} />
                    <td style={styles.freigabenTd}>{renderFreigaben(oil)}</td>
                    <td style={styles.td} dangerouslySetInnerHTML={{ __html: highlight(oil.hersteller || "–") }} />
                    <td style={styles.td} dangerouslySetInnerHTML={{ __html: highlight(oil.kategorie || "–") }} />
                    <td style={styles.td} dangerouslySetInnerHTML={{ __html: highlight(oil.fluid_typ || "–") }} />
                    <td style={styles.td} dangerouslySetInnerHTML={{ __html: highlight(oil.display_spezifikation || "–") }} />
                    <td style={{ ...styles.td, textAlign: "right" }}>{renderRequiredEuro(ek, getDisplayPricePerLiter(oil, ek, "ek_pro_liter"))}</td>
                    <td style={{ ...styles.td, textAlign: "right" }}>{renderRequiredEuro(vk, getDisplayPricePerLiter(oil, vk, "preis_pro_liter"))}</td>
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
  page: {
    backgroundColor: "#121212",
    color: "#e0e0e0",
    fontFamily: "Segoe UI, Roboto, sans-serif",
    padding: "30px",
    minHeight: "100vh",
  },
  header: { display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: "20px", marginBottom: "18px" },
  title: { fontSize: "28px", fontWeight: "bold", color: "#ffeb3b", margin: "0 0 6px" },
  metaLine: { color: "#b8bec9", fontSize: "14px" },
  summaryGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
    gap: "10px",
    marginBottom: "16px",
  },
  statCard: {
    backgroundColor: "#1e1e1e",
    border: "1px solid #333",
    borderRadius: "8px",
    padding: "12px 14px",
    minHeight: "68px",
  },
  statCardActive: {
    borderColor: "#ffeb3b",
    backgroundColor: "#272410",
  },
  statButton: {
    width: "100%",
    color: "inherit",
    font: "inherit",
    textAlign: "left",
    cursor: "pointer",
  },
  statLabel: { display: "block", color: "#aeb4be", fontSize: "12px", marginBottom: "6px" },
  statValue: { color: "#f4f4f4", fontSize: "24px", lineHeight: 1 },
  statValueWarning: { color: "#ffe28a", fontSize: "24px", lineHeight: 1 },
  typeFilterRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: "10px",
    marginBottom: "16px",
  },
  typeButton: {
    display: "inline-flex",
    alignItems: "center",
    gap: "10px",
    border: "1px solid #3a3a3a",
    borderRadius: "8px",
    padding: "8px 12px",
    backgroundColor: "#1e1e1e",
    color: "#e0e0e0",
    cursor: "pointer",
    font: "inherit",
  },
  typeButtonActive: {
    borderColor: "#ffeb3b",
    backgroundColor: "#272410",
    color: "#ffeb3b",
  },
  quickFilterRow: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: "8px",
    marginBottom: "16px",
  },
  quickFilterLabel: { color: "#aeb4be", fontSize: "13px", fontWeight: 700, marginRight: "2px" },
  quickFilterButton: {
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    border: "1px solid #3a3a3a",
    borderRadius: "999px",
    padding: "6px 10px",
    backgroundColor: "#1e1e1e",
    color: "#e0e0e0",
    cursor: "pointer",
    font: "inherit",
    fontSize: "13px",
  },
  quickFilterButtonActive: {
    borderColor: "#ffeb3b",
    backgroundColor: "#272410",
    color: "#ffeb3b",
  },
  toolbar: { display: "flex", flexWrap: "wrap", gap: "10px", alignItems: "center", marginBottom: "20px" },
  search: {
    flex: "1 1 420px",
    padding: "10px",
    borderRadius: "6px",
    minWidth: "260px",
    border: "1px solid #444",
    backgroundColor: "#1e1e1e",
    color: "#e0e0e0",
  },
  select: {
    padding: "10px",
    borderRadius: "6px",
    border: "1px solid #444",
    backgroundColor: "#1e1e1e",
    color: "#e0e0e0",
  },
  resetButton: {
    border: "1px solid #555",
    borderRadius: "6px",
    padding: "10px 12px",
    backgroundColor: "#242424",
    color: "#ffeb3b",
    cursor: "pointer",
    font: "inherit",
  },
  activeFilters: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: "8px",
    margin: "-8px 0 18px",
    color: "#b8bec9",
  },
  activeFiltersLabel: { fontSize: "13px", fontWeight: 700, color: "#e0e0e0" },
  activeFilterChip: {
    display: "inline-flex",
    alignItems: "center",
    gap: "7px",
    border: "1px solid #4b5563",
    borderRadius: "999px",
    padding: "4px 9px",
    backgroundColor: "#20242b",
    color: "#dbe4f0",
    fontSize: "13px",
  },
  activeFilterRemove: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "18px",
    height: "18px",
    border: "1px solid #5f6b7a",
    borderRadius: "999px",
    padding: 0,
    backgroundColor: "#29313b",
    color: "#f4f4f4",
    cursor: "pointer",
    font: "inherit",
    lineHeight: 1,
  },
  tableContainer: { overflowX: "auto", borderRadius: "8px", border: "1px solid #333", backgroundColor: "#1c1c1c" },
  table: { width: "100%", borderCollapse: "collapse" },
  th: { textAlign: "left", backgroundColor: "#222", color: "#ffeb3b", padding: "10px", borderBottom: "2px solid #333", position: "sticky", top: 0, zIndex: 1 },
  sortButton: { display: "inline-flex", alignItems: "center", gap: "6px", width: "100%", border: 0, padding: 0, background: "transparent", color: "inherit", font: "inherit", fontWeight: 700, textAlign: "left", cursor: "pointer" },
  sortIcon: { color: "#777", fontSize: "11px" },
  sortIconActive: { color: "#ffeb3b", fontSize: "11px" },
  td: { padding: "8px 10px", borderBottom: "1px solid #333", verticalAlign: "top" },
  freigabenTd: { padding: "8px 10px", borderBottom: "1px solid #333", verticalAlign: "top", maxWidth: 320, whiteSpace: "normal" },
  freigabenToggle: { display: "inline-block", marginLeft: "8px", border: "1px solid #555", borderRadius: "4px", padding: "2px 7px", backgroundColor: "#242424", color: "#ffeb3b", cursor: "pointer", font: "inherit", fontSize: "12px" },
  tr: { backgroundColor: "#1a1a1a" },
  trAlt: { backgroundColor: "#181818" },
  noData: { marginTop: "20px", fontStyle: "italic", color: "#aaa" },
  errorBox: { backgroundColor: "#4a1515", border: "1px solid #8a2b2b", color: "#ffb3b3", borderRadius: "8px", padding: "12px 14px" },
  inlineWarning: { color: "#ffe28a", fontWeight: 700 },
  badge: { display: "inline-block", minWidth: "70px", padding: "3px 8px", borderRadius: "999px", fontWeight: 700, textAlign: "center" },
  badgeNeutral: { backgroundColor: "#2a2f36", color: "#c8d0dc", border: "1px solid #4b5563" },
  badgeRed: { backgroundColor: "#4a1515", color: "#ffb3b3", border: "1px solid #8a2b2b" },
  badgeYellow: { backgroundColor: "#4a3d12", color: "#ffe28a", border: "1px solid #8a742b" },
  badgeGreen: { backgroundColor: "#153d24", color: "#9af0b8", border: "1px solid #2f8a50" },
  subValue: { fontSize: "12px", color: "#b8bec9", marginTop: "4px" },
};

export default App;
