import hre from "hardhat";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  console.log("Deploying StPetrocCustodian to Polygon Amoy...");
  
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying with account:", deployer.address);
  
  // Get account balance
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", hre.ethers.formatEther(balance), "MATIC");
  
  // Set admin and signer addresses
  const adminAddress = deployer.address;
  const signerAddress = deployer.address; // In production, use a separate signing service
  
  console.log("Admin address:", adminAddress);
  console.log("Signer address:", signerAddress);
  
  // Deploy Custodian Token
  const StPetrocCustodian = await hre.ethers.getContractFactory("StPetrocCustodian");
  const custodian = await StPetrocCustodian.deploy(adminAddress, signerAddress);
  
  await custodian.waitForDeployment();
  const custodianAddress = await custodian.getAddress();
  
  console.log("StPetrocCustodian deployed to:", custodianAddress);
  
  // Verify initial state
  const name = await custodian.name();
  const symbol = await custodian.symbol();
  
  console.log("\nToken Details:");
  console.log("- Name:", name);
  console.log("- Symbol:", symbol);
  console.log("- Type: Soulbound (Non-transferable)");
  
  // Set Snapshot space (example)
  const snapshotSpaceId = "stpetroc.eth"; // Update with actual Snapshot space
  await custodian.setSnapshotSpace(snapshotSpaceId);
  console.log("\nSnapshot Space ID set to:", snapshotSpaceId);
  
  console.log("\n✅ Custodian Token Deployment Complete!");
  console.log("\nNext steps:");
  console.log("1. Set up Snapshot space at https://snapshot.org");
  console.log("2. Configure Snapshot to use this contract address:", custodianAddress);
  console.log("3. Test minting with mintContribution function");
  console.log("4. Verify contract on PolygonScan:");
  console.log(`   npx hardhat verify --network polygonAmoy ${custodianAddress} "${adminAddress}" "${signerAddress}"`);
  
  // Save deployment info
  const deploymentInfo = {
    network: "polygonAmoy",
    custodian: custodianAddress,
    admin: adminAddress,
    signer: signerAddress,
    deployer: deployer.address,
    snapshotSpaceId: snapshotSpaceId,
    timestamp: new Date().toISOString(),
  };
  
  const deploymentsDir = path.join(__dirname, "..", "deployments");
  
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir);
  }
  
  fs.writeFileSync(
    path.join(deploymentsDir, "polygonAmoy-custodian.json"),
    JSON.stringify(deploymentInfo, null, 2)
  );
  
  console.log("\nDeployment info saved to: deployments/polygonAmoy-custodian.json");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
