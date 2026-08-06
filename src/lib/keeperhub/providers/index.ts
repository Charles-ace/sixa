import type { ExecutionProvider, ProviderConfigStatus, ProviderMode } from './types';
import { detectEnvironment, resolveChainId, isKeeperHubCredentialed, chainName } from './types';
import { KeeperHubRestProvider } from './keeperhub';
import { KeeperHubMcpProvider } from './mcp';
import { MockProvider } from './mock';
import { ProviderError } from './http';

export { ProviderError } from './http';
export type { ExecutionProvider, ProviderConfigStatus, ProviderMode } from './types';
export { detectEnvironment, resolveChainId, isKeeperHubCredentialed, chainName } from './types';

function buildProvider(): ExecutionProvider {
  const transport = (process.env.KEEPERHUB_TRANSPORT ?? 'rest').toLowerCase();

  if (transport === 'mcp') {
    if (!isKeeperHubCredentialed()) {
      throw new ProviderError({
        code: 'config_required',
        message: 'KeeperHub MCP transport selected but no API key is configured. Set KEEPERHUB_API_KEY.',
        docs: 'https://docs.keeperhub.com/ai-tools/mcp-server',
      });
    }
    return new KeeperHubMcpProvider();
  }

  if (isKeeperHubCredentialed()) {
    return new KeeperHubRestProvider();
  }

  if (process.env.NODE_ENV === 'production' && !process.env.ALLOW_MOCK) {
    throw new ProviderError({
      code: 'config_required',
      message: 'KeeperHub is not configured. Production execution is disabled until KEEPERHUB_API_KEY is set.',
      hint: 'Set KEEPERHUB_ENDPOINT and KEEPERHUB_API_KEY. The mock provider is never used in production.',
      docs: 'https://docs.keeperhub.com/api/authentication',
      status: 503,
    });
  }

  return new MockProvider();
}

let cachedProvider: ExecutionProvider | null = null;

export function getExecutionProvider(): ExecutionProvider {
  if (!cachedProvider) {
    cachedProvider = buildProvider();
  }
  return cachedProvider;
}

export function getConfigStatus(): ProviderConfigStatus {
  const chainId = resolveChainId();
  const environment = detectEnvironment(chainId);
  const transport = (process.env.KEEPERHUB_TRANSPORT ?? 'rest').toLowerCase();

  if (isKeeperHubCredentialed()) {
    const mode: ProviderMode = environment === 'testnet' ? 'testnet' : 'live';
    return {
      provider: transport === 'mcp' ? 'keeperhub-mcp' : 'keeperhub',
      configured: true,
      environment,
      mode,
      chainId,
      chainName: chainName(chainId),
      protectedExecution: true,
      message: `KeeperHub ${transport === 'mcp' ? 'MCP server' : 'Direct Execution API'} connected (${environment}). Writes relay through KeeperHub infrastructure.`,
    };
  }

  if (process.env.NODE_ENV === 'production' && !process.env.ALLOW_MOCK) {
    return {
      provider: 'none',
      configured: false,
      environment,
      mode: 'misconfigured',
      chainId,
      chainName: chainName(chainId),
      protectedExecution: false,
      message: 'KeeperHub is not configured. Set KEEPERHUB_API_KEY — the mock provider is disabled in production and no transaction will be simulated or broadcast.',
    };
  }

  return {
    provider: 'mock',
    configured: false,
    environment,
    mode: 'simulated',
    chainId,
    chainName: chainName(chainId),
    protectedExecution: false,
    message: 'Dev simulation active. Set KEEPERHUB_API_KEY to enable live execution through KeeperHub.',
  };
}
