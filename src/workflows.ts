import { proxyActivities, executeChild } from "@temporalio/workflow";
import type { Cat } from "./db.js";

// Activity interfaces for proxy
interface Activities {
  fetchAndSaveSheltersActivity(): Promise<{ id: number; url: string }[]>;
  scrapeCatsActivity(url: string, shelterId: number): Promise<Cat[]>;
  saveCatsActivity(shelterId: number, cats: Cat[]): Promise<void>;
}

const activities = proxyActivities<Activities>({
  startToCloseTimeout: "1 minute",
  retry: {
    maximumAttempts: 3,
  },
});

export async function parentSyncWorkflow(): Promise<void> {
  // Step 1: Fetch shelters from API and save to database
  const shelters = await activities.fetchAndSaveSheltersActivity();

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
}

export async function catScraperWorkflow(url: string, shelterId: number): Promise<void> {
  // Step 1: Scrape cat data from the shelter website
  const cats = await activities.scrapeCatsActivity(url, shelterId);

  // Step 2: Save cats to database (even if empty array — clears stale data)
  await activities.saveCatsActivity(shelterId, cats);
}
