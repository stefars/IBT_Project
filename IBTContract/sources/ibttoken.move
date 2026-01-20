module ibt::ibttoken;

use sui::coin_registry;
use std::string;



public struct IBTTOKEN has drop {}


fun init(witness: IBTTOKEN, ctx: &mut TxContext) {
    

    let (builder, treasury_cap) = coin_registry::new_currency_with_otw(
        witness, 
        6,                               
        b"IBT".to_string(),            
        b"IBT_COIN".to_string(),       
        b"Coin for IBT project".to_string(), 
        string::utf8(b""),             
        ctx
    );

    
    let metadata_cap = builder.finalize(ctx);

    transfer::public_transfer(treasury_cap, ctx.sender());
    transfer::public_transfer(metadata_cap, ctx.sender());
}
    