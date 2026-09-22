# A-25 — the contract version belongs to the channel

Status: approved 2026-09-22. Canon: Q-7. Related: [A-21](A-21-channel-and-exchange.md),
[A-24](A-24-plain-code.md).

## Context

Every message carries `version: 1` (Q-7, CLAUDE.md §5). The field was declared in each of the ten
message interfaces of the contract and checked by the contract's guards, while the value was
written by the channel. Three parties knew about it; only one used it.

## Decision

- **The version is the channel's.** The channel adds it to every message it posts and refuses,
  before the contract guard runs, any message whose version is not its own. The constant lives in
  the channel package and is raised only on a breaking change.
- **The contract describes message bodies only**: `type` and the fields the applications read.
  Its guards validate the body and ignore an extra `version` property.
- **Neither application knows the version exists.**

## Why this way

The contract is what the two sides agree to say; the version is how the transport tells a
stranger from a peer. Putting it in the contract made ten interfaces repeat a field no caller
ever set and made the guards check what the channel had already decided. The wire is unchanged.
