export interface DeploymentInfo {
  propertyToken: string;
  propertyCrowdfund: string;
  chainRegistry: string;
  deploymentBlock: number;
  deploymentTx: string | undefined;
  deployedAt: string;
}

export interface TestnetAddresses {
  sepolia?: DeploymentInfo;
  "base-sepolia"?: DeploymentInfo;
  "canton-testnet"?: DeploymentInfo;
}
