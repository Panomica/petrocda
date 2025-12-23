import hre from "hardhat";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  console.log("Deploying St Petroc Heritage Project to Polygon Amoy...\n");
  
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying with account:", deployer.address);
  
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", hre.ethers.formatEther(balance), "MATIC\n");
  
  // Deploy Treasury
  console.log("1. Deploying Treasury...");
  const adminAddress = deployer.address;
  const gnosisSafeAddress = process.env.GNOSIS_SAFE_ADDRESS_POLYGON || deployer.address;
  
  const StPetrocTreasury = await hre.ethers.getContractFactory("StPetrocTreasury");
  const treasury = await StPetrocTreasury.deploy(adminAddress, gnosisSafeAddress);
  await treasury.waitForDeployment();
  const treasuryAddress = await treasury.getAddress();
  
  console.log("✓ Treasury deployed to:", treasuryAddress);
  
  // Grant ALLOCATOR_ROLE
  const ALLOCATOR_ROLE = await treasury.ALLOCATOR_ROLE();
  await treasury.grantRole(ALLOCATOR_ROLE, adminAddress);
  
  // Deploy Custodian Token
  console.log("\n2. Deploying Custodian Token...");
  const signerAddress = deployer.address;
  
  const StPetrocCustodian = await hre.ethers.getContractFactory("StPetrocCustodian");
  const custodian = await StPetrocCustodian.deploy(adminAddress, signerAddress);
  await custodian.waitForDeployment();
  const custodianAddress = await custodian.getAddress();
  
  console.log("✓ Custodian Token deployed to:", custodianAddress);
  
  // Set Snapshot space
  const snapshotSpaceId = "stpetroc.eth";
  await custodian.setSnapshotSpace(snapshotSpaceId);
  console.log("✓ Snapshot space configured:", snapshotSpaceId);
  
  // Summary
  console.log("\n" + "=".repeat(60));
  console.log("🏛️  ST PETROC HERITAGE PROJECT - DEPLOYMENT COMPLETE");
  console.log("=".repeat(60));
  console.log("\n📋 Contract Addresses:");
  console.log("├─ Treasury:        ", treasuryAddress);
  console.log("├─ Custodian Token: ", custodianAddress);
  console.log("├─ Admin:           ", adminAddress);
  console.log("└─ Gnosis Safe:     ", gnosisSafeAddress);
  
  console.log("\n📊 Treasury Features:");
  console.log("├─ Sinking Fund:     20% of all incoming funds");
  console.log("├─ Operational Fund: 80% for restoration work");
  console.log("└─ Multi-sig:        Integrated with Gnosis Safe");
  
  console.log("\n🎫 Custodian Token Features:");
  console.log("├─ Type:            Soulbound (Non-transferable ERC721)");
  console.log("├─ Governance:      Snapshot-ready");
  console.log("└─ Minting:         Signature-based contribution tracking");
  
  console.log("\n🚀 Next Steps:");
  console.log("1. Fund the deployer account with testnet MATIC");
  console.log("2. Test Treasury by sending funds to:", treasuryAddress);
  console.log("3. Mint test Custodian tokens");
  console.log("4. Set up Snapshot space at https://snapshot.org");
  console.log("5. Deploy to mainnet (Polygon/Base) after testing");
  
  console.log("\n📝 Verification Commands:");
  console.log(`npx hardhat verify --network polygonAmoy ${treasuryAddress} "${adminAddress}" "${gnosisSafeAddress}"`);
  console.log(`npx hardhat verify --network polygonAmoy ${custodianAddress} "${adminAddress}" "${signerAddress}"`);
  
  // Save deployment info
  const deploymentInfo = {
    network: "polygonAmoy",
    chainId: 80002,
    contracts: {
      treasury: treasuryAddress,
      custodian: custodianAddress,
    },
    config: {
      admin: adminAddress,
      gnosisSafe: gnosisSafeAddress,
      signer: signerAddress,
      snapshotSpaceId: snapshotSpaceId,
    },
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
  };
  
  const deploymentsDir = path.join(__dirname, "..", "deployments");
  
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir);
  }
  
  fs.writeFileSync(
    path.join(deploymentsDir, "polygonAmoy-full.json"),
    JSON.stringify(deploymentInfo, null, 2)
  );
  
  console.log("\n💾 Deployment info saved to: deployments/polygonAmoy-full.json");
  console.log("\n" + "=".repeat(60) + "\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
