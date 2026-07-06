/**
 * Pure mapping logic for Temporal workflow execution states to sync status responses.
 * Extracted from the /api/admin/sync/status endpoint for testability.
 */

export interface WorkflowExecutionInfo {
  /** Temporal workflow status code (1-7) */
  statusCode: number;
  /** Workflow start time */
  startTime: Date | null;
  /** Workflow close/completion time */
  closeTime: Date | null;
}

export interface SyncStatusResult {
  status: "running" | "completed" | "failed";
  start_time: string | null;
  completion_time: string | null;
}

/**
 * Maps a Temporal workflow execution state to a sync status response.
 *
 * Temporal status codes:
 * - 1 = RUNNING → "running"
 * - 2 = COMPLETED → "completed"
 * - 3 = FAILED, 4 = CANCELLED, 5 = TERMINATED, 6 = CONTINUED_AS_NEW, 7 = TIMED_OUT → "failed"
 */
export function mapWorkflowStatus(info: WorkflowExecutionInfo): SyncStatusResult {
  let status: "running" | "completed" | "failed";

  if (info.statusCode === 1) {
    status = "running";
  } else if (info.statusCode === 2) {
    status = "completed";
  } else {
    status = "failed";
  }

  return {
    status,
    start_time: info.startTime?.toISOString() ?? null,
    completion_time: info.closeTime?.toISOString() ?? null,
  };
}
