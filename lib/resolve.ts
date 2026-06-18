/**
 * Street data interface based on your Google Sheets structure
 */
export interface StreetEntry {
  from: number | null;
  to: number | null;
  nom: string;
  ville: string;
  comptoir: string;
  adress: string;
  courriel: string;
  telephone: string;
}

interface StreetRow {
  from?: number | string | null;
  to?: number | string | null;
  nom?: string | null;
  ville?: string | null;
  comptoir?: string | null;
  adress?: string | null;
  address?: string | null;
  courriel?: string | null;
  telephone?: string | null;
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

function hasRange(
  entry: StreetEntry,
): entry is StreetEntry & { from: number; to: number } {
  return entry.from !== null && entry.to !== null;
}

/**
 * Normalizes regular text blocks (like city names) for loose comparisons
 */
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Normalizes street names for comparison
 * Removes special characters, converts to lowercase, handles number variations
 */
function normalizeStreetName(name: string): string {
  let str = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  // Handle "Alouettes, rue des" -> "rue des alouettes"
  if (str.includes(",")) {
    const parts = str.split(",").map((s) => s.trim());
    if (parts.length === 2) {
      str = `${parts[1]} ${parts[0]}`;
    }
  }

  // Remove punctuation except spaces
  str = str.replace(/[^\w\s]/g, "");

  // Normalize common street types
  str = str
    .replace(/\b(av|ave|av\.)\b/g, "avenue")
    .replace(/\b(r|rue)\b/g, "rue")
    .replace(/\b(boul|blvd)\b/g, "boulevard")
    .replace(/\b(ch|chemin)\b/g, "chemin");

  // Normalize numeric streets (103e -> 103)
  str = str.replace(/(\d+)e\b/g, "$1");

  return str.trim();
}

/**
 * Extracts house number, optional city keyword, and street name from a search string
 */
function extractQuery(input: string, knownVilles: Set<string>) {
  const cleaned = input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  const parts = cleaned.split(" ");
  let number: number | null = null;
  let detectedVille: string | null = null;

  if (parts.length === 0) {
    return { number, street: "", ville: null };
  }

  // 1. Extract a civic number at the beginning (if it isn't an ordinal street name prefix)
  if (/^\d+$/.test(parts[0]) && !STREET_TYPE_WORDS.has(parts[1])) {
    number = parseInt(parts[0], 10);
    parts.shift();
  }

  // 2. Extract a civic number at the end if it wasn't captured up front
  const lastPart = parts[parts.length - 1];
  if (number === null && /^\d+$/.test(lastPart)) {
    number = parseInt(lastPart, 10);
    parts.pop();
  }

  // 3. Extract city name if typed at the end of the input string sequence
  if (parts.length > 0) {
    const lastWordNormalized = normalizeText(parts[parts.length - 1]);
    for (const v of knownVilles) {
      if (normalizeText(v) === lastWordNormalized) {
        detectedVille = v;
        parts.pop(); // Remove the city name keyword out of the street query core
        break;
      }
    }
  }

  const street = normalizeStreetName(parts.join(" "));
  return { number, street, ville: detectedVille };
}

/**
 * Builds a searchable map from raw Google Sheets data
 */
export function buildStreetMap(data: StreetRow[]): Map<string, StreetEntry[]> {
  const map = new Map<string, StreetEntry[]>();

  const addToMap = (key: string, entry: StreetEntry) => {
    if (!key) return;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(entry);
  };

  for (const row of data) {
    const entry: StreetEntry = {
      from: row.from ? Number(row.from) : null,
      to: row.to ? Number(row.to) : null,
      nom: row.nom?.toString() || "",
      ville: row.ville?.toString() || "",
      comptoir: row.comptoir?.toString() || "",
      adress: (row.adress ?? row.address)?.toString() || "",
      courriel: row.courriel?.toString() || "",
      telephone: row.telephone?.toString() || "",
    };

    if (!entry.nom) continue;

    const normalized = normalizeStreetName(entry.nom);
    addToMap(normalized, entry);

    // Index without street type
    const withoutType = normalized
      .replace(/\b(rue|avenue|boulevard|chemin)\b/g, "")
      .trim();
    addToMap(withoutType, entry);

    // Index reversed words
    const reversed = normalized.split(" ").reverse().join(" ");
    addToMap(reversed, entry);
  }

  return map;
}

/**
 * Helper to find entries by street name with fallback logic
 */
function findEntriesByStreet(
  street: string,
  streetMap: Map<string, StreetEntry[]>,
): StreetEntry[] {
  let entries = streetMap.get(street);

  if (!entries || entries.length === 0) {
    const matches: StreetEntry[] = [];
    const seen = new Set<string>();

    for (const [key, value] of streetMap.entries()) {
      const directMatch = street.includes(key) || key.includes(street);
      if (directMatch) {
        value.forEach((entry) => {
          const id = `${entry.nom}|${entry.from}|${entry.to}|${entry.comptoir}|${entry.ville}`;
          if (!seen.has(id)) {
            matches.push(entry);
            seen.add(id);
          }
        });
      }
    }
    entries = matches;
  }
  return entries || [];
}

/**
 * MAIN RESOLVER
 */
export function resolveComptoir(
  query: string,
  streetMap: Map<string, StreetEntry[]>,
) {
  // Collect all known towns from sheet dynamically to enable contextual string matching
  const knownVilles = new Set<string>();
  streetMap.forEach((entries) => {
    entries.forEach((e) => {
      if (e.ville) knownVilles.add(e.ville);
    });
  });

  const { number, street, ville } = extractQuery(query, knownVilles);

  // 1. Get entries for the street
  let entries = findEntriesByStreet(street, streetMap);

  if (entries.length === 0) {
    return { comptoir: null, matches: [], reason: "Rue non trouvée." };
  }

  // Filter out records by city if a specific town keyword was matched out of the query string
  if (ville) {
    const targetVilleNormalized = ville.toLowerCase();
    const specificCityMatches = entries.filter(
      (e) => e.ville.toLowerCase() === targetVilleNormalized,
    );
    if (specificCityMatches.length > 0) {
      entries = specificCityMatches;
    }
  }

  // CASE 1: House number is provided
  if (number !== null) {
    // Try to find an entry where the number is within range
    const match = entries.find((e) => {
      if (!hasRange(e)) return false;
      return number >= e.from && number <= e.to;
    });

    if (match) {
      return {
        comptoir: match.comptoir,
        matches: [match],
        reason: `Succès : Le numéro ${number} correspond à ce comptoir (${match.ville}).`,
      };
    }

    // Fallback: Check if there's a record with no numbers specified (covers the entire street)
    const fallbackMatch = entries.find((e) => !hasRange(e));
    if (fallbackMatch) {
      return {
        comptoir: fallbackMatch.comptoir,
        matches: [fallbackMatch],
        reason: `Succès : Cette rue correspond globalement à ce comptoir (${fallbackMatch.ville}).`,
      };
    }

    return {
      comptoir: null,
      matches: entries,
      reason: `Le numéro ${number} n'est pas répertorié dans les plages pour cette rue.`,
    };
  }

  // CASE 2: No house number provided (Street name search / only city specified)
  const uniqueComptoirs = [...new Set(entries.map((e) => e.comptoir))];
  const uniqueVilles = [...new Set(entries.map((e) => e.ville))];

  // If ALL remaining entries lead to the exact same destination point
  if (uniqueComptoirs.length === 1) {
    return {
      comptoir: uniqueComptoirs[0],
      matches: entries,
      reason: `Toute la rue est desservie par le même comptoir (${uniqueVilles.join(", ")}).`,
    };
  }

  // If there are multiple comptoirs or cross-city boundary splits, ask for precision
  return {
    comptoir: null,
    matches: entries,
    reason: `Cette rue s'étend sur plusieurs secteurs (${uniqueVilles.length} villes identifiées). Veuillez entrer votre numéro civique ou préciser la ville.`,
  };
}

/**
 * Returns all available streets
 */
export function getAllStreets(streetMap: Map<string, StreetEntry[]>): string[] {
  const streets = new Set<string>();
  streetMap.forEach((matches) => {
    matches.forEach((entry) => streets.add(entry.nom));
  });
  return Array.from(streets).sort();
}
