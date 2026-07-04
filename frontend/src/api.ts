import type { ApiError } from "./types";

export class ApiRequestError extends Error {
  public status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
  }
}

export async function apiFetch<T>(url: string): Promise<T> {
  const response = await fetch(url);

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
