# Bugfix Requirements Document

## Introduction

The Aikido security scanner reports three missing security headers on https://mrucznik.serwerigora.com despite the Express server (src/server.ts) correctly configuring helmet with CSP, HSTS, and frame-ancestors directives. The root cause is that the Nginx reverse proxy — which terminates SSL and serves as the edge server — does not forward or emit these security headers. The Nginx config (documented in DEPLOY.md) only performs a basic `proxy_pass` without `proxy_pass_header` directives or its own `add_header` statements.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN a client requests any page via the Nginx reverse proxy on https://mrucznik.serwerigora.com THEN the response does not include a Content-Security-Policy header (Aikido risk score: 91)

1.2 WHEN a client requests any page via the Nginx reverse proxy on https://mrucznik.serwerigora.com THEN the response does not include a Strict-Transport-Security header (Aikido risk score: 89)

1.3 WHEN a client requests any page via the Nginx reverse proxy on https://mrucznik.serwerigora.com THEN the response does not include a X-Frame-Options or CSP frame-ancestors header (Aikido risk score: 50)

### Expected Behavior (Correct)

2.1 WHEN a client requests any page via the Nginx reverse proxy on https://mrucznik.serwerigora.com THEN the system SHALL include a Content-Security-Policy header matching the policy defined in src/server.ts (default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' fonts.googleapis.com unpkg.com; font-src 'self' fonts.gstatic.com; img-src 'self' data: https: http:; connect-src 'self'; frame-src 'none')

2.2 WHEN a client requests any page via the Nginx reverse proxy on https://mrucznik.serwerigora.com THEN the system SHALL include a Strict-Transport-Security header with max-age=31536000 and includeSubDomains

2.3 WHEN a client requests any page via the Nginx reverse proxy on https://mrucznik.serwerigora.com THEN the system SHALL include a Content-Security-Policy header containing "frame-ancestors 'none'" OR an X-Frame-Options: DENY header to prevent clickjacking

### Unchanged Behavior (Regression Prevention)

3.1 WHEN a client accesses the application via localhost (development mode without Nginx) THEN the system SHALL CONTINUE TO serve correct security headers directly from Express/helmet

3.2 WHEN a client makes API requests (e.g., /api/cats, /api/shelters) via the Nginx proxy THEN the system SHALL CONTINUE TO return correct JSON responses with appropriate CORS headers

3.3 WHEN a client loads the React frontend via the Nginx proxy THEN the system SHALL CONTINUE TO serve static assets (JS, CSS, images) without being blocked by the CSP policy

3.4 WHEN map tiles and external resources (Google Fonts, Leaflet from unpkg) are loaded by the frontend THEN the system SHALL CONTINUE TO load successfully under the CSP policy
