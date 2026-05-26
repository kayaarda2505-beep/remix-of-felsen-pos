// FELSEN POS — SAINTS Barkarte

export type Category =
  | "Signatures"
  | "Spritz"
  | "Cocktails"
  | "Bier"
  | "Wein"
  | "Shots"
  | "Spirituosen"
  | "Softdrinks"
  | "Mocktails"
  | "Homemades"
  | "Hot"
  | "Snacks";

export type { Product } from "@/hooks/use-products";


export const categories: Category[] = [
  "Signatures",
  "Spritz",
  "Cocktails",
  "Bier",
  "Wein",
  "Shots",
  "Spirituosen",
  "Softdrinks",
  "Mocktails",
  "Homemades",
  "Hot",
  "Snacks",
];

// Produkte werden jetzt aus der Datenbank geladen (siehe @/hooks/use-products).
// Dieser Fallback bleibt für Code-Pfade, die noch nicht migriert sind.
import type { Product } from "@/hooks/use-products";
export const products: Product[] = [];

// Tische — werden später aus dem Backend geladen
export interface TableInfo {
  id: string;
  name: string;
  seats: number;
  status: "free" | "occupied" | "bill" | "pending";
  guests?: number;
  total?: number;
  openedAt?: string;
}

export const tables: TableInfo[] = [];

// Team — wird später aus dem Backend geladen
export interface StaffMember {
  id: string;
  name: string;
  role: string;
  pin: string;
  active: boolean;
  color: string;
}

export const staff: StaffMember[] = [];
