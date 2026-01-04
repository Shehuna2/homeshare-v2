// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title ChainRegistry
 * @dev Registry for tracking supported chains and tokens
 */
contract ChainRegistry is Ownable {
    struct ChainInfo {
        uint256 chainId;
        string name;
        bool isSupported;
    }
    
    struct TokenInfo {
        address tokenAddress;
        string symbol;
        uint256 chainId;
        bool isSupported;
    }
    
    mapping(uint256 => ChainInfo) public chains;
    mapping(bytes32 => TokenInfo) public tokens;
    
    uint256[] public supportedChainIds;
    
    event ChainAdded(uint256 indexed chainId, string name);
    event ChainRemoved(uint256 indexed chainId);
    event TokenAdded(uint256 indexed chainId, address indexed tokenAddress, string symbol);
    event TokenRemoved(uint256 indexed chainId, address indexed tokenAddress);
    
    constructor() Ownable(msg.sender) {}
    
    function addChain(uint256 chainId, string calldata name) external onlyOwner {
        require(!chains[chainId].isSupported, "Chain already added");
        
        chains[chainId] = ChainInfo({
            chainId: chainId,
            name: name,
            isSupported: true
        });
        
        supportedChainIds.push(chainId);
        emit ChainAdded(chainId, name);
    }
    
    function removeChain(uint256 chainId) external onlyOwner {
        require(chains[chainId].isSupported, "Chain not supported");
        chains[chainId].isSupported = false;
        emit ChainRemoved(chainId);
    }
    
    function addToken(
        uint256 chainId,
        address tokenAddress,
        string calldata symbol
    ) external onlyOwner {
        require(chains[chainId].isSupported, "Chain not supported");
        
        bytes32 tokenKey = keccak256(abi.encodePacked(chainId, tokenAddress));
        require(!tokens[tokenKey].isSupported, "Token already added");
        
        tokens[tokenKey] = TokenInfo({
            tokenAddress: tokenAddress,
            symbol: symbol,
            chainId: chainId,
            isSupported: true
        });
        
        emit TokenAdded(chainId, tokenAddress, symbol);
    }
    
    function removeToken(uint256 chainId, address tokenAddress) external onlyOwner {
        bytes32 tokenKey = keccak256(abi.encodePacked(chainId, tokenAddress));
        require(tokens[tokenKey].isSupported, "Token not supported");
        
        tokens[tokenKey].isSupported = false;
        emit TokenRemoved(chainId, tokenAddress);
    }
    
    function isChainSupported(uint256 chainId) external view returns (bool) {
        return chains[chainId].isSupported;
    }
    
    function isTokenSupported(uint256 chainId, address tokenAddress) 
        external 
        view 
        returns (bool) 
    {
        bytes32 tokenKey = keccak256(abi.encodePacked(chainId, tokenAddress));
        return tokens[tokenKey].isSupported;
    }
    
    function getSupportedChains() external view returns (uint256[] memory) {
        return supportedChainIds;
    }
}
