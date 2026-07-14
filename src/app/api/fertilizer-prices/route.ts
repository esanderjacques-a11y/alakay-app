import * as XLSX from "xlsx";
import countryToCurrency from "country-to-currency";
import {
  COMMERCIAL_FERTILIZERS,
  type FertilizerBenchmarkKey,
} from "@/lib/fertilizerCatalog";
import { countryCodeForName } from "@/lib/countries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const WORLD_BANK_MONTHLY_URL =
  "https://thedocs.worldbank.org/en/doc/74e8be41ceb20fa0da750cda2f6b9e4e-0050012026/related/CMO-Historical-Data-Monthly.xlsx";

const WORLD_BANK_COLUMNS: Record<FertilizerBenchmarkKey, string> = {
  urea: "Urea",
  dap: "DAP",
  tsp: "TSP",
  potassium_chloride: "Potassium chloride",
};

type BenchmarkSnapshot = {
  period: string;
  updatedAt: string;
  usdPerMetricTonne: Record<FertilizerBenchmarkKey, number>;
};

let benchmarkCache:
  | { expiresAt: number; value: BenchmarkSnapshot }
  | undefined;

function cleanHeader(value: unknown) {
  return String(value || "")
    .replace(/\*+/g, "")
    .trim()
    .toLowerCase();
}

async function loadWorldBankBenchmarks(): Promise<BenchmarkSnapshot> {
  if (benchmarkCache && benchmarkCache.expiresAt > Date.now()) {
    return benchmarkCache.value;
  }

  const response = await fetch(WORLD_BANK_MONTHLY_URL, {
    next: { revalidate: 21_600 },
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) {
    throw new Error(`World Bank price source returned ${response.status}`);
  }

  const workbook = XLSX.read(Buffer.from(await response.arrayBuffer()), {
    type: "buffer",
  });
  const sheet = workbook.Sheets["Monthly Prices"];
  if (!sheet) throw new Error("World Bank monthly price sheet is unavailable");

  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    blankrows: false,
  });
  const header = rows[4] || [];
  const updatedAt = String(rows[3]?.[0] || "").replace(/^Updated on\s*/i, "");
  const indices = Object.fromEntries(
    Object.entries(WORLD_BANK_COLUMNS).map(([key, label]) => {
      const normalizedLabel = cleanHeader(label);
      const index = header.findIndex((value) =>
        cleanHeader(value).startsWith(normalizedLabel)
      );
      return [key, index];
    })
  ) as Record<FertilizerBenchmarkKey, number>;

  const latestRow = [...rows]
    .reverse()
    .find(
      (row) =>
        /^\d{4}M\d{2}$/.test(String(row?.[0] || "")) &&
        Object.values(indices).every(
          (index) => index >= 0 && Number.isFinite(Number(row[index]))
        )
    );
  if (!latestRow) throw new Error("No current fertilizer benchmark row was found");

  const value: BenchmarkSnapshot = {
    period: String(latestRow[0]),
    updatedAt,
    usdPerMetricTonne: {
      urea: Number(latestRow[indices.urea]),
      dap: Number(latestRow[indices.dap]),
      tsp: Number(latestRow[indices.tsp]),
      potassium_chloride: Number(
        latestRow[indices.potassium_chloride]
      ),
    },
  };
  benchmarkCache = { expiresAt: Date.now() + 21_600_000, value };
  return value;
}

async function currencyForCountry(country: string) {
  if (!country || country.toLowerCase() === "other") return "USD";
  const code = countryCodeForName(country);
  return code
    ? countryToCurrency[code as keyof typeof countryToCurrency] || "USD"
    : "USD";
}

async function usdRate(currency: string) {
  if (currency === "USD") return 1;
  const response = await fetch("https://open.er-api.com/v6/latest/USD", {
    next: { revalidate: 21_600 },
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) throw new Error("Currency conversion source is unavailable");
  const data = (await response.json()) as {
    result?: string;
    rates?: Record<string, number>;
  };
  const rate = Number(data.rates?.[currency]);
  if (data.result !== "success" || !(rate > 0)) {
    throw new Error(`No exchange rate is available for ${currency}`);
  }
  return rate;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const country = (url.searchParams.get("country") || "").trim();
  const requestedCurrency = (url.searchParams.get("currency") || "")
    .trim()
    .toUpperCase();

  try {
    const currency = requestedCurrency || (await currencyForCountry(country));
    const [snapshot, exchangeRate] = await Promise.all([
      loadWorldBankBenchmarks(),
      usdRate(currency),
    ]);

    const products = COMMERCIAL_FERTILIZERS.map((product) => {
      const benchmarkKey = product.benchmarkKey;
      const usdPrice = benchmarkKey
        ? snapshot.usdPerMetricTonne[benchmarkKey]
        : null;
      return {
        key: product.key,
        pricePerMetricTonne:
          usdPrice == null ? null : Math.round(usdPrice * exchangeRate * 100) / 100,
        online: usdPrice != null,
        proxy: Boolean(product.benchmarkProxy),
        benchmarkKey: benchmarkKey || null,
      };
    });

    return Response.json(
      {
        country: country || null,
        currency,
        exchangeRate,
        period: snapshot.period,
        updatedAt: snapshot.updatedAt,
        source: "World Bank Pink Sheet",
        sourceUrl: WORLD_BANK_MONTHLY_URL,
        priceBasis: "International benchmark converted from USD per metric tonne",
        products,
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=21600, stale-while-revalidate=86400",
        },
      }
    );
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to load fertilizer prices",
      },
      { status: 502 }
    );
  }
}

