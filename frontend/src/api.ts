import type { ApiError } from "./types";

export class ApiRequestError extends Error {
  public status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
  }
}

export async function apiFetch<T>(url: string, timeoutMs = 15000): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(url, { signal: controller.signal });
  } catch (err) {
    clearTimeout(timer);
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new ApiRequestError("Request timed out", 0);
    }
    throw new ApiRequestError("Network error", 0);
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    let message = `Request failed with status ${response.status}`;
    try {
      const errorBody: ApiError = await response.json();
      message = errorBody.message;
    } catch {
      // Use default message if body isn't JSON
    }
    throw new ApiRequestError(message, response.status);
  }

  return response.json() as Promise<T>;
}
