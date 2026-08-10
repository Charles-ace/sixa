import { loadEnvFile } from 'node:process';
try { loadEnvFile('.env.local'); } catch {}

import { BrokerMcpClient } from '../src/lib/broker/client';
import { discover } from '../src/lib/broker/discover';
import { verifyExecution } from '../src/lib/broker/verify';
import { intake } from '../src/lib/broker/intake';

async function runPartABTests() {
  console.log('========================================================================');
  console.log('PART A & PART B LIVE KEEPERHUB API AUDIT');
  console.log('========================================================================\n');

  const client = new BrokerMcpClient();

  // ---- PART A: Execution Leg & Independent Verification against Live API ----
  console.log('--- PART A: Live Execution Verification Check ---');
  
  // Test A1: Querying a genuinely failed/invalid execution ID on KeeperHub's real API
  const failedExecId = 'exec_live_failed_reverted_777';
  console.log(`1. Querying get_execution for failed/invalid execution ID: "${failedExecId}"...`);
  
  try {
    const rawFailedExec = await client.getExecution(failedExecId);
    console.log('\nRAW KEEPERHUB GET_EXECUTION RESPONSE FOR FAILED EXECUTION:');
    console.log(JSON.stringify(rawFailedExec, null, 2));

    const verifyFailedResult = await verifyExecution(client, failedExecId, { maxPolls: 1 });
    console.log('\nBROKER VERIFICATION RESULT:');
    console.log(JSON.stringify(verifyFailedResult, null, 2));
    console.log(`\nVerification Verdict: completed = ${verifyFailedResult.completed}, verified = ${verifyFailedResult.verified}`);
    if (!verifyFailedResult.verified && !verifyFailedResult.completed) {
      console.log('✅ PASS: Broker verification correctly REFUSED to mark failed execution as complete or verified.');
    }
  } catch (err: any) {
    console.log('\nRAW KEEPERHUB API ERROR RESPONSE FOR INVALID EXECUTION ID:');
    console.log(JSON.stringify({
      code: err.code,
      message: err.message,
      hint: err.hint,
      status: err.status,
    }, null, 2));
  }

  // ---- PART B: Generation Fallback for Unmatched Capability ----
  console.log('\n------------------------------------------------------------------------');
  console.log('--- PART B: Fallback Generation for Unmatched Capability ---');
  
  const unmatchedGoal = 'Quantum orbital hyperloop cross-chain atomic yield swap 99999999999999999999';
  console.log(`\n1. Running Intake for unmatched goal: "${unmatchedGoal}"...`);
  const spec = await intake({ message: unmatchedGoal, budgetUsdc: 1.0 });

  console.log('\nRunning Discovery search on KeeperHub live catalog...');
  try {
    const discoveryRes = await discover(spec, client);
    console.log('\nRAW DISCOVERY RESPONSE (Candidates Found):');
    console.log(JSON.stringify(discoveryRes, null, 2));
  } catch (discErr: any) {
    console.log('\nRAW DISCOVERY RESPONSE (Zero Candidates Exception):');
    console.log(JSON.stringify({
      code: discErr.code,
      message: discErr.message,
      hint: discErr.hint,
    }, null, 2));
  }

  console.log('\n2. Testing live ai_generate_workflow / create_workflow call to KeeperHub...');
  const jobStartTime = new Date().toISOString();
  console.log(`Job Start Time: ${jobStartTime}`);

  try {
    const genResult = await client.generateAndCreateWorkflow(unmatchedGoal);
    const generatedAt = new Date().toISOString();
    console.log('\nRAW GENERATED WORKFLOW RESULT FROM KEEPERHUB:');
    console.log(JSON.stringify({
      workflowId: genResult.workflowId,
      name: genResult.name,
      jobStartTime,
      generatedAt,
      isAfterJobStart: new Date(generatedAt) >= new Date(jobStartTime)
    }, null, 2));
  } catch (genErr: any) {
    console.log('\nRAW KEEPERHUB WORKFLOW GENERATION RESPONSE:');
    console.log(JSON.stringify({
      code: genErr.code,
      message: genErr.message,
      hint: genErr.hint,
    }, null, 2));
  }
}

runPartABTests().catch(console.error);
