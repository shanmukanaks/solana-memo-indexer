use anchor_lang::prelude::*;

#[error_code]
pub enum MemoError {
    #[msg("Memo text cannot be empty")]
    TextEmpty,
    #[msg("Memo text exceeds 280 bytes")]
    TextTooLong,
}
