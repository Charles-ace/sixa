'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Address } from 'viem';
import { getWalletPortfolio, type WalletPortfolio } from '@/lib/chain';

declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
      on: (event: string, handler: (...args: unknown[]) => void) => void;
      removeListener: (event: string, handler: (...args: unknown[]) => void) => void;
      isMetaMask?: boolean;
      isCoinbaseWallet?: boolean;
      isWalletConnect?: boolean;
    };
  }
}

export interface WalletState {
  isConnected: boolean;
  isConnecting: boolean;
  address?: Address;
  chainId: number;
  walletName: string;
  portfolio?: WalletPortfolio;
  error?: string;
  isRefreshing: boolean;
}

const initialWalletState: WalletState = {
  isConnected: false,
  isConnecting: false,
  chainId: 8453,
  walletName: '',
  isRefreshing: false,
};

export function useWallet() {
  const [state, setState] = useState<WalletState>(initialWalletState);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const detectWalletName = useCallback(() => {
    const eth = window.ethereum;
    if (!eth) return '';
    if (eth.isMetaMask) return 'MetaMask';
    if (eth.isCoinbaseWallet) return 'Coinbase Wallet';
    if (eth.isWalletConnect) return 'WalletConnect';
    return 'EVM Wallet';
  }, []);

  const refreshPortfolio = useCallback(async (address: Address, chainId: number) => {
    setIsRefreshing(true);
    try {
      const portfolio = await getWalletPortfolio(address, chainId);
      setState((prev) => ({ ...prev, portfolio }));
    } catch {
      // portfolio fetch failed — keep existing state
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  const connect = useCallback(async () => {
    if (!window.ethereum) {
      setState((prev) => ({ ...prev, error: 'No EVM wallet detected. Install MetaMask or another wallet.' }));
      return;
    }

    setState((prev) => ({ ...prev, isConnecting: true, error: undefined }));

    try {
      const accounts = (await window.ethereum.request({ method: 'eth_requestAccounts' })) as string[];
      let chainIdHex = (await window.ethereum.request({ method: 'eth_chainId' })) as string;
      let currentChainId = parseInt(chainIdHex, 16);

      // Auto-switch wallet to Base Mainnet (8453) if connected to Ethereum Mainnet (1) or another non-Base chain
      if (currentChainId !== 8453 && currentChainId !== 84532) {
        try {
          await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: '0x2105' }],
          });
          chainIdHex = '0x2105';
          currentChainId = 8453;
        } catch (switchErr: any) {
          if (switchErr?.code === 4902 || switchErr?.message?.includes('Unrecognized chain')) {
            try {
              await window.ethereum.request({
                method: 'wallet_addEthereumChain',
                params: [{
                  chainId: '0x2105',
                  chainName: 'Base Mainnet',
                  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
                  rpcUrls: ['https://mainnet.base.org'],
                  blockExplorerUrls: ['https://basescan.org'],
                }],
              });
              chainIdHex = '0x2105';
              currentChainId = 8453;
            } catch {
              // add chain rejected
            }
          }
        }
      }

      const address = accounts[0] as Address;
      const walletName = detectWalletName();

      setState({ isConnected: true, isConnecting: false, address, chainId: currentChainId, walletName, error: undefined, isRefreshing: false });

      try {
        const portfolio = await getWalletPortfolio(address, currentChainId);
        setState((prev) => ({ ...prev, portfolio }));
      } catch {
        // portfolio fetch can fail on unsupported networks
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Wallet connection failed';
      setState((prev) => ({ ...prev, isConnecting: false, error: message }));
    }
  }, [detectWalletName]);

  const disconnect = useCallback(() => {
    setState(initialWalletState);
  }, []);

  const switchNetwork = useCallback(
    async (chainId: number) => {
      if (!window.ethereum) return;
      try {
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: `0x${chainId.toString(16)}` }],
        });
        const accounts = (await window.ethereum.request({ method: 'eth_accounts' })) as string[];
        if (accounts[0]) {
          setState((prev) => ({ ...prev, chainId }));
          refreshPortfolio(accounts[0] as Address, chainId);
        }
      } catch {
        // network switch rejected
      }
    },
    [refreshPortfolio]
  );

  useEffect(() => {
    const eth = window.ethereum;
    if (!eth) return;

    const handleAccountsChanged = (accounts: unknown) => {
      const list = accounts as string[];
      if (list.length === 0) {
        setState(initialWalletState);
        return;
      }
      setState((prev) => ({ ...prev, address: list[0] as Address }));
    };

    const handleChainChanged = (chainHex: unknown) => {
      const chainId = parseInt(chainHex as string, 16);
      setState((prev) => {
        if (prev.address) refreshPortfolio(prev.address, chainId);
        return { ...prev, chainId };
      });
    };

    eth.on('accountsChanged', handleAccountsChanged);
    eth.on('chainChanged', handleChainChanged);

    const restoreSession = async () => {
      try {
        const accounts = (await eth.request({ method: 'eth_accounts' })) as string[];
        if (accounts.length > 0) {
          const chainIdHex = (await eth.request({ method: 'eth_chainId' })) as string;
          setState({
            isConnected: true,
            isConnecting: false,
            address: accounts[0] as Address,
            chainId: parseInt(chainIdHex, 16),
            walletName: detectWalletName(),
            isRefreshing: false,
          });
          refreshPortfolio(accounts[0] as Address, parseInt(chainIdHex, 16));
        }
      } catch {
        // no session to restore
      }
    };

    restoreSession();

    return () => {
      eth.removeListener('accountsChanged', handleAccountsChanged);
      eth.removeListener('chainChanged', handleChainChanged);
    };
  }, [detectWalletName, refreshPortfolio]);

  return { ...state, connect, disconnect, switchNetwork, refreshPortfolio, isRefreshing };
}
