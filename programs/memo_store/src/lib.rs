use anchor_lang::prelude::*;

mod error;
mod events;
mod instructions;
mod state;

use instructions::*;

declare_id!("6hEMnbQ2t52uP5h8LieSzVjaH1xrDpY8AWsYj86nTHbq");

#[program]
pub mod memo_store {
    use super::*;

    #[access_control(ctx.accounts.validate(&args))]
    pub fn store_memo(ctx: Context<StoreMemo>, args: StoreMemoArgs) -> Result<()> {
        StoreMemo::handle(ctx, args)
    }

    #[access_control(ctx.accounts.validate())]
    pub fn close_memo(ctx: Context<CloseMemo>) -> Result<()> {
        CloseMemo::handle(ctx)
    }
}
