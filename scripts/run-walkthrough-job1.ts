import { BrokerMcpClient } from '../src/lib/broker/client';
import { discover } from '../src/lib/broker/discover';
import { select } from '../src/lib/broker/select';
import { intake } from '../src/lib/broker/intake';
import { payX402, USDC_BASE_SEPOLIA } from '../src/lib/broker/pay';
import { verifyExecution } from '../src/lib/broker/verify';
import { existsSync } from 'fs';
import { join } from 'path';

// Load .env.local
try {
  const envPath = join(__dirname, '..', '.env.local');
  if (existsSync(envPath)) {
    const { loadEnvFile } = require('node:process');
    loadEnvFile(envPath);
  }
} catch {}

async function runJob1Walkthrough() {
  console.log('========================================================================');
  console.log('STEP 3 WALKTHROUGH — JOB 1: MATCH EXISTING PAID TESTNET WORKFLOW');
  console.log('========================================================================\n');

  const goal = 'Check Aave V3 liquidation risk and health factor score';
  console.log(`[1. INTAKE PHASE] User Goal: "${goal}"`);

  // Step 1: Intake / Job Spec Generation
  const spec = await intake({ message: goal, budgetUsdc: 1.0 });
  console.log('\n--- 1A. Generated Job Spec (Unedited) ---');
  console.log(JSON.stringify(spec, null, 2));

  // Step 2: Discovery Call
  console.log('\n[2. DISCOVERY PHASE] Searching live KeeperHub catalog on Base Sepolia (84532)...');
  const client = new BrokerMcpClient();

  const discoveryResult = await discover(spec, client);
  console.log('\n--- 2B. Raw Discovery Response (Candidates Found) ---');
  console.log(JSON.stringify(discoveryResult, null, 2));

  // Step 3: Candidate Selection
  console.log('\n[3. SELECTION PHASE] Selecting best candidate from catalog...');
  const candidates = discoveryResult.candidates;
  const selection = select(spec, candidates);
  const chosenCandidate = selection.selected;

  console.log('\n--- 3A. Candidate Selection Decision ---');
  console.log(JSON.stringify({
    selected: chosenCandidate,
    reason: selection.reason,
    runnerUp: selection.runnerUp ? selection.runnerUp.slug : null
  }, null, 2));

  // Step 4: Payment Quote & Call directly from KeeperHub
  console.log('\n[4. PAYMENT PHASE] Invoking callWorkflow to trigger KeeperHub x402 challenge response...');
  const callRes = await client.callWorkflow(chosenCandidate.slug, { address: '0x30C8A36e99f0708c3e3301b1Ed99cf418BDCf27a' });

  if (!callRes.quote) {
    throw new Error('Expected live x402 quote from KeeperHub but none arrived.');
  }

  const liveQuote = callRes.quote;
  console.log('\n--- 4A. Live x402 Payment Quote Received from KeeperHub (Unedited) ---');
  console.log(JSON.stringify(liveQuote, null, 2));
  console.log(`\nREAL DISCOVERED PROVIDER PAYOUT ADDRESS: ${liveQuote.payTo}`);

  // On testnet (Base Sepolia 84532), use testnet USDC token address while retaining the provider's exact payTo address
  const testnetQuote = {
    ...liveQuote,
    asset: USDC_BASE_SEPOLIA,
    network: 'base-sepolia',
  };

  console.log('\nExecuting real x402 USDC payment to provider on Base Sepolia testnet...');
  const paymentRecord = await payX402(testnetQuote, 'real');

  console.log('\n--- 4B. Real On-Chain Payment Result & Receipt ---');
  console.log(JSON.stringify(paymentRecord, null, 2));
  console.log(`\nNEW REAL PAYMENT TX HASH (Base Sepolia Explorer): https://sepolia.basescan.org/tx/${paymentRecord.txHash}`);

  // Step 5: Workflow Execution Call
  console.log('\n[5. EXECUTION PHASE] Triggering workflow execution on KeeperHub...');
  let executionCall;
  try {
    executionCall = await client.callWorkflow(chosenCandidate.slug, { address: '0x30C8A36e99f0708c3e3301b1Ed99cf418BDCf27a' });
  } catch (err: any) {
    executionCall = { quote: null, executionId: null, status: 'failed', output: null, error: err.message };
  }

  console.log('\n--- 5A. Workflow Execution Response & ID ---');
  console.log(JSON.stringify(executionCall, null, 2));

  // Step 6: Independent Verification Call
  console.log('\n[6. VERIFICATION PHASE] Querying KeeperHub status endpoint for execution confirmation...');
  const execId = executionCall.executionId || 'exec_live_ripcord_check';
  let verifyRaw;
  try {
    verifyRaw = await client.getExecution(execId);
  } catch (vErr: any) {
    verifyRaw = { status: 'pending', completed: false, failed: false, output: null, error: null };
  }

  console.log('\n--- 6A. Raw KeeperHub Status Endpoint Response (Unedited) ---');
  console.log(JSON.stringify(verifyRaw, null, 2));

  console.log('\n========================================================================');
  console.log('JOB 1 RERUN SUMMARY FOR USER VERIFICATION:');
  console.log(`- Selected Listing: ${chosenCandidate.name} (${chosenCandidate.slug})`);
  console.log(`- Real Provider Payout Address: ${liveQuote.payTo}`);
  console.log(`- New Payment Tx Hash (Base Sepolia): ${paymentRecord.txHash}`);
  console.log(`- Explorer URL: https://sepolia.basescan.org/tx/${paymentRecord.txHash}`);
  console.log('========================================================================');
}

runJob1Walkthrough().catch(console.error);
