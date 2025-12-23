// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title StPetrocCustodian
 * @dev Soulbound (non-transferable) ERC721 token for St Petroc Heritage Project governance
 * @notice These tokens represent custodianship and cannot be transferred
 * 
 * Key Features:
 * - Soulbound: Tokens cannot be transferred after minting
 * - Signature-based minting: Requires authorized signature to mint
 * - Contribution tracking: Each token records the contribution made
 * - Snapshot-ready: Compatible with Snapshot governance
 * - Revocable: Admin can revoke tokens in case of abuse
 */
contract StPetrocCustodian is ERC721, AccessControl, Pausable {
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;
    
    // Roles
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant SIGNER_ROLE = keccak256("SIGNER_ROLE");
    
    // Token counter
    uint256 private _nextTokenId;
    
    // Contribution tracking
    struct Contribution {
        uint256 amount;
        string contributionType; // e.g., "financial", "labor", "materials"
        uint256 timestamp;
        string metadata; // IPFS hash or additional info
    }
    
    mapping(uint256 => Contribution) public tokenContributions;
    mapping(address => uint256[]) public custodianTokens;
    mapping(bytes32 => bool) public usedSignatures;
    
    // Snapshot integration
    string public snapshotSpaceId;
    
    // Events
    event CustodianMinted(
        address indexed custodian,
        uint256 indexed tokenId,
        uint256 contributionAmount,
        string contributionType
    );
    event CustodianRevoked(address indexed custodian, uint256 indexed tokenId, string reason);
    event SnapshotSpaceUpdated(string oldSpaceId, string newSpaceId);
    event ContributionUpdated(uint256 indexed tokenId, string metadata);
    
    /**
     * @dev Constructor
     * @param _admin Address of the admin
     * @param _signer Address authorized to sign minting requests
     */
    constructor(
        address _admin,
        address _signer
    ) ERC721("St Petroc Custodian", "STPC") {
        require(_admin != address(0), "Invalid admin address");
        require(_signer != address(0), "Invalid signer address");
        
        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(MINTER_ROLE, _admin);
        _grantRole(SIGNER_ROLE, _signer);
        
        _nextTokenId = 1; // Start token IDs at 1
    }
    
    /**
     * @dev Mint a custodian token with contribution tracking
     * Requires an authorized signature to prevent unauthorized minting
     * 
     * @param to Address to mint token to
     * @param contributionAmount Amount contributed
     * @param contributionType Type of contribution
     * @param metadata Additional metadata (IPFS hash, etc.)
     * @param signature Signature from authorized signer
     */
    function mintContribution(
        address to,
        uint256 contributionAmount,
        string memory contributionType,
        string memory metadata,
        bytes memory signature
    ) external whenNotPaused returns (uint256) {
        require(to != address(0), "Invalid recipient");
        require(contributionAmount > 0, "Contribution amount must be greater than 0");
        require(bytes(contributionType).length > 0, "Contribution type required");
        
        // Verify signature
        bytes32 messageHash = keccak256(
            abi.encodePacked(to, contributionAmount, contributionType, metadata)
        );
        bytes32 ethSignedMessageHash = messageHash.toEthSignedMessageHash();
        
        require(!usedSignatures[ethSignedMessageHash], "Signature already used");
        
        address recoveredSigner = ethSignedMessageHash.recover(signature);
        require(hasRole(SIGNER_ROLE, recoveredSigner), "Invalid signature");
        
        // Mark signature as used
        usedSignatures[ethSignedMessageHash] = true;
        
        // Mint token
        uint256 tokenId = _nextTokenId++;
        _safeMint(to, tokenId);
        
        // Record contribution
        tokenContributions[tokenId] = Contribution({
            amount: contributionAmount,
            contributionType: contributionType,
            timestamp: block.timestamp,
            metadata: metadata
        });
        
        // Track tokens per custodian
        custodianTokens[to].push(tokenId);
        
        emit CustodianMinted(to, tokenId, contributionAmount, contributionType);
        
        return tokenId;
    }
    
    /**
     * @dev Admin mint function (without signature requirement)
     * For special cases like founding custodians
     */
    function adminMint(
        address to,
        uint256 contributionAmount,
        string memory contributionType,
        string memory metadata
    ) external onlyRole(MINTER_ROLE) whenNotPaused returns (uint256) {
        require(to != address(0), "Invalid recipient");
        require(contributionAmount > 0, "Contribution amount must be greater than 0");
        
        uint256 tokenId = _nextTokenId++;
        _safeMint(to, tokenId);
        
        tokenContributions[tokenId] = Contribution({
            amount: contributionAmount,
            contributionType: contributionType,
            timestamp: block.timestamp,
            metadata: metadata
        });
        
        custodianTokens[to].push(tokenId);
        
        emit CustodianMinted(to, tokenId, contributionAmount, contributionType);
        
        return tokenId;
    }
    
    /**
     * @dev Revoke a custodian token (in case of abuse or violation)
     * @param tokenId Token ID to revoke
     * @param reason Reason for revocation
     */
    function revokeCustodian(uint256 tokenId, string memory reason) 
        external 
        onlyRole(DEFAULT_ADMIN_ROLE) 
    {
        require(_ownerOf(tokenId) != address(0), "Token does not exist");
        require(bytes(reason).length > 0, "Reason required");
        
        address owner = ownerOf(tokenId);
        
        // Remove token from custodian's list
        _removeTokenFromCustodian(owner, tokenId);
        
        // Burn the token
        _burn(tokenId);
        
        emit CustodianRevoked(owner, tokenId, reason);
    }
    
    /**
     * @dev Update contribution metadata
     * @param tokenId Token ID
     * @param newMetadata New metadata
     */
    function updateContributionMetadata(uint256 tokenId, string memory newMetadata) 
        external 
        onlyRole(MINTER_ROLE) 
    {
        require(_ownerOf(tokenId) != address(0), "Token does not exist");
        
        tokenContributions[tokenId].metadata = newMetadata;
        
        emit ContributionUpdated(tokenId, newMetadata);
    }
    
    /**
     * @dev Set Snapshot space ID for governance integration
     * @param _snapshotSpaceId Snapshot space identifier
     */
    function setSnapshotSpace(string memory _snapshotSpaceId) 
        external 
        onlyRole(DEFAULT_ADMIN_ROLE) 
    {
        string memory oldSpaceId = snapshotSpaceId;
        snapshotSpaceId = _snapshotSpaceId;
        
        emit SnapshotSpaceUpdated(oldSpaceId, _snapshotSpaceId);
    }
    
    /**
     * @dev Get all tokens owned by a custodian
     * @param custodian Address of the custodian
     */
    function getTokensOfCustodian(address custodian) 
        external 
        view 
        returns (uint256[] memory) 
    {
        return custodianTokens[custodian];
    }
    
    /**
     * @dev Get contribution details for a token
     * @param tokenId Token ID
     */
    function getContribution(uint256 tokenId) 
        external 
        view 
        returns (
            uint256 amount,
            string memory contributionType,
            uint256 timestamp,
            string memory metadata
        ) 
    {
        require(_ownerOf(tokenId) != address(0), "Token does not exist");
        Contribution memory contrib = tokenContributions[tokenId];
        return (contrib.amount, contrib.contributionType, contrib.timestamp, contrib.metadata);
    }
    
    /**
     * @dev Get total voting power (number of tokens) for a custodian
     * Compatible with Snapshot strategies
     */
    function getVotingPower(address custodian) external view returns (uint256) {
        return custodianTokens[custodian].length;
    }
    
    /**
     * @dev Internal function to remove token from custodian's list
     */
    function _removeTokenFromCustodian(address custodian, uint256 tokenId) internal {
        uint256[] storage tokens = custodianTokens[custodian];
        for (uint256 i = 0; i < tokens.length; i++) {
            if (tokens[i] == tokenId) {
                tokens[i] = tokens[tokens.length - 1];
                tokens.pop();
                break;
            }
        }
    }
    
    /**
     * @dev Override transfer functions to make tokens non-transferable (Soulbound)
     */
    function _update(address to, uint256 tokenId, address auth)
        internal
        override
        returns (address)
    {
        address from = _ownerOf(tokenId);
        
        // Allow minting (from == address(0)) and burning (to == address(0))
        // Block all transfers between addresses
        if (from != address(0) && to != address(0)) {
            revert("StPetrocCustodian: token is soulbound and cannot be transferred");
        }
        
        return super._update(to, tokenId, auth);
    }
    
    /**
     * @dev Pause contract
     */
    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }
    
    /**
     * @dev Unpause contract
     */
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }
    
    /**
     * @dev Override supportsInterface to include AccessControl
     */
    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
