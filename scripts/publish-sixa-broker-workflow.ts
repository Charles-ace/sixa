import { loadEnvFile } from "node:process";
try { loadEnvFile(".env.local"); } catch {}

import { BrokerMcpClient } from "../src/lib/broker/client";

async function main() {
  console.log("Creating dedicated Sixa AI Payment Broker Workflow on KeeperHub...");

  const client = new BrokerMcpClient();
  if (!client.isConfigured()) {
    console.error("KEEPERHUB_API_KEY is missing in environment.");
    process.exit(1);
  }

  // Ensure MCP session is initialized
  await (client as any).ensureInitialized();

  // Construct a bespoke, clean workflow structure representing Sixa's Broker Gateway
  const nodes = [
    {
      id: "node_trigger_1",
      type: "trigger",
      data: {
        label: "Webhook Intent Listener",
        triggerType: "webhook",
        description: "Receives user intent, target chain, and USDC budget",
      },
      position: { x: 100, y: 200 },
    },
    {
      id: "node_sixa_broker_1",
      id_alias: "sixa_engine",
      type: "action",
      data: {
        label: "Sixa x402 Intent Broker Engine",
        actionType: "http",
        config: {
          method: "POST",
          url: "https://sixa-chi.vercel.app/api/broker/jobs",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message: "{{trigger.body.message}}",
            budgetUsdc: "{{trigger.body.budgetUsdc}}",
            payMode: "real",
          }),
        },
        description: "Searches KeeperHub Marketplace, verifies x402 USDC payment, and executes target workflow",
      },
      position: { x: 450, y: 200 },
    },
  ];

  const edges = [
    {
      id: "edge_1_2",
      source: "node_trigger_1",
      target: "node_sixa_broker_1",
    },
  ];

  try {
    const res = await (client as any).callTool("create_workflow", {
      name: "Sixa — x402 AI Payment Broker & Intent Gateway",
      description: "Autonomous x402 payment broker for KeeperHub. Matches natural-language goals to marketplace workflows, verifies on-chain USDC payments on Base, and generates fallback workflows when needed.",
      nodes,
      edges,
      enabled: true,
    });

    const text = res.text || "";
    console.log("\nResponse:", text);

    let parsed: any = {};
    try { parsed = JSON.parse(text); } catch {
      const match = text.match(/\{[\s\S]*\}/);
      if (match) parsed = JSON.parse(match[0]);
    }

    const workflowId = parsed.id || parsed.workflowId || (parsed.workflow && parsed.workflow.id);
    if (workflowId) {
      console.log("\n=======================================================");
      console.log("🎉 SIXA BROKER WORKFLOW CREATED SUCCESSFULLY ON KEEPERHUB!");
      console.log("Workflow ID:", workflowId);
      console.log("Name: Sixa — x402 AI Payment Broker & Intent Gateway");
      console.log(`Direct Link: https://app.keeperhub.com/workflows/${workflowId}`);
      console.log("=======================================================");
    } else {
      console.log("Created result:", text);
    }
  } catch (err: any) {
    console.error("Workflow creation error:", err?.message || err);
  }
}

main().catch(console.error);
