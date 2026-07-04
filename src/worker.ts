import { Worker, NativeConnection } from "@temporalio/worker";
import * as activities from "./activities.js";

const TEMPORAL_ADDRESS = process.env.TEMPORAL_ADDRESS ?? "localhost:7233";
const TASK_QUEUE = "shelter-sync";

async function runWorker(): Promise<void> {
  let connection: NativeConnection;

  try {
    connection = await NativeConnection.connect({
      address: TEMPORAL_ADDRESS,
    });
  } catch (err) {
    throw new Error(
      `Failed to connect to Temporal server at ${TEMPORAL_ADDRESS}: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  const worker = await Worker.create({
    connection,
    workflowsPath: new URL("./workflows.ts", import.meta.url).pathname,
    activities,
    taskQueue: TASK_QUEUE,
  });

  console.log(`Worker connected to Temporal at ${TEMPORAL_ADDRESS}, listening on task queue "${TASK_QUEUE}"`);
  await worker.run();
}

runWorker().catch((err) => {
  console.error("Worker failed:", err);
  process.exit(1);
});
