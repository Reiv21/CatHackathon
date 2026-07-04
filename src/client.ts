import { Client, Connection } from "@temporalio/client";

const TEMPORAL_ADDRESS = process.env.TEMPORAL_ADDRESS ?? "localhost:7233";
const TASK_QUEUE = "shelter-sync";

async function main(): Promise<void> {
  let connection: Connection;

  try {
    connection = await Connection.connect({ address: TEMPORAL_ADDRESS });
  } catch (err) {
    console.error(
      `Failed to connect to Temporal server at ${TEMPORAL_ADDRESS}: ${err instanceof Error ? err.message : String(err)}`
    );
    process.exit(1);
  }

  const client = new Client({ connection });

  const workflowId = `shelter-sync-${Date.now()}`;

  const handle = await client.workflow.start("parentSyncWorkflow", {
    taskQueue: TASK_QUEUE,
    workflowId,
  });

  console.log(`Started workflow: ${handle.workflowId}`);

  const result = await handle.result();
  console.log("Sync complete:", result);
}

main().catch((err) => {
  console.error("Client error:", err);
  process.exit(1);
});
