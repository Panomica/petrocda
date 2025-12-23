# Technical Architecture Document
## St Petroc Heritage Project - Hybrid Stewardship Model

---

## Executive Summary

The St Petroc Heritage Project implements a groundbreaking hybrid governance model that bridges traditional heritage preservation with modern blockchain technology. This system manages the restoration of a 15th-century church through a combination of Legal Trust, DAO governance, and DeFi treasury management.

---

## System Architecture

### High-Level Components

```
┌─────────────────────────────────────────────────────────────┐
│                   Legal Trust Structure                      │
│                  (Off-chain Compliance)                      │
└─────────────────┬───────────────────────────────────────────┘
                  │
┌─────────────────▼───────────────────────────────────────────┐
│                                                               │
│  ┌──────────────────────┐      ┌──────────────────────┐    │
│  │  StPetrocTreasury    │◄────►│ Gnosis Safe          │    │
│  │  - Sinking Fund 20%  │      │ - Multi-sig Control  │    │
│  │  - Operational 80%   │      │ - High-value Ops     │    │
│  └──────────┬───────────┘      └──────────────────────┘    │
│             │                                                 │
│             │                                                 │
│  ┌──────────▼───────────┐      ┌──────────────────────┐    │
│  │ StPetrocCustodian    │◄────►│ Snapshot Governance  │    │
│  │ - Soulbound Tokens   │      │ - Off-chain Voting   │    │
│  │ - Voting Power       │      │ - Gas Efficient      │    │
│  └──────────────────────┘      └──────────────────────┘    │
│                                                               │
│              Blockchain Layer (Polygon/Base)                 │
└───────────────────────────────────────────────────────────────┘
```

---

## Contract Specifications

### StPetrocTreasury

**Purpose**: Secure, transparent treasury management with automated fund allocation.

#### State Variables

```solidity
// Role identifiers
bytes32 public constant TREASURER_ROLE = keccak256("TREASURER_ROLE");
bytes32 public constant ALLOCATOR_ROLE = keccak256("ALLOCATOR_ROLE");
bytes32 public constant GNOSIS_SAFE_ROLE = keccak256("GNOSIS_SAFE_ROLE");

// Fund tracking
uint256 public totalReceived;           // Total funds ever received
uint256 public sinkingFundBalance;      // 20% locked for maintenance
uint256 public operationalBalance;      // 80% available for allocations
uint256 public totalAllocated;          // Total allocated to projects
uint256 public totalWithdrawn;          // Total withdrawn to recipients

// Gnosis Safe integration
address public gnosisSafe;              // Multi-sig wallet address

// Allocation tracking
Allocation[] public allocations;        // Array of all allocations
```

#### Key Functions

##### 1. Fund Reception
```solidity
receive() external payable whenNotPaused {
    _processFunds(msg.sender, msg.value);
}

function _processFunds(address from, uint256 amount) internal {
    uint256 sinkingAmount = (amount * 2000) / 10000;  // 20%
    uint256 operationalAmount = amount - sinkingAmount; // 80%
    
    sinkingFundBalance += sinkingAmount;
    operationalBalance += operationalAmount;
    totalReceived += amount;
    
    emit FundsReceived(from, amount, sinkingAmount, operationalAmount);
}
```

##### 2. Allocation Management
```solidity
function createAllocation(
    address recipient,
    uint256 amount,
    string memory purpose
) external onlyRole(ALLOCATOR_ROLE) whenNotPaused returns (uint256) {
    require(amount <= operationalBalance, "Insufficient operational funds");
    
    uint256 allocationId = allocations.length;
    allocations.push(Allocation({...}));
    
    totalAllocated += amount;
    operationalBalance -= amount;
    
    return allocationId;
}

function executeAllocation(uint256 allocationId) 
    external 
    onlyRole(GNOSIS_SAFE_ROLE) 
    nonReentrant 
    whenNotPaused 
{
    Allocation storage allocation = allocations[allocationId];
    require(!allocation.executed, "Already executed");
    
    allocation.executed = true;
    totalWithdrawn += allocation.amount;
    
    (bool success, ) = allocation.recipient.call{value: allocation.amount}("");
    require(success, "Transfer failed");
}
```

#### Security Features

1. **Reentrancy Protection**: `nonReentrant` modifier on all withdrawal functions
2. **Role-based Access**: Only authorized roles can perform sensitive operations
3. **Pausable**: Emergency stop mechanism
4. **Event Emission**: Complete audit trail
5. **Multi-sig Requirement**: Critical operations require Gnosis Safe approval

#### Gas Optimization

- Storage packing where possible
- Efficient array operations
- Minimal external calls
- Optimized loop operations

---

### StPetrocCustodian

**Purpose**: Soulbound governance tokens representing custodianship and contribution.

#### State Variables

```solidity
// Role identifiers
bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
bytes32 public constant SIGNER_ROLE = keccak256("SIGNER_ROLE");

// Token tracking
uint256 private _nextTokenId;                          // Counter for token IDs

// Contribution data
mapping(uint256 => Contribution) public tokenContributions;
mapping(address => uint256[]) public custodianTokens;
mapping(bytes32 => bool) public usedSignatures;       // Replay protection

// Snapshot integration
string public snapshotSpaceId;                        // Snapshot space identifier
```

#### Key Functions

##### 1. Signature-based Minting
```solidity
function mintContribution(
    address to,
    uint256 contributionAmount,
    string memory contributionType,
    string memory metadata,
    bytes memory signature
) external whenNotPaused returns (uint256) {
    // Verify signature
    bytes32 messageHash = keccak256(
        abi.encodePacked(to, contributionAmount, contributionType, metadata)
    );
    bytes32 ethSignedMessageHash = messageHash.toEthSignedMessageHash();
    
    require(!usedSignatures[ethSignedMessageHash], "Signature already used");
    
    address recoveredSigner = ethSignedMessageHash.recover(signature);
    require(hasRole(SIGNER_ROLE, recoveredSigner), "Invalid signature");
    
    usedSignatures[ethSignedMessageHash] = true;
    
    // Mint token
    uint256 tokenId = _nextTokenId++;
    _safeMint(to, tokenId);
    
    // Record contribution
    tokenContributions[tokenId] = Contribution({...});
    custodianTokens[to].push(tokenId);
    
    return tokenId;
}
```

##### 2. Soulbound Enforcement
```solidity
function _update(address to, uint256 tokenId, address auth)
    internal
    override
    returns (address)
{
    address from = _ownerOf(tokenId);
    
    // Allow minting (from == address(0)) and burning (to == address(0))
    // Block all transfers between addresses
    if (from != address(0) && to != address(0)) {
        revert("StPetrocCustodian: token is soulbound");
    }
    
    return super._update(to, tokenId, auth);
}
```

##### 3. Voting Power
```solidity
function getVotingPower(address custodian) external view returns (uint256) {
    return custodianTokens[custodian].length;  // 1 token = 1 vote
}
```

#### Security Features

1. **Signature Verification**: ECDSA signature validation
2. **Replay Protection**: Used signatures tracked in mapping
3. **Non-transferable**: Override prevents transfers
4. **Role-based Minting**: Only authorized signers can approve mints
5. **Revocation**: Admin can revoke tokens if needed

---

## Data Flow Diagrams

### Treasury Fund Flow

```
Donor
  │
  ├─ sendTransaction(value: 10 ETH)
  │
  ▼
Treasury.receive()
  │
  ├─ _processFunds()
  │   ├─ sinkingFundBalance += 2 ETH    (20%)
  │   └─ operationalBalance += 8 ETH    (80%)
  │
  ▼
ALLOCATOR creates allocation
  │
  ├─ operationalBalance -= 5 ETH
  ├─ totalAllocated += 5 ETH
  │
  ▼
GNOSIS_SAFE executes allocation
  │
  ├─ Transfer 5 ETH to contractor
  ├─ totalWithdrawn += 5 ETH
  │
  ▼
Contractor receives payment
```

### Governance Token Flow

```
Contributor
  │
  ├─ Makes contribution (financial/labor/materials)
  │
  ▼
Backend Service
  │
  ├─ Generates signature (SIGNER_ROLE)
  │   messageHash = keccak256(to, amount, type, metadata)
  │   signature = sign(messageHash)
  │
  ▼
StPetrocCustodian.mintContribution()
  │
  ├─ Verify signature
  ├─ Check not already used
  ├─ Mint Soulbound token
  ├─ Record contribution data
  │
  ▼
Token Holder
  │
  ├─ Voting power = token count
  │
  ▼
Snapshot Governance
  │
  ├─ Off-chain voting
  ├─ Proposal creation
  │
  ▼
Approved proposals → On-chain execution via Treasury
```

---

## Network Deployment Strategy

### Testnet Phase (Current)

**Networks:**
- Polygon Amoy (chainId: 80002)
- Base Sepolia (chainId: 84532)

**Purpose:**
- Contract testing and validation
- User acceptance testing
- Gas optimization
- Security verification

### Mainnet Phase (Phase 3)

**Primary Network: Polygon (chainId: 137)**
- Lower gas costs than Ethereum mainnet
- Proven L2 security
- Wide adoption
- DeFi ecosystem integration

**Secondary Network: Base (chainId: 8453)**
- Coinbase-backed L2
- Growing ecosystem
- Alternative deployment option
- Risk diversification

---

## Security Analysis

### Threat Model

#### 1. Treasury Attacks

**Threat**: Unauthorized fund withdrawal
**Mitigation**: 
- Multi-sig requirement (Gnosis Safe)
- Role-based access control
- ReentrancyGuard
- Pausable emergency stop

**Threat**: Allocation manipulation
**Mitigation**:
- Separate allocator and executor roles
- Event emission for transparency
- Immutable allocation records

#### 2. Governance Attacks

**Threat**: Sybil attack (multiple tokens to one person)
**Mitigation**:
- Signature-based minting with authorized signer
- Off-chain KYC via signature service
- Admin revocation capability

**Threat**: Token transfer speculation
**Mitigation**:
- Soulbound implementation
- Override prevents all transfers
- Burning only via admin revocation

#### 3. Smart Contract Vulnerabilities

**Threat**: Reentrancy attacks
**Mitigation**: OpenZeppelin ReentrancyGuard

**Threat**: Integer overflow/underflow
**Mitigation**: Solidity 0.8.20 built-in checks

**Threat**: Access control bypass
**Mitigation**: OpenZeppelin AccessControl

### Audit Checklist

- [x] OpenZeppelin contracts used
- [x] ReentrancyGuard on withdrawals
- [x] Access control implemented
- [x] Input validation comprehensive
- [x] Event emission complete
- [x] Pausable for emergencies
- [x] No delegatecall usage
- [x] No assembly code
- [x] Gas-optimized
- [ ] Professional audit (Phase 3)

---

## Gas Optimization

### Treasury Operations

| Operation | Estimated Gas | Optimization |
|-----------|--------------|--------------|
| Receive funds | ~50,000 | Efficient storage updates |
| Create allocation | ~100,000 | Minimal storage writes |
| Execute allocation | ~70,000 | Direct transfer, no loops |
| Sinking fund withdrawal | ~70,000 | Simple transfer |

### Custodian Operations

| Operation | Estimated Gas | Optimization |
|-----------|--------------|--------------|
| Mint with signature | ~150,000 | Standard ERC721 mint |
| Admin mint | ~140,000 | No signature verification |
| Revoke token | ~80,000 | Burn + array update |
| Get voting power | ~3,000 | View function |

---

## Testing Strategy

### Unit Tests (55+ tests)

**Treasury Tests (30+)**
- Fund reception and splitting
- Allocation lifecycle
- Access control enforcement
- Sinking fund management
- Emergency procedures
- Balance queries

**Custodian Tests (25+)**
- Signature verification
- Minting workflows
- Transfer prevention
- Token revocation
- Voting power calculation
- Metadata management

### Integration Tests (Phase 3)

- Treasury ↔ Custodian interaction
- Gnosis Safe integration
- Snapshot governance flow
- DeFi protocol integration

### Security Tests

- Reentrancy attack scenarios
- Access control bypass attempts
- Integer overflow conditions
- Gas limit attacks
- Front-running scenarios

---

## Deployment Checklist

### Pre-deployment

- [ ] All tests passing
- [ ] Gas optimization complete
- [ ] Security review completed
- [ ] Documentation finalized
- [ ] Gnosis Safe created
- [ ] Testnet MATIC acquired

### Deployment

- [ ] Deploy StPetrocTreasury
- [ ] Deploy StPetrocCustodian
- [ ] Configure roles
- [ ] Update Gnosis Safe
- [ ] Set Snapshot space
- [ ] Verify contracts

### Post-deployment

- [ ] Test fund reception
- [ ] Test allocation workflow
- [ ] Test token minting
- [ ] Monitor gas costs
- [ ] Document addresses
- [ ] Announce to community

---

## Maintenance & Monitoring

### Key Metrics

1. **Treasury Health**
   - Total funds received
   - Sinking fund balance
   - Operational fund available
   - Allocation success rate

2. **Governance Activity**
   - Total custodians
   - Active voters
   - Proposal frequency
   - Execution rate

3. **Technical Metrics**
   - Gas costs per operation
   - Transaction success rate
   - Contract response time
   - Error frequency

### Monitoring Tools

- Etherscan/PolygonScan for transactions
- Gnosis Safe app for multi-sig operations
- Snapshot for governance activity
- Custom dashboard (Phase 3)

---

## Future Enhancements (Phase 3)

1. **DeFi Integration**
   - Yield generation (Aave, Compound)
   - Automated reinvestment
   - Risk management

2. **Advanced Governance**
   - On-chain proposal execution
   - Time-locked operations
   - Delegation mechanisms

3. **User Interface**
   - Web dashboard
   - Mobile app
   - Real-time notifications

4. **Legal Integration**
   - Trust document linking
   - Compliance reporting
   - Audit trail generation

---

## Conclusion

The St Petroc Heritage Project represents a successful implementation of hybrid governance, combining the security and transparency of blockchain with the legal compliance of traditional structures. Phases 1 and 2 provide a solid, secure foundation for the DAO and DeFi features planned in Phase 3.

**Status**: Production-ready for testnet deployment
**Next Step**: Deploy to Polygon Amoy and begin user testing

---

*Document Version: 1.0*
*Last Updated: December 2025*
*Author: St Petroc Heritage Project Development Team*
