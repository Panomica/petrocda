import hre from "hardhat";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  console.log("Deploying StPetrocTreasury to Polygon Amoy...");
  
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying with account:", deployer.address);
  
  // Get account balance
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", hre.ethers.formatEther(balance), "MATIC");
  
  // Set admin and Gnosis Safe addresses
  // In production, these should be different addresses
  // For testnet, we'll use the deployer as admin and a placeholder for Gnosis Safe
  const adminAddress = deployer.address;
  const gnosisSafeAddress = process.env.GNOSIS_SAFE_ADDRESS_POLYGON || deployer.address;
  
  console.log("Admin address:", adminAddress);
  console.log("Gnosis Safe address:", gnosisSafeAddress);
  
  // Deploy Treasury
  const StPetrocTreasury = await hre.ethers.getContractFactory("StPetrocTreasury");
  const treasury = await StPetrocTreasury.deploy(adminAddress, gnosisSafeAddress);
  
  await treasury.waitForDeployment();
  const treasuryAddress = await treasury.getAddress();
  
  console.log("StPetrocTreasury deployed to:", treasuryAddress);
  
  // Verify initial state
  const balances = await treasury.getBalances();
  console.log("\nInitial Treasury State:");
  console.log("- Contract Balance:", hre.ethers.formatEther(balances[0]));
  console.log("- Sinking Fund:", hre.ethers.formatEther(balances[1]));
  console.log("- Operational Balance:", hre.ethers.formatEther(balances[2]));
  
  // Grant roles for testing
  const ALLOCATOR_ROLE = await treasury.ALLOCATOR_ROLE();
  await treasury.grantRole(ALLOCATOR_ROLE, adminAddress);
  console.log("\nGranted ALLOCATOR_ROLE to admin");
  
  console.log("\n✅ Treasury Deployment Complete!");
  console.log("\nNext steps:");
  console.log("1. Update .env with GNOSIS_SAFE_ADDRESS_POLYGON if using a real Safe");
  console.log("2. Test the contract by sending funds to:", treasuryAddress);
  console.log("3. Verify contract on PolygonScan:");
  console.log(`   npx hardhat verify --network polygonAmoy ${treasuryAddress} "${adminAddress}" "${gnosisSafeAddress}"`);
  
  // Save deployment info
  const deploymentInfo = {
    network: "polygonAmoy",
    treasury: treasuryAddress,
    admin: adminAddress,
    gnosisSafe: gnosisSafeAddress,
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
  };
  
  const deploymentsDir = path.join(__dirname, "..", "deployments");
  
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir);
  }
  
  fs.writeFileSync(
    path.join(deploymentsDir, "polygonAmoy-treasury.json"),
    JSON.stringify(deploymentInfo, null, 2)
  );
  
  console.log("\nDeployment info saved to: deployments/polygonAmoy-treasury.json");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
