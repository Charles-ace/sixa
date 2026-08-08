import { NextResponse } from 'next/server';
import { isPayerConfigured, payerMode } from '@/lib/broker/pay';
import { brokerMcpClient } from '@/lib/broker/pipeline';

export async function GET() {
  return NextResponse.json({
    marketplace: {
      configured: brokerMcpClient.isConfigured(),
      mcpEndpoint: process.env.KEEPERHUB_MCP_ENDPOINT ?? 'https://app.keeperhub.com/mcp',
    },
    payments: {
      mode: payerMode(),
      realConfigured: isPayerConfigured(),
      chainId: process.env.BROKER_PAYER_CHAIN_ID ?? '8453',
      note: isPayerConfigured()
        ? 'Real x402 payments are enabled — the broker will spend USDC on Base.'
        : 'Payments are simulated. Set BROKER_PAYER_PRIVATE_KEY to enable real x402 USDC payments.',
    },
  });
}