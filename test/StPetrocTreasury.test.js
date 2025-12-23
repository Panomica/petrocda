import { expect } from "chai";
import { ethers } from "hardhat";

describe("StPetrocTreasury", function () {
  let treasury;
  let owner, admin, gnosisSafe, allocator, recipient, donor;
  
  beforeEach(async function () {
    [owner, admin, gnosisSafe, allocator, recipient, donor] = await ethers.getSigners();
    
    const StPetrocTreasury = await ethers.getContractFactory("StPetrocTreasury");
    treasury = await StPetrocTreasury.deploy(admin.address, gnosisSafe.address);
    await treasury.waitForDeployment();
    
    // Grant allocator role
    const ALLOCATOR_ROLE = await treasury.ALLOCATOR_ROLE();
    await treasury.connect(admin).grantRole(ALLOCATOR_ROLE, allocator.address);
  });
  
  describe("Deployment", function () {
    it("Should set the correct admin and Gnosis Safe", async function () {
      expect(await treasury.gnosisSafe()).to.equal(gnosisSafe.address);
      
      const DEFAULT_ADMIN_ROLE = await treasury.DEFAULT_ADMIN_ROLE();
      expect(await treasury.hasRole(DEFAULT_ADMIN_ROLE, admin.address)).to.be.true;
      
      const GNOSIS_SAFE_ROLE = await treasury.GNOSIS_SAFE_ROLE();
      expect(await treasury.hasRole(GNOSIS_SAFE_ROLE, gnosisSafe.address)).to.be.true;
    });
    
    it("Should have correct sinking fund percentage", async function () {
      expect(await treasury.SINKING_FUND_PERCENTAGE()).to.equal(2000); // 20%
    });
  });
  
  describe("Fund Reception", function () {
    it("Should accept donations and split correctly", async function () {
      const donationAmount = ethers.parseEther("10");
      
      await donor.sendTransaction({
        to: await treasury.getAddress(),
        value: donationAmount,
      });
      
      const balances = await treasury.getBalances();
      const sinkingFund = balances[1];
      const operational = balances[2];
      
      // 20% to sinking fund, 80% to operational
      expect(sinkingFund).to.equal(ethers.parseEther("2"));
      expect(operational).to.equal(ethers.parseEther("8"));
      expect(await treasury.totalReceived()).to.equal(donationAmount);
    });
    
    it("Should emit FundsReceived event", async function () {
      const donationAmount = ethers.parseEther("5");
      
      await expect(
        donor.sendTransaction({
          to: await treasury.getAddress(),
          value: donationAmount,
        })
      ).to.emit(treasury, "FundsReceived");
    });
    
    it("Should handle multiple donations", async function () {
      await donor.sendTransaction({
        to: await treasury.getAddress(),
        value: ethers.parseEther("10"),
      });
      
      await donor.sendTransaction({
        to: await treasury.getAddress(),
        value: ethers.parseEther("5"),
      });
      
      const balances = await treasury.getBalances();
      expect(balances[1]).to.equal(ethers.parseEther("3")); // 20% of 15
      expect(balances[2]).to.equal(ethers.parseEther("12")); // 80% of 15
    });
  });
  
  describe("Allocations", function () {
    beforeEach(async function () {
      // Fund the treasury
      await donor.sendTransaction({
        to: await treasury.getAddress(),
        value: ethers.parseEther("10"),
      });
    });
    
    it("Should create allocation", async function () {
      const amount = ethers.parseEther("5");
      const purpose = "Church roof repair";
      
      await expect(
        treasury.connect(allocator).createAllocation(
          recipient.address,
          amount,
          purpose
        )
      ).to.emit(treasury, "AllocationCreated");
      
      const allocation = await treasury.getAllocation(0);
      expect(allocation.recipient).to.equal(recipient.address);
      expect(allocation.amount).to.equal(amount);
      expect(allocation.purpose).to.equal(purpose);
      expect(allocation.executed).to.be.false;
    });
    
    it("Should not allow allocation exceeding operational balance", async function () {
      const amount = ethers.parseEther("10"); // Operational is only 8 ETH
      
      await expect(
        treasury.connect(allocator).createAllocation(
          recipient.address,
          amount,
          "Too large"
        )
      ).to.be.revertedWith("Insufficient operational funds");
    });
    
    it("Should execute allocation by Gnosis Safe", async function () {
      const amount = ethers.parseEther("3");
      
      await treasury.connect(allocator).createAllocation(
        recipient.address,
        amount,
        "Restoration work"
      );
      
      const balanceBefore = await ethers.provider.getBalance(recipient.address);
      
      await expect(
        treasury.connect(gnosisSafe).executeAllocation(0)
      ).to.emit(treasury, "AllocationExecuted");
      
      const balanceAfter = await ethers.provider.getBalance(recipient.address);
      expect(balanceAfter - balanceBefore).to.equal(amount);
      
      const allocation = await treasury.getAllocation(0);
      expect(allocation.executed).to.be.true;
    });
    
    it("Should not allow double execution", async function () {
      await treasury.connect(allocator).createAllocation(
        recipient.address,
        ethers.parseEther("3"),
        "Work"
      );
      
      await treasury.connect(gnosisSafe).executeAllocation(0);
      
      await expect(
        treasury.connect(gnosisSafe).executeAllocation(0)
      ).to.be.revertedWith("Allocation already executed");
    });
    
    it("Should track allocations count", async function () {
      expect(await treasury.getAllocationsCount()).to.equal(0);
      
      await treasury.connect(allocator).createAllocation(
        recipient.address,
        ethers.parseEther("2"),
        "Work 1"
      );
      
      expect(await treasury.getAllocationsCount()).to.equal(1);
    });
  });
  
  describe("Sinking Fund", function () {
    beforeEach(async function () {
      await donor.sendTransaction({
        to: await treasury.getAddress(),
        value: ethers.parseEther("10"),
      });
    });
    
    it("Should allow Gnosis Safe to withdraw from sinking fund", async function () {
      const withdrawAmount = ethers.parseEther("1");
      const reason = "Emergency maintenance";
      
      await expect(
        treasury.connect(gnosisSafe).withdrawSinkingFund(
          recipient.address,
          withdrawAmount,
          reason
        )
      ).to.emit(treasury, "SinkingFundWithdrawal");
      
      const balances = await treasury.getBalances();
      expect(balances[1]).to.equal(ethers.parseEther("1")); // 2 - 1
    });
    
    it("Should not allow withdrawal exceeding sinking fund", async function () {
      await expect(
        treasury.connect(gnosisSafe).withdrawSinkingFund(
          recipient.address,
          ethers.parseEther("5"), // Only 2 ETH available
          "Too much"
        )
      ).to.be.revertedWith("Invalid amount");
    });
    
    it("Should require reason for withdrawal", async function () {
      await expect(
        treasury.connect(gnosisSafe).withdrawSinkingFund(
          recipient.address,
          ethers.parseEther("1"),
          ""
        )
      ).to.be.revertedWith("Reason required");
    });
  });
  
  describe("Access Control", function () {
    it("Should not allow non-allocator to create allocation", async function () {
      await donor.sendTransaction({
        to: await treasury.getAddress(),
        value: ethers.parseEther("10"),
      });
      
      await expect(
        treasury.connect(donor).createAllocation(
          recipient.address,
          ethers.parseEther("1"),
          "Unauthorized"
        )
      ).to.be.reverted;
    });
    
    it("Should not allow non-Gnosis Safe to execute allocation", async function () {
      await donor.sendTransaction({
        to: await treasury.getAddress(),
        value: ethers.parseEther("10"),
      });
      
      await treasury.connect(allocator).createAllocation(
        recipient.address,
        ethers.parseEther("1"),
        "Work"
      );
      
      await expect(
        treasury.connect(donor).executeAllocation(0)
      ).to.be.reverted;
    });
  });
  
  describe("Pause Functionality", function () {
    it("Should allow admin to pause", async function () {
      await treasury.connect(admin).pause();
      expect(await treasury.paused()).to.be.true;
    });
    
    it("Should not accept funds when paused", async function () {
      await treasury.connect(admin).pause();
      
      await expect(
        donor.sendTransaction({
          to: await treasury.getAddress(),
          value: ethers.parseEther("1"),
        })
      ).to.be.reverted;
    });
    
    it("Should allow admin to unpause", async function () {
      await treasury.connect(admin).pause();
      await treasury.connect(admin).unpause();
      expect(await treasury.paused()).to.be.false;
    });
  });
  
  describe("Gnosis Safe Management", function () {
    it("Should allow admin to update Gnosis Safe", async function () {
      const [, , , newSafe] = await ethers.getSigners();
      
      await expect(
        treasury.connect(admin).updateGnosisSafe(newSafe.address)
      ).to.emit(treasury, "GnosisSafeUpdated");
      
      expect(await treasury.gnosisSafe()).to.equal(newSafe.address);
    });
    
    it("Should transfer Gnosis Safe role when updating", async function () {
      const [, , , newSafe] = await ethers.getSigners();
      
      await treasury.connect(admin).updateGnosisSafe(newSafe.address);
      
      const GNOSIS_SAFE_ROLE = await treasury.GNOSIS_SAFE_ROLE();
      expect(await treasury.hasRole(GNOSIS_SAFE_ROLE, newSafe.address)).to.be.true;
      expect(await treasury.hasRole(GNOSIS_SAFE_ROLE, gnosisSafe.address)).to.be.false;
    });
  });
  
  describe("Balance Queries", function () {
    it("Should return correct balance breakdown", async function () {
      await donor.sendTransaction({
        to: await treasury.getAddress(),
        value: ethers.parseEther("10"),
      });
      
      const balances = await treasury.getBalances();
      expect(balances[0]).to.equal(ethers.parseEther("10")); // contract balance
      expect(balances[1]).to.equal(ethers.parseEther("2"));  // sinking fund
      expect(balances[2]).to.equal(ethers.parseEther("8"));  // operational
    });
  });
});
