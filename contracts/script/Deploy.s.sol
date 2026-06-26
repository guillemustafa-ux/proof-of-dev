// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import {Script, console2} from "forge-std/Script.sol";
import {ProofOfDev} from "../src/ProofOfDev.sol";

/// @notice Deploys ProofOfDev to the configured network.
/// @dev Required env: PRIVATE_KEY (deployer/owner), ATTESTER_ADDRESS, BASE_URI.
///      Run (Sepolia, with verification):
///        forge script script/Deploy.s.sol:Deploy \
///          --rpc-url sepolia --broadcast --verify -vvvv
contract Deploy is Script {
    function run() external returns (ProofOfDev pod) {
        uint256 deployerPk = vm.envUint("PRIVATE_KEY");
        address attester = vm.envAddress("ATTESTER_ADDRESS");
        string memory baseURI = vm.envString("BASE_URI");

        vm.startBroadcast(deployerPk);
        pod = new ProofOfDev(attester, baseURI);
        vm.stopBroadcast();

        console2.log("ProofOfDev deployed at:", address(pod));
        console2.log("Attester:", attester);
    }
}
