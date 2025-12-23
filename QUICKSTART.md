# Quick Start Guide - St Petroc Heritage Project

## 🚀 Fast Track to Deployment

### 1. Setup (2 minutes)

```bash
# Install dependencies
npm install

# Configure environment
cp .env.example .env
nano .env  # Add your private key and API keys
```

### 2. Local Testing (5 minutes)

```bash
# Compile contracts
npm run compile

# Run all tests
npm test

# Run specific test suite
npm run test:treasury
npm run test:custodian
```

### 3. Deploy to Polygon Amoy Testnet (3 minutes)

```bash
# Get testnet MATIC from faucet
# https://faucet.polygon.technology/

# Deploy both contracts
npm run deploy:all

# Or deploy individually
npm run deploy:treasury
npm run deploy:custodian
```

### 4. Verify Contracts (2 minutes)

```bash
# Copy contract addresses from deployment output
npx hardhat verify --network polygonAmoy <TREASURY_ADDRESS> "<ADMIN>" "<GNOSIS_SAFE>"
npx hardhat verify --network polygonAmoy <CUSTODIAN_ADDRESS> "<ADMIN>" "<SIGNER>"
```

## 📖 Key Commands

| Command | Purpose |
|---------|---------|
| `npm run compile` | Compile smart contracts |
| `npm test` | Run all tests |
| `npm run deploy:all` | Deploy Treasury + Custodian |
| `npm run deploy:treasury` | Deploy Treasury only |
| `npm run deploy:custodian` | Deploy Custodian only |
| `npm run node` | Start local Hardhat node |

## 🏛️ Contract Addresses (After Deployment)

Update these after deployment:

- **Treasury**: `0x...` (Polygon Amoy)
- **Custodian**: `0x...` (Polygon Amoy)
- **Gnosis Safe**: `0x...` (Create at https://app.safe.global)

## 💡 Quick Interactions

### Send Donation to Treasury

```javascript
// Using ethers.js
const tx = await signer.sendTransaction({
  to: "TREASURY_ADDRESS",
  value: ethers.parseEther("10.0")
});
// Automatically splits: 2 ETH → Sinking Fund, 8 ETH → Operational
```

### Create Allocation

```javascript
const treasury = await ethers.getContractAt("StPetrocTreasury", "TREASURY_ADDRESS");

// Must have ALLOCATOR_ROLE
await treasury.createAllocation(
  "0xContractorAddress",
  ethers.parseEther("5.0"),
  "Church roof repair - Phase 1"
);
```

### Mint Custodian Token

```javascript
const custodian = await ethers.getContractAt("StPetrocCustodian", "CUSTODIAN_ADDRESS");

// Create signature (typically done by backend service)
const messageHash = ethers.solidityPackedKeccak256(
  ["address", "uint256", "string", "string"],
  ["0xRecipient", ethers.parseEther("1.0"), "financial", "ipfs://Qm..."]
);
const signature = await signer.signMessage(ethers.getBytes(messageHash));

// Mint token
await custodian.mintContribution(
  "0xRecipient",
  ethers.parseEther("1.0"),
  "financial",
  "ipfs://Qm...",
  signature
);
```

## 🔐 Required Roles

### Treasury
- **Admin**: Full control, can pause, update Gnosis Safe
- **Allocator**: Create fund allocations
- **Gnosis Safe**: Execute allocations, withdraw from sinking fund

### Custodian
- **Admin**: Full control, can revoke tokens
- **Minter**: Direct minting privileges
- **Signer**: Authorize signature-based mints

## 🧪 Test Checklist

- [x] Treasury receives and splits funds correctly (20/80)
- [x] Allocations created and executed properly
- [x] Only Gnosis Safe can execute allocations
- [x] Sinking fund protected from unauthorized withdrawals
- [x] Custodian tokens cannot be transferred (Soulbound)
- [x] Signature verification prevents unauthorized minting
- [x] Token revocation works correctly
- [x] All access controls enforced

## 📊 Monitoring

After deployment, monitor:

1. **Treasury Balance**: `treasury.getBalances()`
2. **Allocations**: `treasury.getAllocationsCount()`
3. **Custodian Supply**: `custodian.balanceOf(address)`
4. **Voting Power**: `custodian.getVotingPower(address)`

## 🆘 Troubleshooting

### Issue: Compilation fails
**Solution**: Check Node.js version (recommended v20+), ensure dependencies installed

### Issue: Deployment fails
**Solution**: Ensure you have testnet MATIC and correct RPC URL in .env

### Issue: Verification fails
**Solution**: Wait 1-2 minutes after deployment, ensure API key is correct

### Issue: Transaction reverts
**Solution**: Check you have the required role for the operation

## 📚 Next Steps

1. ✅ Deploy to testnet
2. ✅ Create Gnosis Safe wallet
3. ✅ Test treasury operations
4. ✅ Mint test custodian tokens
5. ✅ Set up Snapshot space
6. ⏳ Proceed to Phase 3 (DAO + DeFi integration)

## 🔗 Useful Links

- **Polygon Amoy Faucet**: https://faucet.polygon.technology/
- **Gnosis Safe**: https://app.safe.global
- **Snapshot**: https://snapshot.org
- **PolygonScan Amoy**: https://amoy.polygonscan.com/
- **Base Sepolia Explorer**: https://sepolia.basescan.org/

## 💬 Support

- **Issues**: https://github.com/Panomica/petrocda/issues
- **Documentation**: See README.md and IMPLEMENTATION_SUMMARY.md
- **Contract Source**: `/contracts` directory
- **Tests**: `/test` directory

---

**Total Setup Time: ~15 minutes** ⚡
