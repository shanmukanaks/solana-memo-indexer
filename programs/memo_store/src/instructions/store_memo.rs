use anchor_lang::prelude::*;

use crate::error::MemoError;
use crate::events::{CommonFields, MemoCreated};
use crate::state::Memo;

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct StoreMemoArgs {
    pub text: String,
    pub nonce: u64,
}

#[derive(Accounts)]
#[instruction(args: StoreMemoArgs)]
#[event_cpi]
pub struct StoreMemo<'info> {
    #[account(
        init,
        payer = author,
        space = Memo::space(&args.text),
        seeds = [b"memo", author.key().as_ref(), &args.nonce.to_le_bytes()],
        bump,
    )]
    pub memo: Account<'info, Memo>,
    #[account(mut)]
    pub author: Signer<'info>,
    pub system_program: Program<'info, System>,
}

impl StoreMemo<'_> {
    pub fn validate(&self, args: &StoreMemoArgs) -> Result<()> {
        require!(!args.text.is_empty(), MemoError::TextEmpty);
        require_gte!(280, args.text.len(), MemoError::TextTooLong);
        Ok(())
    }

    pub fn handle(ctx: Context<Self>, args: StoreMemoArgs) -> Result<()> {
        let memo = &mut ctx.accounts.memo;
        let clock = Clock::get()?;

        memo.author = ctx.accounts.author.key();
        memo.text = args.text;
        memo.timestamp = clock.unix_timestamp;
        memo.nonce = args.nonce;
        memo.bump = ctx.bumps.memo;

        emit_cpi!(MemoCreated {
            common: CommonFields::new(&clock),
            memo: memo.key(),
            author: memo.author,
            text: memo.text.clone(),
        });

        Ok(())
    }
}
