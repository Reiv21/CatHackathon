# Requirements Document

## Introduction

This document specifies the requirements for the "Tactical Cat Frontend" — a React-based web application and REST API layer that serves as the presentation and access layer for the existing Shelter Sync Cat Scraper backend. The application adopts a "Wholesome World Domination" theme where cats are "agents" conquering territories (shelter locations across Poland). The UI is styled as a "Tactical Command Center" with dark-mode military aesthetics ("Operation Purrfect Storm"), featuring an interactive map view, search capabilities, and polished animations. A REST API layer exposes the SQLite data to the frontend, secured with industry-standard middleware.

## Glossary

- **Frontend_App**: The React + Vite single-page application that renders the Tactical Command Center UI
- **API_Server**: The Express.js HTTP server that exposes REST endpoints for shelter and cat data
- **Map_View**: The react-leaflet interactive map component displaying shelter locations across Poland ("World Domination View")
- **Agent_Database**: The search interface allowing users to find cats by name or shelter city
- **Agent_Profile_Card**: A styled card component displaying individual cat information in tactical/military style
- **Shelter_Pin**: A map marker representing a shelter location on the Map_View
- **Security_Layer**: The combination of helmet, CORS, and input validation middleware protecting the API_Server
- **Cat**: A record in the SQLite cats table representing a scraped cat listing (referred to as "Agent" in the UI)
- **Shelter**: A record in the SQLite shelters table representing an animal shelter (referred to as "Base" or "Station" in the UI)

## Requirements

### Requirement 1: REST API - List Shelters

**User Story:** As a frontend developer, I want a REST endpoint that returns all shelters with their cat counts, so that the map and UI can display shelter data.

#### Acceptance Criteria

1. WHEN a GET request is made to /api/shelters, THE API_Server SHALL return HTTP 200 with a JSON array of all shelters in the database, where each shelter object includes id_zewnetrzne, name, city, voivodeship, website_url, and a cat_count field representing the number of cat records associated with that shelter (a non-negative integer, 0 if the shelter has no cats)
2. WHEN a GET request is made to /api/shelters and the database contains no shelter records, THE API_Server SHALL return HTTP 200 with an empty JSON array
3. WHEN a GET request is made to /api/shelters, THE API_Server SHALL respond within 500ms for datasets up to 1000 shelters
4. IF the database is unreachable, THEN THE API_Server SHALL return HTTP 503 with a JSON error object containing a message field

### Requirement 2: REST API - Search Cats

**User Story:** As a user, I want to search for cats by name or shelter city, so that I can find specific agents in the database.

#### Acceptance Criteria

1. WHEN a GET request is made to /api/cats with a search query parameter, THE API_Server SHALL return a JSON array of up to 200 cats whose name matches the search term OR whose associated shelter city matches the search term (case-insensitive partial match using SQL LIKE with wildcards)
2. WHEN a GET request is made to /api/cats without a search parameter, THE API_Server SHALL return up to 200 cats with their associated shelter name and city
3. THE API_Server SHALL include shelter_name and shelter_city fields in each cat result object
4. WHEN the search query parameter is empty or whitespace-only, THE API_Server SHALL return all cats (up to 200)
5. IF the database is unreachable, THEN THE API_Server SHALL return HTTP 503 with a JSON error object containing a message field

### Requirement 3: REST API - Shelter Cats

**User Story:** As a user, I want to view all cats at a specific shelter, so that I can see which agents are stationed at a particular base.

#### Acceptance Criteria

1. WHEN a GET request is made to /api/shelters/:id/cats, THE API_Server SHALL return a JSON array of all cats belonging to the shelter with the specified id_zewnetrzne, where each cat object includes the fields defined in Requirement 12 criterion 3
2. IF the shelter ID does not exist in the database, THEN THE API_Server SHALL return HTTP 404 with a JSON error object containing a message field indicating the shelter was not found
3. IF the shelter ID parameter is not a positive integer, THEN THE API_Server SHALL return HTTP 400 with a JSON error object containing a message field indicating invalid input
4. WHEN a GET request is made to /api/shelters/:id/cats and the shelter exists but has no cats, THE API_Server SHALL return HTTP 200 with an empty JSON array

### Requirement 4: Security Headers

**User Story:** As a security engineer, I want the API to use industry-standard security headers, so that the application passes Aikido security scans.

#### Acceptance Criteria

1. THE API_Server SHALL apply helmet middleware to all responses to set security headers including X-Content-Type-Options: nosniff, X-Frame-Options: DENY, and Strict-Transport-Security with a minimum max-age of 31536000 seconds
2. THE API_Server SHALL configure CORS to allow requests only from the configured frontend origin, permitting only GET methods and restricting headers to Content-Type and Accept
3. THE API_Server SHALL set Content-Security-Policy header with default-src 'none' and frame-ancestors 'none' directives to deny all content loading and framing on the API-only server
4. IF a request originates from an origin not matching the configured frontend origin, THEN THE API_Server SHALL omit CORS allow-origin headers from the response, causing the browser to block the request

### Requirement 5: Input Validation

**User Story:** As a security engineer, I want all user inputs to be validated and sanitized, so that the application is protected against injection attacks.

#### Acceptance Criteria

1. WHEN the search query parameter contains characters outside alphanumeric (a-z, A-Z, 0-9), spaces, hyphens, and Polish diacritics (ą, ć, ę, ł, ń, ó, ś, ź, ż and their uppercase equivalents), THE API_Server SHALL strip those characters before processing
2. WHEN the search query parameter exceeds 100 characters, THE API_Server SHALL truncate the input to 100 characters before processing
3. WHEN a shelter ID path parameter is provided, THE API_Server SHALL validate it as a positive integer not exceeding 2,147,483,647 before processing
4. IF the shelter ID path parameter fails validation, THEN THE API_Server SHALL return HTTP 400 with a JSON error object containing a message field, without executing any database query
5. WHEN the search query parameter contains only characters that are stripped by sanitization (resulting in an empty string after processing), THE API_Server SHALL treat the sanitized empty input as no search filter and return all cats

### Requirement 6: Map View

**User Story:** As a user, I want to see an interactive map of Poland with shelter locations, so that I can visually explore the "World Domination" status.

#### Acceptance Criteria

1. WHEN the Frontend_App loads the Map_View, THE Frontend_App SHALL render a react-leaflet map centered on Poland (approximately latitude 52.0, longitude 19.0, zoom level 6)
2. WHEN the Map_View has successfully fetched shelter data from the /api/shelters endpoint, THE Frontend_App SHALL display a Shelter_Pin for each shelter
3. WHEN a user clicks a Shelter_Pin, THE Frontend_App SHALL display a popup containing the shelter name and the number of agents (cats) stationed there
4. WHILE the Map_View is loading shelter data, THE Frontend_App SHALL display a loading indicator overlay on the map area
5. IF the Map_View fails to fetch shelter data from the /api/shelters endpoint, THEN THE Frontend_App SHALL display an error message indicating that shelter locations could not be loaded and SHALL allow the user to retry the request
6. WHEN a user clicks outside a Shelter_Pin popup or clicks the popup close control, THE Frontend_App SHALL dismiss the currently displayed popup

### Requirement 7: Agent Database Search

**User Story:** As a user, I want to search for cats by name or city, so that I can quickly locate specific agents.

#### Acceptance Criteria

1. THE Frontend_App SHALL render a search input field labeled "Agent Database" with placeholder text containing the words "name" and "city" to indicate searchable fields
2. WHEN a user types at least 2 characters in the search field, THE Frontend_App SHALL debounce the input for 300ms before sending a request to /api/cats?search=...
3. WHEN search results are returned, THE Frontend_App SHALL display up to 50 results as Agent_Profile_Card components
4. WHILE a search request is in progress, THE Frontend_App SHALL display a loading indicator
5. WHEN the search returns zero results, THE Frontend_App SHALL display a "No agents found" message
6. WHEN the search field is cleared or contains fewer than 2 characters, THE Frontend_App SHALL clear the displayed results and not send a search request
7. IF a search request fails due to a network error or non-2xx response, THEN THE Frontend_App SHALL display an error message indicating the search could not be completed and hide the loading indicator

### Requirement 8: Agent Profile Cards

**User Story:** As a user, I want to see cat information displayed as tactical agent cards, so that the experience matches the "Wholesome World Domination" theme.

#### Acceptance Criteria

1. THE Frontend_App SHALL render each Agent_Profile_Card with the cat name, description (truncated to 150 characters with an ellipsis if longer), image (when image_url is non-null), shelter name, and shelter city
2. WHEN a cat has no image_url, THE Frontend_App SHALL display a placeholder image with a cat silhouette, rendered at the same dimensions as a regular cat image
3. THE Frontend_App SHALL apply a dark-mode tactical styling to each Agent_Profile_Card including a border, subtle glow effect, and monospace font for the agent designation (name)
4. IF a cat's description field is empty or null, THEN THE Frontend_App SHALL display the text "No intel available" in place of the description

### Requirement 9: Dark Mode Tactical UI

**User Story:** As a user, I want the entire UI to have a dark, tactical/military aesthetic, so that the "Operation Purrfect Storm" theme is immersive and polished.

#### Acceptance Criteria

1. THE Frontend_App SHALL use a dark color palette (background colors below #1a1a2e) with accent colors in military green (#0f3460) and amber (#e94560) tones
2. THE Frontend_App SHALL use TailwindCSS for all styling with a custom dark theme configuration
3. THE Frontend_App SHALL apply smooth CSS transitions (duration 200-300ms) to interactive elements including buttons, cards, and map popups
4. THE Frontend_App SHALL display a header with the title "Operation Purrfect Storm" and a tactical-style subtitle

### Requirement 10: Frontend Build and Serving

**User Story:** As a developer, I want the frontend to be built with Vite and serveable from the API server, so that deployment is simple.

#### Acceptance Criteria

1. THE Frontend_App SHALL be built using Vite with React and TypeScript, producing output in the /frontend/dist directory
2. WHEN the Frontend_App is built for production, THE API_Server SHALL serve static files (JavaScript, CSS, images, fonts) from the /frontend/dist directory with correct Content-Type headers
3. WHEN a request is made to a path that does not start with /api/ and does not match a static file in /frontend/dist, THE API_Server SHALL respond with the contents of /frontend/dist/index.html to support client-side routing
4. IF the /frontend/dist/index.html file does not exist when a fallback route is requested, THEN THE API_Server SHALL return HTTP 404 with a JSON error object containing a message field indicating the frontend has not been built

### Requirement 11: README Documentation

**User Story:** As a hackathon judge, I want clear documentation explaining the project theme, architecture, and setup, so that I can evaluate the project quickly.

#### Acceptance Criteria

1. THE README.md SHALL contain a project overview section explaining the "Wholesome World Domination" theme and how cats are conquering territories through shelter adoption
2. THE README.md SHALL contain an architecture overview section with a text-based diagram (Mermaid or ASCII) showing the data flow between Temporal.io workflows, SQLite database, REST API, and React frontend
3. THE README.md SHALL contain setup instructions that include runnable shell commands for each step: Temporal server startup, worker process launch, and frontend development server launch
4. THE README.md SHALL contain a placeholder section for the Aikido Security Scan Report with a heading and a note indicating where the report will be inserted
5. THE README.md SHALL list the technology stack including Temporal.io, React, Vite, TailwindCSS, Leaflet, Express.js, SQLite, and helmet
6. THE README.md SHALL organize content under markdown headings so that each major section (overview, architecture, setup, technology stack, security report) is navigable from a table of contents or by scrolling

### Requirement 12: API Response Format Consistency

**User Story:** As a frontend developer, I want consistent API response formats, so that the frontend can reliably parse responses.

#### Acceptance Criteria

1. THE API_Server SHALL return all successful responses with Content-Type application/json
2. THE API_Server SHALL return all error responses as JSON objects containing a "message" field of type string, and SHALL return an appropriate HTTP status code in the 4xx or 5xx range
3. WHEN the API_Server returns a list of cats, THE API_Server SHALL return a JSON array at the root level where each cat object includes the fields: id (integer), name (string), description (string), image_url (string or null), shelter_id (integer), shelter_name (string), and shelter_city (string)
4. WHEN the API_Server returns a list of shelters, THE API_Server SHALL return a JSON array at the root level where each shelter object includes the fields: id_zewnetrzne (integer), name (string), city (string), voivodeship (string), website_url (string or null), and cat_count (non-negative integer)
5. WHEN a field has no value, THE API_Server SHALL represent it as JSON null rather than omitting the field from the object, ensuring all documented fields are always present in every response object
