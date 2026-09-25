import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";

function isLunchTime() {
  const h = Number(
    new Intl.DateTimeFormat("de-CH", { hour: "numeric", hour12: false, timeZone: "Europe/Zurich" }).format(new Date()),
  );
  return h >= 11 && h < 14;
}
import { supabase } from "@/integrations/supabase/client";

export interface ModifierItem {
  label: string;
  price_delta?: number;
}
export interface ModifierGroup {
  label: string;
  multi?: boolean;
  items: ModifierItem[];
}

export interface Product {
  id: string;
  name: string;
  category: string;
  price: number;
  description?: string | null;
  meta?: string | null;
  active: boolean;
  sort_order: number;
  modifier_groups: ModifierGroup[];
}

export function useProducts() {
  const queryClient = useQueryClient();
  const q = useQuery({
    queryKey: ["products"],
    queryFn: async (): Promise<Product[]> => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((r: any) => ({
        id: r.id,
        name: r.name,
        category: r.category,
        price: Number(r.price),
        description: r.description,
        meta: r.meta,
        active: r.active,
        sort_order: r.sort_order,
        modifier_groups: Array.isArray(r.modifier_groups) ? r.modifier_groups : [],
      }));
    },
    staleTime: 30_000,
  });

  useEffect(() => {
    const channel = supabase
      .channel(`products-changes-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "products" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["products"] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);


  // Mittagsmenü nur zwischen 11:00 und 14:00 (Zürich) anzeigen
  const [lunchTime, setLunchTime] = useState(isLunchTime);
  useEffect(() => {
    const t = setInterval(() => setLunchTime(isLunchTime()), 60_000);
    return () => clearInterval(t);
  }, []);
  const products = useMemo(
    () =>
      (q.data ?? []).filter(
        (p) => p.active && (lunchTime || !/mittagsmen/i.test(p.category)),
      ),
    [q.data, lunchTime],
  );
  const allProducts = q.data ?? [];
  const categories = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const p of products) {
      if (!seen.has(p.category)) {
        seen.add(p.category);
        out.push(p.category);
      }
    }
    return out;
  }, [products]);

  return { products, allProducts, categories, isLoading: q.isLoading, refetch: q.refetch };
}
