import { proxyActivities, executeChild } from "@temporalio/workflow";
import type { Cat } from "./db.js";

// Activity interfaces split by timeout group
interface FetchActivities {
  fetchAndSaveSheltersActivity(): Promise<{ id: number; url: string }[]>;
  scrapeCatsActivity(url: string, shelterId: number): Promise<Cat[]>;
}

interface SaveActivities {
  saveCatsActivity(shelterId: number, cats: Cat[]): Promise<void>;
  exportDataActivity(): Promise<{ shelters: number; cats: number }>;
}

// Scraper/fetch activities: 60s timeout, exponential backoff (1s base, coefficient 2)
const fetchActivities = proxyActivities<FetchActivities>({
  startToCloseTimeout: "60s",
  retry: {
    maximumAttempts: 3,
    initialInterval: "1s",
    backoffCoefficient: 2,
  },
});

// Save/export activities: 30s timeout, exponential backoff (1s base, coefficient 2)
const saveActivities = proxyActivities<SaveActivities>({
  startToCloseTimeout: "30s",
  retry: {
    maximumAttempts: 3,
    initialInterval: "1s",
    backoffCoefficient: 2,
  },
});

export async function parentSyncWorkflow(): Promise<void> {
  // Step 1: Fetch shelters from API and save to database
  const shelters = await fetchActivities.fetchAndSaveSheltersActivity();

  // Step 2: Start a child catScraperWorkflow for each shelter with a website
  const childWorkflows = shelters.map((shelter) =>
    executeChild(catScraperWorkflow, {
      args: [shelter.url, shelter.id],
      workflowId: `cat-scraper-${shelter.id}-${Date.now()}`,
      taskQueue: "shelter-sync",
    })
  );

  // Step 3: Await all child workflows before completing
  await Promise.all(childWorkflows);

  // Step 4: Export data from SQLite to JSON after all scrapers finish
  await saveActivities.exportDataActivity();
}

export async function catScraperWorkflow(url: string, shelterId: number): Promise<void> {
  // Step 1: Scrape cat data from the shelter website
  const cats = await fetchActivities.scrapeCatsActivity(url, shelterId);

  // Step 2: Save cats to database (even if empty array — clears stale data)
  await saveActivities.saveCatsActivity(shelterId, cats);
}
