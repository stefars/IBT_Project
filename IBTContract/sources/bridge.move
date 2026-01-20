module ibt::bridge;


use sui::coin::{Self,Coin, TreasuryCap, burn};
use sui::sui::SUI;
use sui::balance::{Self,Balance};
use ibt::ibttoken::{IBTTOKEN};
use sui::event::emit;
use std::string;

//Event emitted when SUI coins are burned
public struct BurnSUIEvent has copy, drop, store {
    burner: address,
    amount: u64,
}

public struct BurnIBTforSUIEvent has copy, drop, store {
    burner: address,
    amount: u64,
}

public struct BridgeIBTtoETHIBT has copy, drop, store {
    burner: address,
    amount: u64,
}


//Place to story IBT Tokens
public struct Vault has key {
    id: UID,
    balanceSUI: Balance<SUI>,
    balanceIBT: Balance<IBTTOKEN>,

}

//Speciall pass
public struct AdminCap has key {
    id: UID,
}


//Create the Vault to store SUI, in order to produce IBT tokens, and the admin pass
fun init(ctx: &mut TxContext){
    let obj = Vault {
        id: object::new(ctx),
        balanceSUI: balance::zero<SUI>(),
        balanceIBT: balance::zero<IBTTOKEN>(),
    };

    let admin = AdminCap {
        id: object::new(ctx),
    };

    
    transfer::share_object(obj); //Vault 
    transfer::transfer(admin, ctx.sender()); //Admin 
}



//Mints IBT, only TreasuryCap holder can mint
entry fun mintIBT( 
    cap: &mut TreasuryCap<IBTTOKEN>,
    value: u64,
    recipient: address, //Address passed from the burnSUI event
    ctx: &mut TxContext
){
    let coin = coin::mint(cap, value, ctx); //I Create IBT 
    transfer::public_transfer(coin, recipient); //I send the IBT to the account
}


//User transfer token to the vault
entry fun bridgeIBTtoETH(
    coin: Coin<IBTTOKEN>,
    vault: &mut Vault,
    ctx: &mut TxContext
){
    let amount = coin::value(&coin);
    let bal = coin::into_balance(coin);
    balance::join(&mut vault.balanceIBT, bal);

    emit( BridgeIBTtoETHIBT{
        burner: ctx.sender(),
        amount: amount
    });

}



//Burns and IBT coin object, only TreasuryCap holder can burn
entry fun burnIBT(
    cap: &mut TreasuryCap<IBTTOKEN>,
    coin: Coin<IBTTOKEN>,
    ctx: &mut TxContext

){
    burn(cap, coin); //I burn the IBT
}


//Function that stores a SUI coin Object, in order to create IBT tokens.
entry fun burnSUI(
    vault: &mut Vault,
    coin: Coin<SUI>,
    ctx: &mut TxContext

){

    let amount = coin::value(&coin);
    let bal = coin::into_balance(coin);

    balance::join(&mut vault.balanceSUI, bal);


    let event = BurnSUIEvent {
        burner: ctx.sender(),
        amount,
    };

    //When the event is emmited, the coressponding IBT will be minted and transfered to the burner address
    emit(event);
}

//In the future I may add function to transfer IBT -> SUI


