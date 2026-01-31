import { configureChains, createConfig } from 'wagmi';
import { injected } from 'wagmi/connectors';
import { sepolia, baseSepolia } from 'wagmi/chains';
import { publicProvider } from 'wagmi/providers/public';

const { chains, publicClient, webSocketPublicClient } = configureChains(
  [sepolia, baseSepolia],
  [publicProvider()]
);

export const wagmiConfig = createConfig({
  autoConnect: true,
  connectors: [injected({ chains })],
  publicClient,
  webSocketPublicClient,
});

export { chains };
