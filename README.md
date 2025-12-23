# St Petroc Heritage Project

> Hybrid Stewardship model (Legal Trust + DAO + DeFi) for 15th-century church restoration

[![Hardhat](https://img.shields.io/badge/Built%20with-Hardhat-yellow.svg)](https://hardhat.org/)
[![OpenZeppelin](https://img.shields.io/badge/Secured%20by-OpenZeppelin-blue.svg)](https://openzeppelin.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)

## 🏛️ Overview

The St Petroc Heritage Project implements a novel hybrid governance model that combines traditional legal structures with modern blockchain technology to manage the restoration and preservation of a historic 15th-century church.

### Key Components

1. **Legal Trust** - Traditional legal entity for compliance and heritage regulations
2. **DAO (Decentralized Autonomous Organization)** - Community governance via Soulbound tokens
3. **DeFi Treasury** - Transparent, automated fund management with Gnosis Safe integration

## 📋 Features

### Phase 1 & 2 Implementation ✅

#### StPetrocTreasury
- **Gnosis Safe Integration** - Multi-signature security for high-value operations
- **Sinking Fund Mechanism** - Automatically locks 20% of incoming funds for long-term maintenance
- **Allocation System** - Structured fund distribution for restoration projects
- **Role-based Access Control** - Treasurer, Allocator, and Gnosis Safe roles
- **Emergency Controls** - Pause functionality and emergency withdrawal
- **Full Transparency** - Complete on-chain tracking of all funds

#### StPetrocCustodian (Soulbound Governance Token)
- **Non-transferable ERC721** - Tokens represent custodianship, not ownership
- **Contribution Tracking** - Each token records the holder's contribution (financial, labor, materials)
- **Signature-based Minting** - Secure minting with authorized signatures
- **Snapshot Integration** - Ready for off-chain voting via Snapshot
- **Revocable** - Admin can revoke tokens in case of abuse
- **Voting Power** - One token = one vote in governance decisions

## 🚀 Getting Started

### Prerequisites

- Node.js v20+ 
- npm or yarn
- Git

### Installation

```bash
# Clone the repository
git clone https://github.com/Panomica/petrocda.git
cd petrocda

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env
# Edit .env with your configuration
```

### Environment Configuration

Edit `.env` file:

```env
POLYGON_AMOY_RPC_URL=https://rpc-amoy.polygon.technology/
BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
PRIVATE_KEY=your_private_key_here
POLYGONSCAN_API_KEY=your_polygonscan_api_key
BASESCAN_API_KEY=your_basescan_api_key
GNOSIS_SAFE_ADDRESS_POLYGON=
GNOSIS_SAFE_ADDRESS_BASE=
```

### Compile Contracts

```bash
npm run compile
```

### Run Tests

```bash
# Run all tests
npm test

# Run specific test suites
npm run test:treasury
npm run test:custodian
```

## 📦 Deployment

### Local Testing

```bash
# Start local Hardhat node
npm run node

# In another terminal, deploy to local network
npx hardhat run scripts/deploy-all.js --network localhost
```

### Testnet Deployment (Polygon Amoy)

```bash
# Deploy both contracts
npm run deploy:all

# Or deploy individually
npm run deploy:treasury
npm run deploy:custodian
```

### Verify Contracts

```bash
npx hardhat verify --network polygonAmoy <TREASURY_ADDRESS> "<ADMIN_ADDRESS>" "<GNOSIS_SAFE_ADDRESS>"
npx hardhat verify --network polygonAmoy <CUSTODIAN_ADDRESS> "<ADMIN_ADDRESS>" "<SIGNER_ADDRESS>"
```

## 🏗️ Architecture

### Contract Structure

```
contracts/
├── StPetrocTreasury.sol      # Treasury management with sinking fund
└── StPetrocCustodian.sol     # Soulbound governance tokens
```

### Fund Flow

```
Donation → Treasury Contract
    ↓
20% → Sinking Fund (maintenance)
80% → Operational Fund (restoration)
    ↓
Allocations created by ALLOCATOR_ROLE
    ↓
Executed by Gnosis Safe (multi-sig)
    ↓
Funds transferred to contractors
```

### Governance Flow

```
Contribution Made
    ↓
Authorized Signature Generated
    ↓
Custodian Token Minted (Soulbound)
    ↓
Voting Power Acquired
    ↓
Participate in Snapshot Governance
    ↓
On-chain Execution via Treasury
```

## 📚 Smart Contract Documentation

### StPetrocTreasury

#### Key Functions

```solidity
// Accept donations (automatically splits 20/80)
receive() external payable

// Create allocation for restoration work
function createAllocation(address recipient, uint256 amount, string memory purpose) 
    external returns (uint256)

// Execute allocation (requires Gnosis Safe)
function executeAllocation(uint256 allocationId) external

// Withdraw from sinking fund (requires Gnosis Safe)
function withdrawSinkingFund(address to, uint256 amount, string memory reason) external

// Get balance breakdown
function getBalances() external view returns (
    uint256 contractBalance,
    uint256 sinkingFund,
    uint256 operational,
    uint256 allocated,
    uint256 withdrawn
)
```

#### Roles

- `DEFAULT_ADMIN_ROLE` - Full administrative control
- `TREASURER_ROLE` - Financial oversight
- `ALLOCATOR_ROLE` - Create fund allocations
- `GNOSIS_SAFE_ROLE` - Execute high-value operations

### StPetrocCustodian

#### Key Functions

```solidity
// Mint token with signature (public)
function mintContribution(
    address to,
    uint256 contributionAmount,
    string memory contributionType,
    string memory metadata,
    bytes memory signature
) external returns (uint256)

// Admin mint (no signature required)
function adminMint(
    address to,
    uint256 contributionAmount,
    string memory contributionType,
    string memory metadata
) external returns (uint256)

// Get voting power for governance
function getVotingPower(address custodian) external view returns (uint256)

// Get all tokens owned by custodian
function getTokensOfCustodian(address custodian) external view returns (uint256[] memory)

// Revoke token (admin only)
function revokeCustodian(uint256 tokenId, string memory reason) external
```

#### Contribution Types

- `financial` - Monetary donations
- `labor` - Work hours contributed
- `materials` - Physical materials donated
- `expertise` - Professional services

## 🔐 Security Features

- ✅ **OpenZeppelin Contracts** - Battle-tested security libraries
- ✅ **ReentrancyGuard** - Protection against reentrancy attacks
- ✅ **Access Control** - Role-based permissions
- ✅ **Pausable** - Emergency stop functionality
- ✅ **Multi-signature** - Gnosis Safe integration for critical operations
- ✅ **Soulbound Tokens** - Non-transferable to prevent speculation
- ✅ **Signature Verification** - Prevents unauthorized minting

## 🧪 Testing

Comprehensive test coverage includes:

- Fund reception and splitting (20% sinking fund)
- Allocation creation and execution
- Sinking fund withdrawals
- Access control enforcement
- Soulbound token transfers (should fail)
- Signature-based minting
- Token revocation
- Emergency controls

```bash
# Run tests with coverage
npx hardhat coverage
```

## 🗺️ Roadmap

### Phase 1: Foundation & Treasury ✅ COMPLETED
- [x] Hardhat project initialization
- [x] Treasury contract with Gnosis Safe integration
- [x] Sinking Fund mechanism (20% automatic allocation)
- [x] Deployment scripts for Polygon Amoy
- [x] Comprehensive test suite

### Phase 2: Soulbound Governance Tokens ✅ COMPLETED
- [x] Soulbound ERC721 implementation
- [x] Signature-based minting
- [x] Contribution tracking
- [x] Snapshot integration preparation
- [x] Comprehensive test suite

### Phase 3: DAO Integration & DeFi (UPCOMING)
- [ ] Implement proposal system
- [ ] Add time-locked governance
- [ ] Integrate yield strategies (Aave, Compound)
- [ ] Milestone-based fund release
- [ ] Create governance UI
- [ ] Deploy to Polygon and Base mainnet
- [ ] Professional security audit
- [ ] Establish legal trust structure

## 🌐 Supported Networks

### Testnets
- **Polygon Amoy** (chainId: 80002)
- **Base Sepolia** (chainId: 84532)

### Mainnets (Phase 3)
- **Polygon** (chainId: 137)
- **Base** (chainId: 8453)

## 💡 Usage Examples

### Donating to the Treasury

```javascript
// Send ETH/MATIC to treasury address
await signer.sendTransaction({
  to: treasuryAddress,
  value: ethers.parseEther("10.0")
});

// 2 ETH → Sinking Fund
// 8 ETH → Operational Fund
```

### Creating an Allocation

```javascript
const treasury = await ethers.getContractAt("StPetrocTreasury", treasuryAddress);

// Must have ALLOCATOR_ROLE
const tx = await treasury.createAllocation(
  contractorAddress,
  ethers.parseEther("5.0"),
  "Roof repair - Phase 1"
);

const receipt = await tx.wait();
const allocationId = receipt.events[0].args.allocationId;
```

### Minting Custodian Token

```javascript
const custodian = await ethers.getContractAt("StPetrocCustodian", custodianAddress);

// Create signature (off-chain service)
const messageHash = ethers.solidityPackedKeccak256(
  ["address", "uint256", "string", "string"],
  [recipient, amount, "financial", metadata]
);
const signature = await signer.signMessage(ethers.getBytes(messageHash));

// Mint token
await custodian.mintContribution(
  recipient,
  ethers.parseEther("1.0"),
  "financial",
  "ipfs://Qm...",
  signature
);
```

## 📞 Contact & Support

- **Project Repository**: https://github.com/Panomica/petrocda
- **Documentation**: See `/docs` folder
- **Issues**: https://github.com/Panomica/petrocda/issues

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- OpenZeppelin for secure smart contract libraries
- Gnosis Safe for multi-signature wallet infrastructure
- Snapshot for off-chain governance framework
- Polygon and Base for scalable L2 infrastructure

---

**Built with ❤️ for heritage preservation and community governance**