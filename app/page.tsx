"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Search } from "lucide-react";

interface SearchMatch {
  telephone: string;
  courriel: string;
  from: number | null;
  to: number | null;
  nom: string;
  ville: string;
  comptoir: string;
  adress: string;
}

interface SearchResult {
  found: boolean;
  comptoir: string | null;
  matches: SearchMatch[];
  reason?: string;
}

interface StreetSuggestion {
  kind: "street" | "city";
  nom: string;
  ville: string;
}

interface ApiSuggestion {
  nom: string;
  ville: string;
}

declare global {
  interface Window {
    dataLayer?: Array<Record<string, unknown>>;
  }
}

const STREET_TYPE_WORDS = new Set([
  "avenue",
  "av",
  "ave",
  "rue",
  "r",
  "boulevard",
  "boul",
  "blvd",
  "chemin",
  "ch",
  "terrasse",
]);

function normalizeSearchText(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\([^)]*\)/g, " ")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function removeStreetTypeWords(text: string): string {
  return normalizeSearchText(text)
    .split(" ")
    .filter((word) => word && !STREET_TYPE_WORDS.has(word))
    .join(" ");
}

function getSuggestionKey(suggestion: StreetSuggestion): string {
  return `${suggestion.kind}|${normalizeSearchText(suggestion.nom)}|${normalizeSearchText(suggestion.ville)}`;
}

function getSuggestionSearchText(suggestion: StreetSuggestion): string {
  const fullText = `${suggestion.nom} ${suggestion.ville}`;
  return `${normalizeSearchText(fullText)} ${removeStreetTypeWords(fullText)}`;
}

function hasCookieConsent(): boolean {
  if (typeof document === "undefined") return false;

  return document.cookie
    .split("; ")
    .some((item) => item === "comptoir_cookie_consent=accepted");
}

function getSearchTrackingShape(
  searchQuery: string,
  allSuggestions: StreetSuggestion[],
) {
  const parts = searchQuery.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const hasCivicNumber =
    parts.length > 1 &&
    /^\d+$/.test(parts[0]) &&
    !STREET_TYPE_WORDS.has(parts[1]);
  const exactCityMatch = allSuggestions.some(
    (suggestion) =>
      suggestion.kind === "city" &&
      suggestion.ville.toLowerCase() === searchQuery.trim().toLowerCase(),
  );
  const searchType = hasCivicNumber
    ? "address"
    : exactCityMatch
      ? "city"
      : "street";

  return {
    event: "comptoir_search",
    search_type: searchType,
    has_civic_number: hasCivicNumber,
  };
}

function trackSearch(searchQuery: string, allSuggestions: StreetSuggestion[]) {
  if (!hasCookieConsent()) return;

  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push(getSearchTrackingShape(searchQuery, allSuggestions));
}

function trackSearchResult(data: SearchResult) {
  if (!hasCookieConsent()) return;

  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({
    event: "comptoir_search_result",
    result_type: data.found
      ? "single_result"
      : data.matches.length > 0
        ? "multiple_results"
        : "no_result",
    match_count: data.matches.length,
  });
}

export default function ComptairSearchPage() {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [suggestions, setSuggestions] = useState<StreetSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [allStreets, setAllStreets] = useState<StreetSuggestion[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Load all streets with their towns on component mount
  useEffect(() => {
    const loadStreets = async () => {
      try {
        const res = await fetch("/api/resolve?action=list");
        const data = await res.json();
        const citySuggestions: StreetSuggestion[] = (data.cities || []).map(
          (city: string) => ({
            kind: "city",
            nom: city,
            ville: city,
          }),
        );

        if (data.suggestions) {
          const streetSuggestions = data.suggestions.map(
            (street: ApiSuggestion) => ({
              kind: "street" as const,
              nom: street.nom,
              ville: street.ville || "",
            }),
          );

          const uniqueSuggestions = [
            ...citySuggestions,
            ...streetSuggestions,
          ].filter(
            (suggestion, index, items) =>
              items.findIndex(
                (item) =>
                  getSuggestionKey(item) === getSuggestionKey(suggestion),
              ) === index,
          );

          setAllStreets(uniqueSuggestions);
        } else if (data.streets) {
          setAllStreets([
            ...citySuggestions,
            ...data.streets.map((street: string) => ({
              kind: "street" as const,
              nom: street,
              ville: "",
            })),
          ]);
        }
      } catch (err) {
        console.error("Failed to load streets:", err);
      }
    };

    loadStreets();
  }, []);

  // Handle input change with autocomplete (ignoring leading civic numbers)
  const handleInputChange = useCallback(
    (value: string) => {
      setQuery(value);
      setError("");

      const cleanSearch = normalizeSearchText(value);
      if (cleanSearch.length > 0) {
        const parts = cleanSearch.split(/\s+/);

        // If user typed a civic number first, skip it so the street name triggers suggestions
        if (
          /^\d+$/.test(parts[0]) &&
          parts.length > 1 &&
          !STREET_TYPE_WORDS.has(parts[1])
        ) {
          parts.shift();
        }

        const streetSearchCore = parts.join(" ");
        const normalizedStreetSearch = normalizeSearchText(streetSearchCore);
        const streetSearchWithoutType = removeStreetTypeWords(streetSearchCore);

        if (streetSearchCore.length > 0) {
          const filtered = allStreets
            .filter((street) => {
              const suggestionText = getSuggestionSearchText(street);
              return (
                suggestionText.includes(normalizedStreetSearch) ||
                suggestionText.includes(streetSearchWithoutType)
              );
            })
            .slice(0, 8);

          setSuggestions(filtered);
          setShowSuggestions(true);
        } else {
          setSuggestions([]);
          setShowSuggestions(false);
        }
      } else {
        setSuggestions([]);
        setShowSuggestions(false);
      }
    },
    [allStreets],
  );

  // Handle search action
  const handleSearch = async (searchQuery: string) => {
    const queryToSearch = searchQuery || query;

    if (!queryToSearch.trim()) {
      setError("Entrez un nom de rue pour rechercher le comptoir associé.");
      return;
    }

    // DISMISS KEYBOARD ON MOBILE: Force the input field to lose focus
    if (inputRef.current) {
      inputRef.current.blur();
    }

    setLoading(true);
    setError("");
    setShowSuggestions(false);
    trackSearch(queryToSearch, allStreets);

    try {
      const res = await fetch(
        `/api/resolve?q=${encodeURIComponent(queryToSearch)}`,
      );
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Search failed");
        setResult(null);
      } else {
        setResult(data);
        trackSearchResult(data);
      }
    } catch (err) {
      setError("Failed to fetch results. Please try again.");
      console.error("Search error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSuggestionClick = (suggestion: StreetSuggestion) => {
    if (suggestion.kind === "city") {
      setQuery(suggestion.ville);
      setShowSuggestions(false);
      inputRef.current?.blur();
      handleSearch(suggestion.ville);
      return;
    }

    // Retain the civic number if the user typed one before picking the suggestion
    const currentParts = query.trim().split(/\s+/);
    let prefix = "";
    if (
      /^\d+$/.test(currentParts[0]) &&
      !STREET_TYPE_WORDS.has(currentParts[1])
    ) {
      const typedNumber = currentParts[0];
      const suggestionNorm = suggestion.nom.toLowerCase().trim();

      if (suggestionNorm.startsWith(typedNumber.toLowerCase())) {
        prefix = "";
      } else {
        prefix = `${typedNumber} `;
      }
    }

    const nextQuery = `${prefix}${suggestion.nom}${suggestion.ville ? ` ${suggestion.ville}` : ""}`;
    setQuery(nextQuery);
    setShowSuggestions(false);

    // Force keyboard down here as well when clicking an item
    if (inputRef.current) {
      inputRef.current.blur();
    }

    handleSearch(nextQuery);
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleSearch(query);
    } else if (e.key === "Escape") {
      setShowSuggestions(false);
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleRangeClick = (match: SearchMatch) => {
    const nextQuery =
      match.from !== null
        ? `${match.from} ${match.nom} ${match.ville}`
        : `${match.nom || match.ville}`;

    setQuery(nextQuery);
    setError("");
    setShowSuggestions(false);
    setResult({
      found: true,
      comptoir: match.comptoir,
      matches: [match],
    });
  };

  const formatRange = (m: SearchMatch) => {
    if (!m.nom) {
      return m.ville;
    }

    if (m.from !== null && m.to !== null) {
      return `${m.from} à ${m.to} ${m.nom} (${m.ville})`;
    }
    return `${m.nom} (${m.ville})`;
  };

  return (
    <div className="relative isolate min-h-[100dvh] overflow-x-hidden p-6 flex flex-col justify-center items-center">
      <div className="absolute inset-0 -z-20 bg-[url('/bg.jpg')] bg-cover bg-center bg-no-repeat" />
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,rgba(15,23,42,0.85)_0%,rgba(15,23,42,0.6)_50%,rgba(15,23,42,0.9)_100%)] pointer-events-none" />
      <div className="max-w-4xl mx-auto w-full relative z-10">
        {/* Header */}
        <div className="mb-12 text-center">
          <h1 className="text-3xl md:text-5xl font-bold bg-gradient-to-r from-white/90 to-white/80 bg-clip-text text-transparent mb-3">
            Trouvez votre comptoir alimentaire
          </h1>
          <p className="text-white/90 text-2xl md:text-md">
            Entrez le nom de votre rue ou ville dans la barre de recherche
            ci-dessous.
          </p>
        </div>

        {/* Search Box */}
        <div className="relative mb-8">
          <div className="relative">
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => handleInputChange(e.target.value)}
              onKeyDown={handleKeyPress}
              onFocus={() =>
                query.trim().length > 0 && setShowSuggestions(true)
              }
              placeholder="(ex : Rue Albert, Saint-Jérôme ou ex : Prévost)"
              className="w-full py-4 pl-4 pr-14 text-base bg-white text-gray-900 placeholder:text-gray-400 border-2 border-green-200 rounded-lg focus:outline-none focus:border-green-600 focus:ring-2 focus:ring-green-200 transition-all duration-200 sm:px-6 sm:pr-40 sm:text-lg"
            />
            <button
              onClick={() => handleSearch(query)}
              disabled={loading}
              aria-label={loading ? "Recherche en cours" : "Rechercher"}
              className="absolute right-0 top-0 flex h-full w-12 items-center justify-center rounded-r-lg bg-[#1D522C] text-white transition-colors duration-200 hover:bg-[#A2BF9B] disabled:bg-slate-400 sm:right-2 sm:top-1/2 sm:h-10 sm:w-auto sm:-translate-y-1/2 sm:rounded-md sm:px-6 sm:text-base sm:font-medium"
            >
              <Search
                className="h-5 w-5 sm:hidden"
                aria-hidden="true"
                strokeWidth={2.5}
              />
              <span className="sr-only sm:not-sr-only">
                {loading ? "Recherche..." : "Rechercher"}
              </span>
            </button>
          </div>

          {showSuggestions && suggestions.length > 0 && (
            <div
              ref={suggestionsRef}
              className="absolute top-full left-0 right-0 mt-2 bg-white border-2 border-slate-200 rounded-lg shadow-lg z-50 max-h-64 overflow-y-auto"
            >
              {suggestions.map((suggestion, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSuggestionClick(suggestion)}
                  className="w-full text-left px-6 py-3 hover:bg-green-50 transition-colors border-b border-slate-100 last:border-b-0 focus:outline-none"
                >
                  <div className="font-medium text-slate-900">
                    {suggestion.nom}
                    {suggestion.kind === "city" ? (
                      <span className="text-sm font-normal text-green-600 ml-2">
                        (ville)
                      </span>
                    ) : (
                      suggestion.ville && (
                        <span className="text-sm font-normal text-slate-500 ml-2">
                          ({suggestion.ville})
                        </span>
                      )
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 rounded text-red-700">
            <p className="font-semibold">Erreur</p>
            <p>{error}</p>
          </div>
        )}

        {/* Results */}
        {result && (
          <div className="space-y-6">
            {result.found ? (
              <div className="bg-white rounded-lg shadow-lg overflow-hidden border-l-4 border-green-600">
                <div className="bg-gradient-to-r from-[#A2BF9B] to-[#A2BF9B] p-6 border-b border-green-200">
                  <p className="text-sm font-semibold text-[#2D5936] tracking-wider mb-2 uppercase">
                    Votre comptoir assigné
                  </p>
                  <h2 className="text-3xl font-bold text-gray-800">
                    {result.comptoir}
                  </h2>
                </div>

                <div className="p-6 space-y-4">
                  <h3 className="text-xs font-bold text-red-700 tracking-wider uppercase">
                    * Veuillez contacter le comptoir avant de vous présenter si
                    vous n’êtes pas inscrit *
                  </h3>
                  <h3 className="text-sm font-semibold text-slate-500 tracking-wider border-b pb-1">
                    Directions et informations
                  </h3>
                  {result.matches.map((match, idx) => (
                    <div
                      key={idx}
                      className="space-y-3 text-sm text-slate-700 border-b border-slate-100 last:border-0 pb-4 last:pb-0"
                    >
                      <div className="flex justify-between ">
                        <span className="text-slate-500">Secteur:</span>
                        <span className="max-w-[75%] font-large text-gray-900">
                          {match.nom ? (
                            <>
                              {match.nom}{" "}
                              {match.from !== null
                                ? `( ${match.from} à ${match.to} )`
                                : ""}
                              {match.ville ? ` - ${match.ville}` : ""}
                            </>
                          ) : (
                            match.ville
                          )}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Courriel:</span>
                        {match.courriel ? (
                          <a
                            href={`mailto:${match.courriel}`}
                            className="font-medium text-blue-600 hover:underline cursor-pointer"
                          >
                            {match.courriel}
                          </a>
                        ) : (
                          <span className="font-medium text-gray-400">
                            Non disponible
                          </span>
                        )}
                      </div>

                      <div className="flex justify-between items-center">
                        <span className="text-slate-500">Téléphone:</span>
                        {match.telephone ? (
                          <a
                            href={`tel:${match.telephone.replace(/\s+/g, "")}`}
                            className="text-blue-600 font-medium hover:underline flex items-center gap-1 cursor-pointer"
                          >
                            {match.telephone}
                          </a>
                        ) : (
                          <span className="font-medium text-gray-400">
                            Non disponible
                          </span>
                        )}
                      </div>

                      <div className="space-y-2">
                        <div className="flex justify-between items-start gap-4">
                          <span className="text-slate-500 shrink-0">
                            Adresse du comptoir :
                          </span>
                          <button
                            onClick={() => {
                              const geoQuery = `${match.adress} ${match.ville}`;
                              window.open(
                                `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(geoQuery)}`,
                                "_blank",
                              );
                            }}
                            className="flex items-start gap-1 text-blue-600 hover:underline cursor-pointer text-right font-medium"
                          >
                            <span>
                              {match.adress}, {match.ville}
                            </span>
                          </button>
                        </div>

                        {/* Maps Embed View */}
                        <div className="w-full h-40 rounded-lg overflow-hidden border border-slate-200 mt-2">
                          <iframe
                            title="Carte de localisation"
                            width="100%"
                            height="100%"
                            loading="lazy"
                            style={{ border: 0 }}
                            src={`https://maps.google.com/maps?q=${encodeURIComponent(`${match.adress} ${match.ville}`)}&t=&z=14&ie=UTF8&iwloc=&output=embed`}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : result.matches && result.matches.length > 0 ? (
              /* Multiple matches returned (No civic number or town mismatch) */
              <div className="bg-white rounded-lg shadow-lg overflow-hidden border-l-4 border-green-600">
                <div className="bg-gradient-to-r from-green-50 to-green-100 p-6">
                  <p className="text-[#2D5936] font-semibold text-lg">
                    Sélectionnez votre adresse
                  </p>
                  <div className="mt-4 border-t border-green-200 pt-4">
                    <p className="text-xs font-bold text-[#2D5936] uppercase tracking-widest mb-2">
                      Secteurs disponibles :
                    </p>
                    <ul className="space-y-2">
                      {result.matches.map((m, i) => (
                        <li key={i} className="text-sm">
                          <button
                            type="button"
                            onClick={() => handleRangeClick(m)}
                            className="w-full rounded-md px-4 py-3 text-left transition-colors bg-white/60 hover:bg-green-100 border border-green-200 shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                          >
                            <span className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                              <span className="font-semibold text-slate-800">
                                {formatRange(m)}
                              </span>
                              <span className="font-bold text-[#2D5936] sm:text-right">
                                {m.comptoir}
                              </span>
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            ) : (
              /* No Results Found */
              <div className="bg-white rounded-lg shadow-lg overflow-hidden border-l-4 border-red-500">
                <div className="bg-gradient-to-r from-red-50 to-red-100 p-6">
                  <p className="text-red-900 font-semibold text-lg">
                    Aucun résultat trouvé
                  </p>
                  <p className="text-red-700 text-sm mt-2">
                    Nous n&apos;avons pas pu associer cette adresse. Vérifiez
                    l&apos;orthographe ou essayez d&apos;ajouter le nom de la
                    ville.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {!result && (
          <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-green-600">
            <h3 className="font-semibold text-slate-900 mb-3">
              Consignes de recherche :
            </h3>
            <ul className="space-y-2 text-slate-700 text-sm">
              <li>
                ✓ Si vous demeurez à <strong>Prévost</strong>,{" "}
                <strong>Saint-Colomban</strong>,{" "}
                <strong>Sainte-Hippolyte</strong> ou{" "}
                <strong>Sainte-Sophie</strong>, veuillez entrer <u>SEULEMENT</u>{" "}
                le nom de votre <u>VILLE</u>. (ex: &quot; Prévost &quot;)
              </li>
              <li>
                ✓ Si vous demeurez à <strong>Saint-Jérôme</strong>, veuillez
                inscrire <u>SEULEMENT</u> {"  "}le nom de votre <u>RUE</u>{" "}
                {"  "} dans la barre de recherche ci-dessous. (ex: &quot;rue
                Albert&quot;)
              </li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
