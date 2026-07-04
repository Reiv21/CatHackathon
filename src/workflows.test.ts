import { describe, it, expect, vi, beforeEach } from "vitest";

// Use vi.hoisted to ensure mock functions are available when vi.mock factory runs
const {
  mockFetchAndSaveSheltersActivity,
  mockScrapeCatsActivity,
  mockSaveCatsActivity,
  mockExecuteChild,
} = vi.hoisted(() => ({
  mockFetchAndSaveSheltersActivity: vi.fn(),
  mockScrapeCatsActivity: vi.fn(),
  mockSaveCatsActivity: vi.fn(),
  mockExecuteChild: vi.fn(),
}));

vi.mock("@temporalio/workflow", () => {
  return {
    proxyActivities: () => ({
      fetchAndSaveSheltersActivity: mockFetchAndSaveSheltersActivity,
      scrapeCatsActivity: mockScrapeCatsActivity,
      saveCatsActivity: mockSaveCatsActivity,
    }),
    executeChild: (...args: unknown[]) => mockExecuteChild(...args),
  };
});

// Import workflows after mocking
import { parentSyncWorkflow, catScraperWorkflow } from "./workflows.js";

describe("parentSyncWorkflow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls fetchAndSaveSheltersActivity first, then fans out child workflows", async () => {
    const shelters = [
      { id: 1, url: "https://shelter1.example.com" },
      { id: 2, url: "https://shelter2.example.com" },
    ];
    mockFetchAndSaveSheltersActivity.mockResolvedValue(shelters);
    mockExecuteChild.mockResolvedValue(undefined);

    await parentSyncWorkflow();

    // Verify fetchAndSaveSheltersActivity was called exactly once
    expect(mockFetchAndSaveSheltersActivity).toHaveBeenCalledTimes(1);

    // Verify executeChild was called for each shelter
    expect(mockExecuteChild).toHaveBeenCalledTimes(2);

    // Verify executeChild was called with catScraperWorkflow and correct args
    expect(mockExecuteChild).toHaveBeenCalledWith(
      catScraperWorkflow,
      expect.objectContaining({
        args: ["https://shelter1.example.com", 1],
        taskQueue: "shelter-sync",
      })
    );
    expect(mockExecuteChild).toHaveBeenCalledWith(
      catScraperWorkflow,
      expect.objectContaining({
        args: ["https://shelter2.example.com", 2],
        taskQueue: "shelter-sync",
      })
    );
  });

  it("calls fetchAndSaveSheltersActivity before executeChild", async () => {
    const callOrder: string[] = [];

    mockFetchAndSaveSheltersActivity.mockImplementation(async () => {
      callOrder.push("fetchAndSaveShelters");
      return [{ id: 1, url: "https://shelter.example.com" }];
    });
    mockExecuteChild.mockImplementation(async () => {
      callOrder.push("executeChild");
    });

    await parentSyncWorkflow();

    expect(callOrder[0]).toBe("fetchAndSaveShelters");
    expect(callOrder.slice(1).every((c) => c === "executeChild")).toBe(true);
  });

  it("does not start child workflows if no shelters are returned", async () => {
    mockFetchAndSaveSheltersActivity.mockResolvedValue([]);
    mockExecuteChild.mockResolvedValue(undefined);

    await parentSyncWorkflow();

    expect(mockFetchAndSaveSheltersActivity).toHaveBeenCalledTimes(1);
    expect(mockExecuteChild).not.toHaveBeenCalled();
  });

  it("waits for all child workflows to complete", async () => {
    const shelters = [
      { id: 1, url: "https://shelter1.example.com" },
      { id: 2, url: "https://shelter2.example.com" },
      { id: 3, url: "https://shelter3.example.com" },
    ];
    mockFetchAndSaveSheltersActivity.mockResolvedValue(shelters);

    let resolvedCount = 0;
    mockExecuteChild.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          setTimeout(() => {
            resolvedCount++;
            resolve();
          }, 10);
        })
    );

    await parentSyncWorkflow();

    // All child workflows should have resolved by the time parentSyncWorkflow returns
    expect(resolvedCount).toBe(3);
  });
});

describe("catScraperWorkflow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls scrapeCatsActivity then saveCatsActivity in order", async () => {
    const cats = [
      { shelter_id: 1, name: "Whiskers", description: "Friendly cat", image_url: null },
      { shelter_id: 1, name: "Mittens", description: "Playful kitten", image_url: "https://img.example.com/mittens.jpg" },
    ];
    const callOrder: string[] = [];

    mockScrapeCatsActivity.mockImplementation(async () => {
      callOrder.push("scrapeCats");
      return cats;
    });
    mockSaveCatsActivity.mockImplementation(async () => {
      callOrder.push("saveCats");
    });

    await catScraperWorkflow("https://shelter.example.com", 1);

    expect(callOrder).toEqual(["scrapeCats", "saveCats"]);
    expect(mockScrapeCatsActivity).toHaveBeenCalledWith("https://shelter.example.com", 1);
    expect(mockSaveCatsActivity).toHaveBeenCalledWith(1, cats);
  });

  it("passes correct arguments to scrapeCatsActivity", async () => {
    mockScrapeCatsActivity.mockResolvedValue([]);
    mockSaveCatsActivity.mockResolvedValue(undefined);

    await catScraperWorkflow("https://example.com/cats", 42);

    expect(mockScrapeCatsActivity).toHaveBeenCalledWith("https://example.com/cats", 42);
  });

  it("still calls saveCatsActivity when scrapeCatsActivity returns empty array", async () => {
    mockScrapeCatsActivity.mockResolvedValue([]);
    mockSaveCatsActivity.mockResolvedValue(undefined);

    await catScraperWorkflow("https://shelter.example.com", 5);

    expect(mockScrapeCatsActivity).toHaveBeenCalledTimes(1);
    expect(mockSaveCatsActivity).toHaveBeenCalledTimes(1);
    expect(mockSaveCatsActivity).toHaveBeenCalledWith(5, []);
  });

  it("passes scraped cats to saveCatsActivity with correct shelter ID", async () => {
    const cats = [
      { shelter_id: 7, name: "Luna", description: "Calm", image_url: null },
    ];
    mockScrapeCatsActivity.mockResolvedValue(cats);
    mockSaveCatsActivity.mockResolvedValue(undefined);

    await catScraperWorkflow("https://cats.example.com", 7);

    expect(mockSaveCatsActivity).toHaveBeenCalledWith(7, cats);
  });
});
