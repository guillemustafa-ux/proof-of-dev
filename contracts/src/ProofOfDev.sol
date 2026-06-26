// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title ProofOfDev
/// @notice Soulbound (non-transferable) ERC-721 that records an on-chain
///         developer-reputation profile. A wallet may mint exactly once, and
///         only with a valid EIP-712 attestation signed by the trusted off-chain
///         attester. This prevents self-reported, inflated scores: the score that
///         lands on-chain is the same deterministic score the backend computed
///         from public Alchemy/Etherscan data.
/// @dev    Implements StableNaira "Proof of Dev" spec section 10 (Smart Contract
///         Requirements). The attester model maps to the server-side
///         ATTESTER_PRIVATE_KEY described in spec section 11/12.
contract ProofOfDev is ERC721, EIP712, Ownable {
    using ECDSA for bytes32;

    struct Reputation {
        uint256 score;
        uint256 contractCount;
        uint256 verifiedCount;
        uint64 mintedAt;
    }

    /// @dev tokenId => stored reputation snapshot (on-chain metadata, spec 10.2).
    mapping(uint256 => Reputation) private _reputation;
    /// @dev wallet => tokenId (0 means "never minted"), enforces one-per-address.
    mapping(address => uint256) private _tokenByAddress;

    uint256 private _nextId = 1;
    string private _baseTokenURI;

    /// @notice Address whose EIP-712 signature authorizes a mint.
    address public attester;

    bytes32 private constant MINT_TYPEHASH =
        keccak256("Mint(address to,uint256 score,uint256 contractCount,uint256 verifiedCount)");

    event Minted(address indexed to, uint256 indexed tokenId, uint256 score);
    event AttesterUpdated(address indexed previousAttester, address indexed newAttester);

    error AlreadyMinted(address wallet);
    error InvalidAttestation();
    error Soulbound();
    error ZeroAttester();

    constructor(address attester_, string memory baseURI_)
        ERC721("Proof of Dev", "POD")
        EIP712("ProofOfDev", "1")
        Ownable(msg.sender)
    {
        if (attester_ == address(0)) revert ZeroAttester();
        attester = attester_;
        _baseTokenURI = baseURI_;
    }

    // ---------------------------------------------------------------------
    // Minting
    // ---------------------------------------------------------------------

    /// @notice Mint the caller's soulbound Proof of Dev token.
    /// @param score          Deterministic reputation score from the backend.
    /// @param contractCount  Number of contract deployments counted.
    /// @param verifiedCount  Number of verified deployments counted.
    /// @param signature      EIP-712 signature over (msg.sender, score,
    ///                       contractCount, verifiedCount) produced by `attester`.
    function mint(uint256 score, uint256 contractCount, uint256 verifiedCount, bytes calldata signature)
        external
        returns (uint256 tokenId)
    {
        if (_tokenByAddress[msg.sender] != 0) revert AlreadyMinted(msg.sender);

        bytes32 digest = mintDigest(msg.sender, score, contractCount, verifiedCount);
        if (digest.recover(signature) != attester) revert InvalidAttestation();

        tokenId = _nextId++;
        _reputation[tokenId] = Reputation(score, contractCount, verifiedCount, uint64(block.timestamp));
        _tokenByAddress[msg.sender] = tokenId;
        _safeMint(msg.sender, tokenId);

        emit Minted(msg.sender, tokenId, score);
    }

    /// @notice EIP-712 digest the attester must sign. Exposed so the backend and
    ///         tests sign exactly what the contract verifies.
    function mintDigest(address to, uint256 score, uint256 contractCount, uint256 verifiedCount)
        public
        view
        returns (bytes32)
    {
        return _hashTypedDataV4(keccak256(abi.encode(MINT_TYPEHASH, to, score, contractCount, verifiedCount)));
    }

    // ---------------------------------------------------------------------
    // Views (spec 10.3)
    // ---------------------------------------------------------------------

    function getMetadata(uint256 tokenId)
        external
        view
        returns (uint256 score, uint256 contractCount, uint256 verifiedCount, uint64 mintedAt)
    {
        _requireOwned(tokenId);
        Reputation storage r = _reputation[tokenId];
        return (r.score, r.contractCount, r.verifiedCount, r.mintedAt);
    }

    /// @notice Returns the tokenId held by `wallet`, or 0 if it never minted.
    function getTokenByAddress(address wallet) external view returns (uint256) {
        return _tokenByAddress[wallet];
    }

    // ---------------------------------------------------------------------
    // Admin
    // ---------------------------------------------------------------------

    function setBaseURI(string calldata baseURI_) external onlyOwner {
        _baseTokenURI = baseURI_;
    }

    function setAttester(address newAttester) external onlyOwner {
        if (newAttester == address(0)) revert ZeroAttester();
        emit AttesterUpdated(attester, newAttester);
        attester = newAttester;
    }

    // ---------------------------------------------------------------------
    // Soulbound enforcement
    // ---------------------------------------------------------------------

    /// @dev Allow only mint (from == 0) and burn (to == 0); block transfers.
    function _update(address to, uint256 tokenId, address auth) internal override returns (address) {
        address from = _ownerOf(tokenId);
        if (from != address(0) && to != address(0)) revert Soulbound();
        return super._update(to, tokenId, auth);
    }

    function _baseURI() internal view override returns (string memory) {
        return _baseTokenURI;
    }
}
