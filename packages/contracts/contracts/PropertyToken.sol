// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title PropertyToken
 * @dev ERC20 token representing fractional ownership of a property
 */
contract PropertyToken is ERC20, Ownable {
    string private _propertyId;
    uint256 private _totalValue;
    
    event PropertyInfoUpdated(string propertyId, uint256 totalValue);
    
    constructor(
        string memory name,
        string memory symbol,
        string memory propertyId,
        uint256 totalValue,
        uint256 initialSupply
    ) ERC20(name, symbol) Ownable(msg.sender) {
        _propertyId = propertyId;
        _totalValue = totalValue;
        _mint(msg.sender, initialSupply);
    }
    
    function propertyId() public view returns (string memory) {
        return _propertyId;
    }
    
    function totalValue() public view returns (uint256) {
        return _totalValue;
    }
    
    function updatePropertyInfo(string memory newPropertyId, uint256 newTotalValue) 
        external 
        onlyOwner 
    {
        _propertyId = newPropertyId;
        _totalValue = newTotalValue;
        emit PropertyInfoUpdated(newPropertyId, newTotalValue);
    }
    
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }
}
