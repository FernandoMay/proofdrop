// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

contract AnchorRegistry {
    struct Anchor {
        address anchorer;
        string stellarTxHash;
        uint64 anchoredAt;
    }

    mapping(bytes32 manifestHash => Anchor anchor) private registry;

    error DuplicateManifest(bytes32 manifestHash);
    error InvalidManifestHash();
    error InvalidStellarTransactionHash();

    event ManifestAnchored(
        bytes32 indexed manifestHash,
        string stellarTxHash,
        address indexed anchorer,
        uint64 anchoredAt
    );

    function anchor(bytes32 manifestHash, string calldata stellarTxHash) external {
        if (manifestHash == bytes32(0)) revert InvalidManifestHash();
        if (!_isHex(stellarTxHash, 64)) revert InvalidStellarTransactionHash();
        if (registry[manifestHash].anchorer != address(0)) revert DuplicateManifest(manifestHash);

        uint64 anchoredAt = uint64(block.timestamp);
        registry[manifestHash] = Anchor({
            anchorer: msg.sender,
            stellarTxHash: stellarTxHash,
            anchoredAt: anchoredAt
        });

        emit ManifestAnchored(manifestHash, stellarTxHash, msg.sender, anchoredAt);
    }

    function getAnchor(bytes32 manifestHash)
        external
        view
        returns (address anchorer, string memory stellarTxHash, uint64 anchoredAt)
    {
        Anchor storage stored = registry[manifestHash];
        return (stored.anchorer, stored.stellarTxHash, stored.anchoredAt);
    }

    function _isHex(string calldata value, uint256 expectedLength) private pure returns (bool) {
        bytes calldata raw = bytes(value);
        if (raw.length != expectedLength) return false;

        for (uint256 index = 0; index < raw.length; ++index) {
            bytes1 character = raw[index];
            bool decimal = character >= 0x30 && character <= 0x39;
            bool lowerHex = character >= 0x61 && character <= 0x66;
            bool upperHex = character >= 0x41 && character <= 0x46;
            if (!decimal && !lowerHex && !upperHex) return false;
        }
        return true;
    }
}
