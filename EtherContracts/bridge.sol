// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "@openzeppelin/contracts/access/Ownable.sol";

// Update the interface to match your new IBToken functions
interface IIBToken {
    // Note: 'receiver' and 'burner' names must match what the token expects
    function mint(address receiver, uint256 amount) external;
    function burn(address burner, uint256 amount) external;
    function grantRole(bytes32 role, address account) external;
    function BRIDGE_ROLE() external view returns (bytes32);
    function balanceOf(address account) external view returns (uint256);
}

contract EthBridge is Ownable {
    IIBToken public ibtToken;

    event BurnETHEvent(address indexed burner, uint256 amount);
    event BridgeIBTtoSUIIBT(address indexed burner, uint256 amount);

    constructor(address _ibtTokenAddress) Ownable(msg.sender) {
        ibtToken = IIBToken(_ibtTokenAddress);
    }

    // Bridge mints IBT to user when SUI is locked on Sui side
    function mintIBT(address recipient, uint256 amount) external onlyOwner {
        ibtToken.mint(recipient, amount);
    }

    // Bridge burns IBT from user when they want to move back to Sui
    function bridgeIBTtoSui(uint256 amount) external {
        // IMPORTANT: The user must call ibtToken.approve(address(this), amount) 
        // OR the bridge must have BURNER_ROLE to call the token's burn function.

        require(ibtToken.balanceOf(msg.sender) >= amount, "IBT: insufficient balance");
        ibtToken.burn(msg.sender, amount);
        emit BridgeIBTtoSUIIBT(msg.sender, amount);
    }

    // lockETH remains the same as your previous SUI logic
    function lockETH() external payable {
        require(msg.value > 0, "Amount must be > 0");
        emit BurnETHEvent(msg.sender, msg.value);
    }
}