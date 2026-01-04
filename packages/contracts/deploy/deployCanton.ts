import { ethers } from "hardhat";

async function main() {
  console.log("Deploying contracts to Canton...");

  // Deploy PropertyToken
  const PropertyToken = await ethers.getContractFactory("PropertyToken");
  const propertyToken = await PropertyToken.deploy(
    "Canton Property Token",
    "CPT",
    "property-canton-1",
    ethers.parseEther("1000000"),
    ethers.parseEther("100000")
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
