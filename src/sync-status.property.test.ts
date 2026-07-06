import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { mapWorkflowStatus, WorkflowExecutionInfo } from "./sync-status.js";

/**
 * Property 4: Workflow status mapping
 *
 * For any Temporal workflow execution state (RUNNING, COMPLETED, FAILED, TERMINATED,
 * CANCELLED, TIMED_OUT), the `/api/admin/sync/status` endpoint SHALL map it to one of
 * the defined status strings ("running", "completed", "failed") with `start_time` always
 * populated as a valid ISO 8601 string and `completion_time` populated only when status
 * is "completed" or "failed".
 *
 * Mapping rules:
 * - Status code 1 (RUNNING) → "running"
 * - Status code 2 (COMPLETED) → "completed"
 * - Status codes 3 (FAILED), 4 (CANCELLED), 5 (TERMINATED), 6 (CONTINUED_AS_NEW), 7 (TIMED_OUT) → "failed"
 *
 * **Validates: Requirements 3.2**
 *
 * Tag: Feature: hackathon-polish, Property 4: Workflow status mapping
 */
describe("Feature: hackathon-polish, Property 4: Workflow status mapping", () => {
  /**
   * ISO 8601 pattern for validating timestamps produced by Date.toISOString().
   * Example: 2024-01-15T10:30:00.000Z
   */
  const ISO_8601_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/;

  /**
   * All valid Temporal workflow execution status codes.
   * 1=RUNNING, 2=COMPLETED, 3=FAILED, 4=CANCELLED, 5=TERMINATED, 6=CONTINUED_AS_NEW, 7=TIMED_OUT
   */
  const validStatusCodes = [1, 2, 3, 4, 5, 6, 7] as const;

  /**
   * Arbitrary for generating a valid Temporal status code (1-7).
   */
  const statusCodeArbitrary = fc.constantFrom(...validStatusCodes);

  /**
   * Arbitrary for generating a valid Date within a reasonable range.
   */
  const dateArbitrary = fc.date({
    min: new Date("2020-01-01T00:00:00Z"),
    max: new Date("2030-12-31T23:59:59Z"),
  });

  /**
   * Arbitrary for generating a WorkflowExecutionInfo with a start time always present
   * (since Temporal always provides a start time for listed workflows) and a close time
   * that's present when the workflow is no longer running.
   */
  const workflowExecutionArbitrary: fc.Arbitrary<WorkflowExecutionInfo> = fc
    .tuple(statusCodeArbitrary, dateArbitrary, dateArbitrary)
    .map(([statusCode, startTime, closeTime]) => ({
      statusCode,
      startTime,
      // closeTime is typically null for RUNNING workflows (code 1), present otherwise
      closeTime: statusCode === 1 ? null : closeTime,
    }));

  it("maps status codes to correct status strings", () => {
    fc.assert(
      fc.property(workflowExecutionArbitrary, (info) => {
        const result = mapWorkflowStatus(info);

        // Verify status mapping
        if (info.statusCode === 1) {
          expect(result.status).toBe("running");
        } else if (info.statusCode === 2) {
          expect(result.status).toBe("completed");
        } else {
          // Codes 3, 4, 5, 6, 7 all map to "failed"
          expect(result.status).toBe("failed");
        }
      }),
      { numRuns: 100 }
    );
  });

  it("always returns a valid status string from the defined set", () => {
    fc.assert(
      fc.property(workflowExecutionArbitrary, (info) => {
        const result = mapWorkflowStatus(info);
        expect(["running", "completed", "failed"]).toContain(result.status);
      }),
      { numRuns: 100 }
    );
  });

  it("start_time is always a valid ISO 8601 string when startTime is provided", () => {
    fc.assert(
      fc.property(workflowExecutionArbitrary, (info) => {
        const result = mapWorkflowStatus(info);

        // start_time should always be populated as a valid ISO 8601 string
        // (since startTime is always present for listed workflows)
        expect(result.start_time).not.toBeNull();
        expect(result.start_time).toMatch(ISO_8601_REGEX);
      }),
      { numRuns: 100 }
    );
  });

  it("completion_time is populated only when status is 'completed' or 'failed'", () => {
    fc.assert(
      fc.property(workflowExecutionArbitrary, (info) => {
        const result = mapWorkflowStatus(info);

        if (result.status === "running") {
          // Running workflows should have null completion_time
          expect(result.completion_time).toBeNull();
        } else {
          // Completed and failed workflows should have a valid ISO 8601 completion_time
          expect(result.completion_time).not.toBeNull();
          expect(result.completion_time).toMatch(ISO_8601_REGEX);
        }
      }),
      { numRuns: 100 }
    );
  });

  it("start_time is null only when startTime input is null", () => {
    fc.assert(
      fc.property(
        statusCodeArbitrary,
        fc.option(dateArbitrary, { nil: null }),
        fc.option(dateArbitrary, { nil: null }),
        (statusCode, startTime, closeTime) => {
          const info: WorkflowExecutionInfo = { statusCode, startTime, closeTime };
          const result = mapWorkflowStatus(info);

          if (startTime === null) {
            expect(result.start_time).toBeNull();
          } else {
            expect(result.start_time).not.toBeNull();
            expect(result.start_time).toMatch(ISO_8601_REGEX);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it("all non-running/non-completed codes (3-7) map to 'failed'", () => {
    const failedCodesArbitrary = fc.constantFrom(3, 4, 5, 6, 7);

    fc.assert(
      fc.property(failedCodesArbitrary, dateArbitrary, dateArbitrary, (statusCode, startTime, closeTime) => {
        const info: WorkflowExecutionInfo = { statusCode, startTime, closeTime };
        const result = mapWorkflowStatus(info);
        expect(result.status).toBe("failed");
      }),
      { numRuns: 100 }
    );
  });
});
