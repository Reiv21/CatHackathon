import { useState, useEffect, useRef, useCallback } from "react";
import type { CatResponse } from "../types";
import { apiFetch } from "../api";

interface UseSearchCatsResult {
  data: CatResponse[] | null;
  loading: boolean;
  error: string | null;
}

export function useSearchCats(query: string): UseSearchCatsResult {
  const [data, setData] = useState<CatResponse[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchCats = useCallback(async (search?: string) => {
    setLoading(true);
    setError(null);
    try {
      const url = search && search.length >= 2
        ? `/api/cats?search=${encodeURIComponent(search)}`
        : "/api/cats";
      const cats = await apiFetch<CatResponse[]>(url);
      setData(cats);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    if (query.length === 0) {
      // Load all cats immediately
      fetchCats();
      return;
    }

    if (query.length < 2) {
      // Don't search yet, keep current results
      return;
    }

    // Debounce search
    timeoutRef.current = setTimeout(() => {
      fetchCats(query);
    }, 300);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [query, fetchCats]);

  return { data, loading, error };
}
