#!/bin/bash

# Contract Verification Script for Etherscan-compatible Block Explorers
# This script verifies deployed contracts on various networks

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
DEPLOYMENTS_FILE="$PROJECT_ROOT/deployments/testnet-addresses.json"

# Default network
NETWORK="${1:-sepolia}"

# Function to print colored output
print_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to verify a contract
verify_contract() {
    local network=$1
    local contract_address=$2
    local contract_name=$3
    shift 3
    local constructor_args=("$@")

    print_info "Verifying $contract_name on $network at $contract_address..."

    if [ ${#constructor_args[@]} -eq 0 ]; then
        # No constructor arguments
        npx hardhat verify --network "$network" "$contract_address"
    else
        # With constructor arguments
        npx hardhat verify --network "$network" "$contract_address" "${constructor_args[@]}"
    fi

    if [ $? -eq 0 ]; then
        print_info "✓ $contract_name verified successfully!"
    else
        print_warning "! Verification failed for $contract_name (might already be verified)"
    fi
}

# Main verification function
verify_all_contracts() {
    local network=$1

    print_info "====================================="
    print_info "Contract Verification for $network"
    print_info "====================================="

    # Load addresses from deployment file
    if [ ! -f "$DEPLOYMENTS_FILE" ]; then
        print_error "Deployments file not found: $DEPLOYMENTS_FILE"
        exit 1
    fi

    # Extract addresses using grep and sed (more portable than jq)
    local property_token=$(grep -A 20 "\"$network\"" "$DEPLOYMENTS_FILE" | grep "propertyToken" | sed 's/.*": "\(.*\)".*/\1/')
    local property_crowdfund=$(grep -A 20 "\"$network\"" "$DEPLOYMENTS_FILE" | grep "propertyCrowdfund" | sed 's/.*": "\(.*\)".*/\1/')
    local chain_registry=$(grep -A 20 "\"$network\"" "$DEPLOYMENTS_FILE" | grep "chainRegistry" | sed 's/.*": "\(.*\)".*/\1/')

    if [ -z "$property_token" ] || [ "$property_token" = "" ]; then
        print_error "No contract addresses found for network: $network"
        exit 1
    fi

    print_info "Contract addresses loaded from deployments file"
    print_info "PropertyToken: $property_token"
    print_info "PropertyCrowdfund: $property_crowdfund"
    print_info "ChainRegistry: $chain_registry"
    echo ""

    # Verify PropertyToken with constructor arguments
    # Arguments: name, symbol, propertyId, totalValue, initialSupply
    case "$network" in
        sepolia)
            verify_contract "$network" "$property_token" "PropertyToken" \
                "Sepolia Property Token" \
                "SPT" \
                "property-sepolia-1" \
                "1000000000000000000000000" \
                "100000000000000000000000"
            ;;
        base-sepolia)
            verify_contract "$network" "$property_token" "PropertyToken" \
                "Base Sepolia Property Token" \
                "BSPT" \
                "property-base-sepolia-1" \
                "1000000000000000000000000" \
                "100000000000000000000000"
            ;;
        canton-testnet)
            verify_contract "$network" "$property_token" "PropertyToken" \
                "Canton Testnet Property Token" \
                "CTPT" \
                "property-canton-testnet-1" \
                "1000000000000000000000000" \
                "100000000000000000000000"
            ;;
        *)
            print_warning "Unknown network for PropertyToken verification: $network"
            print_warning "Skipping PropertyToken verification"
            ;;
    esac

    echo ""

    # Verify PropertyCrowdfund (no constructor arguments)
    verify_contract "$network" "$property_crowdfund" "PropertyCrowdfund"

    echo ""

    # Verify ChainRegistry (no constructor arguments)
    verify_contract "$network" "$chain_registry" "ChainRegistry"

    echo ""
    print_info "====================================="
    print_info "Verification Complete!"
    print_info "====================================="
}

# Function to show usage
show_usage() {
    echo "Usage: $0 [network]"
    echo ""
    echo "Networks:"
    echo "  sepolia         - Ethereum Sepolia Testnet (default)"
    echo "  base-sepolia    - Base Sepolia Testnet"
    echo "  canton-testnet  - Canton Testnet"
    echo "  ethereum        - Ethereum Mainnet"
    echo "  base            - Base Mainnet"
    echo "  canton          - Canton Mainnet"
    echo ""
    echo "Example:"
    echo "  $0 sepolia"
    echo "  $0 base-sepolia"
}

# Main script execution
if [ "$1" = "--help" ] || [ "$1" = "-h" ]; then
    show_usage
    exit 0
fi

# Check if hardhat is available
if ! command -v npx &> /dev/null; then
    print_error "npx command not found. Please install Node.js and npm."
    exit 1
fi

# Check if .env file exists
if [ ! -f "$PROJECT_ROOT/.env" ]; then
    print_warning ".env file not found. Make sure environment variables are set."
    print_warning "Copy .env.example to .env and fill in the required values."
fi

# Run verification
verify_all_contracts "$NETWORK"

print_info ""
print_info "Note: If verification fails with 'Already Verified', the contract is already verified."
print_info "You can check the verification status on the block explorer."
