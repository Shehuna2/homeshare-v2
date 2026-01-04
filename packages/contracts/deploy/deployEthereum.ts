import { ethers } from "hardhat";

async function main() {
  console.log("Deploying contracts to Ethereum...");

  // Deploy PropertyToken
  const PropertyToken = await ethers.getContractFactory("PropertyToken");
  const propertyToken = await PropertyToken.deploy(
    "Sample Property Token",
    "SPT",
    "property-1",
    ethers.parseEther("1000000"), // 1M total value
    ethers.parseEther("100000") // 100k tokens
  );
  await propertyToken.waitForDeployment();
  console.log("PropertyToken deployed to:", await propertyToken.getAddress());

  // Deploy PropertyCrowdfund
  const PropertyCrowdfund = await ethers.getContractFactory("PropertyCrowdfund");
  const propertyCrowdfund = await PropertyCrowdfund.deploy();
  await propertyCrowdfund.waitForDeployment();
  console.log("PropertyCrowdfund deployed to:", await propertyCrowdfund.getAddress());

  // Deploy ChainRegistry
  const ChainRegistry = await ethers.getContractFactory("ChainRegistry");
  const chainRegistry = await ChainRegistry.deploy();
  await chainRegistry.waitForDeployment();
  console.log("ChainRegistry deployed to:", await chainRegistry.getAddress());

  console.log("\nDeployment complete!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
