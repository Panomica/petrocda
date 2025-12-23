import { expect } from "chai";
import { ethers } from "hardhat";

describe("StPetrocCustodian", function () {
  let custodian;
  let admin, signer, custodian1, custodian2, unauthorized;
  
  beforeEach(async function () {
    [admin, signer, custodian1, custodian2, unauthorized] = await ethers.getSigners();
    
    const StPetrocCustodian = await ethers.getContractFactory("StPetrocCustodian");
    custodian = await StPetrocCustodian.deploy(admin.address, signer.address);
    await custodian.waitForDeployment();
  });
  
  describe("Deployment", function () {
    it("Should set correct name and symbol", async function () {
      expect(await custodian.name()).to.equal("St Petroc Custodian");
      expect(await custodian.symbol()).to.equal("STPC");
    });
    
    it("Should set correct roles", async function () {
      const DEFAULT_ADMIN_ROLE = await custodian.DEFAULT_ADMIN_ROLE();
      const MINTER_ROLE = await custodian.MINTER_ROLE();
      const SIGNER_ROLE = await custodian.SIGNER_ROLE();
      
      expect(await custodian.hasRole(DEFAULT_ADMIN_ROLE, admin.address)).to.be.true;
      expect(await custodian.hasRole(MINTER_ROLE, admin.address)).to.be.true;
      expect(await custodian.hasRole(SIGNER_ROLE, signer.address)).to.be.true;
    });
  });
  
  describe("Admin Minting", function () {
    it("Should allow admin to mint custodian token", async function () {
      const amount = ethers.parseEther("1");
      const contributionType = "financial";
      const metadata = "ipfs://Qm...";
      
      await expect(
        custodian.connect(admin).adminMint(
          custodian1.address,
          amount,
          contributionType,
          metadata
        )
      ).to.emit(custodian, "CustodianMinted");
      
      expect(await custodian.balanceOf(custodian1.address)).to.equal(1);
    });
    
    it("Should track contribution details", async function () {
      const amount = ethers.parseEther("2.5");
      const contributionType = "labor";
      const metadata = "100 hours of restoration work";
      
      await custodian.connect(admin).adminMint(
        custodian1.address,
        amount,
        contributionType,
        metadata
      );
      
      const contribution = await custodian.getContribution(1);
      expect(contribution.amount).to.equal(amount);
      expect(contribution.contributionType).to.equal(contributionType);
      expect(contribution.metadata).to.equal(metadata);
    });
    
    it("Should not allow non-admin to mint", async function () {
      await expect(
        custodian.connect(unauthorized).adminMint(
          custodian1.address,
          ethers.parseEther("1"),
          "financial",
          "test"
        )
      ).to.be.reverted;
    });
  });
  
  describe("Signature-based Minting", function () {
    it("Should mint with valid signature", async function () {
      const to = custodian1.address;
      const amount = ethers.parseEther("5");
      const contributionType = "materials";
      const metadata = "Stone donation";
      
      // Create signature
      const messageHash = ethers.solidityPackedKeccak256(
        ["address", "uint256", "string", "string"],
        [to, amount, contributionType, metadata]
      );
      
      const signature = await signer.signMessage(ethers.getBytes(messageHash));
      
      await expect(
        custodian.connect(custodian1).mintContribution(
          to,
          amount,
          contributionType,
          metadata,
          signature
        )
      ).to.emit(custodian, "CustodianMinted");
      
      expect(await custodian.balanceOf(to)).to.equal(1);
    });
    
    it("Should reject invalid signature", async function () {
      const to = custodian1.address;
      const amount = ethers.parseEther("5");
      const contributionType = "materials";
      const metadata = "Stone donation";
      
      // Create signature with wrong signer
      const messageHash = ethers.solidityPackedKeccak256(
        ["address", "uint256", "string", "string"],
        [to, amount, contributionType, metadata]
      );
      
      const signature = await unauthorized.signMessage(ethers.getBytes(messageHash));
      
      await expect(
        custodian.connect(custodian1).mintContribution(
          to,
          amount,
          contributionType,
          metadata,
          signature
        )
      ).to.be.revertedWith("Invalid signature");
    });
    
    it("Should not allow signature reuse", async function () {
      const to = custodian1.address;
      const amount = ethers.parseEther("5");
      const contributionType = "materials";
      const metadata = "Stone donation";
      
      const messageHash = ethers.solidityPackedKeccak256(
        ["address", "uint256", "string", "string"],
        [to, amount, contributionType, metadata]
      );
      
      const signature = await signer.signMessage(ethers.getBytes(messageHash));
      
      // First mint should succeed
      await custodian.connect(custodian1).mintContribution(
        to,
        amount,
        contributionType,
        metadata,
        signature
      );
      
      // Second mint with same signature should fail
      await expect(
        custodian.connect(custodian1).mintContribution(
          to,
          amount,
          contributionType,
          metadata,
          signature
        )
      ).to.be.revertedWith("Signature already used");
    });
  });
  
  describe("Soulbound (Non-transferable)", function () {
    beforeEach(async function () {
      await custodian.connect(admin).adminMint(
        custodian1.address,
        ethers.parseEther("1"),
        "financial",
        "test"
      );
    });
    
    it("Should not allow transfer between addresses", async function () {
      await expect(
        custodian.connect(custodian1).transferFrom(
          custodian1.address,
          custodian2.address,
          1
        )
      ).to.be.revertedWith("StPetrocCustodian: token is soulbound and cannot be transferred");
    });
    
    it("Should not allow safeTransferFrom", async function () {
      await expect(
        custodian.connect(custodian1)["safeTransferFrom(address,address,uint256)"](
          custodian1.address,
          custodian2.address,
          1
        )
      ).to.be.revertedWith("StPetrocCustodian: token is soulbound and cannot be transferred");
    });
  });
  
  describe("Token Tracking", function () {
    it("Should track multiple tokens per custodian", async function () {
      await custodian.connect(admin).adminMint(
        custodian1.address,
        ethers.parseEther("1"),
        "financial",
        "donation 1"
      );
      
      await custodian.connect(admin).adminMint(
        custodian1.address,
        ethers.parseEther("2"),
        "financial",
        "donation 2"
      );
      
      const tokens = await custodian.getTokensOfCustodian(custodian1.address);
      expect(tokens.length).to.equal(2);
      expect(tokens[0]).to.equal(1);
      expect(tokens[1]).to.equal(2);
    });
    
    it("Should return correct voting power", async function () {
      await custodian.connect(admin).adminMint(
        custodian1.address,
        ethers.parseEther("1"),
        "financial",
        "test"
      );
      
      await custodian.connect(admin).adminMint(
        custodian1.address,
        ethers.parseEther("2"),
        "financial",
        "test"
      );
      
      expect(await custodian.getVotingPower(custodian1.address)).to.equal(2);
    });
  });
  
  describe("Token Revocation", function () {
    beforeEach(async function () {
      await custodian.connect(admin).adminMint(
        custodian1.address,
        ethers.parseEther("1"),
        "financial",
        "test"
      );
    });
    
    it("Should allow admin to revoke token", async function () {
      await expect(
        custodian.connect(admin).revokeCustodian(1, "Violation of terms")
      ).to.emit(custodian, "CustodianRevoked");
      
      expect(await custodian.balanceOf(custodian1.address)).to.equal(0);
    });
    
    it("Should remove token from custodian's list on revocation", async function () {
      await custodian.connect(admin).adminMint(
        custodian1.address,
        ethers.parseEther("2"),
        "financial",
        "test2"
      );
      
      await custodian.connect(admin).revokeCustodian(1, "Test revocation");
      
      const tokens = await custodian.getTokensOfCustodian(custodian1.address);
      expect(tokens.length).to.equal(1);
      expect(tokens[0]).to.equal(2);
    });
    
    it("Should not allow non-admin to revoke", async function () {
      await expect(
        custodian.connect(unauthorized).revokeCustodian(1, "Unauthorized")
      ).to.be.reverted;
    });
    
    it("Should require reason for revocation", async function () {
      await expect(
        custodian.connect(admin).revokeCustodian(1, "")
      ).to.be.revertedWith("Reason required");
    });
  });
  
  describe("Snapshot Integration", function () {
    it("Should set Snapshot space ID", async function () {
      const spaceId = "stpetroc.eth";
      
      await expect(
        custodian.connect(admin).setSnapshotSpace(spaceId)
      ).to.emit(custodian, "SnapshotSpaceUpdated");
      
      expect(await custodian.snapshotSpaceId()).to.equal(spaceId);
    });
    
    it("Should only allow admin to set Snapshot space", async function () {
      await expect(
        custodian.connect(unauthorized).setSnapshotSpace("test.eth")
      ).to.be.reverted;
    });
  });
  
  describe("Metadata Updates", function () {
    beforeEach(async function () {
      await custodian.connect(admin).adminMint(
        custodian1.address,
        ethers.parseEther("1"),
        "financial",
        "original metadata"
      );
    });
    
    it("Should allow admin to update metadata", async function () {
      const newMetadata = "ipfs://QmUpdated...";
      
      await expect(
        custodian.connect(admin).updateContributionMetadata(1, newMetadata)
      ).to.emit(custodian, "ContributionUpdated");
      
      const contribution = await custodian.getContribution(1);
      expect(contribution.metadata).to.equal(newMetadata);
    });
    
    it("Should not allow non-admin to update metadata", async function () {
      await expect(
        custodian.connect(unauthorized).updateContributionMetadata(1, "new")
      ).to.be.reverted;
    });
  });
  
  describe("Pause Functionality", function () {
    it("Should allow admin to pause", async function () {
      await custodian.connect(admin).pause();
      expect(await custodian.paused()).to.be.true;
    });
    
    it("Should not allow minting when paused", async function () {
      await custodian.connect(admin).pause();
      
      await expect(
        custodian.connect(admin).adminMint(
          custodian1.address,
          ethers.parseEther("1"),
          "financial",
          "test"
        )
      ).to.be.reverted;
    });
    
    it("Should allow admin to unpause", async function () {
      await custodian.connect(admin).pause();
      await custodian.connect(admin).unpause();
      expect(await custodian.paused()).to.be.false;
    });
  });
});
