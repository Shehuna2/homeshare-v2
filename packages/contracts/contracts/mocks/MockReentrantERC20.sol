// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockReentrantERC20 is ERC20 {
    uint8 private immutable _customDecimals;
    bool private _reenterEnabled;
    bool private _reentering;
    address private _reenterTarget;
    address private _reenterCaller;
    bytes private _reenterData;

    constructor(string memory name, string memory symbol, uint8 decimals_) ERC20(name, symbol) {
        _customDecimals = decimals_;
    }

    function decimals() public view override returns (uint8) {
        return _customDecimals;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function setReentrancy(
        bool enabled,
        address target,
        address caller,
        bytes calldata data
    ) external {
        _reenterEnabled = enabled;
        _reenterTarget = target;
        _reenterCaller = caller;
        _reenterData = data;
    }

    function transfer(address to, uint256 value) public override returns (bool) {
        bool result = super.transfer(to, value);
        _maybeReenter(msg.sender);
        return result;
    }

    function transferFrom(address from, address to, uint256 value) public override returns (bool) {
        bool result = super.transferFrom(from, to, value);
        _maybeReenter(msg.sender);
        return result;
    }

    function _maybeReenter(address caller) private {
        if (!_reenterEnabled || _reentering) {
            return;
        }
        if (_reenterTarget == address(0) || caller != _reenterCaller) {
            return;
        }

        _reentering = true;
        (bool success, bytes memory returndata) = _reenterTarget.call(_reenterData);
        if (!success) {
            assembly {
                revert(add(returndata, 32), mload(returndata))
            }
        }
        _reentering = false;
    }
}
