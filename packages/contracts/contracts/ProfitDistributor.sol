// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title ProfitDistributor
 * @notice Distributes USDC proceeds to equity token holders using an accumulator model.
 */
contract ProfitDistributor is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable usdcToken;
    IERC20 public immutable equityToken;

    uint256 public accProfitPerShare;
    mapping(address => uint256) public userDebt;

    event Deposited(uint256 amountUSDC, uint256 accProfitPerShare);
    event Claimed(address indexed user, uint256 amountUSDC);

    constructor(address admin, address usdcTokenAddress, address equityTokenAddress) Ownable(admin) {
        require(admin != address(0), "Admin required");
        require(usdcTokenAddress != address(0), "USDC required");
        require(equityTokenAddress != address(0), "Equity token required");

        usdcToken = IERC20(usdcTokenAddress);
        equityToken = IERC20(equityTokenAddress);
    }

    /**
     * @notice Deposit USDC proceeds for distribution.
     * @param amountUSDC Amount of USDC in smallest units (6 decimals).
     */
    function deposit(uint256 amountUSDC) external onlyOwner {
        require(amountUSDC > 0, "INVALID_AMOUNT");

        uint256 supply = equityToken.totalSupply();
        require(supply > 0, "NO_SUPPLY");

        usdcToken.safeTransferFrom(msg.sender, address(this), amountUSDC);

        accProfitPerShare += (amountUSDC * 1e18) / supply;

        emit Deposited(amountUSDC, accProfitPerShare);
    }

    /**
     * @notice Claim accumulated USDC profits.
     */
    function claim() external nonReentrant {
        uint256 balance = equityToken.balanceOf(msg.sender);
        uint256 accumulated = (balance * accProfitPerShare) / 1e18;
        require(accumulated > userDebt[msg.sender], "NO_CLAIMABLE");

        uint256 pending = accumulated - userDebt[msg.sender];
        userDebt[msg.sender] = accumulated;

        usdcToken.safeTransfer(msg.sender, pending);
        emit Claimed(msg.sender, pending);
    }

    /**
     * @notice View claimable USDC profits for a user.
     * @param user Address to query.
     */
    function claimable(address user) external view returns (uint256) {
        uint256 balance = equityToken.balanceOf(user);
        uint256 accumulated = (balance * accProfitPerShare) / 1e18;
        uint256 debt = userDebt[user];
        if (accumulated <= debt) {
            return 0;
        }
        return accumulated - debt;
    }

    /**
     * @notice Sync a user's debt to their current balance without transferring.
     * @param user Address to sync.
     */
    function sync(address user) external {
        uint256 balance = equityToken.balanceOf(user);
        userDebt[user] = (balance * accProfitPerShare) / 1e18;
    }
}
