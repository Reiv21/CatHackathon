# Security Documentation

This document describes the security measures implemented in the Mrucznik 🐱 project, including HTTP hardening, input validation, rate limiting, authentication, and data handling practices.

## HTTP Security Headers (Helmet)

The application uses [Helmet](https://helmetjs.github.io/) to set security-related HTTP headers.

### Content Security Policy (CSP)

CSP prevents cross-site scripting (XSS) and other code injection attacks by restricting which resources the browser is allowed to load.

| Directive | Value | Reason |
|---|---|---|
| `default-src` | `'self'` | Only allow resources from the same origin by default |
| `script-src` | `'self'`, `'unsafe-inline'` | Allow same-origin scripts and inline scripts (required by Vite dev mode and some React patterns) |
| `style-src` | `'self'`, `'unsafe-inline'`, `https://fonts.googleapis.com`, `https://unpkg.com` | Allow inline styles (Tailwind/React), Google Fonts stylesheets, and Leaflet CSS from unpkg |
| `font-src` | `'self'`, `https://fonts.gstatic.com` | Allow self-hosted fonts and Google Fonts file hosting |
| `img-src` | `'self'`, `data:`, `https:`, `http:` | Allow images from any origin — necessary because cat photos are hosted on various shelter websites |
| `connect-src` | `'self'`, Temporal address (validated) | Allow API calls to same origin and Temporal server for workflow management |
| `frame-src` | `'none'` | Disallow embedding in iframes — prevents clickjacking |

### Other Headers

| Header | Configuration | Purpose |
|---|---|---|
| HSTS | `max-age=31536000; includeSubDomains` | Forces HTTPS for 1 year; applies to all subdomains |
| X-Content-Type-Options | `nosniff` | Prevents browsers from MIME-sniffing responses away from declared content type |
| X-Powered-By | Removed | Hides Express server identity to reduce fingerprinting surface |
| Referrer-Policy | `no-referrer-when-downgrade` | Sends referrer for same-protocol requests, omits it on HTTPS→HTTP downgrade |

### CORS

Cross-Origin Resource Sharing is restricted to the configured `FRONTEND_ORIGIN` environment variable (defaults to `http://localhost:5173` in development). Only `GET`, `POST`, and `DELETE` methods are allowed with `Content-Type`, `Accept`, and `Authorization` headers.

## Input Validation

All user-supplied inputs are validated and sanitized before processing.

### `sanitizeSearchQuery(raw: string): string`

Used on cat/shelter search queries to prevent injection attacks.

- **Strips** all characters except: alphanumeric (`a-z`, `A-Z`, `0-9`), spaces, hyphens, and Polish diacritics (`ąćęłńóśźżĄĆĘŁŃÓŚŹŻ`)
- **Truncates** result to 100 characters maximum
- Effectively neutralizes HTML tags, script injection, SQL fragments, and special characters

### `validateShelterId(raw: string): number | null`

Used to validate shelter ID route parameters.

- Parses the string as a number
- Rejects non-integers, zero, negative values, and values exceeding INT32 max (`2,147,483,647`)
- Returns `null` for any invalid input (callers respond with 400/404)

## Rate Limiting

### Brute Force Login Protection

Protects the `POST /api/admin/login` endpoint from credential stuffing attacks.

| Parameter | Value |
|---|---|
| Max attempts | 5 per IP |
| Lockout window | 15 minutes |
| Reset behavior | Counter resets after lockout period expires |
| Response when limited | HTTP 429 with message "Too many attempts. Try again in 15 minutes." |

Implementation uses an in-memory `Map<IP, { count, lastAttempt }>`. Successful logins clear the counter for that IP.

### Stray Cat Report Limiting

Protects `POST /api/report-stray` from spam and abuse.

| Parameter | Value |
|---|---|
| Max reports | 3 per IP per 24 hours |
| Reset behavior | Counter resets after 24h from first report in window |
| Response when limited | HTTP 429 with message "Too many reports. Max 3 per day. Try again tomorrow." |
| Exception | Localhost IPs (`127.0.0.1`, `::1`, `::ffff:127.0.0.1`) are exempt for development |

## Authentication

### Approach

The admin panel uses a simple token-based authentication scheme:

1. Client sends credentials to `POST /api/admin/login`
2. Server validates the password against `ADMIN_PASSWORD` env var
3. On success, server returns a Base64-encoded token in format `admin:{timestamp}`
4. Client includes this token as `Authorization: Bearer <token>` on subsequent admin requests
5. `requireAdminAuth` middleware decodes and validates the token prefix

### Known Limitations

| Limitation | Risk | Mitigation |
|---|---|---|
| No token expiry | Tokens remain valid indefinitely | Acceptable for hackathon demo; tokens are only stored in session memory |
| No JWT / cryptographic signing | Token can be forged if format is known | Low risk — admin functionality is limited to triggering syncs |
| Base64 encoding, not encryption | Token is trivially decodable | Does not contain sensitive data (only username + timestamp) |
| Single shared password | No per-user audit trail | Appropriate for single-admin hackathon scenario |
| In-memory rate limit state | Resets on server restart | Acceptable for demo; prevents sustained attacks during uptime |

### Error Response Security

All authentication failures return a generic `{ "message": "Unauthorized" }` with HTTP 401 — no stack traces, filesystem paths, or configuration details are leaked regardless of failure reason.

## Data Handling

### Data Sources

- **Shelter data**: Scraped from publicly available Polish animal shelter registry (napaluchu.waw.pl API)
- **Cat data**: Scraped from individual shelter websites (public adoption listings)
- **Stray reports**: User-submitted via the frontend form

### Storage

| Store | Format | Sensitivity |
|---|---|---|
| SQLite database (`shelter-sync.db`) | WAL mode | Public shelter/cat data only — no PII |
| JSON exports (`data/*.json`) | Flat files | Derived from SQLite — same public data |
| Stray reports (`data/strays.json`) | Flat file | Contains approximate GPS coordinates and optional image URLs |

### Data Practices

- No user accounts or personal data are stored
- Stray report locations are intentionally imprecise (randomized offset when geocoded from city name)
- No cookies or session storage are used
- Admin password is stored in environment variable, never committed to source control
- `.env` is listed in `.gitignore`

## Future Improvements

The following security enhancements would be recommended for a production deployment:

1. **JWT Authentication** — Replace Base64 tokens with signed JWTs including expiry claims (`exp`), enabling stateless validation and automatic token rotation.

2. **HTTPS Enforcement** — Deploy behind a TLS-terminating reverse proxy (nginx, Caddy, or cloud load balancer). The HSTS header is already configured for when HTTPS is enabled.

3. **Persistent Rate Limiting** — Replace in-memory Maps with Redis-backed rate limiting (e.g., `express-rate-limit` + `rate-limit-redis`) to survive restarts and work across multiple instances.

4. **Security Scanning (Aikido)** — Integrate automated dependency vulnerability scanning and SAST in CI pipeline.

5. **CSP Nonce** — Replace `'unsafe-inline'` in `script-src` with per-request nonces for stronger XSS protection.

6. **Input Size Limits** — Add `express.json({ limit: '10kb' })` and request body size limits to prevent DoS via large payloads.

7. **Audit Logging** — Log admin actions (sync triggers, login attempts) to persistent storage with timestamps and IP addresses.
