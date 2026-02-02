import { expect } from "chai";
import { ethers } from "hardhat";


describe("EquityToken", function () {
  it("deploys with metadata and initial supply", async function () {
    const [admin, initialHolder] = await ethers.getSigners();
    const EquityToken = await ethers.getContractFactory("EquityToken");
    const supply = ethers.parseUnits("1000", 18);

    const token = await EquityToken.deploy(
      "Equity Token",
      "EQT",
      "PROP-123",
      admin.address,
      initialHolder.address,
      supply
    );

    expect(await token.name()).to.equal("Equity Token");
    expect(await token.symbol()).to.equal("EQT");
    expect(await token.propertyId()).to.equal("PROP-123");
    expect(await token.admin()).to.equal(admin.address);
    expect(await token.totalSupply()).to.equal(supply);
    expect(await token.balanceOf(initialHolder.address)).to.equal(supply);
  });

  it("does not expose a mint function", async function () {
    const [admin, initialHolder] = await ethers.getSigners();
    const EquityToken = await ethers.getContractFactory("EquityToken");
    const supply = ethers.parseUnits("1000", 18);

    const token = await EquityToken.deploy(
      "Equity Token",
      "EQT",
      "PROP-123",
      admin.address,
      initialHolder.address,
      supply
    );

    const contract = token as unknown as Record<string, unknown>;
    expect(contract.mint).to.equal(undefined);
  });

  it("allows standard ERC20 transfers", async function () {
    const [admin, initialHolder, recipient] = await ethers.getSigners();
    const EquityToken = await ethers.getContractFactory("EquityToken");
    const supply = ethers.parseUnits("1000", 18);

    const token = await EquityToken.deploy(
      "Equity Token",
      "EQT",
      "PROP-123",
      admin.address,
      initialHolder.address,
      supply
    );

    const amount = ethers.parseUnits("100", 18);
    await token.connect(initialHolder).transfer(recipient.address, amount);

    expect(await token.balanceOf(recipient.address)).to.equal(amount);
    expect(await token.balanceOf(initialHolder.address)).to.equal(supply - amount);
  });
});
