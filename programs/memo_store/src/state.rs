use anchor_lang::prelude::*;

#[account]
pub struct Memo {
    pub author: Pubkey,
    pub text: String,
    pub timestamp: i64,
    pub nonce: u64,
    pub bump: u8,
}

impl Memo {
    pub fn space(text: &str) -> usize {
        8           // discriminator
        + 32        // author
        + 4 + text.len() // text
        + 8         // timestamp
        + 8         // nonce
        + 1         // bump
    }
}
