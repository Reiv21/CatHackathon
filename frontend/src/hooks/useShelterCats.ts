import { useState, useEffect, useCallback } from "react";
import type { CatResponse } from "../types";
import { apiFetch } from "../api";

interface UseShelterCatsResult {
  data: CatResponse[] | null;
  loading: boolean;
  error: string | null;
  retry: () => void;
}

export function useShelterCats(shelterId: number | null): UseShelterCatsResult {
  const [data, setData] = useState<CatResponse[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCats = useCallback(async () => {
    if (shelterId === null) {
      setData(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const cats = await apiFetch<CatResponse[]>(`/api/shelters/${shelterId}/cats`);
      setData(cats);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load shelter cats");
    } finally {
      setLoading(false);
    }
  }, [shelterId]);

  useEffect(() => {
    fetchCats();
  }, [fetchCats]);

  return { data, loading, error, retry: fetchCats };
}
