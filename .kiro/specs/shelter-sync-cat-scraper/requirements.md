# Requirements Document

## Introduction

This document defines the functional and non-functional requirements for the Shelter Sync with Cat Scraper system — a PoC backend that synchronizes animal shelter data from the otwarteschroniska.org.pl API into a local SQLite database, then orchestrates web scraping of cat listings from each shelter's website using Temporal.io workflows.

## Glossary

- **System**: The Shelter Sync Cat Scraper application as a whole
- **Shelter_API_Client**: The component responsible for fetching shelter data from the otwarteschroniska.org.pl API
- **Database_Layer**: The component managing SQLite connection, schema, and data access operations
- **Scraper**: The component that fetches and parses shelter websites to extract cat data using cheerio
- **Parent_Workflow**: The top-level Temporal workflow (parentSyncWorkflow) that orchestrates the full sync
- **Child_Workflow**: The per-shelter Temporal workflow (catScraperWorkflow) that handles scraping and saving cats
- **Worker**: The Temporal worker process that executes workflows and activities
- **Client**: The CLI entry point that triggers the parent sync workflow

## Requirements

### Requirement 1: Database Initialization

**User Story:** As a developer, I want the system to automatically create and initialize the SQLite database schema, so that data storage is ready without manual setup.

#### Acceptance Criteria

1. WHEN the database is initialized, THE Database_Layer SHALL create a `shelters` table with columns: id_zewnetrzne (INTEGER PRIMARY KEY), name (TEXT NOT NULL), website_url (TEXT), city (TEXT NOT NULL), voivodeship (TEXT NOT NULL), updated_at (TEXT DEFAULT datetime)
2. WHEN the database is initialized, THE Database_Layer SHALL create a `cats` table with columns: id (INTEGER PRIMARY KEY AUTOINCREMENT), shelter_id (INTEGER NOT NULL FOREIGN KEY), name (TEXT NOT NULL), description (TEXT DEFAULT ''), image_url (TEXT), scraped_at (TEXT DEFAULT datetime)
3. WHEN the database is initialized, THE Database_Layer SHALL create an index idx_cats_shelter on cats(shelter_id)
4. IF the database file does not exist, THEN THE Database_Layer SHALL create it at the specified path

### Requirement 2: Shelter Data Fetching

**User Story:** As a system operator, I want the system to fetch shelter data from the otwarteschroniska.org.pl API, so that I have an up-to-date list of shelters to scrape.

#### Acceptance Criteria

1. WHEN fetchSheltersFromApi is invoked, THE Shelter_API_Client SHALL send an HTTP GET request to the otwarteschroniska.org.pl API endpoint
2. WHEN the API returns a successful response, THE Shelter_API_Client SHALL parse the JSON body into an array of ApiShelter objects with fields: id, nazwa, miasto, województwo, strona_www
3. IF the API returns a non-200 HTTP status, THEN THE Shelter_API_Client SHALL throw an error containing the HTTP status code and a descriptive message
4. IF a network timeout occurs, THEN THE Shelter_API_Client SHALL throw an error with a descriptive timeout message

### Requirement 3: Shelter Data Persistence

**User Story:** As a developer, I want shelter data to be upserted into the local database, so that new shelters are added and existing shelters are updated without duplicates.

#### Acceptance Criteria

1. WHEN upsertShelters is called with an array of shelters, THE Database_Layer SHALL insert new shelters that do not exist (by id_zewnetrzne)
2. WHEN upsertShelters is called with an array of shelters, THE Database_Layer SHALL update existing shelters (matched by id_zewnetrzne) with the new data
3. WHEN a shelter is upserted, THE Database_Layer SHALL refresh the updated_at timestamp to the current datetime
4. WHEN upsertShelters completes, THE Database_Layer SHALL ensure the total shelter count in the database is greater than or equal to the input array length
5. WHEN upsertShelters is called with the same data twice, THE Database_Layer SHALL produce an identical database state (idempotent operation)

### Requirement 4: Shelter Website Query

**User Story:** As a workflow orchestrator, I want to query only shelters that have a website URL, so that scraping is only attempted on shelters with known web pages.

#### Acceptance Criteria

1. WHEN getSheltersWithWebsite is called, THE Database_Layer SHALL return only shelters where website_url is not null and not empty
2. WHEN getSheltersWithWebsite is called, THE Database_Layer SHALL return Shelter objects with all fields correctly mapped (id_zewnetrzne, name, website_url, city, voivodeship)

### Requirement 5: Cat Scraping

**User Story:** As a data consumer, I want the system to scrape cat listings from shelter websites, so that I have structured cat data from each shelter.

#### Acceptance Criteria

1. WHEN scrapeCatsActivity is called with a valid URL and shelter ID, THE Scraper SHALL send an HTTP GET request to the shelter website
2. WHEN the HTML response is received, THE Scraper SHALL parse it using cheerio and extract cat data (name, description, image_url)
3. WHEN cats are extracted, THE Scraper SHALL return an array of Cat objects where each cat has a non-empty name
4. IF the shelter website is unreachable, THEN THE Scraper SHALL return an empty array without throwing an error
5. IF the HTML structure does not match expected selectors, THEN THE Scraper SHALL return an empty array without throwing an error

### Requirement 6: Cat Data Persistence

**User Story:** As a developer, I want scraped cat data to be saved to the database, so that the latest scrape results replace previous data for each shelter.

#### Acceptance Criteria

1. WHEN saveCats is called for a shelter, THE Database_Layer SHALL remove all previously stored cats for that shelter_id
2. WHEN saveCats is called with an array of cats, THE Database_Layer SHALL insert all provided cat records with the given shelter_id
3. WHEN saveCats completes, THE Database_Layer SHALL ensure the cat count for the given shelter equals the input array length
4. WHEN saveCats is called with an empty array, THE Database_Layer SHALL remove all existing cats for that shelter and store zero cats

### Requirement 7: Parent Sync Workflow Orchestration

**User Story:** As a system operator, I want a parent workflow that orchestrates the full sync process, so that shelter fetching and cat scraping are reliably coordinated.

#### Acceptance Criteria

1. WHEN parentSyncWorkflow is executed, THE Parent_Workflow SHALL first invoke fetchAndSaveSheltersActivity to fetch and persist shelter data
2. WHEN fetchAndSaveSheltersActivity completes, THE Parent_Workflow SHALL start a child catScraperWorkflow for each shelter that has a website URL
3. WHEN child workflows are started, THE Parent_Workflow SHALL wait for all child workflows to complete before finishing
4. IF fetchAndSaveSheltersActivity fails after retries, THEN THE Parent_Workflow SHALL propagate the failure

### Requirement 8: Cat Scraper Child Workflow

**User Story:** As a workflow orchestrator, I want a per-shelter child workflow that handles scraping and saving cats, so that each shelter is processed independently with its own retry logic.

#### Acceptance Criteria

1. WHEN catScraperWorkflow is executed with a URL and shelter ID, THE Child_Workflow SHALL invoke scrapeCatsActivity to extract cat data
2. WHEN scrapeCatsActivity returns cat data, THE Child_Workflow SHALL invoke saveCatsActivity to persist the data
3. IF scrapeCatsActivity returns an empty array, THEN THE Child_Workflow SHALL still invoke saveCatsActivity with the empty array

### Requirement 9: Temporal Worker Setup

**User Story:** As a system administrator, I want a worker process that registers and executes workflows and activities, so that the Temporal task queue is properly served.

#### Acceptance Criteria

1. WHEN the worker starts, THE Worker SHALL connect to the Temporal server at the configured address
2. WHEN connected, THE Worker SHALL register all workflows (parentSyncWorkflow, catScraperWorkflow) and all activities (fetchAndSaveSheltersActivity, scrapeCatsActivity, saveCatsActivity)
3. WHEN registered, THE Worker SHALL listen on the "shelter-sync" task queue for incoming tasks
4. IF the Temporal server is unreachable, THEN THE Worker SHALL throw a connection error with a descriptive message

### Requirement 10: CLI Client Entry Point

**User Story:** As a developer, I want a CLI entry point that triggers the sync workflow, so that I can start the synchronization process on demand.

#### Acceptance Criteria

1. WHEN the client is executed, THE Client SHALL connect to the Temporal server
2. WHEN connected, THE Client SHALL start a parentSyncWorkflow execution with a unique workflow ID
3. WHEN the workflow is started, THE Client SHALL log the workflow ID to the console
4. WHEN the workflow completes, THE Client SHALL log the completion result to the console
5. IF the Temporal server is unreachable, THEN THE Client SHALL log an error message and exit with a non-zero code

### Requirement 11: Activity Retry Behavior

**User Story:** As a system operator, I want activities to be retried on transient failures, so that temporary network issues do not cause permanent sync failures.

#### Acceptance Criteria

1. THE Parent_Workflow SHALL configure fetchAndSaveSheltersActivity with a retry policy of maximum 3 attempts with exponential backoff
2. THE Child_Workflow SHALL configure scrapeCatsActivity with a retry policy of maximum 3 attempts with exponential backoff
3. WHEN an activity exceeds its maximum retry attempts, THE System SHALL mark the activity as permanently failed

### Requirement 12: Data Integrity

**User Story:** As a data consumer, I want the database to maintain referential integrity and correct data mapping, so that I can trust the stored data.

#### Acceptance Criteria

1. THE Database_Layer SHALL enforce a foreign key relationship between cats.shelter_id and shelters.id_zewnetrzne
2. WHEN shelter data is fetched from the API, THE System SHALL correctly map API fields (nazwa→name, miasto→city, województwo→voivodeship, strona_www→website_url)
3. FOR ALL shelters stored in the database, THE Database_Layer SHALL ensure the name field is non-empty
4. FOR ALL cats stored in the database, THE Database_Layer SHALL ensure the name field is non-empty
