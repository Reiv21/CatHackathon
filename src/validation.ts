/**
 * Input validation utilities for the Tactical Cat Frontend API.
 * Sanitizes user inputs to prevent injection attacks.
 */

const ALLOWED_CHARS_REGEX = /[^a-zA-Z0-9 \-ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/g;
const MAX_SEARCH_LENGTH = 100;
const MAX_SHELTER_ID = 2_147_483_647;

/**
 * Sanitizes a search query by stripping disallowed characters and truncating.
 * Allowed: alphanumeric, spaces, hyphens, Polish diacritics.
 * Truncates to 100 characters after stripping.
 */
export function sanitizeSearchQuery(raw: string): string {
  const stripped = raw.replace(ALLOWED_CHARS_REGEX, "");
  return stripped.slice(0, MAX_SEARCH_LENGTH);
}

/**
 * Validates a shelter ID string as a positive integer within INT32 range.
 * Returns the parsed number or null if invalid.
 */
export function validateShelterId(raw: string): number | null {
  const parsed = Number(raw);

  if (!Number.isInteger(parsed)) {
    return null;
  }

  if (parsed <= 0 || parsed > MAX_SHELTER_ID) {
    return null;
  }

  return parsed;
}

/**
 * Strips terminal control characters (ANSI escapes, C0/C1 controls) from a string.
 * Use before logging any externally-sourced data to prevent terminal injection.
 */
export function stripControlChars(str: string): string {
  // Remove ANSI escape sequences and C0/C1 control characters (except newline/tab)
  return str
    .replace(/\x1b\[[0-9;]*[a-zA-Z]/g, "") // ANSI CSI sequences
    .replace(/\x1b[^[]/g, "")              // Other ESC sequences
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f]/g, ""); // C0/C1 controls (keep \t \n \r)
}
