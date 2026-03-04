import { useEffect, useMemo, useState } from "react";
import Fuse from "fuse.js";
import type { Filters, ProductType, TastingRecord } from "../types";

const getStoredProductType = (): ProductType | "all" => {
  const stored = localStorage.getItem("productTypeFilter");
  if (stored === "sauce" || stored === "drink" || stored === "all") return stored;
  return "all";
};

const defaultFilters: Filters = {
  productType: getStoredProductType(),
  search: "",
  style: "",
  ingredient: "",
  minScore: "",
  minHeat: "",
  date: "",
  sortBy: "date"
};

export function useFilters(tastings: TastingRecord[]) {
  const [filters, setFilters] = useState<Filters>(defaultFilters);

  useEffect(() => {
    localStorage.setItem("productTypeFilter", filters.productType);
  }, [filters.productType]);

  const filteredTastings = useMemo(() => {
    const lowerSearch = filters.search.trim().toLowerCase();
    const lowerStyle = filters.style.trim().toLowerCase();
    const ingredientQuery = filters.ingredient.trim();
    const minScore = filters.minScore ? Number(filters.minScore) : null;
    const minHeat = filters.minHeat ? Number(filters.minHeat) : null;

    let results = tastings.filter((item) => {
      if (filters.productType !== "all") {
        const itemType = item.productType ?? "sauce";
        if (itemType !== filters.productType) return false;
      }
      if (lowerSearch) {
        const combined = `${item.name} ${item.maker}`.toLowerCase();
        if (!combined.includes(lowerSearch)) return false;
      }
      if (lowerStyle && !item.style.toLowerCase().includes(lowerStyle)) return false;
      if (filters.date && item.date !== filters.date) return false;
      if (minScore !== null && (item.score ?? -1) < minScore) return false;
      if (minHeat !== null && (item.heatUser ?? -1) < minHeat) return false;
      return true;
    });

    if (ingredientQuery && results.length > 0) {
      const fuse = new Fuse(results, {
        keys: ["ingredients"],
        threshold: 0.4,
        ignoreLocation: true,
        useExtendedSearch: true
      });
      results = fuse.search(ingredientQuery).map((r) => r.item);
    }

    return [...results].sort((a, b) => {
      if (filters.sortBy === "name") return a.name.localeCompare(b.name);
      if (filters.sortBy === "score") return (b.score ?? -1) - (a.score ?? -1);
      if (filters.sortBy === "style") return a.style.localeCompare(b.style);
      if (filters.sortBy === "heat") return (b.heatUser ?? -1) - (a.heatUser ?? -1);
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });
  }, [filters, tastings]);

  const activeFilterCount = [filters.minScore, filters.minHeat, filters.style, filters.ingredient, filters.date].filter(Boolean).length;

  const resetFilters = () => setFilters(defaultFilters);

  return { filters, setFilters, filteredTastings, activeFilterCount, resetFilters, defaultFilters };
}
