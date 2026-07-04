export interface ApiShelter {
  id: string;
  nazwa: string;
  miasto: string;
  wojewodztwo: string;
  www: string | null;
  kod_pocztowy: string | null;
  adres: string | null;
  telefon: string | null;
  email: string | null;
}

const API_URL = "https://otwarteschroniska.org.pl/api/v1/shelters.json";
const TIMEOUT_MS = 30_000;

export async function fetchSheltersFromApi(): Promise<ApiShelter[]> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(API_URL, { signal: controller.signal });
  } catch (error: unknown) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(
        `Network timeout: request to ${API_URL} timed out after ${TIMEOUT_MS}ms`
      );
    }
    throw new Error(
      `Network error fetching shelters from ${API_URL}: ${error instanceof Error ? error.message : String(error)}`
    );
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    throw new Error(
      `Failed to fetch shelters: HTTP ${response.status} ${response.statusText} from ${API_URL}`
    );
  }

  const data = (await response.json()) as ApiShelter[];
  return data;
}
