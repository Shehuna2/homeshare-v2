import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";
import { DeploymentInfo, TestnetAddresses } from "./types";

async function main() {
  console.log("Deploying contracts to Canton Testnet...");

  const [deployer] = await ethers.getSigners();
  console.log(`Deploying contracts with account: ${deployer.address}`);
  
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`Account balance: ${ethers.formatEther(balance)} ETH\n`);

  // Deploy PropertyToken
  console.log("Deploying PropertyToken...");
  const PropertyToken = await ethers.getContractFactory("PropertyToken");
  const propertyToken = await PropertyToken.deploy(
    "Canton Testnet Property Token",
    "CTPT",
    "property-canton-testnet-1",
    ethers.parseEther("1000000"), // 1M total value
    ethers.parseEther("100000")   // 100k tokens
  );
  await propertyToken.waitForDeployment();
  const propertyTokenAddress = await propertyToken.getAddress();
  console.log("PropertyToken deployed to:", propertyTokenAddress);

  // Deploy PropertyCrowdfund
  console.log("\nDeploying PropertyCrowdfund...");
  const PropertyCrowdfund = await ethers.getContractFactory("PropertyCrowdfund");
  const propertyCrowdfund = await PropertyCrowdfund.deploy();
  await propertyCrowdfund.waitForDeployment();
  const propertyCrowdfundAddress = await propertyCrowdfund.getAddress();
  console.log("PropertyCrowdfund deployed to:", propertyCrowdfundAddress);

  // Deploy ChainRegistry
  console.log("\nDeploying ChainRegistry...");
  const ChainRegistry = await ethers.getContractFactory("ChainRegistry");
  const chainRegistry = await ChainRegistry.deploy();
  await chainRegistry.waitForDeployment();
  const chainRegistryAddress = await chainRegistry.getAddress();
  console.log("ChainRegistry deployed to:", chainRegistryAddress);

  // Get deployment details
  const blockNumber = await ethers.provider.getBlockNumber();
  const deploymentTx = propertyToken.deploymentTransaction()?.hash;

  // Prepare deployment info
  const addresses = {
    propertyToken: propertyTokenAddress,
    propertyCrowdfund: propertyCrowdfundAddress,
    chainRegistry: chainRegistryAddress,
    deploymentBlock: blockNumber,
    deploymentTx: deploymentTx,
    deployedAt: new Date().toISOString(),
  };

  console.log("\n" + "=".repeat(50));
  console.log("Deployment Successful!");
  console.log("=".repeat(50));
  console.log(JSON.stringify(addresses, null, 2));
  console.log("=".repeat(50));

  // Save deployment info to file
  const deploymentsDir = path.join(__dirname, "..", "deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir);
  }

  const addressesFile = path.join(deploymentsDir, "testnet-addresses.json");
  let allAddresses: TestnetAddresses = {};
  
  if (fs.existsSync(addressesFile)) {
    allAddresses = JSON.parse(fs.readFileSync(addressesFile, "utf8"));
  }
  
  allAddresses["canton-testnet"] = addresses;
  fs.writeFileSync(addressesFile, JSON.stringify(allAddresses, null, 2));
  
  console.log(`\nDeployment info saved to: ${addressesFile}`);

  console.log("\n" + "=".repeat(50));
  console.log("Next Steps:");
  console.log("=".repeat(50));
  console.log("1. Verify contracts on Canton block explorer (if available):");
  console.log(`   Contract addresses saved to deployments/testnet-addresses.json`);
  console.log("\n2. Update frontend/backend with contract addresses");
  console.log("3. Test contract interactions on Canton testnet");
  console.log("=".repeat(50));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
