// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

contract IBToken is ERC20, AccessControl {
    // Create a special permission ID for the Bridge
    bytes32 public constant BRIDGE_ROLE = keccak256("BRIDGE_ROLE");

    constructor() ERC20("IBToken", "IBT") {
        // Give the deployer (you) the power to grant roles
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        
        // Mint initial supply to you
        _mint(msg.sender, 1000000 * 10 ** decimals());
    }
    

    // Only the Bridge can call this
    function mint(address receiver, uint256 amount) external onlyRole(BRIDGE_ROLE) {
        _mint(receiver, amount);
    }

    // Only the Bridge can call this
    function burn(address burner, uint256 amount) external onlyRole(BRIDGE_ROLE) {
        _burn(burner, amount);
    }
}