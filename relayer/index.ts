import * as dotenv from "dotenv";

dotenv.config();

import { ethers } from "ethers";
import { SuiClient, getFullnodeUrl } from "@mysten/sui/client";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { Transaction } from "@mysten/sui/transactions";



// --- ETH CONFIG ---
const ETH_RPC = process.env.ETH_RPC_URL || "http://127.0.0.1:8545";
const BRIDGE_ADDRESS = process.env.ETH_BRIDGE_ADDRESS;
const ETH_PRIVATE_KEY = process.env.ETH_PRIVATE_KEY!;
const provider = new ethers.JsonRpcProvider(ETH_RPC);
const adminWallet = new ethers.Wallet(ETH_PRIVATE_KEY, provider);

// The ABI only needs the event you care about
const BRIDGE_ABI = [
    "event BurnETHEvent(address indexed burner, uint256 amount)",
    "function mintIBT(address recipient, uint256 amount) external",
    "event BridgeIBTtoSUIIBT(address indexed burner, uint256 amount)"
];

if (!BRIDGE_ADDRESS) {
    console.error("Error: ETH_BRIDGE_ADDRESS not found in .env");
    process.exit(1);
}


const bridge = new ethers.Contract(BRIDGE_ADDRESS!, BRIDGE_ABI, adminWallet);




// --- SUI CONFIG ---
const SUI_PRIVATE_KEY = process.env.SUI_PRIVATE_KEY!;
const client = new SuiClient({ url: getFullnodeUrl("devnet") });
const suiKeypair = Ed25519Keypair.fromSecretKey(SUI_PRIVATE_KEY);
const TREASURY_CAP_ID = process.env.SUI_TREASURY_CAP_ID;
const SUI_PACKAGE_ID = process.env.SUI_PACKAGE_ID!;
const MODULE_NAME = "bridge";


// Event Signatures
const EVENTS = {
    BURN_SUI: `${SUI_PACKAGE_ID}::${MODULE_NAME}::BurnSUIEvent`,
    BRIDGE_IBT: `${SUI_PACKAGE_ID}::${MODULE_NAME}::BridgeIBTtoETHIBT`,
};

async function watchSuiEvents(suiClient: SuiClient, ethBridge: ethers.Contract) {
    
   
    
    console.log("🚀 RELAYER STARTING (Dual Event Listener)...");
    console.log(`📍 Package: ${SUI_PACKAGE_ID}`);

    let cursor: any = null;

    setInterval(async () => {
        try {
            // We query the whole module to get both event types at once
            const { data, nextCursor } = await client.queryEvents({
                query: { MoveModule: { package: SUI_PACKAGE_ID, module: MODULE_NAME } },
                cursor: cursor,
                order: "ascending",
            });

            if (data.length > 0) {
                for (const event of data) {
                    const type = event.type;
                    const payload = event.parsedJson as any;

                    // --- CASE 1: BURN SUI (INTERNAL MINT) ---
                    if (type === EVENTS.BURN_SUI) {
                        const { burner, amount } = payload;
                        console.log(`\n [BURN EVENT] ${amount} SUI from ${burner}`);
                        
                        console.log("Executing mintIBT on Sui...");
                        const tx = new Transaction();
                        tx.moveCall({
                            target: `${SUI_PACKAGE_ID}::${MODULE_NAME}::mintIBT`,
                            arguments: [
                                tx.object(TREASURY_CAP_ID!), 
                                tx.pure.u64(amount),        
                                tx.pure.address(burner),    
                            ],
                        });

                        const result = await client.signAndExecuteTransaction({
                            signer: suiKeypair,
                            transaction: tx,
                        });
                        
                        await client.waitForTransaction({ digest: result.digest });
                        console.log(`✅ [SUCCESS] IBT Minted! Digest: ${result.digest}`);
                    }

                    // --- CASE 2: BRIDGE IBT (PLACEHOLDER) ---
                    else if (type === EVENTS.BRIDGE_IBT) {
                        const { burner, amount } = payload;
                        console.log(`\n🌉 [BRIDGE EVENT DETECTED]`);
                        console.log(`👤 Burner: ${burner}`);
                        console.log(`💰 Amount: ${amount} IBT (Sui units)`);

                        try {
                            console.log("🛠️  Preparing Ethereum Mint...");

                            // 1. Scale amount: Sui (9 decimals) -> Ethereum (18 decimals)
                            // amount is a string or number from the event, convert to BigInt first
                            const ethAmount = BigInt(amount) * BigInt(10 ** 9);

                            // 2. Map Address: 
                            // If the Sui event 'burner' is the 32-byte padded address, 
                            // we extract the last 20 bytes (40 chars + 0x) for Ethereum.
                            const ethRecipient = burner.length > 42 
                                ? "0x" + burner.slice(-40) 
                                : burner;

                            console.log(` Minting ${ethers.formatEther(ethAmount)} IBT to ${process.env.ETH_DUMMY_ACCOUNT}`);

                            // 3. Call the Ethereum Contract
                            // .getFunction is the safest way in Ethers v6 for dynamic ABIs
                            const mintIBT = ethBridge.getFunction("mintIBT");
                            if (mintIBT) {
                                const tx = await mintIBT(process.env.ETH_DUMMY_ACCOUNT, ethAmount);
                                console.log(` Transaction sent! Hash: ${tx.hash}`);

                                // 4. Wait for confirmation
                            const receipt = await tx.wait();
                            console.log(`[SUCCESS] IBT Minted on Ethereum in block ${receipt.blockNumber}`);
                        } else {
                            throw new Error("Could not find mintIBT function on contract.");
                        }

                    } catch (error: any) {
                        console.error("Ethereum Bridge failed:", error.reason || error.message);
                    }
                    }
                }
                cursor = nextCursor;
            }
        } catch (error: any) {
            console.error("Polling Error:", error.message);
        }
    }, 3000);

    process.stdin.resume();
}

async function ethListener(){
   

    console.log("-----------------------------------------");
    console.log(`Starting Listening Server...`);
    console.log(`Listening at ETH: ${BRIDGE_ADDRESS}`);
    console.log(`Local ETH RPC URL: ${ETH_RPC}`);
    console.log("-----------------------------------------");

    // 3. Listen for the BurnETHEvent
    bridge.on("BurnETHEvent", async (burner, amount, event) => {
        console.log(`\n[ETH LOCK EVENT] ${ethers.formatEther(amount)} ETH from ${burner}`);
        
        
        try {
            console.log("Attempting to mint IBT on Ethereum...");
            
            const mintIBT = bridge.getFunction("mintIBT");

            if (mintIBT) {
            const tx = await mintIBT(burner, amount);
            console.log(`Transaction sent: ${tx.hash}`);
            const receipt = await tx.wait();

            console.log(`[SUCCESS] IBT Minted to ${burner} in block ${receipt.blockNumber}`);
        }
            // 4. Call the mintIBT function on your contract
            // Note: In your architecture, you wanted the owner to trigger this.
            
            // Wait for 1 confirmation
            
            
        } catch (error: any) {
            console.error("Minting failed:", error.reason || error.message);
        }

            
    });

    bridge.on("BridgeIBTtoSUIIBT", async (burner, amount, event) => {
        console.log(`\n[IBT BRIDGE EVENT] ${ethers.formatEther(amount)} IBT from ${burner}`);

        const suiClient = new SuiClient({ 
             url: getFullnodeUrl("devnet") 
        });
        
        try {
            console.log("Bridging IBT to SUI...");
            // User has burned IBT on Ethereum, now bridge to SUI
            // Now make call on SUI chain to mint IBT there


            const tx = new Transaction();

            // Convert ETH sui 18 decimals to SUI 9 decimals
            const suiAmount = amount / BigInt(10 ** 9); 

            // Make the mova call to mint IBT
            tx.moveCall({
                target: `${process.env.SUI_PACKAGE_ID}::bridge::mintIBT`,
                arguments: [
                    tx.object(process.env.SUI_TREASURY_CAP_ID!), // Your TreasuryCap ID
                    tx.pure.u64(suiAmount),                     // The scaled amount
                    tx.pure.address(process.env.SUI_DUMMY_ACCOUNT!),    // The recipient address
                    //CURRENTLY USING HARDCODED ADDRESS
                    //In the future this would be provided by a call idk
                ],
            });


            // 4. Sign and Execute on Sui
            console.log("🚀 Sending transaction to Sui Devnet...");
            const result = await suiClient.signAndExecuteTransaction({
                signer: suiKeypair, // Your Ed25519Keypair from .env
                transaction: tx,
            });
                const response = await suiClient.waitForTransaction({
                digest: result.digest,
            });

            console.log(`✅ [SUCCESS] IBT Minted on Sui! Digest: ${result.digest}`);
            
        } catch (error: any) {
            console.error("❌ Sui Bridging failed:", error);
        }
    });

}

async function main() {
    console.log("🛠️  Initializing relayer...");

    // 1. Await the setup logic (connecting to RPC, checking contract, etc.)
    // This ensures that if the setup fails, the .catch() below will see it.
    await ethListener();

    await watchSuiEvents(client, bridge);

    console.log("🚀 Relayer is now online and listening.");

    // 2. Keep the process from exiting
    // This is necessary because event listeners (like bridge.on) 
    // run in the background.
    process.stdin.resume();
}

// This block is your safety net
main().catch((error) => {
    console.error("💀 Fatal error in main:", error);
    process.exit(1); 
});