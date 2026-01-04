// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./PropertyToken.sol";

/**
 * @title PropertyCrowdfund
 * @dev Crowdfunding contract for real estate properties with multi-token support
 */
contract PropertyCrowdfund is Ownable, ReentrancyGuard {
    struct Campaign {
        address propertyToken;
        uint256 fundingGoal;
        uint256 currentFunding;
        uint256 deadline;
        bool isActive;
        address[] acceptedTokens;
        mapping(address => bool) isTokenAccepted;
    }
    
    mapping(uint256 => Campaign) public campaigns;
    mapping(uint256 => mapping(address => uint256)) public investments;
    uint256 public campaignCount;
    
    event CampaignCreated(
        uint256 indexed campaignId,
        address indexed propertyToken,
        uint256 fundingGoal,
        uint256 deadline
    );
    
    event InvestmentMade(
        uint256 indexed campaignId,
        address indexed investor,
        address indexed token,
        uint256 amount
    );
    
    event CampaignFinalized(uint256 indexed campaignId, uint256 totalFunding);
    
    constructor() Ownable(msg.sender) {}
    
    function createCampaign(
        address propertyToken,
        uint256 fundingGoal,
        uint256 duration,
        address[] calldata acceptedTokens
    ) external onlyOwner returns (uint256) {
        require(propertyToken != address(0), "Invalid property token");
        require(fundingGoal > 0, "Invalid funding goal");
        require(acceptedTokens.length > 0, "No accepted tokens");
        
        uint256 campaignId = campaignCount++;
        Campaign storage campaign = campaigns[campaignId];
        
        campaign.propertyToken = propertyToken;
        campaign.fundingGoal = fundingGoal;
        campaign.deadline = block.timestamp + duration;
        campaign.isActive = true;
        campaign.acceptedTokens = acceptedTokens;
        
        for (uint256 i = 0; i < acceptedTokens.length; i++) {
            campaign.isTokenAccepted[acceptedTokens[i]] = true;
        }
        
        emit CampaignCreated(campaignId, propertyToken, fundingGoal, campaign.deadline);
        return campaignId;
    }
    
    function invest(
        uint256 campaignId,
        address token,
        uint256 amount
    ) external nonReentrant {
        Campaign storage campaign = campaigns[campaignId];
        
        require(campaign.isActive, "Campaign not active");
        require(block.timestamp < campaign.deadline, "Campaign ended");
        require(campaign.isTokenAccepted[token], "Token not accepted");
        require(amount > 0, "Invalid amount");
        
        IERC20(token).transferFrom(msg.sender, address(this), amount);
        
        investments[campaignId][msg.sender] += amount;
        campaign.currentFunding += amount;
        
        emit InvestmentMade(campaignId, msg.sender, token, amount);
    }
    
    function finalizeCampaign(uint256 campaignId) external onlyOwner {
        Campaign storage campaign = campaigns[campaignId];
        
        require(campaign.isActive, "Campaign not active");
        require(
            block.timestamp >= campaign.deadline || 
            campaign.currentFunding >= campaign.fundingGoal,
            "Cannot finalize yet"
        );
        
        campaign.isActive = false;
        emit CampaignFinalized(campaignId, campaign.currentFunding);
    }
    
    function getCampaignTokens(uint256 campaignId) 
        external 
        view 
        returns (address[] memory) 
    {
        return campaigns[campaignId].acceptedTokens;
    }
}
