// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title EquityToken
 * @notice Non-inflationary ERC20 representing equity ownership of a single property.
 */
contract EquityToken is ERC20 {
    string public propertyId;
    address public admin;

    /**
     * @param name Token name.
     * @param symbol Token symbol.
     * @param propertyIdValue Off-chain property identifier.
     * @param adminValue Admin address (no special permissions).
     * @param initialHolder Recipient of the fixed supply.
     * @param totalSupplyAmount Total fixed supply (18 decimals assumed).
     */
    constructor(
        string memory name,
        string memory symbol,
        string memory propertyIdValue,
        address adminValue,
        address initialHolder,
        uint256 totalSupplyAmount
    ) ERC20(name, symbol) {
        require(initialHolder != address(0), "Invalid initial holder");
        require(totalSupplyAmount > 0, "Supply must be > 0");

        propertyId = propertyIdValue;
        admin = adminValue;
        _mint(initialHolder, totalSupplyAmount);
    }
}
