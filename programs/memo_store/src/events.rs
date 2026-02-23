use anchor_lang::prelude::*;

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct CommonFields {
    pub slot: u64,
    pub unix_timestamp: i64,
}

impl CommonFields {
    pub fn new(clock: &Clock) -> Self {
        Self {
            slot: clock.slot,
            unix_timestamp: clock.unix_timestamp,
        }
    }
}

#[event]
pub struct MemoCreated {
    pub common: CommonFields,
    pub memo: Pubkey,
    pub author: Pubkey,
    pub text: String,
}
