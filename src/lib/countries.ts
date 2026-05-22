export type CountryRegion =
  | "Caribbean"
  | "Central America"
  | "North America"
  | "South America"
  | "Europe"
  | "Africa"
  | "Asia"
  | "Oceania";

const countryCodesByRegion: Record<CountryRegion, string[]> = {
  Caribbean: [
    "AG", "AI", "AW", "BB", "BL", "BQ", "BS", "CU", "CW", "DM", "DO", "GD",
    "GP", "HT", "JM", "KN", "KY", "LC", "MF", "MQ", "MS", "PR", "SX", "TC",
    "TT", "VC", "VG", "VI",
  ],
  "Central America": ["BZ", "CR", "GT", "HN", "NI", "PA", "SV"],
  "North America": ["BM", "CA", "GL", "MX", "PM", "US"],
  "South America": [
    "AR", "BO", "BR", "CL", "CO", "EC", "FK", "GF", "GY", "PE", "PY", "SR",
    "UY", "VE",
  ],
  Europe: [
    "AD", "AL", "AT", "AX", "BA", "BE", "BG", "BY", "CH", "CY", "CZ", "DE",
    "DK", "EE", "ES", "FI", "FO", "FR", "GB", "GG", "GI", "GR", "HR", "HU",
    "IE", "IM", "IS", "IT", "JE", "LI", "LT", "LU", "LV", "MC", "MD", "ME",
    "MK", "MT", "NL", "NO", "PL", "PT", "RO", "RS", "RU", "SE", "SI", "SJ",
    "SK", "SM", "UA", "VA", "XK",
  ],
  Africa: [
    "AO", "BF", "BI", "BJ", "BW", "CD", "CF", "CG", "CI", "CM", "CV", "DJ",
    "DZ", "EG", "EH", "ER", "ET", "GA", "GH", "GM", "GN", "GQ", "GW", "KE",
    "KM", "LR", "LS", "LY", "MA", "MG", "ML", "MR", "MU", "MW", "MZ", "NA",
    "NE", "NG", "RE", "RW", "SC", "SD", "SH", "SL", "SN", "SO", "SS", "ST",
    "SZ", "TD", "TG", "TN", "TZ", "UG", "YT", "ZA", "ZM", "ZW",
  ],
  Asia: [
    "AE", "AF", "AM", "AZ", "BD", "BH", "BN", "BT", "CC", "CN", "CX", "GE",
    "HK", "ID", "IL", "IN", "IO", "IQ", "IR", "JO", "JP", "KG", "KH", "KP",
    "KR", "KW", "KZ", "LA", "LB", "LK", "MM", "MN", "MO", "MV", "MY", "NP",
    "OM", "PH", "PK", "PS", "QA", "SA", "SG", "SY", "TH", "TJ", "TL", "TM",
    "TR", "TW", "UZ", "VN", "YE",
  ],
  Oceania: [
    "AS", "AU", "CK", "FJ", "FM", "GU", "KI", "MH", "MP", "NC", "NF", "NR",
    "NU", "NZ", "PF", "PG", "PN", "PW", "SB", "TK", "TO", "TV", "UM", "VU",
    "WF", "WS",
  ],
};

const displayNames = new Intl.DisplayNames(["en"], { type: "region" });

function countryName(code: string) {
  return displayNames.of(code) || code;
}

export const countryRegions = Object.entries(countryCodesByRegion).map(
  ([region, codes]) => ({
    region: region as CountryRegion,
    countries: codes.map(countryName).sort((a, b) => a.localeCompare(b)),
  })
);

export const countries = [
  ...countryRegions.flatMap((group) => group.countries),
]
  .filter((country, index, list) => list.indexOf(country) === index)
  .sort((a, b) => a.localeCompare(b));

countries.push("Other");
