import { NextResponse } from "next/server";
import { GoogleSpreadsheet } from "google-spreadsheet";
import { JWT } from "google-auth-library";
import {
  buildStreetMap,
  resolveComptoir,
  getAllStreets,
  type StreetEntry,
} from "@/lib/resolve";

// Initialize auth
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
let rawData: any[] = [];

/**
 * Load data directly from Google Sheet (Live data)
 */
async function loadData() {
  try {
    if (
      !process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL ||
      !process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY ||
      !process.env.GOOGLE_SHEET_ID
    ) {
      throw new Error("Missing required environment variables.");
    }

    await doc.loadInfo();
    const sheet = doc.sheetsByIndex[0];
    const rows = await sheet.getRows();

    if (rows.length === 0) {
      throw new Error("Sheet is empty - no data to load");
    }

    // Convert rows with whitespace trimming and new fields included
    const data = rows
      .map((row) => {
        const nom = (row.get("nom") || "").trim();
        const ville = (row.get("ville") || "").trim();
        const comptoir = (row.get("comptoir") || "").trim();
        const from = row.get("from") ? Number(row.get("from")) : null;
        const to = row.get("to") ? Number(row.get("to")) : null;
        const adress = (row.get("adress") || row.get("address") || "").trim();
        const courriel = (row.get("courriel") || "").trim();
        const telephone = (row.get("telephone") || "").trim();

        if (!nom) return null;

        return {
          from,
          to,
          nom,
          ville,
          comptoir,
          adress,
          courriel,
          telephone,
        };
      })
      .filter((entry) => entry !== null) as Array<{
      from: number | null;
      to: number | null;
      nom: string;
      ville: string;
      comptoir: string;
      adress: string;
      courriel: string;
      telephone: string;
    }>;

    streetMap = buildStreetMap(data);
    rawData = data;

    return streetMap;
  } catch (error) {
    throw error;
  }
}

/**
 * GET /api/resolve?q=<street_query>&action=<search|list>
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q");
    const action = searchParams.get("action");

    if (!q && action !== "list") {
      return NextResponse.json(
        { error: "Missing query parameter 'q'" },
        { status: 400 },
      );
    }

    const map = await loadData();

    if (action === "list") {
      const streets = getAllStreets(map);
      const suggestions = rawData
        .map((entry) => ({
          from: entry.from,
          to: entry.to,
          nom: entry.nom,
          ville: entry.ville,
          comptoir: entry.comptoir,
          adress: entry.adress,
          courriel: entry.courriel,
          telephone: entry.telephone,
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
    const result = resolveComptoir(q!, map);

    return NextResponse.json({
      comptoir: result.comptoir,
      reason: result.reason,
      matches: result.matches.map((m: any) => ({
        from: m.from,
        to: m.to,
        nom: m.nom,
        ville: m.ville,
        comptoir: m.comptoir,
        adress: m.adress,
        courriel: m.courriel,
        telephone: m.telephone,
      })),
      found: result.comptoir !== null,
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

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
