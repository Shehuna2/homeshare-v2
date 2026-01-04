import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";

dotenv.config();

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    hardhat: {},
    // Testnets
    sepolia: {
      url: process.env.ETHEREUM_SEPOLIA_RPC_URL || "",
      accounts: process.env.DEPLOYER_PRIVATE_KEY ? [process.env.DEPLOYER_PRIVATE_KEY] : [],
      chainId: 11155111,
    },
    "base-sepolia": {
      url: process.env.BASE_SEPOLIA_RPC_URL || "",
      accounts: process.env.DEPLOYER_PRIVATE_KEY ? [process.env.DEPLOYER_PRIVATE_KEY] : [],
      chainId: 84532,
    },
    "canton-testnet": {
      url: process.env.CANTON_TESTNET_RPC_URL || "",
      accounts: process.env.DEPLOYER_PRIVATE_KEY ? [process.env.DEPLOYER_PRIVATE_KEY] : [],
      chainId: process.env.CANTON_TESTNET_CHAIN_ID ? parseInt(process.env.CANTON_TESTNET_CHAIN_ID) : 0,
    },
    // Mainnets
    ethereum: {
      url: process.env.ETHEREUM_MAINNET_RPC_URL || "",
      accounts: process.env.DEPLOYER_PRIVATE_KEY ? [process.env.DEPLOYER_PRIVATE_KEY] : [],
      chainId: 1,
    },
    base: {
      url: process.env.BASE_MAINNET_RPC_URL || "",
      accounts: process.env.DEPLOYER_PRIVATE_KEY ? [process.env.DEPLOYER_PRIVATE_KEY] : [],
      chainId: 8453,
    },
    canton: {
      url: process.env.CANTON_MAINNET_RPC_URL || "",
      accounts: process.env.DEPLOYER_PRIVATE_KEY ? [process.env.DEPLOYER_PRIVATE_KEY] : [],
      chainId: process.env.CANTON_MAINNET_CHAIN_ID ? parseInt(process.env.CANTON_MAINNET_CHAIN_ID) : 0,
    },
  },
  etherscan: {
    apiKey: {
      mainnet: process.env.ETHEREUM_ETHERSCAN_API_KEY || "",
      sepolia: process.env.ETHEREUM_ETHERSCAN_API_KEY || "",
      base: process.env.BASE_ETHERSCAN_API_KEY || "",
      "base-sepolia": process.env.BASE_ETHERSCAN_API_KEY || "",
      // Canton explorer might use different verification method
    },
  },
};

export default config;
