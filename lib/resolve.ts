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
}

interface StreetRow {
  from?: number | string | null;
  to?: number | string | null;
  nom?: string | null;
  ville?: string | null;
  comptoir?: string | null;
  adress?: string | null;
  address?: string | null;
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
 * Extracts house number and street name from a search string
 */
function extractQuery(input: string) {
  const cleaned = input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  const parts = cleaned.split(" ");
  let number: number | null = null;

  if (parts.length === 0) {
    return { number, street: "" };
  }

  // Extract a civic number at the beginning, but keep numeric street names
  // such as "100 Avenue" or "100e Avenue" as the street when no civic number
  // was typed.
  if (/^\d+$/.test(parts[0]) && !STREET_TYPE_WORDS.has(parts[1])) {
    number = parseInt(parts[0], 10);
    parts.shift();
  }

  // Also support "100e Avenue 305" for people who type the civic number last.
  const lastPart = parts[parts.length - 1];
  if (number === null && /^\d+$/.test(lastPart)) {
    number = parseInt(lastPart, 10);
    parts.pop();
  }

  const street = normalizeStreetName(parts.join(" "));
  return { number, street };
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
          const id = `${entry.nom}|${entry.from}|${entry.to}|${entry.comptoir}|${entry.adress}`;
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
  const { number, street } = extractQuery(query);

  // 1. Get entries for the street
  const entries = findEntriesByStreet(street, streetMap);

  if (entries.length === 0) {
    return { comptoir: null, matches: [], reason: "Rue non trouvée." };
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
        reason: `Succès : Le numéro ${number} correspond à ce comptoir.`,
      };
    }

    const fallbackMatch = entries.find((e) => !hasRange(e));
    if (fallbackMatch) {
      return {
        comptoir: fallbackMatch.comptoir,
        matches: [fallbackMatch],
        reason: `Succès : cette rue correspond à ce comptoir.`,
      };
    }

    return {
      comptoir: null,
      matches: entries,
      reason: `Le numéro ${number} n'est pas répertorié pour cette rue.`,
    };
  }

  // CASE 2: No house number provided
  // Get all unique comptoirs for this street
  const uniqueComptoirs = [...new Set(entries.map((e) => e.comptoir))];

  // If ALL entries lead to the same comptoir, return it immediately
  if (uniqueComptoirs.length === 1) {
    return {
      comptoir: uniqueComptoirs[0],
      matches: entries,
      reason: "Toute la rue est desservie par le même comptoir.",
    };
  }

  // If there are multiple comptoirs, we MUST ask for a house number
  return {
    comptoir: null,
    matches: entries,
    reason: `Plusieurs comptoirs desservent cette rue (${uniqueComptoirs.length}). Veuillez entrer votre numéro de porte pour préciser.`,
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
