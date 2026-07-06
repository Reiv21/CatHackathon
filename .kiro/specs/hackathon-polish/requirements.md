# Requirements Document

## Introduction

Dokument wymagań dla finalnego "polerowania" projektu Mrucznik 🐱 na hackathon "Światowy Dzień Kociej Dominacji" (World Cat Domination Day). Celem jest maksymalizacja punktów w 6 kategoriach oceny: Technical Execution (Temporal), Innovation & Creativity, Theme Relevance, Documentation, Security i UX/UI. Zmiany obejmują pełną integrację Temporal do aktualizacji bazy danych, elementy tematyczne gamifikacji "kociej dominacji", profesjonalny README, hardening bezpieczeństwa, oraz usprawnienia UX/UI.

## Glossary

- **API_Server**: Serwer Express.js obsługujący endpointy REST i serwujący frontend
- **Temporal_Worker**: Proces Node.js uruchamiający Temporal Worker nasłuchujący na task queue "shelter-sync"
- **Temporal_Client**: Moduł inicjujący workflow synchronizacji przez Temporal SDK
- **Parent_Sync_Workflow**: Workflow Temporal orkiestrujący scraping schronisk — najpierw pobiera listę schronisk, potem uruchamia child workflow dla każdego
- **Cat_Scraper_Workflow**: Child workflow Temporal scrapujący koty z jednego schroniska i zapisujący do bazy
- **Domination_Tracker**: Komponent UI wyświetlający postęp "kociej dominacji" — procent pokrycia schronisk w Polsce
- **Cat_Army_Counter**: Animowany licznik kotów w bazie, prezentowany jako "armia kotów"
- **Health_Check_Endpoint**: Endpoint HTTP zwracający status gotowości serwera i połączeń
- **CSP**: Content Security Policy — nagłówki HTTP ograniczające źródła zasobów
- **SQLite_DB**: Baza danych SQLite (better-sqlite3) w trybie WAL przechowująca schroniska i koty
- **README_Doc**: Plik README.md w repozytorium zawierający dokumentację projektu
- **Security_Report**: Dokument SECURITY.md opisujący praktyki bezpieczeństwa projektu

## Requirements

### Requirement 1: Wyzwalanie synchronizacji przez Temporal

**User Story:** Jako administrator, chcę wyzwalać synchronizację danych schronisk przez Temporal, aby proces był niezawodny, obserwowalny i automatycznie ponawiany przy błędach.

#### Acceptance Criteria

1. WHEN an authenticated administrator sends a POST request to `/api/admin/sync`, THE API_Server SHALL start a new Parent_Sync_Workflow execution via Temporal_Client, respond with HTTP 200 containing the workflow ID within 5 seconds, and return control to the caller without waiting for workflow completion
2. IF the API_Server cannot connect to Temporal when processing a sync request, THEN THE API_Server SHALL respond with HTTP 503 and an error message indicating that the workflow engine is unavailable
3. WHEN the Parent_Sync_Workflow starts, THE Temporal_Worker SHALL execute fetchAndSaveSheltersActivity to retrieve shelter data from the external shelter registry API and persist it to SQLite_DB
4. WHEN fetchAndSaveSheltersActivity completes successfully, THE Parent_Sync_Workflow SHALL launch a Cat_Scraper_Workflow child workflow for each shelter that has a non-null website URL
5. IF a Cat_Scraper_Workflow activity fails, THEN THE Temporal_Worker SHALL retry the activity up to 3 times with exponential backoff starting at 1 second, with a start-to-close timeout of 60 seconds per attempt
6. WHEN all Cat_Scraper_Workflow child workflows complete (including those that failed after exhausting retries), THE Parent_Sync_Workflow SHALL execute an export activity that writes updated shelter and cat data from SQLite_DB to JSON files in the data/ directory used by the API_Server

### Requirement 2: Eksport danych z SQLite do JSON po synchronizacji

**User Story:** Jako system, chcę automatycznie eksportować dane z SQLite_DB do plików JSON po zakończeniu synchronizacji, aby API_Server serwował aktualne dane bez zmian w obecnych endpointach.

#### Acceptance Criteria

1. WHEN all Cat_Scraper_Workflow child workflows complete within Parent_Sync_Workflow, THE Temporal_Worker SHALL execute an export activity that queries SQLite_DB for all rows in the shelters table and all rows in the cats table joined with their corresponding shelter data
2. THE export activity SHALL write the shelter data to `data/shelters.json` as a JSON array where each object contains the fields: id_zewnetrzne, name, city, voivodeship, website_url, and cat_count (number of cats associated with the shelter), and SHALL write the cat data to `data/cats.json` as a JSON array where each object contains the fields: id, name, description, image_url, source_url, shelter_id, shelter_name, shelter_city, sex, and age
3. IF the export activity encounters a file system write error, THEN THE Temporal_Worker SHALL retry the export activity up to 3 times with a backoff interval of at least 1 second between attempts before marking the workflow as failed
4. THE export activity SHALL write both JSON files atomically such that if a write to either file fails, the previously existing files remain unchanged
5. WHEN the export activity completes successfully, THE Temporal_Worker SHALL log the count of exported shelters and cats

### Requirement 3: Status synchronizacji

**User Story:** Jako administrator, chcę sprawdzić status bieżącej synchronizacji, aby wiedzieć czy proces się zakończył lub napotkał problemy.

#### Acceptance Criteria

1. WHEN administrator sends a GET request to `/api/admin/sync/status` with a valid Bearer token, THE API_Server SHALL query Temporal for the most recent Parent_Sync_Workflow execution (matched by workflow ID prefix `shelter-sync-`) and return an HTTP 200 response
2. WHEN the most recent workflow is found, THE API_Server SHALL return a JSON object containing: status (one of: "running", "completed", "failed"), start_time (ISO 8601 string), and completion_time (ISO 8601 string if status is "completed" or "failed", otherwise null)
3. IF no workflow has been executed, THEN THE API_Server SHALL return an HTTP 200 response with a JSON object containing status "never_run" and null values for start_time and completion_time
4. IF the request does not include a valid Bearer token, THEN THE API_Server SHALL return an HTTP 401 response with a JSON error message indicating unauthorized access
5. IF the Temporal server is unreachable when querying workflow status, THEN THE API_Server SHALL return an HTTP 503 response with a JSON error message indicating that the sync status is temporarily unavailable

### Requirement 4: Domination Progress Tracker

**User Story:** Jako użytkownik, chcę widzieć postęp "kociej dominacji" nad Polską, aby poczuć się częścią tematycznej zabawy hackathonowej.

#### Acceptance Criteria

1. THE API_Server SHALL expose a GET `/api/domination` endpoint returning the domination progress as a JSON object with fields: total_shelters_in_poland (integer, fixed value of 190), shelters_covered (integer, count of shelters in data/shelters.json that have at least 1 cat in data/cats.json), percentage (float 0.00–100.00, rounded to 2 decimal places, calculated as shelters_covered / total_shelters_in_poland * 100), cats_in_army (integer, total number of cat records in data/cats.json), and domination_level (string)
2. WHEN percentage is in range 0 to 24.99, THE API_Server SHALL set domination_level to "Kocie Zwiadowcy"
3. WHEN percentage is in range 25.00 to 49.99, THE API_Server SHALL set domination_level to "Kocia Partyzantka"
4. WHEN percentage is in range 50.00 to 74.99, THE API_Server SHALL set domination_level to "Kocia Ofensywa"
5. WHEN percentage is in range 75.00 to 100.00, THE API_Server SHALL set domination_level to "Pełna Kocia Dominacja"
6. THE Domination_Tracker SHALL display a progress bar that visually fills to the current percentage, the domination_level title, and the cats_in_army count on the home page
7. IF data/shelters.json or data/cats.json is missing or unreadable, THEN THE API_Server SHALL return the domination JSON with total_shelters_in_poland set to 190, shelters_covered set to 0, percentage set to 0, cats_in_army set to 0, and domination_level set to "Kocie Zwiadowcy"
8. WHEN the `/api/domination` endpoint receives a request, THE API_Server SHALL respond within 500 milliseconds

### Requirement 5: Cat Army Counter z animacją

**User Story:** Jako użytkownik, chcę widzieć animowany licznik "kociej armii" rosnący od zera do aktualnej liczby kotów, aby strona była wizualnie angażująca.

#### Acceptance Criteria

1. WHEN the home page loads and the /api/domination endpoint returns a successful response, THE Cat_Army_Counter SHALL animate from 0 to the current cats_in_army value over 2 seconds using an ease-out easing function
2. THE Cat_Army_Counter SHALL display the count as a whole integer with locale-appropriate thousands separators, preceded by a cat emoji (🐱) and followed by the label "Kocia Armia" when active language is PL or "Cat Army" when active language is EN
3. WHILE the animation is in progress, THE Cat_Army_Counter SHALL update the displayed number at least 30 times per second
4. IF the /api/domination endpoint fails or does not respond within 5 seconds, THEN THE Cat_Army_Counter SHALL display the cat emoji (🐱) and localized label with the count shown as "0"

### Requirement 6: Tematyczne elementy UI "World Cat Domination Day"

**User Story:** Jako użytkownik, chcę widzieć spójne elementy tematyczne "Dnia Kociej Dominacji" w interfejsie, aby doświadczenie było unikalne i zgodne z tematem hackathonu.

#### Acceptance Criteria

1. THE Home component SHALL display a banner section with the title "Światowy Dzień Kociej Dominacji" and a subtitle stating "Katalogujemy wszystkie koty do adopcji w Polsce" positioned above the existing hero content
2. THE API_Server SHALL expose a GET `/api/achievements` endpoint that returns a JSON array of achievement objects, where each object contains: name (string), description (string), icon (string emoji), and unlocked_at (ISO 8601 timestamp of when the threshold was first met, calculated as the current server time if met on this request)
3. IF the total number of cats in the data store is at least 100, THEN THE API_Server SHALL include a "Pierwsza Setka" achievement in the achievements response
4. IF the number of distinct shelters that have at least 1 cat in the data store is at least 10, THEN THE API_Server SHALL include a "10 Schronisk" achievement in the achievements response
5. IF the number of distinct voivodeships represented by shelters in the data store equals 16, THEN THE API_Server SHALL include a "Pełna Dominacja" achievement in the achievements response
6. IF no achievement thresholds are met, THEN THE API_Server SHALL return an empty JSON array from the `/api/achievements` endpoint
7. THE Home component SHALL display unlocked achievements returned from `/api/achievements` as badges showing the icon and name in a section titled "Odznaki Dominacji", and SHALL hide the section entirely when the achievements array is empty
8. IF the request to `/api/achievements` fails, THEN THE Home component SHALL hide the "Odznaki Dominacji" section without displaying an error message to the user

### Requirement 7: README profesjonalny z diagramami architektury

**User Story:** Jako juror hackathonu, chcę przeczytać profesjonalny README z diagramami Mermaid, aby szybko zrozumieć architekturę i jakość projektu.

#### Acceptance Criteria

1. THE README_Doc SHALL contain an architecture overview section with a valid Mermaid diagram (parseable by GitHub's Mermaid renderer) showing the data flow from scraping (Cheerio) through Temporal orchestration to SQLite_DB (better-sqlite3) to JSON export to API_Server (Express) to Frontend (React/Vite), where each node in the diagram includes the technology name in parentheses
2. THE README_Doc SHALL contain a setup section with numbered step-by-step instructions for local development including: prerequisites with exact version requirements (Node.js 20+, Temporal server), dependency installation commands for both backend and frontend, environment variable configuration referencing .env.example, and a verification command that confirms successful setup
3. THE README_Doc SHALL contain a deployment section describing production setup including: a list of all required environment variables with descriptions, build commands for backend and frontend, and instructions for running the API server and Temporal worker as background processes
4. THE README_Doc SHALL contain a security section that links to the Security_Report document and lists at minimum the input sanitization, HTTP security headers (helmet), and CORS configuration measures applied in the project
5. THE README_Doc SHALL contain a technology stack section listing all runtime and development dependencies (as declared in root and frontend package.json files) grouped by function (scraping, API, data, frontend, testing, orchestration) with a one-line purpose description for each
6. THE README_Doc SHALL contain a contributing section with code style guidelines (linter/formatter configuration) and PR process (branch naming, review requirements)
7. WHEN the README_Doc is rendered on GitHub, THE README_Doc SHALL display all Mermaid diagrams as visual graphics without syntax errors, verifiable by absence of Mermaid parse-error blocks in rendered output
8. THE README_Doc SHALL contain a project description section within the first 5 lines that states the project name, a one-sentence summary of its purpose, and the hackathon theme ("World Cat Domination Day")

### Requirement 8: Security Report (SECURITY.md)

**User Story:** Jako juror hackathonu, chcę przeczytać raport bezpieczeństwa, aby ocenić świadomość i praktyki bezpieczeństwa zespołu.

#### Acceptance Criteria

1. THE Security_Report SHALL document all applied security headers (helmet configuration, CSP directives) with explanations of their purpose
2. THE Security_Report SHALL document input validation practices including the sanitizeSearchQuery and validateShelterId functions
3. THE Security_Report SHALL document rate limiting mechanisms (login brute force protection, stray report limits)
4. THE Security_Report SHALL document authentication approach and its known limitations
5. THE Security_Report SHALL document data handling practices including what data is collected and how it is stored
6. THE Security_Report SHALL include a section on future security improvements (JWT tokens, HTTPS enforcement, Aikido integration)

### Requirement 9: Hardening CSP i security headers

**User Story:** Jako deweloper, chcę wzmocnić nagłówki bezpieczeństwa, aby aplikacja była odporna na typowe ataki webowe.

#### Acceptance Criteria

1. THE API_Server SHALL configure CSP connectSrc directive to allow connections only to 'self' and the Temporal server address read from the TEMPORAL_ADDRESS environment variable (defaulting to localhost:7233 if not set)
2. THE API_Server SHALL set X-Content-Type-Options to "nosniff" via helmet configuration
3. THE API_Server SHALL set Strict-Transport-Security header with max-age of 31536000 seconds and includeSubDomains directive
4. THE API_Server SHALL remove the X-Powered-By header from all HTTP responses
5. IF a request to any `/api/admin/*` endpoint does not contain an Authorization header with a Bearer token that matches the token previously issued by the login endpoint, THEN THE API_Server SHALL return HTTP 401 with a JSON body containing a generic error message (e.g., "Unauthorized") and SHALL NOT include stack traces, internal file paths, or server configuration details in the response
6. IF the TEMPORAL_ADDRESS environment variable contains a value that is not a valid host:port format, THEN THE API_Server SHALL fall back to allowing connectSrc only for 'self'

### Requirement 10: Health Check Endpoint

**User Story:** Jako system produkcyjny, chcę mieć endpoint health check, aby monitoring mógł weryfikować dostępność serwera.

#### Acceptance Criteria

1. WHEN a GET request is sent to `/api/health`, THE API_Server SHALL return HTTP 200 with a JSON object containing status "ok", uptime in seconds, and timestamp
2. THE Health_Check_Endpoint SHALL respond within 100ms under normal operating conditions
3. IF the data directory is inaccessible, THEN THE Health_Check_Endpoint SHALL return HTTP 503 with status "degraded" and a description of the issue

### Requirement 11: Graceful Shutdown

**User Story:** Jako proces produkcyjny, chcę obsługiwać sygnały zamknięcia graceful, aby nie przerywać aktywnych requestów przy restarcie.

#### Acceptance Criteria

1. WHEN the API_Server process receives a SIGTERM or SIGINT signal, THE API_Server SHALL stop accepting new TCP connections and log a message indicating that graceful shutdown has been initiated
2. WHEN the API_Server process receives a shutdown signal, THE API_Server SHALL allow currently in-flight HTTP requests to complete their response cycle within a maximum of 10 seconds before terminating the process
3. IF the 10-second graceful shutdown timeout expires while connections remain open, THEN THE API_Server SHALL force-close all remaining connections and exit with code 0
4. IF the API_Server receives a second SIGTERM or SIGINT signal while a graceful shutdown is already in progress, THEN THE API_Server SHALL immediately force-close all connections and exit with code 1
5. WHEN all in-flight requests complete before the 10-second timeout expires, THE API_Server SHALL exit with code 0

### Requirement 12: Usprawnienia UX — loading states i skeleton screens

**User Story:** Jako użytkownik, chcę widzieć czytelne stany ładowania zamiast pustego ekranu, aby wiedzieć że aplikacja pracuje.

#### Acceptance Criteria

1. WHILE data is being fetched from the API_Server, THE CatSearch component SHALL display skeleton placeholder cards in the same grid layout as actual cat cards, where each skeleton card preserves the dimensions of the image area (208px height), name line, metadata tags, and shelter info line, rendering a minimum of 6 skeleton cards or the page size (24), whichever is smaller
2. WHILE data is being fetched from the API_Server, THE Home component SHALL display skeleton placeholders for the three statistics boxes (maintaining rounded-2xl card dimensions) and a skeleton placeholder for the cat of the day image area (320px height) with name and location lines
3. IF an API request returns an HTTP error status (4xx or 5xx), a network error, or does not respond within 15 seconds, THEN THE affected component SHALL display an inline error message indicating the nature of the failure, along with a retry button, while preserving any previously loaded data in other sections of the same page
4. WHEN the retry button is clicked, THE component SHALL re-fetch the failed request and display the same skeleton loading state as the initial load in place of the error message
5. IF a retry request also fails, THEN THE component SHALL display the inline error message with the retry button again, allowing unlimited retry attempts

### Requirement 13: Accessibility improvements (WCAG 2.1 AA)

**User Story:** Jako użytkownik korzystający z czytnika ekranu, chcę aby aplikacja była dostępna, aby mógł z niej korzystać każdy.

#### Acceptance Criteria

1. THE Frontend SHALL use semantic HTML elements (nav, main, article, section, header, footer) for page structure, where the top-level layout contains exactly one `main` landmark, at least one `nav` landmark for primary navigation, and `header`/`footer` landmarks for the site header and footer
2. THE Frontend SHALL provide aria-label attributes on all interactive elements that lack visible text labels, including icon-only buttons (hamburger menu, close buttons, back-to-top), map markers, and language toggle buttons
3. THE Frontend SHALL maintain a color contrast ratio of at least 4.5:1 for normal text (below 18pt regular or 14pt bold) and at least 3:1 for large text (18pt regular or 14pt bold and above) and for non-text UI components (borders, icons, focus indicators) against their adjacent backgrounds
4. THE Frontend SHALL support keyboard navigation for all interactive elements in a logical DOM-based tab order, with visible focus indicators that have a minimum contrast ratio of 3:1 against the adjacent background
5. WHEN a page section updates dynamically (search results loading/updating, error messages appearing, or shelter selection changing displayed cats), THE Frontend SHALL use aria-live regions with appropriate politeness levels (polite for content updates, assertive for error messages) to announce changes to assistive technologies
6. WHEN the user navigates between views via hash-based routing, THE Frontend SHALL move focus to the main content heading or the main landmark of the newly rendered view within 500 milliseconds of the navigation event
7. THE Frontend SHALL provide descriptive alt text on all cat images (including the cat name and shelter city when available) and decorative images SHALL have an empty alt attribute
8. THE Frontend SHALL provide a text-based alternative for the map view so that users who cannot interact with the visual map can access the list of shelters and their locations via the sidebar panel or shelter search

### Requirement 14: Responsive design improvements

**User Story:** Jako użytkownik mobilny, chcę aby interfejs był w pełni responsywny i dotykowy, aby wygodnie przeglądać koty na telefonie.

#### Acceptance Criteria

1. THE Frontend SHALL display cat cards in a single-column layout on screens narrower than 640px, two-column on screens 640–1024px, and three-column on screens wider than 1024px
2. THE Frontend SHALL ensure all interactive elements (buttons, links, and form controls) have a minimum touch-target size of 44×44 CSS pixels on screens narrower than 768px
3. THE Frontend SHALL hide the desktop navigation and show a hamburger menu on screens narrower than 768px
4. WHILE the map view is active on screens narrower than 768px, THE MapView component SHALL occupy the full viewport height minus the fixed header height (3.5rem)
5. THE Frontend SHALL prevent horizontal scrolling on all viewport widths by ensuring no content overflows the viewport width
6. WHEN the hamburger menu button is tapped, THE Frontend SHALL toggle the mobile navigation menu between visible and hidden states

### Requirement 15: Build optimization for production

**User Story:** Jako deweloper, chcę zoptymalizować build produkcyjny, aby strona ładowała się szybko.

#### Acceptance Criteria

1. THE Frontend build SHALL produce chunked JavaScript bundles where all third-party dependencies from node_modules are placed in a separate vendor chunk, and no single output chunk exceeds 500 kB uncompressed
2. THE Frontend build SHALL generate filenames containing a content hash (minimum 8 characters) for all emitted JavaScript and CSS assets, excluding index.html
3. THE Frontend build SHALL generate gzip-compressed (.gz) versions of all JavaScript and CSS assets that exceed 1 kB in size
4. WHEN the API_Server serves a static file whose filename contains a content hash, THE API_Server SHALL include a Cache-Control header with the value "max-age=31536000, immutable"
5. WHEN the API_Server serves index.html, THE API_Server SHALL include a Cache-Control header with the value "no-cache"
