# Security Report

This document describes all security measures implemented in Mrucznik. The application was designed with secure-by-default principles and has been validated with the **Aikido Security Scanner** (0 issues found).

---

## Aikido Security Scan

The application was scanned using [Aikido Security](https://www.aikido.dev/) — an automated security platform that checks for vulnerabilities in code, dependencies, and infrastructure configuration.

**Result: ✅ No security issues detected**

> Screenshot of the Aikido scan report is available in `docs/screenshots/aikido-scan.png`

---

## Security Headers

All HTTP responses include security headers set by the [Helmet](https://helmetjs.github.io/) middleware. These headers tell browsers how to behave when loading our pages, preventing many common attacks.

### Content Security Policy (CSP)

CSP prevents cross-site scripting (XSS) attacks by controlling which resources the browser is allowed to load.

| What it controls | Allowed sources | Why |
|-----------------|----------------|-----|
| Default (everything) | Only our own server | Blocks unknown external resources |
| Scripts | Our server + inline | Required for React to work |
| Styles | Our server + inline + Google Fonts + unpkg | Tailwind CSS and external font stylesheets |
| Fonts | Our server + Google Fonts | Custom typography |
| Images | Our server + data URIs + any HTTPS/HTTP | Cat photos come from many different shelter sites |
| Connections (API calls) | Our server + Temporal | API requests and workflow management |
| Frames (embedding) | **None** (frame-src + frame-ancestors) | Nobody can embed our site in an iframe → prevents clickjacking |

### Other Protection Headers

| Header | What it does | Our setting |
|--------|-------------|-------------|
| **Strict-Transport-Security (HSTS)** | Forces browsers to use HTTPS for 1 full year | `max-age=31536000; includeSubDomains` |
| **X-Content-Type-Options** | Prevents browsers from guessing file types (MIME sniffing) | `nosniff` |
| **X-Powered-By** | Hidden — attackers can't see we use Express | Removed entirely |
| **Referrer-Policy** | Controls what info is sent when clicking links | Don't send referrer on HTTP downgrade |
| **frame-ancestors 'none'** | Modern clickjacking protection via CSP | No origin can frame our pages |

---

## Input Validation & Sanitization

Every user input is validated before being processed. This prevents injection attacks (SQL injection, XSS, command injection).

### Search Queries
- Only allows: letters (including Polish characters ąćęłńóśźż), numbers, spaces, and hyphens
- Strips ALL other characters (HTML tags, script tags, SQL keywords, special chars)
- Truncated to maximum 100 characters
- Example: `<script>alert('xss')</script>` → `scriptalertxssscript`

### Shelter IDs
- Must be a positive integer within safe range (1 to 2,147,483,647)
- Rejects: decimals, negative numbers, strings, extremely large numbers
- Returns 400 Bad Request for invalid IDs

### URL Validation
- Backend: only allows `http://`, `https://`, and `data:` schemes
- Blocks `javascript:`, `vbscript:`, `file:` and other dangerous schemes
- Frontend: additional `safeUrl()` function that returns `#` for any non-http(s) URL
- Prevents XSS via malicious links in shelter suggestions

### Terminal Injection Protection
- `stripControlChars()` removes ANSI escape sequences and control characters
- Applied before logging any external data
- Prevents attackers from injecting terminal commands via crafted input

---

## Authentication & Access Control

### Admin Authentication
- Password stored in environment variable (never in code or committed files)
- Password comparison uses **timing-safe** algorithm (prevents timing attacks that could guess the password character by character)
- Successful login returns an **HMAC-SHA256 signed token** — cryptographically verifiable
- Token format: `admin:{timestamp}:{signature}` (Base64 encoded)
- All admin endpoints require valid Bearer token

### Brute Force Protection
- **5 failed login attempts** → IP is locked out for **15 minutes**
- Counter resets after successful login
- Counter resets after lockout period expires
- Response always says "Unauthorized" (no hints about whether username or password is wrong)

---

## Rate Limiting

| Endpoint | Limit | Window | Purpose |
|----------|-------|--------|---------|
| Admin login | 5 attempts | 15 minutes | Prevent password guessing |
| Stray reports | 3 reports | 24 hours | Prevent spam submissions |

Localhost IPs are exempt from stray report limits (for development).

---

## CORS (Cross-Origin Resource Sharing)

The API only accepts requests from the configured frontend origin:
- **Allowed origin**: The specific frontend URL (not `*`)
- **Allowed methods**: GET, POST, DELETE only
- **Allowed headers**: Content-Type, Accept, Authorization only

This means random websites cannot make requests to our API on behalf of users.

---

## Data Privacy

| Data type | Personal info? | How we handle it |
|-----------|---------------|-----------------|
| Cat listings | No (public data) | Scraped from public shelter websites |
| Shelter info | No (public data) | From public registry API |
| Stray reports | Minimal (approximate GPS) | Locations are intentionally imprecise |
| Suggestions | Optional email | Only visible to admin, can be deleted |
| Admin password | Yes | Stored in env var, never exposed |

**We do NOT:**
- Create user accounts
- Store personal information
- Use cookies or tracking
- Send data to third parties
- Collect analytics

---

## Infrastructure Security

### HTTPS (SSL/TLS)
- All traffic is encrypted via HTTPS (SSL certificate from Let's Encrypt)
- HTTP automatically redirects to HTTPS
- HSTS header ensures browsers never downgrade to HTTP

### Nginx Reverse Proxy
- SSL termination at Nginx layer
- Security headers forwarded from Express (`proxy_pass_header` directives)
- WebSocket support for development hot-reload

### Graceful Shutdown
- On SIGTERM/SIGINT: stops accepting new connections
- Waits up to 10 seconds for active requests to complete
- Then gracefully closes all remaining connections
- Prevents data corruption from abrupt termination

### Atomic File Writes
- Data export uses write-to-temp-file + rename pattern
- If the write fails mid-way, the original file remains intact
- No partial/corrupted JSON files served to users

---

## Dependency Security

- All GitHub Actions use **pinned SHA hashes** (not version tags) — prevents supply chain attacks
- `actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683` instead of `actions/checkout@v4`
- Production dependencies are minimal and well-maintained:
  - Express 5 (official release)
  - Helmet 8 (security-focused middleware)
  - Temporal.io (enterprise-grade workflow engine)
  - better-sqlite3 (widely audited native module)
  - Cheerio (HTML parsing, no browser engine)

---

## CI/CD Security

- Deployment credentials stored in GitHub Secrets (encrypted at rest)
- SSH key authentication (no passwords)
- `persist-credentials: false` on checkout (prevents token leakage)
- Deploy only triggers on push to `main` branch
- CI runs tests and type-checking before deploy is allowed

---

## Security Fixes Applied During Development

### Fix: Missing Security Headers in Production (Nginx)

**Problem:** Aikido scanner reported that security headers set by Express/Helmet were not reaching end users because Nginx was stripping them during proxying.

**Impact:** Risk scores of 91 (CSP), 89 (HSTS), and 50 (frame protection) from Aikido.

**Fix:**
1. Added `proxy_pass_header` directives to Nginx config for all security headers
2. Added `frameAncestors: ["'none'"]` to Express Helmet CSP config
3. Documented Nginx reload procedure

**Verification:** Property-based tests confirm all security headers are present on every response path.

---

## Testing Security Properties

The project uses **property-based testing** to mathematically verify security properties hold for ALL possible inputs (not just manually chosen test cases):

- **Bug condition test**: Verifies CSP contains `frame-ancestors 'none'` for any request path
- **Preservation tests**: Verifies all security headers remain intact after any code change
- **Validation tests**: Verifies input sanitization correctly strips dangerous characters for any input string
- **Auth tests**: Verifies admin endpoints reject all forged tokens

This testing approach provides much stronger guarantees than traditional unit tests because it automatically generates hundreds of edge cases.
