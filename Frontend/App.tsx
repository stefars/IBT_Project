import { useState } from 'react';
import { ethers } from 'ethers';
import { ConnectButton, useCurrentAccount, useSignAndExecuteTransaction } from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';

// Update these with your actual IDs
const ETH_BRIDGE_ADDRESS = "0x...";
const SUI_PACKAGE_ID = "0x...";
const SUI_VAULT_ID = "0x...";

export default function BridgeApp() {
  const [ethAddress, setEthAddress] = useState<string>("");
  const [amount, setAmount] = useState("");
  const suiAccount = useCurrentAccount();
  const { mutate: signAndExecuteSui } = useSignAndExecuteTransaction();

  // --- WALLET HELPERS ---
  async function connectEth() {
    if ((window as any).ethereum) {
      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const accounts = await provider.send("eth_requestAccounts", []);
      setEthAddress(accounts[0]);
    }
  }


  // --- CONVERSION LOGIC ---

  // 1. ETH -> IBT (Ethereum)
  async function convertEthToIbt() {
    const provider = new ethers.BrowserProvider((window as any).ethereum);
    const signer = await provider.getSigner();
    const bridge = new ethers.Contract(ETH_BRIDGE_ADDRESS, ["function lockETH() payable"], signer);
    const tx = await bridge.lockETH({ value: ethers.parseEther(amount) });
    await tx.wait();
    alert("Locked ETH! Relayer will mint IBT on Sui.");
  }

  // 2. SUI -> IBT (Sui)
  async function convertSuiToIbt() {
    const tx = new Transaction();
    const [coin] = tx.splitCoins(tx.gas, [tx.pure.u64(Number(amount) * 1e9)]);
    tx.moveCall({
      target: `${SUI_PACKAGE_ID}::bridge::burnSUI`,
      arguments: [tx.object(SUI_VAULT_ID), coin],
    });
    signAndExecuteSui({ transaction: tx }, { onSuccess: () => alert("SUI Burned! Relayer will mint IBT on Sui.") });
  }

  // 3. IBT.sui -> IBT.eth
  async function bridgeSuiToEth() {
    const tx = new Transaction();
    // Assuming you have an IBT coin object ID or need to fetch it
    // For simplicity, this uses a placeholder for the IBT coin object
    tx.moveCall({
      target: `${SUI_PACKAGE_ID}::bridge::bridgeIBTtoETH`,
      arguments: [tx.object("PASTE_IBT_COIN_ID_HERE"), tx.object(SUI_VAULT_ID)],
    });
    signAndExecuteSui({ transaction: tx }, { onSuccess: () => alert("IBT Locked on Sui! Relayer will mint on Ethereum.") });
  }

  // 4. IBT.eth -> IBT.sui
  async function bridgeEthToSui() {
    const provider = new ethers.BrowserProvider((window as any).ethereum);
    const signer = await provider.getSigner();
    // ABI for your BridgeIBTtoSUIIBT function
    const bridge = new ethers.Contract(ETH_BRIDGE_ADDRESS, ["function bridgeIBTtoSUIIBT(uint256 amount)"], signer);
    const tx = await bridge.bridgeIBTtoSUIIBT(ethers.parseUnits(amount, 18));
    await tx.wait();
    alert("IBT Locked on Ethereum! Relayer will mint on Sui.");
  }


  return (
    /* Big Div: Centered on screen, background black, white text */
    <div style={{ backgroundColor: '#5f8e91', minHeight: '100vh', color: '#fff', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px' }}>
      
      {/* Container separated by rows */}
      <div style={{ width: '100%', maxWidth: '800px', display: 'flex', flexDirection: 'column', gap: '20px', border: '1px solid #333', padding: '20px' }}>
        
        {/* Row 1: Title */}
        <div style={{ textAlign: 'center', fontSize: '24px', fontWeight: 'bold', borderBottom: '1px solid #333', paddingBottom: '10px' }}>
          IBT BRIDGE
        </div>

        {/* Row 2: The Main Column Container */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          
          {/* LEFT COLUMN: SUI SIDE */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', padding: '15px', border: '1px solid #333' }}>
            <div style={{ fontWeight: 'bold', textAlign: 'center' }}>SUI NETWORK</div>
            
            {/* Row 1: Sui Connect */}
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <ConnectButton />
            </div>

            {/* Row 2: Amount */}
            <input 
              type="number" 
              placeholder="Amount" 
              style={{ padding: '8px', backgroundColor: '#111', color: '#fff', border: '1px solid #444' }}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />

            {/* Row 3: Options */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button onClick={convertSuiToIbt} style={{ padding: '10px', backgroundColor: '#222', border: '1px solid #555', color: '#fff' }}>
                CREATE IBT (SUI)
              </button>
              <button onClick={bridgeSuiToEth} style={{ padding: '10px', backgroundColor: '#222', border: '1px solid #555', color: '#fff' }}>
                BRIDGE IBT TO ETH
              </button>
            </div>
          </div>

          {/* RIGHT COLUMN: ETH SIDE */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', padding: '15px', border: '1px solid #333' }}>
            <div style={{ fontWeight: 'bold', textAlign: 'center' }}>ETH NETWORK</div>

            {/* Row 1: Metamask Connect */}
            <button 
              onClick={connectEth} 
              style={{ padding: '10px', backgroundColor: '#4e4848', border: '1px solid #555', color: '#fff' }}
            >
              {ethAddress ? "ETH CONNECTED" : "CONNECT METAMASK"}
            </button>

            {/* Row 2: Amount (Shared or separate input) */}
            <input 
              type="number" 
              placeholder="Amount" 
              style={{ padding: '8px', backgroundColor: '#111', color: '#fff', border: '1px solid #444' }}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />

            {/* Row 3: Options */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button onClick={convertEthToIbt} style={{ padding: '10px', backgroundColor: '#222', border: '1px solid #555', color: '#fff' }}>
                CREATE IBT (ETH)
              </button>
              <button onClick={bridgeEthToSui} style={{ padding: '10px', backgroundColor: '#222', border: '1px solid #555', color: '#fff' }}>
                BRIDGE IBT TO SUI
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}

function ActionButton({ title, color, onClick }: any) {
   return (
     <button onClick={onClick} className={`${color} p-6 rounded-xl border border-gray-600 hover:border-white transition-all text-sm font-bold uppercase tracking-widest`}>
       {title}
     </button>
);
}