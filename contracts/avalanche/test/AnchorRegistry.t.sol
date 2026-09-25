// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Test} from "forge-std/Test.sol";

import {AnchorRegistry} from "../src/AnchorRegistry.sol";

contract AnchorRegistryTest is Test {
    AnchorRegistry internal registry;
    address internal anchorer = makeAddr("anchorer");
    bytes32 internal manifestHash = keccak256("proofdrop.manifest.v1");
    string internal stellarTxHash;

    function setUp() public {
        registry = new AnchorRegistry();
        stellarTxHash = syntheticTransactionHash("a");
    }

    function testFirstAnchorStoresAndEmitsEvidence() public {
        vm.expectEmit(true, false, false, true, address(registry));
        emit AnchorRegistry.ManifestAnchored(manifestHash, stellarTxHash, anchorer, uint64(block.timestamp));

        vm.prank(anchorer);
        registry.anchor(manifestHash, stellarTxHash);

        (address storedAnchorer, string memory storedTxHash, uint64 anchoredAt) = registry.getAnchor(manifestHash);
        assertEq(storedAnchorer, anchorer);
        assertEq(storedTxHash, stellarTxHash);
        assertEq(anchoredAt, uint64(block.timestamp));
    }

    function testRejectsDuplicateManifestHash() public {
        vm.prank(anchorer);
        registry.anchor(manifestHash, stellarTxHash);

        vm.expectRevert(abi.encodeWithSelector(AnchorRegistry.DuplicateManifest.selector, manifestHash));
        vm.prank(address(0xBEEF));
        registry.anchor(manifestHash, syntheticTransactionHash("b"));
    }

    function testGetterReturnsEmptyValuesForUnknownManifest() public view {
        bytes32 unknownHash = keccak256("unknown");
        (address storedAnchorer, string memory storedTxHash, uint64 anchoredAt) = registry.getAnchor(
            unknownHash
        );

        assertEq(storedAnchorer, address(0));
        assertEq(storedTxHash, "");
        assertEq(anchoredAt, uint64(0));
    }

    function syntheticTransactionHash(bytes1 character) private pure returns (string memory) {
        bytes memory raw = new bytes(64);
        for (uint256 index = 0; index < raw.length; ++index) {
            raw[index] = character;
        }
        return string(raw);
    }
}
