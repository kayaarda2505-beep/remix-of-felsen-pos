export type StationKey = "pizza" | "bar" | "kueche";

/** Feste Station-Accounts: 3 = Pizza, 4 = Bar, 5 = Küche */
export const STATION_ACCOUNTS: Record<number, StationKey> = {
  3: "pizza",
  4: "bar",
  5: "kueche",
};

export const STATION_LABEL: Record<StationKey, string> = {
  pizza: "Pizzastation",
  bar: "Bar",
  kueche: "Küche",
};

export function stationForAccount(accountNumber?: number | null): StationKey | null {
  if (accountNumber == null) return null;
  return STATION_ACCOUNTS[accountNumber] ?? null;
}
