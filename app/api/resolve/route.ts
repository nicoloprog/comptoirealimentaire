import { NextResponse } from "next/server";
import { GoogleSpreadsheet } from "google-spreadsheet";
import { JWT } from "google-auth-library";
import {
  buildStreetMap,
  resolveComptoir,
  getAllStreets,
  type StreetEntry,
} from "@/lib/resolve";

// Initialize auth - same as your POST endpoint
const serviceAccountAuth = new JWT({
  email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  key: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY,
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

const doc = new GoogleSpreadsheet(
  process.env.GOOGLE_SHEET_ID as string,
  serviceAccountAuth,
);

let streetMap: Map<string, StreetEntry[]> | null = null;
let rawData: StreetEntry[] = []; // Store raw data for debugging
let lastFetchTime = 0;
const CACHE_DURATION = 1000 * 60 * 60; // 1 hour in milliseconds

/**
 * Load data from Google Sheet
 */
async function loadData() {
  // Use cached data if fresh
  if (streetMap && Date.now() - lastFetchTime < CACHE_DURATION) {
    // console.log("✅ Using cached data");
    return streetMap;
  }

  try {
    // console.log("📥 Loading data from Google Sheet...");

    // Validate environment variables
    if (
      !process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL ||
      !process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY ||
      !process.env.GOOGLE_SHEET_ID
    ) {
      throw new Error(
        "Missing required environment variables: GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY, GOOGLE_SHEET_ID",
      );
    }

    // Load document info and worksheets
    await doc.loadInfo();
    // console.log(`📄 Document title: ${doc.title}`);

    // Get the first sheet
    const sheet = doc.sheetsByIndex[0];
    // console.log(`📋 Sheet name: ${sheet.title}`);

    // Get all rows from the sheet
    const rows = await sheet.getRows();
    // console.log(`📊 Found ${rows.length} rows in sheet`);

    if (rows.length === 0) {
      throw new Error("Sheet is empty - no data to load");
    }

    // Convert rows to our expected data format with whitespace trimming
    const data = rows
      .map((row) => {
        const nom = (row.get("nom") || "").trim();
        const ville = (row.get("ville") || "").trim();
        const comptoir = (row.get("comptoir") || "").trim();
        const from = row.get("from") ? Number(row.get("from")) : null;
        const to = row.get("to") ? Number(row.get("to")) : null;
        const adress = (row.get("adress") || row.get("address") || "").trim();

        // Validate
        if (!nom) {
          // console.warn(`⚠️ Row ${index + 1}: Empty nom (skipped)`);
          return null;
        }

        return {
          from,
          to,
          nom,
          ville,
          comptoir,
          adress,
        };
      })
      .filter((entry) => entry !== null) as Array<{
      from: number | null;
      to: number | null;
      nom: string;
      ville: string;
      comptoir: string;
      adress: string;
    }>;

    // console.log(`✔️ Processed ${data.length} valid entries`);

    // Log first few entries for debugging
    // if (data.length > 0) {
    //   console.log("\n📝 Sample data (first 3):");
    //   data.slice(0, 3).forEach((d, i) => {
    //     console.log(`  [${i}] nom="${d.nom}", from=${d.from}, to=${d.to}`);
    //   });
    // }

    // Build searchable map
    streetMap = buildStreetMap(data);
    rawData = data;
    lastFetchTime = Date.now();

    // console.log(`\n✅ Map built with ${streetMap.size} keys`);
    // console.log(
    //   `   Sample keys: ${Array.from(streetMap.keys()).slice(0, 5).join(", ")}`,
    // );

    return streetMap;
  } catch (error) {
    // console.error("❌ Error loading data:", error);
    throw error;
  }
}

/**
 * GET /api/resolve?q=<street_query>&action=<search|list|debug>
 * Returns the associated comptoir for a given street name
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q");
    const action = searchParams.get("action"); // "search", "list", or "debug"

    if (!q && action !== "list" && action !== "debug") {
      return NextResponse.json(
        { error: "Missing query parameter 'q'" },
        { status: 400 },
      );
    }

    const map = await loadData();

    // DEBUG ACTION: Show map structure and sample data
    if (action === "debug") {
      const mapEntries = Array.from(map.entries())
        .slice(0, 20)
        .map(([key, entries]) => ({
          key,
          count: entries.length,
          examples: entries.slice(0, 2).map((e) => ({
            nom: e.nom,
            comptoir: e.comptoir,
          })),
        }));

      return NextResponse.json({
        debug: {
          mapSize: map.size,
          totalKeys: map.size,
          rawDataCount: rawData.length,
          sampleRawData: rawData.slice(0, 3),
          mapEntries,
        },
      });
    }

    if (action === "list") {
      // Return all available streets for autocomplete
      const streets = getAllStreets(map);
      const suggestions = rawData
        .map((entry) => ({
          from: entry.from,
          to: entry.to,
          nom: entry.nom,
          ville: entry.ville,
          comptoir: entry.comptoir,
          adress: entry.adress,
        }))
        .sort((a, b) => {
          const streetCompare = a.nom.localeCompare(b.nom, "fr");
          if (streetCompare !== 0) return streetCompare;
          return (a.from ?? 0) - (b.from ?? 0);
        });

      return NextResponse.json({
        streets,
        suggestions,
        count: suggestions.length,
      });
    }

    // SEARCH ACTION
    // console.log(`\n🔍 Searching for: "${q}"`);

    const result = resolveComptoir(q!, map);

    // console.log(`   → Found: ${result.comptoir || "NO MATCH"}`);
    // console.log(`   → Matches: ${result.matches.length}`);

    return NextResponse.json({
      comptoir: result.comptoir,
      reason: result.reason,
      matches: result.matches.map((m) => ({
        from: m.from,
        to: m.to,
        nom: m.nom,
        ville: m.ville,
        comptoir: m.comptoir,
        adress: m.adress,
      })),
      found: result.comptoir !== null,
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    // console.error("❌ API error:", errorMessage);

    return NextResponse.json(
      {
        error: "Internal server error",
        details:
          process.env.NODE_ENV === "development" ? errorMessage : undefined,
      },
      { status: 500 },
    );
  }
}
