use anchor_lang::prelude::*;

use crate::state::Memo;

#[derive(Accounts)]
pub struct CloseMemo<'info> {
    #[account(
        mut,
        close = author,
        has_one = author,
        seeds = [b"memo", author.key().as_ref(), &memo.nonce.to_le_bytes()],
        bump = memo.bump,
    )]
    pub memo: Account<'info, Memo>,
    #[account(mut)]
    pub author: Signer<'info>,
}

impl CloseMemo<'_> {
    pub fn validate(&self) -> Result<()> {
        Ok(())
    }

    pub fn handle(_ctx: Context<Self>) -> Result<()> {
        Ok(())
    }
}
