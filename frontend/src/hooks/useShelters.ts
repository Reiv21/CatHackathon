import { useState, useEffect, useCallback } from "react";
import type { ShelterResponse } from "../types";
import { apiFetch } from "../api";

interface UseSheltersResult {
  data: ShelterResponse[] | null;
  loading: boolean;
  error: string | null;
  retry: () => void;
}

export function useShelters(): UseSheltersResult {
  const [data, setData] = useState<ShelterResponse[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchShelters = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const shelters = await apiFetch<ShelterResponse[]>("/api/shelters");
      setData(shelters);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load shelters");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchShelters();
  }, [fetchShelters]);

  return { data, loading, error, retry: fetchShelters };
}
