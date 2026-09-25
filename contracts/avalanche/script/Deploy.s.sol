// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Script} from "forge-std/Script.sol";
import {Vm} from "forge-std/Vm.sol";
import {AnchorRegistry} from "../src/AnchorRegistry.sol";

contract AnchorRegistryScript is Script {
    Vm private constant foundryVm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    function run() external returns (AnchorRegistry registry) {
        uint256 deployerKey = foundryVm.envUint("AVALANCHE_PRIVATE_KEY");
        foundryVm.startBroadcast(deployerKey);
        registry = new AnchorRegistry();
        foundryVm.stopBroadcast();
    }
}
