import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-toolbox/network-helpers";

const ONE_USDC = 1_000_000n;

describe("PropertyCrowdfund", function () {
  async function expectRevert(promise: Promise<unknown>, message?: string) {
    try {
      await promise;
    } catch (error) {
      if (message) {
        const reason = (error as Error).message;
        expect(reason).to.include(message);
      }
      return;
    }

    expect.fail("Expected transaction to revert");
  }

  async function deployFixture() {
    const [admin, investor1, investor2, recipient] = await ethers.getSigners();

    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const usdc = await MockERC20.deploy("USD Coin", "USDC", 6);
    const equity = await MockERC20.deploy("Equity Token", "EQT", 18);

    const now = await time.latest();
    const startTime = now - 10;
    const endTime = now + 1000;
    const targetAmount = 3n * ONE_USDC;
    const totalEquityTokens = ethers.parseUnits("1000", 18);

    const Crowdfund = await ethers.getContractFactory("PropertyCrowdfund");
    const crowdfund = await Crowdfund.deploy(
      admin.address,
      usdc.target,
      targetAmount,
      startTime,
      endTime,
      totalEquityTokens,
      "PROP-1"
    );

    await usdc.mint(investor1.address, 10n * ONE_USDC);
    await usdc.mint(investor2.address, 10n * ONE_USDC);

    return {
      admin,
      investor1,
      investor2,
      recipient,
      usdc,
      equity,
      crowdfund,
      targetAmount,
      totalEquityTokens,
      endTime,
    };
  }

  async function deployWithSchedule(startOffset: number, endOffset: number) {
    const [admin, investor1, investor2, recipient] = await ethers.getSigners();
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const usdc = await MockERC20.deploy("USD Coin", "USDC", 6);
    const equity = await MockERC20.deploy("Equity Token", "EQT", 18);

    const now = await time.latest();
    const startTime = now + startOffset;
    const endTime = now + endOffset;
    const targetAmount = 3n * ONE_USDC;
    const totalEquityTokens = ethers.parseUnits("1000", 18);

    const Crowdfund = await ethers.getContractFactory("PropertyCrowdfund");
    const crowdfund = await Crowdfund.deploy(
      admin.address,
      usdc.target,
      targetAmount,
      startTime,
      endTime,
      totalEquityTokens,
      "PROP-1"
    );

    await usdc.mint(investor1.address, 10n * ONE_USDC);
    await usdc.mint(investor2.address, 10n * ONE_USDC);

    return {
      admin,
      investor1,
      investor2,
      recipient,
      usdc,
      equity,
      crowdfund,
      targetAmount,
      totalEquityTokens,
      startTime,
      endTime,
    };
  }

  it("records investments and raised amount", async function () {
    const { investor1, usdc, crowdfund } = await deployFixture();

    await usdc.connect(investor1).approve(crowdfund.target, 2n * ONE_USDC);
    await crowdfund.connect(investor1).invest(2n * ONE_USDC);

    expect(await crowdfund.raisedAmountUSDC()).to.equal(2n * ONE_USDC);
    expect(await crowdfund.contributionOf(investor1.address)).to.equal(2n * ONE_USDC);
  });

  it("finalizes as failed and refunds investors", async function () {
    const { investor1, usdc, crowdfund, endTime } = await deployFixture();

    await usdc.connect(investor1).approve(crowdfund.target, ONE_USDC);
    await crowdfund.connect(investor1).invest(ONE_USDC);

    await time.increaseTo(endTime + 1);
    await crowdfund.finalizeCampaign();

    const balanceBefore = await usdc.balanceOf(investor1.address);
    await crowdfund.connect(investor1).claimRefund();
    const balanceAfter = await usdc.balanceOf(investor1.address);

    expect(balanceAfter - balanceBefore).to.equal(ONE_USDC);
    expect(await crowdfund.contributionOf(investor1.address)).to.equal(0n);
  });

  it("finalizes as success and allows withdraw only once", async function () {
    const { admin, investor1, investor2, recipient, usdc, crowdfund } = await deployFixture();

    await usdc.connect(investor1).approve(crowdfund.target, 3n * ONE_USDC);
    await usdc.connect(investor2).approve(crowdfund.target, 2n * ONE_USDC);
    await crowdfund.connect(investor1).invest(3n * ONE_USDC);
    await crowdfund.connect(investor2).invest(2n * ONE_USDC);

    await crowdfund.finalizeCampaign();

    await crowdfund.connect(admin).withdrawFunds(recipient.address);
    await expectRevert(
      crowdfund.connect(admin).withdrawFunds(recipient.address),
      "Campaign not successful"
    );
  });

  it("claims equity tokens pro-rata with rounding", async function () {
    const { admin, investor1, investor2, usdc, equity, crowdfund, totalEquityTokens } =
      await deployFixture();

    await usdc.connect(investor1).approve(crowdfund.target, ONE_USDC);
    await usdc.connect(investor2).approve(crowdfund.target, 2n * ONE_USDC);
    await crowdfund.connect(investor1).invest(ONE_USDC);
    await crowdfund.connect(investor2).invest(2n * ONE_USDC);

    await crowdfund.finalizeCampaign();

    await crowdfund.connect(admin).setEquityToken(equity.target);
    await equity.mint(crowdfund.target, totalEquityTokens);

    const totalRaised = await crowdfund.raisedAmountUSDC();
    const expectedInvestor1 = (totalEquityTokens * ONE_USDC) / totalRaised;
    const expectedInvestor2 = (totalEquityTokens * (2n * ONE_USDC)) / totalRaised;

    await crowdfund.connect(investor1).claimTokens();
    await crowdfund.connect(investor2).claimTokens();

    expect(await equity.balanceOf(investor1.address)).to.equal(expectedInvestor1);
    expect(await equity.balanceOf(investor2.address)).to.equal(expectedInvestor2);
    expect(expectedInvestor1 + expectedInvestor2 <= totalEquityTokens).to.equal(true);
  });

  it("reverts invest before start time", async function () {
    const { investor1, usdc, crowdfund, startTime } = await deployWithSchedule(100, 200);

    await usdc.connect(investor1).approve(crowdfund.target, ONE_USDC);
    await time.increaseTo(startTime - 1);
    await expectRevert(crowdfund.connect(investor1).invest(ONE_USDC), "Campaign not started");
  });

  it("reverts invest after end time", async function () {
    const { investor1, usdc, crowdfund, endTime } = await deployWithSchedule(-10, 100);

    await usdc.connect(investor1).approve(crowdfund.target, ONE_USDC);
    await time.increaseTo(endTime + 1);
    await expectRevert(crowdfund.connect(investor1).invest(ONE_USDC), "Campaign ended");
  });

  it("reverts invest after finalize", async function () {
    const { investor1, investor2, usdc, crowdfund } = await deployFixture();

    await usdc.connect(investor1).approve(crowdfund.target, 2n * ONE_USDC);
    await usdc.connect(investor2).approve(crowdfund.target, ONE_USDC);
    await crowdfund.connect(investor1).invest(2n * ONE_USDC);
    await crowdfund.connect(investor2).invest(ONE_USDC);

    await crowdfund.finalizeCampaign();

    await expectRevert(crowdfund.connect(investor1).invest(ONE_USDC), "Campaign not active");
  });

  it("reverts finalize before end time if target not met", async function () {
    const { investor1, usdc, crowdfund } = await deployFixture();

    await usdc.connect(investor1).approve(crowdfund.target, ONE_USDC);
    await crowdfund.connect(investor1).invest(ONE_USDC);

    await expectRevert(crowdfund.finalizeCampaign(), "Cannot finalize yet");
  });

  it("reverts finalize when called twice", async function () {
    const { investor1, investor2, usdc, crowdfund } = await deployFixture();

    await usdc.connect(investor1).approve(crowdfund.target, 2n * ONE_USDC);
    await usdc.connect(investor2).approve(crowdfund.target, ONE_USDC);
    await crowdfund.connect(investor1).invest(2n * ONE_USDC);
    await crowdfund.connect(investor2).invest(ONE_USDC);

    await crowdfund.finalizeCampaign();
    await expectRevert(crowdfund.finalizeCampaign(), "Campaign not active");
  });

  it("reverts withdraw when called by non-admin", async function () {
    const { investor1, investor2, usdc, crowdfund } = await deployFixture();

    await usdc.connect(investor1).approve(crowdfund.target, 2n * ONE_USDC);
    await usdc.connect(investor2).approve(crowdfund.target, ONE_USDC);
    await crowdfund.connect(investor1).invest(2n * ONE_USDC);
    await crowdfund.connect(investor2).invest(ONE_USDC);
    await crowdfund.finalizeCampaign();

    await expectRevert(
      crowdfund.connect(investor1).withdrawFunds(investor1.address),
      "OwnableUnauthorizedAccount"
    );
  });

  it("reverts setEquityToken when called by non-admin", async function () {
    const { investor1, equity, crowdfund } = await deployFixture();

    await expectRevert(
      crowdfund.connect(investor1).setEquityToken(equity.target),
      "OwnableUnauthorizedAccount"
    );
  });

  it("reverts setEquityToken when called twice", async function () {
    const { admin, equity, crowdfund } = await deployFixture();

    await crowdfund.connect(admin).setEquityToken(equity.target);
    await expectRevert(
      crowdfund.connect(admin).setEquityToken(equity.target),
      "Equity token already set"
    );
  });

  it("reverts withdraw when campaign not successful", async function () {
    const { admin, crowdfund } = await deployFixture();

    await expectRevert(
      crowdfund.connect(admin).withdrawFunds(admin.address),
      "Campaign not successful"
    );
  });

  it("reverts claimRefund when campaign not failed", async function () {
    const { investor1, crowdfund } = await deployFixture();

    await expectRevert(crowdfund.connect(investor1).claimRefund(), "Campaign not failed");
  });

  it("reverts claimRefund when no contribution exists", async function () {
    const { investor1, investor2, usdc, crowdfund, endTime } = await deployFixture();

    await usdc.connect(investor1).approve(crowdfund.target, ONE_USDC);
    await crowdfund.connect(investor1).invest(ONE_USDC);
    await time.increaseTo(endTime + 1);
    await crowdfund.finalizeCampaign();

    await expectRevert(crowdfund.connect(investor2).claimRefund(), "No refund available");
  });

  it("reverts claimTokens when equity token not set", async function () {
    const { investor1, investor2, usdc, crowdfund } = await deployFixture();

    await usdc.connect(investor1).approve(crowdfund.target, 2n * ONE_USDC);
    await usdc.connect(investor2).approve(crowdfund.target, ONE_USDC);
    await crowdfund.connect(investor1).invest(2n * ONE_USDC);
    await crowdfund.connect(investor2).invest(ONE_USDC);
    await crowdfund.finalizeCampaign();

    await expectRevert(crowdfund.connect(investor1).claimTokens(), "Equity token not set");
  });

  it("reverts claimTokens when contributor has no allocation", async function () {
    const { admin, investor1, investor2, usdc, equity, crowdfund, totalEquityTokens } =
      await deployFixture();

    await usdc.connect(investor1).approve(crowdfund.target, 3n * ONE_USDC);
    await crowdfund.connect(investor1).invest(3n * ONE_USDC);
    await crowdfund.finalizeCampaign();

    await crowdfund.connect(admin).setEquityToken(equity.target);
    await equity.mint(crowdfund.target, totalEquityTokens);

    await expectRevert(crowdfund.connect(investor2).claimTokens(), "No tokens claimable");
  });

  it("reverts on double token claim", async function () {
    const { admin, investor1, usdc, equity, crowdfund, totalEquityTokens } = await deployFixture();

    await usdc.connect(investor1).approve(crowdfund.target, 3n * ONE_USDC);
    await crowdfund.connect(investor1).invest(3n * ONE_USDC);
    await crowdfund.finalizeCampaign();

    await crowdfund.connect(admin).setEquityToken(equity.target);
    await equity.mint(crowdfund.target, totalEquityTokens);

    await crowdfund.connect(investor1).claimTokens();
    await expectRevert(crowdfund.connect(investor1).claimTokens(), "No tokens claimable");
  });

  it("distributes pro-rata tokens with leftover in contract", async function () {
    const { admin, investor1, investor2, usdc, equity, crowdfund, totalEquityTokens } =
      await deployFixture();
    const [, , investor3] = await ethers.getSigners();

    await usdc.mint(investor3.address, 10n * ONE_USDC);

    await usdc.connect(investor1).approve(crowdfund.target, ONE_USDC);
    await usdc.connect(investor2).approve(crowdfund.target, 2n * ONE_USDC);
    await usdc.connect(investor3).approve(crowdfund.target, ONE_USDC);
    await crowdfund.connect(investor1).invest(ONE_USDC);
    await crowdfund.connect(investor2).invest(2n * ONE_USDC);
    await crowdfund.connect(investor3).invest(ONE_USDC);

    await crowdfund.finalizeCampaign();
    await crowdfund.connect(admin).setEquityToken(equity.target);
    await equity.mint(crowdfund.target, totalEquityTokens);

    const totalRaised = await crowdfund.raisedAmountUSDC();
    const expected1 = (totalEquityTokens * ONE_USDC) / totalRaised;
    const expected2 = (totalEquityTokens * (2n * ONE_USDC)) / totalRaised;
    const expected3 = (totalEquityTokens * ONE_USDC) / totalRaised;

    await crowdfund.connect(investor1).claimTokens();
    await crowdfund.connect(investor2).claimTokens();
    await crowdfund.connect(investor3).claimTokens();

    const claimedTotal = expected1 + expected2 + expected3;
    expect(claimedTotal <= totalEquityTokens).to.equal(true);
    expect(await equity.balanceOf(crowdfund.target)).to.equal(totalEquityTokens - claimedTotal);
  });

  it("blocks reentrancy during refund via malicious token", async function () {
    const [admin, investor1] = await ethers.getSigners();
    const MockReentrantERC20 = await ethers.getContractFactory("MockReentrantERC20");
    const reentrantUsdc = await MockReentrantERC20.deploy("USD Coin", "USDC", 6);

    const now = await time.latest();
    const startTime = now - 10;
    const endTime = now + 1000;
    const targetAmount = 3n * ONE_USDC;
    const totalEquityTokens = ethers.parseUnits("1000", 18);

    const Crowdfund = await ethers.getContractFactory("PropertyCrowdfund");
    const crowdfund = await Crowdfund.deploy(
      admin.address,
      reentrantUsdc.target,
      targetAmount,
      startTime,
      endTime,
      totalEquityTokens,
      "PROP-1"
    );

    await reentrantUsdc.mint(investor1.address, 10n * ONE_USDC);
    await reentrantUsdc.connect(investor1).approve(crowdfund.target, ONE_USDC);
    await crowdfund.connect(investor1).invest(ONE_USDC);

    await time.increaseTo(endTime + 1);
    await crowdfund.finalizeCampaign();

    const data = crowdfund.interface.encodeFunctionData("invest", [ONE_USDC]);
    await reentrantUsdc.setReentrancy(true, crowdfund.target, crowdfund.target, data);

    await expectRevert(
      crowdfund.connect(investor1).claimRefund(),
      "ReentrancyGuardReentrantCall"
    );
  });

  it("blocks reentrancy during token claim via malicious token", async function () {
    const [admin, investor1] = await ethers.getSigners();
    const MockReentrantERC20 = await ethers.getContractFactory("MockReentrantERC20");
    const usdc = await MockReentrantERC20.deploy("USD Coin", "USDC", 6);
    const equity = await MockReentrantERC20.deploy("Equity Token", "EQT", 18);

    const now = await time.latest();
    const startTime = now - 10;
    const endTime = now + 1000;
    const targetAmount = 3n * ONE_USDC;
    const totalEquityTokens = ethers.parseUnits("1000", 18);

    const Crowdfund = await ethers.getContractFactory("PropertyCrowdfund");
    const crowdfund = await Crowdfund.deploy(
      admin.address,
      usdc.target,
      targetAmount,
      startTime,
      endTime,
      totalEquityTokens,
      "PROP-1"
    );

    await usdc.mint(investor1.address, 10n * ONE_USDC);
    await usdc.connect(investor1).approve(crowdfund.target, 3n * ONE_USDC);
    await crowdfund.connect(investor1).invest(3n * ONE_USDC);

    await crowdfund.finalizeCampaign();
    await crowdfund.connect(admin).setEquityToken(equity.target);
    await equity.mint(crowdfund.target, totalEquityTokens);

    const data = crowdfund.interface.encodeFunctionData("claimTokens");
    await equity.setReentrancy(true, crowdfund.target, crowdfund.target, data);

    await expectRevert(
      crowdfund.connect(investor1).claimTokens(),
      "ReentrancyGuardReentrantCall"
    );
  });
});
