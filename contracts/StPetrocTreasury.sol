// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title StPetrocTreasury
 * @dev Treasury contract for St Petroc Heritage Project
 * @notice Manages funds with Gnosis Safe integration and Sinking Fund mechanism
 * 
 * Key Features:
 * - Integration with Gnosis Safe for multi-sig security
 * - Sinking Fund: 20% of incoming funds locked for maintenance
 * - Role-based access control for different operations
 * - Emergency pause functionality
 * - Transparent fund tracking and allocation
 */
contract StPetrocTreasury is AccessControl, ReentrancyGuard, Pausable {
    // Roles
    bytes32 public constant TREASURER_ROLE = keccak256("TREASURER_ROLE");
    bytes32 public constant ALLOCATOR_ROLE = keccak256("ALLOCATOR_ROLE");
    bytes32 public constant GNOSIS_SAFE_ROLE = keccak256("GNOSIS_SAFE_ROLE");
    
    // Sinking Fund percentage (20% = 2000 basis points)
    uint256 public constant SINKING_FUND_PERCENTAGE = 2000; // 20%
    uint256 public constant BASIS_POINTS = 10000; // 100%
    
    // Fund tracking
    uint256 public totalReceived;
    uint256 public sinkingFundBalance;
    uint256 public operationalBalance;
    uint256 public totalAllocated;
    uint256 public totalWithdrawn;
    
    // Gnosis Safe address
    address public gnosisSafe;
    
    // Allocation tracking
    struct Allocation {
        address recipient;
        uint256 amount;
        string purpose;
        uint256 timestamp;
        bool executed;
    }
    
    Allocation[] public allocations;
    
    // Events
    event FundsReceived(address indexed from, uint256 amount, uint256 sinkingFundAmount, uint256 operationalAmount);
    event AllocationCreated(uint256 indexed allocationId, address indexed recipient, uint256 amount, string purpose);
    event AllocationExecuted(uint256 indexed allocationId, address indexed recipient, uint256 amount);
    event SinkingFundWithdrawal(address indexed to, uint256 amount, string reason);
    event GnosisSafeUpdated(address indexed oldSafe, address indexed newSafe);
    event EmergencyWithdrawal(address indexed to, uint256 amount, string reason);
    
    /**
     * @dev Constructor sets up initial roles and Gnosis Safe address
     * @param _admin Address of the admin (typically a multisig or DAO)
     * @param _gnosisSafe Address of the Gnosis Safe for high-value operations
     */
    constructor(address _admin, address _gnosisSafe) {
        require(_admin != address(0), "Invalid admin address");
        require(_gnosisSafe != address(0), "Invalid Gnosis Safe address");
        
        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(TREASURER_ROLE, _admin);
        _grantRole(GNOSIS_SAFE_ROLE, _gnosisSafe);
        
        gnosisSafe = _gnosisSafe;
    }
    
    /**
     * @dev Receive function to accept ETH/MATIC donations
     * Automatically splits funds: 20% to sinking fund, 80% to operational
     */
    receive() external payable whenNotPaused {
        _processFunds(msg.sender, msg.value);
    }
    
    /**
     * @dev Fallback function
     */
    fallback() external payable whenNotPaused {
        _processFunds(msg.sender, msg.value);
    }
    
    /**
     * @dev Process incoming funds and split between sinking fund and operational
     * @param from Address sending the funds
     * @param amount Amount of funds received
     */
    function _processFunds(address from, uint256 amount) internal {
        require(amount > 0, "Amount must be greater than 0");
        
        // Calculate sinking fund amount (20%)
        uint256 sinkingAmount = (amount * SINKING_FUND_PERCENTAGE) / BASIS_POINTS;
        uint256 operationalAmount = amount - sinkingAmount;
        
        // Update balances
        sinkingFundBalance += sinkingAmount;
        operationalBalance += operationalAmount;
        totalReceived += amount;
        
        emit FundsReceived(from, amount, sinkingAmount, operationalAmount);
    }
    
    /**
     * @dev Create an allocation for restoration work
     * @param recipient Address to receive the allocation
     * @param amount Amount to allocate
     * @param purpose Description of the allocation purpose
     * @return allocationId ID of the created allocation
     */
    function createAllocation(
        address recipient,
        uint256 amount,
        string memory purpose
    ) external onlyRole(ALLOCATOR_ROLE) whenNotPaused returns (uint256) {
        require(recipient != address(0), "Invalid recipient");
        require(amount > 0, "Amount must be greater than 0");
        require(amount <= operationalBalance, "Insufficient operational funds");
        require(bytes(purpose).length > 0, "Purpose required");
        
        uint256 allocationId = allocations.length;
        
        allocations.push(Allocation({
            recipient: recipient,
            amount: amount,
            purpose: purpose,
            timestamp: block.timestamp,
            executed: false
        }));
        
        totalAllocated += amount;
        operationalBalance -= amount;
        
        emit AllocationCreated(allocationId, recipient, amount, purpose);
        
        return allocationId;
    }
    
    /**
     * @dev Execute an allocation (requires Gnosis Safe approval)
     * @param allocationId ID of the allocation to execute
     */
    function executeAllocation(uint256 allocationId) 
        external 
        onlyRole(GNOSIS_SAFE_ROLE) 
        nonReentrant 
        whenNotPaused 
    {
        require(allocationId < allocations.length, "Invalid allocation ID");
        Allocation storage allocation = allocations[allocationId];
        require(!allocation.executed, "Allocation already executed");
        require(address(this).balance >= allocation.amount, "Insufficient contract balance");
        
        allocation.executed = true;
        totalWithdrawn += allocation.amount;
        
        (bool success, ) = allocation.recipient.call{value: allocation.amount}("");
        require(success, "Transfer failed");
        
        emit AllocationExecuted(allocationId, allocation.recipient, allocation.amount);
    }
    
    /**
     * @dev Withdraw from sinking fund for maintenance (requires Gnosis Safe)
     * @param to Address to send funds
     * @param amount Amount to withdraw
     * @param reason Reason for withdrawal
     */
    function withdrawSinkingFund(
        address to,
        uint256 amount,
        string memory reason
    ) external onlyRole(GNOSIS_SAFE_ROLE) nonReentrant whenNotPaused {
        require(to != address(0), "Invalid recipient");
        require(amount > 0 && amount <= sinkingFundBalance, "Invalid amount");
        require(bytes(reason).length > 0, "Reason required");
        
        sinkingFundBalance -= amount;
        
        (bool success, ) = to.call{value: amount}("");
        require(success, "Transfer failed");
        
        emit SinkingFundWithdrawal(to, amount, reason);
    }
    
    /**
     * @dev Update Gnosis Safe address
     * @param newGnosisSafe New Gnosis Safe address
     */
    function updateGnosisSafe(address newGnosisSafe) 
        external 
        onlyRole(DEFAULT_ADMIN_ROLE) 
    {
        require(newGnosisSafe != address(0), "Invalid address");
        
        address oldSafe = gnosisSafe;
        
        // Revoke role from old safe and grant to new safe
        _revokeRole(GNOSIS_SAFE_ROLE, oldSafe);
        _grantRole(GNOSIS_SAFE_ROLE, newGnosisSafe);
        
        gnosisSafe = newGnosisSafe;
        
        emit GnosisSafeUpdated(oldSafe, newGnosisSafe);
    }
    
    /**
     * @dev Emergency withdrawal function (only admin, when paused)
     * @param to Address to send funds
     * @param amount Amount to withdraw
     * @param reason Reason for emergency withdrawal
     */
    function emergencyWithdraw(
        address to,
        uint256 amount,
        string memory reason
    ) external onlyRole(DEFAULT_ADMIN_ROLE) whenPaused nonReentrant {
        require(to != address(0), "Invalid recipient");
        require(amount > 0 && amount <= address(this).balance, "Invalid amount");
        require(bytes(reason).length > 0, "Reason required");
        
        (bool success, ) = to.call{value: amount}("");
        require(success, "Transfer failed");
        
        emit EmergencyWithdrawal(to, amount, reason);
    }
    
    /**
     * @dev Pause contract operations
     */
    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }
    
    /**
     * @dev Unpause contract operations
     */
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }
    
    /**
     * @dev Get allocation details
     * @param allocationId ID of the allocation
     */
    function getAllocation(uint256 allocationId) 
        external 
        view 
        returns (
            address recipient,
            uint256 amount,
            string memory purpose,
            uint256 timestamp,
            bool executed
        ) 
    {
        require(allocationId < allocations.length, "Invalid allocation ID");
        Allocation memory allocation = allocations[allocationId];
        return (
            allocation.recipient,
            allocation.amount,
            allocation.purpose,
            allocation.timestamp,
            allocation.executed
        );
    }
    
    /**
     * @dev Get total number of allocations
     */
    function getAllocationsCount() external view returns (uint256) {
        return allocations.length;
    }
    
    /**
     * @dev Get contract balance breakdown
     */
    function getBalances() external view returns (
        uint256 contractBalance,
        uint256 sinkingFund,
        uint256 operational,
        uint256 allocated,
        uint256 withdrawn
    ) {
        return (
            address(this).balance,
            sinkingFundBalance,
            operationalBalance,
            totalAllocated,
            totalWithdrawn
        );
    }
}
