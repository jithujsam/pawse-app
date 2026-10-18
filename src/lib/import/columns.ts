// Suggests which spreadsheet column plays which role, so most uploads need no manual mapping.

export const ROLES = [
  "name",
  "address",
  "city",
  "region",
  "postcode",
  "country",
  "lat",
  "lng",
  "category",
  "owner",
  "territory",
  "metric",
] as const;

export type Role = (typeof ROLES)[number];

/** Column index for each role, or null when the sheet has no such column. */
export type ColumnMap = Record<Role, number | null>;

export const ROLE_LABELS: Record<Role, string> = {
  name: "Name",
  address: "Street address",
  city: "City / town",
  region: "State / county",
  postcode: "ZIP / postcode",
  country: "Country",
  lat: "Latitude",
  lng: "Longitude",
  category: "Category / type",
  owner: "Rep / owner",
  territory: "Territory",
  metric: "Metric (sales, volume…)",
};

// Synonyms are compared after normalising headers to lowercase alphanumerics.
// Earlier entries win, so put the most specific spellings first.
const SYNONYMS: Record<Role, string[]> = {
  name: ["name", "accountname", "account", "customername", "customer", "dealername", "dealer", "storename", "store", "company", "companyname", "business", "location", "site", "outlet"],
  address: ["streetaddress", "address1", "addressline1", "address", "street", "addr", "fulladdress", "mailingaddress", "billingstreet", "shippingstreet"],
  city: ["city", "town", "posttown", "locality", "billingcity", "shippingcity"],
  region: ["state", "stateprovince", "province", "region", "county", "billingstate", "shippingstate", "st"],
  postcode: ["zip", "zipcode", "zip5", "postcode", "postalcode", "postal", "billingpostalcode", "shippingpostalcode", "pincode"],
  country: ["country", "countrycode", "billingcountry", "shippingcountry"],
  lat: ["lat", "latitude", "y"],
  lng: ["lng", "lon", "long", "longitude", "x"],
  category: ["category", "type", "segment", "channel", "tier", "class", "accounttype"],
  owner: ["owner", "rep", "salesrep", "accountowner", "assignedto", "manager", "am", "accountmanager"],
  territory: ["territory", "territoryname", "area", "zone", "patch", "district"],
  metric: ["sales", "revenue", "amount", "volume", "value", "arr", "mrr", "units", "orders"],
};

function normalizeHeader(header: string): string {
  return header.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function emptyColumnMap(): ColumnMap {
  return Object.fromEntries(ROLES.map((r) => [r, null])) as ColumnMap;
}

/**
 * Assign each role to at most one column, and each column to at most one role.
 * Matching runs in passes from strict to loose (exact, then prefix, then contains), so an
 * exact "City" header is claimed before a looser match can take it.
 */
export function autoMapColumns(headers: string[]): ColumnMap {
  const map = emptyColumnMap();
  const used = new Set<number>();
  const normalized = headers.map(normalizeHeader);

  const matches = (pass: "exact" | "prefix" | "contains", header: string, synonym: string) => {
    if (pass === "exact") return header === synonym;
    if (pass === "prefix") return synonym.length >= 4 && header.startsWith(synonym);
    return synonym.length >= 5 && header.includes(synonym);
  };

  for (const pass of ["exact", "prefix", "contains"] as const) {
    for (const role of ROLES) {
      if (map[role] !== null) continue;
      for (const synonym of SYNONYMS[role]) {
        const index = normalized.findIndex((h, i) => !used.has(i) && h.length > 0 && matches(pass, h, synonym));
        if (index !== -1) {
          map[role] = index;
          used.add(index);
          break;
        }
      }
    }
  }
  return map;
}

/** At least one way to place a row on the map must be mapped. */
export function hasLocationColumns(map: ColumnMap): boolean {
  return (map.lat !== null && map.lng !== null) || map.address !== null || map.postcode !== null;
}
