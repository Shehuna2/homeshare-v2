import { expect } from "chai";
import { ethers } from "hardhat";

const ONE_USDC = 1_000_000n;

function computeExpected(amountUSDC: bigint, balance: bigint, supply: bigint) {
  return (amountUSDC * balance) / supply;
}

describe("ProfitDistributor", function () {
  it("reverts deposit when equity supply is zero", async function () {
    const [admin] = await ethers.getSigners();
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const usdc = await MockERC20.deploy("USD Coin", "USDC", 6);
    const equity = await MockERC20.deploy("Equity Token", "EQT", 18);

    const ProfitDistributor = await ethers.getContractFactory("ProfitDistributor");
    const distributor = await ProfitDistributor.deploy(admin.address, usdc.target, equity.target);

    await usdc.mint(admin.address, 10n * ONE_USDC);
    await usdc.connect(admin).approve(distributor.target, 10n * ONE_USDC);

    await expect(distributor.connect(admin).deposit(ONE_USDC)).to.be.revertedWith("NO_SUPPLY");
  });

  it("distributes a single deposit 70/30", async function () {
    const [admin, holderA, holderB] = await ethers.getSigners();
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const usdc = await MockERC20.deploy("USD Coin", "USDC", 6);
    const EquityToken = await ethers.getContractFactory("EquityToken");

    const supply = ethers.parseUnits("100", 18);
    const equity = await EquityToken.deploy(
      "Equity Token",
      "EQT",
      "PROP-1",
      admin.address,
      holderA.address,
      supply
    );
    await equity.connect(holderA).transfer(holderB.address, ethers.parseUnits("30", 18));

    const ProfitDistributor = await ethers.getContractFactory("ProfitDistributor");
    const distributor = await ProfitDistributor.deploy(admin.address, usdc.target, equity.target);

    const depositAmount = 100n * ONE_USDC;
    await usdc.mint(admin.address, depositAmount);
    await usdc.connect(admin).approve(distributor.target, depositAmount);
    await distributor.connect(admin).deposit(depositAmount);

    await distributor.connect(holderA).claim();
    await distributor.connect(holderB).claim();

    const balanceA = await equity.balanceOf(holderA.address);
    const balanceB = await equity.balanceOf(holderB.address);

    expect(await usdc.balanceOf(holderA.address)).to.equal(
      computeExpected(depositAmount, balanceA, supply)
    );
    expect(await usdc.balanceOf(holderB.address)).to.equal(
      computeExpected(depositAmount, balanceB, supply)
    );
  });

  it("supports multiple deposits", async function () {
    const [admin, holderA, holderB] = await ethers.getSigners();
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const usdc = await MockERC20.deploy("USD Coin", "USDC", 6);
    const EquityToken = await ethers.getContractFactory("EquityToken");

    const supply = ethers.parseUnits("100", 18);
    const equity = await EquityToken.deploy(
      "Equity Token",
      "EQT",
      "PROP-1",
      admin.address,
      holderA.address,
      supply
    );
    await equity.connect(holderA).transfer(holderB.address, ethers.parseUnits("30", 18));

    const ProfitDistributor = await ethers.getContractFactory("ProfitDistributor");
    const distributor = await ProfitDistributor.deploy(admin.address, usdc.target, equity.target);

    const depositA = 100n * ONE_USDC;
    const depositB = 50n * ONE_USDC;
    await usdc.mint(admin.address, depositA + depositB);
    await usdc.connect(admin).approve(distributor.target, depositA + depositB);

    await distributor.connect(admin).deposit(depositA);
    await distributor.connect(admin).deposit(depositB);

    await distributor.connect(holderA).claim();
    await distributor.connect(holderB).claim();

    const totalDeposit = depositA + depositB;
    const balanceA = await equity.balanceOf(holderA.address);
    const balanceB = await equity.balanceOf(holderB.address);

    expect(await usdc.balanceOf(holderA.address)).to.equal(
      computeExpected(totalDeposit, balanceA, supply)
    );
    expect(await usdc.balanceOf(holderB.address)).to.equal(
      computeExpected(totalDeposit, balanceB, supply)
    );
  });

  it("handles balance changes with sync", async function () {
    const [admin, holderA, holderB] = await ethers.getSigners();
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const usdc = await MockERC20.deploy("USD Coin", "USDC", 6);
    const EquityToken = await ethers.getContractFactory("EquityToken");

    const supply = ethers.parseUnits("100", 18);
    const equity = await EquityToken.deploy(
      "Equity Token",
      "EQT",
      "PROP-1",
      admin.address,
      holderA.address,
      supply
    );
    await equity.connect(holderA).transfer(holderB.address, ethers.parseUnits("50", 18));

    const ProfitDistributor = await ethers.getContractFactory("ProfitDistributor");
    const distributor = await ProfitDistributor.deploy(admin.address, usdc.target, equity.target);

    const depositOne = 100n * ONE_USDC;
    await usdc.mint(admin.address, depositOne);
    await usdc.connect(admin).approve(distributor.target, depositOne);
    await distributor.connect(admin).deposit(depositOne);

    await distributor.connect(holderA).claim();
    await distributor.connect(holderB).claim();

    await equity.connect(holderA).transfer(holderB.address, ethers.parseUnits("10", 18));
    await distributor.sync(holderA.address);
    await distributor.sync(holderB.address);

    const depositTwo = 100n * ONE_USDC;
    await usdc.mint(admin.address, depositTwo);
    await usdc.connect(admin).approve(distributor.target, depositTwo);
    await distributor.connect(admin).deposit(depositTwo);

    await distributor.connect(holderA).claim();
    await distributor.connect(holderB).claim();

    const balanceA = await equity.balanceOf(holderA.address);
    const balanceB = await equity.balanceOf(holderB.address);

    const expectedA = computeExpected(depositTwo, balanceA, supply);
    const expectedB = computeExpected(depositTwo, balanceB, supply);

    expect(await usdc.balanceOf(holderA.address)).to.equal(expectedA + computeExpected(depositOne, ethers.parseUnits("50", 18), supply));
    expect(await usdc.balanceOf(holderB.address)).to.equal(expectedB + computeExpected(depositOne, ethers.parseUnits("50", 18), supply));
  });

  it("reverts when claiming twice", async function () {
    const [admin, holderA] = await ethers.getSigners();
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const usdc = await MockERC20.deploy("USD Coin", "USDC", 6);
    const EquityToken = await ethers.getContractFactory("EquityToken");

    const supply = ethers.parseUnits("100", 18);
    const equity = await EquityToken.deploy(
      "Equity Token",
      "EQT",
      "PROP-1",
      admin.address,
      holderA.address,
      supply
    );

    const ProfitDistributor = await ethers.getContractFactory("ProfitDistributor");
    const distributor = await ProfitDistributor.deploy(admin.address, usdc.target, equity.target);

    const depositAmount = 10n * ONE_USDC;
    await usdc.mint(admin.address, depositAmount);
    await usdc.connect(admin).approve(distributor.target, depositAmount);
    await distributor.connect(admin).deposit(depositAmount);

    await distributor.connect(holderA).claim();
    await expect(distributor.connect(holderA).claim()).to.be.revertedWith("NO_CLAIMABLE");
  });

  it("prevents non-owner deposits", async function () {
    const [admin, holderA, attacker] = await ethers.getSigners();
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const usdc = await MockERC20.deploy("USD Coin", "USDC", 6);
    const EquityToken = await ethers.getContractFactory("EquityToken");

    const supply = ethers.parseUnits("100", 18);
    const equity = await EquityToken.deploy(
      "Equity Token",
      "EQT",
      "PROP-1",
      admin.address,
      holderA.address,
      supply
    );

    const ProfitDistributor = await ethers.getContractFactory("ProfitDistributor");
    const distributor = await ProfitDistributor.deploy(admin.address, usdc.target, equity.target);

    await usdc.mint(attacker.address, ONE_USDC);
    await usdc.connect(attacker).approve(distributor.target, ONE_USDC);

    await expect(distributor.connect(attacker).deposit(ONE_USDC)).to.be.revertedWith(
      "OwnableUnauthorizedAccount"
    );
  });
});
