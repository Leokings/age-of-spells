# Age of Spells Game Architecture

## The core rule

There are no pre-built spell cards and no single-card attacks. Every spell is
created and resolved in one atomic `forge_and_cast` move:

1. Select exactly two ingredient cards for a **Dual Fusion**, or three for a
   **Grand Fusion**.
2. Write a 12–240 character incantation describing what those ingredients
   should become and what the spell should do.
3. GenLayer validators interpret the incantation within the selected cards'
   declared affinities.
4. If the request is coherent and supported, the contract burns the cards,
   applies an audited power template, records the generated spell, and passes
   the turn. If it is invalid, the entire move reverts and no card is burned.

The generated name, fusion family, element, and description make the spell
expressive. They never grant power. Gameplay effects and numbers stay bounded
by contract code.

## Authority boundary

- **React owns presentation:** Privy connection, matchmaking controls,
  ingredient selection, incantation input, effects, and finalized-state UI.
- **AgeOfSpellsPvP owns gameplay:** wallet seats, private/open challenges, hands,
  health, shield, gold, turn order, legal affinities, fixed effect values,
  outcomes, XP, wins, losses, and streaks.
- **The application data layer owns discovery:** XP-derived titles and the
  public Top 100. It projects finalized contract profiles but cannot award XP,
  change a result, or alter gameplay.
- **The wallet owns intent:** `gl.message.sender_address` identifies the player,
  and only the wallet that owns the turn can submit a move.
- **The validator council owns semantic interpretation:** it independently
  determines whether the words fit the selected ingredients and agrees on the
  broad gameplay intent. Equivalent offensive, restorative, or defensive
  interpretations do not need identical creative labels.
- **No centralized service owns gameplay:** there is no backend signer, wager,
  off-chain game database, privileged server, or AI opponent.

## Ingredients and affinities

| Ingredient | Pull rate | Affinities |
|---|---:|---|
| Fire | 21% | damage |
| Water | 20.5% | damage, heal, shield |
| Air | 20.5% | damage, piercing |
| Earth | 20.5% | damage, shield |
| Light Catalyst | 8% | heal, shield |
| Metal Catalyst | 6% | damage, piercing, shield |
| Shadow Catalyst | 3% | damage, drain |
| One Man Stand | 0.5% | equalize |

Damage plus shield can become `fortify`; damage plus healing can become
`drain`. A Grand Fusion may add one compatible secondary damage, piercing,
healing, or shield effect. One Man Stand requires a three-card fusion and sets
both players to exactly 10 health—even if either player was already below 10.

## Fixed power templates

| Effect | Dual Fusion | Grand Fusion |
|---|---:|---:|
| Damage | 20 | 28 |
| Piercing | 14 | 20 |
| Heal | 20 | 28 |
| Shield | 24 | 34 |
| Fortify | 10 damage + 12 shield | 16 damage + 18 shield |
| Drain | 12 damage + 7 heal | 18 damage + 10 heal |
| Equalize | unavailable | both players to 10 health |

Compatible Grand Fusion secondary effects are intentionally smaller: 10
damage, 7 piercing, 10 healing, or 12 shield. Normal damage hits shield first;
piercing bypasses it. Health is capped at 100 and shield at 50.

## Match and economy loop

1. `create_match(invited_player)` opens a public challenge with the zero
   address or reserves a private challenge for one wallet.
2. `join_match(match_id)` seats the second wallet. Each player receives exactly
   12 cards: three Fire, three Water, three Air, and three Earth. Both start at
   100 health, 0 shield, and 8 gold.
3. A successful fusion burns two or three ingredients. The incoming player
   automatically draws one card when space permits.
4. `focus_turn` draws up to two cards and passes. A standard pack costs 2 gold
   and draws two cards; an arcane pack costs 4 gold and makes three best-of-two
   rarity pulls. Both pack actions pass the turn.
5. A knockout or concession settles once, awards 10 XP to the winner, updates
   authoritative win/loss and streak totals, and releases both wallets. The
   application projection derives titles and the Top 100 from that finalized
   state.

The hand limit is 12. Draws use a deterministic seed derived from contract
state, wallet, match ID, and pull nonce, so no frontend or server chooses a card
after seeing the result.

## What makes it GenLayer-native

Turn enforcement, health, shield, packs, and rankings could live in an ordinary
deterministic contract. Age of Spells becomes GenLayer-native because natural
language is the only way to create and cast a spell: validators interpret an
open-ended incantation rather than selecting from a fixed recipe table. The
contract then constrains that intelligence with deterministic affinities,
atomic failure, and audited power templates.
