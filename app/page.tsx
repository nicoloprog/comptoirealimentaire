"use client";
import { MapPin } from "lucide-react";
import { useState, useEffect, useRef, useCallback } from "react";

interface SearchMatch {
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
  comptoir: string;
  adress: string;
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

  // Load all streets on component mount
  useEffect(() => {
    const loadStreets = async () => {
      try {
        const res = await fetch("/api/resolve?action=list");
        const data = await res.json();
        if (data.streets) {
          setAllStreets(
            data.streets.map((street: string) => ({
              nom: street,
              comptoir: "",
              adress: "",
            })),
          );
        }
      } catch (err) {
        console.error("Failed to load streets:", err);
      }
    };

    loadStreets();
  }, []);

  // Handle input change with autocomplete
  const handleInputChange = useCallback(
    (value: string) => {
      setQuery(value);
      setError("");

      if (value.trim().length > 0) {
        const filtered = allStreets
          .filter((street) =>
            street.nom.toLowerCase().includes(value.toLowerCase()),
          )
          .slice(0, 8);

        setSuggestions(filtered);
        setShowSuggestions(true);
      } else {
        setSuggestions([]);
        setShowSuggestions(false);
      }
    },
    [allStreets],
  );

  // Handle search
  const handleSearch = async (searchQuery: string) => {
    const queryToSearch = searchQuery || query;

    if (!queryToSearch.trim()) {
      setError("Entrez un nom de rue pour rechercher le comptoir associé.");
      return;
    }

    loading && setLoading(true);
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
    setQuery(suggestion.nom);
    setShowSuggestions(false);
    handleSearch(suggestion.nom);
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
      match.from !== null ? `${match.from} ${match.nom}` : match.nom;

    setQuery(nextQuery);
    setError("");
    setShowSuggestions(false);
    setResult({
      found: true,
      comptoir: match.comptoir,
      matches: [match],
    });
  };

  // FIXED: Implemented formatRange to cleanly display address splits
  const formatRange = (m: SearchMatch) => {
    if (m.from !== null && m.to !== null) {
      return `No. ${m.from} à ${m.to} ${m.nom}`;
    }
    return m.nom;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-12 text-center">
          <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-slate-900 to-slate-600 bg-clip-text text-transparent mb-3">
            Trouver votre comptoir alimentaire à St-Jérôme
          </h1>
          <p className="text-slate-600 text-sm md:text-md">
            Entrez le nom de votre rue pour découvrir le comptoir alimentaire
            qui lui est associé.
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
              onKeyPress={handleKeyPress}
              onFocus={() =>
                query.trim().length > 0 && setShowSuggestions(true)
              }
              placeholder="Ex: 8 rue des Alouettes ou 103e Avenue"
              className="w-full px-6 py-4 text-lg text-black placeholder:text-gray-400 border-2 border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-200"
            />
            <button
              onClick={() => handleSearch(query)}
              disabled={loading}
              className="absolute right-2 top-1/2 -translate-y-1/2 bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 disabled:bg-slate-400 transition-colors duration-200 font-medium"
            >
              {loading ? "recherche..." : "Rechercher"}
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
                  <p className="text-sm font-semibold text-blue-500 tracking-wider mb-2 uppercase">
                    Votre comptoir assigné
                  </p>
                  <h2 className="text-3xl font-bold text-gray-700">
                    {result.comptoir}
                  </h2>
                </div>

                <div className="p-6 space-y-4">
                  <h3 className="text-sm font-semibold text-slate-500 tracking-wider">
                    Directions et informations
                  </h3>
                  {result.matches.map((match, idx) => (
                    <div
                      key={idx}
                      className="space-y-2 text-[0.750rem] border-b border-slate-50 last:border-0 pb-2"
                    >
                      <div className="flex justify-between">
                        <span className="text-slate-600">Recherche :</span>
                        <span className="font-medium text-gray-900">
                          {match.nom}{" "}
                          {match.from !== null
                            ? `(${match.from} à ${match.to})`
                            : ""}
                        </span>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-slate-600">
                            Adresse de votre comptoire alimentaire :
                          </span>

                          <button
                            onClick={() => {
                              const query = `${match.adress} ${match.ville}`;
                              const url = `https://maps.google.com/?q=${encodeURIComponent(query)}`;
                              window.open(url, "_blank");
                            }}
                            className="flex items-center gap-1 text-blue-600 hover:underline cursor-pointer"
                          >
                            <MapPin
                              size={16}
                              className="text-slate-400 hidden md:inline"
                            />
                            <span className="break-words text-right">
                              {match.adress}, {match.ville}
                            </span>
                          </button>
                        </div>

                        {/* Maps preview integration */}
                        <a
                          href={`https://maps.google.com/?q=${encodeURIComponent(
                            `${match.adress} ${match.ville}`,
                          )}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <iframe
                            title="Carte de localisation"
                            width="100%"
                            height="160"
                            loading="lazy"
                            className="rounded-lg"
                            src={`https://maps.google.com/maps?q=${encodeURIComponent(
                              `${match.adress} ${match.ville}`,
                            )}&output=embed`}
                          />
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : result.matches && result.matches.length > 0 ? (
              /* Street Found but Ambiguous (e.g. Alouettes) */
              <div className="bg-white rounded-lg shadow-lg overflow-hidden border-l-4 border-blue-500">
                <div className="bg-gradient-to-r from-blue-50 to-blue-100 p-6">
                  <p className="text-blue-900 font-semibold text-lg">
                    Numéro de porte requis
                  </p>
                  <p className="text-blue-700 text-sm mt-2">
                    Cette rue est desservie par plusieurs comptoirs. Veuillez
                    ajouter votre numéro de porte (ex: 8 {result.matches[0].nom}
                    ).
                  </p>
                  <div className="mt-4 border-t border-blue-200 pt-4">
                    <p className="text-xs font-bold text-blue-600 uppercase tracking-widest mb-2">
                      Options :
                    </p>
                    <ul className="space-y-2">
                      {result.matches.map((m, i) => (
                        <li key={i} className="text-sm text-blue-800">
                          <button
                            type="button"
                            onClick={() => handleRangeClick(m)}
                            className="w-full rounded-md px-3 py-2 text-left transition-colors hover:bg-white/70 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            <span className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                              <span className="font-semibold">
                                {formatRange(m)}
                              </span>
                              <span className="font-bold">{m.comptoir}</span>
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            ) : (
              /* Truly Not Found */
              <div className="bg-white rounded-lg shadow-lg overflow-hidden border-l-4 border-amber-500">
                <div className="bg-gradient-to-r from-amber-50 to-amber-100 p-6">
                  <p className="text-amber-900 font-semibold text-lg">
                    Aucun résultat trouvé
                  </p>
                  <p className="text-amber-700 text-sm mt-2">
                    Vérifiez l'orthographe ou essayez une autre variation.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {!result && (
          <div className="mt-12 bg-white rounded-lg shadow-md p-6 border-l-4 border-blue-500">
            <h3 className="font-semibold text-slate-900 mb-3">
              Conseils de recherche
            </h3>
            <ul className="space-y-2 text-slate-700 text-sm">
              <li>✓ Entrez le numéro et la rue (ex: "8 rue des Alouettes")</li>
              <li>✓ Sélectionnez une suggestion dans la liste</li>
              <li>✓ Pour les rues numérotées, essayez "103e" ou "103"</li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
