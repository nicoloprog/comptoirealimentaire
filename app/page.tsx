"use client";

import { MapPin, Phone } from "lucide-react";
import { useState, useEffect, useRef, useCallback } from "react";

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
  nom: string;
  ville: string;
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
]);

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
        if (data.streets) {
          // Expecting data.streets to be an array of objects: { nom: string, ville: string }
          // If it is an array of strings, it defaults safely gracefully
          setAllStreets(
            data.streets.map((street: any) => ({
              nom: typeof street === "object" ? street.nom : street,
              ville: typeof street === "object" ? street.ville || "" : "",
            })),
          );
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

      let cleanSearch = value.trim().toLowerCase();
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

        if (streetSearchCore.length > 0) {
          const filtered = allStreets
            .filter(
              (street) =>
                street.nom.toLowerCase().includes(streetSearchCore) ||
                street.ville.toLowerCase().includes(streetSearchCore),
            )
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
      }
    } catch (err) {
      setError("Failed to fetch results. Please try again.");
      console.error("Search error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSuggestionClick = (suggestion: StreetSuggestion) => {
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
        : `${match.nom} ${match.ville}`;

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
    if (m.from !== null && m.to !== null) {
      return `${m.from} à ${m.to} ${m.nom} (${m.ville})`;
    }
    return `${m.nom} (${m.ville})`;
  };

  return (
    <div className="min-h-screen bg-[url('/bg.jpg')] bg-cover bg-center bg-no-repeat p-6 flex flex-col justify-center items-center">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(15,23,42,0.85)_0%,rgba(15,23,42,0.6)_50%,rgba(15,23,42,0.9)_100%)] pointer-events-none z-0" />
      <div className="max-w-4xl mx-auto w-full relative z-10">
        {/* Header */}
        <div className="mb-12 text-center">
          <h1 className="text-3xl md:text-5xl font-bold bg-gradient-to-r from-white/90 to-white/80 bg-clip-text text-transparent mb-3">
            Trouver votre comptoir alimentaire
          </h1>
          <p className="text-white/90 text-2xl md:text-md">
            Entrez le nom de votre rue
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
              placeholder="Ex: Villemont, rue de"
              className="w-full px-6 py-4 text-lg bg-white text-gray-900 placeholder:text-gray-400 border-2 border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-200"
            />
            <button
              onClick={() => handleSearch(query)}
              disabled={loading}
              className="absolute right-2 top-1/2 -translate-y-1/2 bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 disabled:bg-slate-400 transition-colors duration-200 font-medium"
            >
              {loading ? "Recherche..." : "Rechercher"}
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
                  className="w-full text-left px-6 py-3 hover:bg-blue-50 transition-colors border-b border-slate-100 last:border-b-0 focus:outline-none"
                >
                  <div className="font-medium text-slate-900">
                    {suggestion.nom}
                    {suggestion.ville && (
                      <span className="text-sm font-normal text-slate-500 ml-2">
                        ({suggestion.ville})
                      </span>
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
              <div className="bg-white rounded-lg shadow-lg overflow-hidden border-l-4 border-blue-500">
                <div className="bg-gradient-to-r from-blue-50 to-blue-100 p-6 border-b border-blue-200">
                  <p className="text-sm font-semibold text-blue-600 tracking-wider mb-2 uppercase">
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
                          {match.nom}{" "}
                          {match.from !== null
                            ? `( ${match.from} à ${match.to} )`
                            : ""}
                          {match.ville ? ` - ${match.ville}` : ""}
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
              <div className="bg-white rounded-lg shadow-lg overflow-hidden border-l-4 border-blue-500">
                <div className="bg-gradient-to-r from-blue-50 to-blue-100 p-6">
                  <p className="text-blue-900 font-semibold text-lg">
                    Sélectionnez votre adresse
                  </p>
                  <div className="mt-4 border-t border-blue-200 pt-4">
                    <p className="text-xs font-bold text-blue-600 uppercase tracking-widest mb-2">
                      Secteurs disponibles :
                    </p>
                    <ul className="space-y-2">
                      {result.matches.map((m, i) => (
                        <li key={i} className="text-sm">
                          <button
                            type="button"
                            onClick={() => handleRangeClick(m)}
                            className="w-full rounded-md px-4 py-3 text-left transition-colors bg-white/60 hover:bg-white border border-blue-200 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            <span className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                              <span className="font-semibold text-slate-800">
                                {formatRange(m)}
                              </span>
                              <span className="font-bold text-blue-600 sm:text-right">
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
                    Nous n'avons pas pu associer cette adresse. Vérifiez
                    l'orthographe ou essayez d'ajouter le nom de la ville.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {!result && (
          <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-blue-500">
            <h3 className="font-semibold text-slate-900 mb-3">
              Conseils de recherche
            </h3>
            <ul className="space-y-2 text-slate-700 text-sm">
              <li>
                ✓ Entrez simplement le nom de votre rue (ex:{" "}
                <strong>" Villemont "</strong>)
              </li>
              <li>
                ✓ Si une rue traverse plusieurs villes, vous pouvez ajouter la
                ville à la fin (ex:{" "}
                <strong>" 103e Avenue, Saint-Jérôme"</strong>)
              </li>
              <li>
                ✓ Vous pouvez aussi l'ajouter au début pour une correspondance
                plus précise (ex: <strong>" 8 Villemont, rue de "</strong>)
              </li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
