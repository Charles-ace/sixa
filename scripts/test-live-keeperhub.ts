import { BrokerMcpClient } from '../src/lib/broker/client';
import { verifyExecution } from '../src/lib/broker/verify';
import { confirmOnChainReceipt, basePublicClient } from '../src/lib/broker/pay';
import { existsSync } from 'fs';
import { join } from 'path';

// Load .env.local if present
try {
  const envPath = join(__dirname, '..', '.env.local');
  if (existsSync(envPath)) {
    const { loadEnvFile } = require('node:process');
    loadEnvFile(envPath);
  }
} catch {}

async function runLiveTests() {
  console.log('=====================================================');
  console.log('REAL LIVE NETWORK TESTS (KeeperHub API + Base Node)');
  console.log('=====================================================\n');

  // TEST 1a LIVE: Hitting real KeeperHub MCP endpoint for execution status
  console.log('--- TEST 1a LIVE: Real KeeperHub MCP API status check ---');
  const client = new BrokerMcpClient();
  console.log('Connecting to KeeperHub endpoint:', process.env.KEEPERHUB_MCP_ENDPOINT ?? 'https://app.keeperhub.com/mcp');

  const testExecutionId = 'exec_live_test_unconfirmed_99999';
  console.log(`Querying get_execution for executionId: "${testExecutionId}"...`);

  try {
    const liveRawResult = await client.getExecution(testExecutionId);
    console.log('\nLIVE UNEDITED KEEPERHUB API RESPONSE:');
    console.log(JSON.stringify(liveRawResult, null, 2));

    const verificationResult = await verifyExecution(client, testExecutionId, { maxPolls: 1 });
    console.log('\nVERIFY EXECUTION RESULT:');
    console.log(JSON.stringify(verificationResult, null, 2));
    console.log('Completed:', verificationResult.completed, '| Verified:', verificationResult.verified);
  } catch (error: any) {
    console.log('\nLIVE UNEDITED KEEPERHUB API ERROR RESPONSE:');
    console.log(JSON.stringify({
      name: error.name,
      code: error.code,
      message: error.message,
      status: error.status,
      hint: error.hint,
      body: error.body,
    }, null, 2));
  }

  // TEST 2b LIVE: Hitting real Base Mainnet node for transaction receipt verification
  console.log('\n-----------------------------------------------------');
  console.log('--- TEST 2b LIVE: Real Base RPC node receipt check ---');
  const publicClient = basePublicClient();
  const testTxHash = '0x1111111111111111111111111111111111111111111111111111111111111111';
  console.log(`Querying Base mainnet RPC for txHash: "${testTxHash}"...`);

  try {
    const liveReceipt = await confirmOnChainReceipt({
      txHash: testTxHash as `0x${string}`,
      asset: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
      native: false,
      expectedAmountUnits: '250000',
      expectedRecipient: '0x1111111111111111111111111111111111111111',
      publicClient,
      payer: '0x0000000000000000000000000000000000000000',
      networkName: 'base',
    });
    console.log('\nLIVE UNEDITED BASE RECEIPT RESULT:');
    console.log(JSON.stringify(liveReceipt, null, 2));
  } catch (error: any) {
    console.log('\nLIVE UNEDITED BASE RPC ERROR RESPONSE:');
    console.log(JSON.stringify({
      name: error.name,
      code: error.code,
      message: error.message,
      status: error.status,
      hint: error.hint,
    }, null, 2));
  }
}

runLiveTests().catch(console.error);
