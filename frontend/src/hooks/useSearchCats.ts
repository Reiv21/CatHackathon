import { useState, useEffect, useRef, useCallback } from "react";
import type { CatResponse } from "../types";
import { apiFetch } from "../api";

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface UseSearchCatsResult {
  data: CatResponse[] | null;
  loading: boolean;
  error: string | null;
  pagination: Pagination | null;
  setPage: (page: number) => void;
}

interface ApiCatsResponse {
  cats: CatResponse[];
  pagination: Pagination;
}

export function useSearchCats(query: string, voivodeship: string = ""): UseSearchCatsResult {
  const [data, setData] = useState<CatResponse[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [page, setPage] = useState(1);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset page when query or voivodeship changes
  useEffect(() => { setPage(1); }, [query, voivodeship]);

  const fetchCats = useCallback(async (searchQuery: string, voiv: string, p: number) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("page", String(p));
      params.set("limit", "24");
      if (searchQuery.length >= 2) params.set("search", searchQuery);
      if (voiv) params.set("voivodeship", voiv);

      const result = await apiFetch<ApiCatsResponse>(`/api/cats?${params.toString()}`);
      // Handle both new paginated format and legacy flat array
      if (Array.isArray(result)) {
        setData(result as unknown as CatResponse[]);
        setPagination({ page: 1, limit: 200, total: (result as unknown as CatResponse[]).length, totalPages: 1 });
      } else {
        setData(result.cats);
        setPagination(result.pagination);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    if (query.length > 0 && query.length < 2) return;

    const delay = query.length >= 2 ? 300 : 0;
    timeoutRef.current = setTimeout(() => {
      fetchCats(query, voivodeship, page);
    }, delay);

    return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); };
  }, [query, voivodeship, page, fetchCats]);

  return { data, loading, error, pagination, setPage };
}
