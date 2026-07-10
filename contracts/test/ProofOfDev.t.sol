// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import {Test} from "forge-std/Test.sol";
import {ProofOfDev} from "../src/ProofOfDev.sol";
import {IERC721Errors} from "@openzeppelin/contracts/interfaces/draft-IERC6093.sol";

contract ProofOfDevTest is Test {
    ProofOfDev internal pod;

    uint256 internal attesterPk = 0xA11CE;
    address internal attester;
    address internal user = makeAddr("user");
    address internal other = makeAddr("other");

    function setUp() public {
        attester = vm.addr(attesterPk);
        pod = new ProofOfDev(attester, "https://api.stablenaira.test/token/");
    }

    function _sign(uint256 pk, address to, uint256 score, uint256 cc, uint256 vc)
        internal
        view
        returns (bytes memory)
    {
        bytes32 digest = pod.mintDigest(to, score, cc, vc);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(pk, digest);
        return abi.encodePacked(r, s, v);
    }

    function test_MintWithValidAttestation() public {
        bytes memory sig = _sign(attesterPk, user, 74, 5, 3);

        vm.prank(user);
        uint256 tokenId = pod.mint(74, 5, 3, sig);

        assertEq(tokenId, 1);
        assertEq(pod.ownerOf(tokenId), user);
        assertEq(pod.balanceOf(user), 1);
        assertEq(pod.getTokenByAddress(user), tokenId);

        (uint256 score, uint256 cc, uint256 vc,) = pod.getMetadata(tokenId);
        assertEq(score, 74);
        assertEq(cc, 5);
        assertEq(vc, 3);
    }

    // NOTA en todos los tests: la firma se precomputa en una variable ANTES del
    // prank/expectRevert. `_sign` hace una staticcall a `pod.mintDigest`, y si se
    // inlinea como argumento, ESA llamada consume el cheatcode en vez del `mint`.

    function test_TokenURI() public {
        bytes memory sig = _sign(attesterPk, user, 74, 5, 3);
        vm.prank(user);
        uint256 tokenId = pod.mint(74, 5, 3, sig);
        assertEq(pod.tokenURI(tokenId), "https://api.stablenaira.test/token/1");
    }

    function test_RevertWhen_MintTwice() public {
        bytes memory sig1 = _sign(attesterPk, user, 74, 5, 3);
        bytes memory sig2 = _sign(attesterPk, user, 10, 1, 0);
        vm.startPrank(user);
        pod.mint(74, 5, 3, sig1);
        vm.expectRevert(abi.encodeWithSelector(ProofOfDev.AlreadyMinted.selector, user));
        pod.mint(10, 1, 0, sig2);
        vm.stopPrank();
    }

    function test_RevertWhen_AttestationFromWrongSigner() public {
        bytes memory badSig = _sign(0xBADBAD, user, 999, 9, 9);
        vm.prank(user);
        vm.expectRevert(ProofOfDev.InvalidAttestation.selector);
        pod.mint(999, 9, 9, badSig);
    }

    function test_RevertWhen_ScoreTamperedAfterSigning() public {
        // Attester signed for score 30, caller tries to mint 100.
        bytes memory sig = _sign(attesterPk, user, 30, 3, 1);
        vm.prank(user);
        vm.expectRevert(ProofOfDev.InvalidAttestation.selector);
        pod.mint(100, 3, 1, sig);
    }

    function test_RevertWhen_Transfer() public {
        bytes memory sig = _sign(attesterPk, user, 74, 5, 3);
        vm.prank(user);
        uint256 tokenId = pod.mint(74, 5, 3, sig);

        vm.prank(user);
        vm.expectRevert(ProofOfDev.Soulbound.selector);
        pod.transferFrom(user, other, tokenId);
    }

    function test_RevertWhen_GetMetadataForNonexistentToken() public {
        vm.expectRevert(abi.encodeWithSelector(IERC721Errors.ERC721NonexistentToken.selector, 999));
        pod.getMetadata(999);
    }

    function test_SetBaseURI_OnlyOwner() public {
        bytes memory sig = _sign(attesterPk, user, 74, 5, 3);
        vm.prank(user);
        uint256 tokenId = pod.mint(74, 5, 3, sig);

        pod.setBaseURI("ipfs://newbase/");
        assertEq(pod.tokenURI(tokenId), "ipfs://newbase/1");

        vm.prank(user);
        vm.expectRevert(abi.encodeWithSelector(/* OwnableUnauthorizedAccount */ bytes4(0x118cdaa7), user));
        pod.setBaseURI("ipfs://hacked/");
    }

    function test_SetAttester_RotatesSigner() public {
        uint256 newPk = 0xB0B;
        address newAttester = vm.addr(newPk);
        pod.setAttester(newAttester);
        assertEq(pod.attester(), newAttester);

        // Old attester no longer valid.
        bytes memory oldSig = _sign(attesterPk, user, 50, 5, 0);
        vm.prank(user);
        vm.expectRevert(ProofOfDev.InvalidAttestation.selector);
        pod.mint(50, 5, 0, oldSig);

        // New attester works.
        bytes memory newSig = _sign(newPk, user, 50, 5, 0);
        vm.prank(user);
        pod.mint(50, 5, 0, newSig);
        assertEq(pod.balanceOf(user), 1);
    }
}
