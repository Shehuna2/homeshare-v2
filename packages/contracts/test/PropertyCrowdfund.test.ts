import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-toolbox/network-helpers";

const ONE_USDC = 1_000_000n;

describe("PropertyCrowdfund", function () {
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
    await expect(crowdfund.connect(admin).withdrawFunds(recipient.address)).to.be.revertedWith(
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
    expect(expectedInvestor1 + expectedInvestor2).to.be.at.most(totalEquityTokens);
  });
});
