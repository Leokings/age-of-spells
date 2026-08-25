# Age of Spells · Intelligent Fusion PvP

Age of Spells is a wallet-versus-wallet text-and-card game built natively on
GenLayer Studionet. Players connect through Privy, select ingredient cards, and
write an incantation. GenLayer validators interpret what the selected elements
become; the intelligent contract enforces affinities, fixed power limits,
health, shield, turns, results, and XP. XP-derived titles and the global Top
100 are application-layer projections of finalized contract data.

There are no premade spell cards, single-card attacks, wagers, backend signer,
or AI opponent. Every spell is created from the player's words during a real
wallet-versus-wallet match.

## Play loop

- Create an open match, invite one wallet, or join a challenge in the lobby.
- Both wallets begin with 100 health, 0 shield, 8 gold, and 12 ingredients:
  three Fire, three Water, three Air, and three Earth.
- Select two cards for a Dual Fusion or three for a Grand Fusion.
- Write a 12–240 character incantation, then choose **Forge & Cast**.
- Validators independently confirm semantic validity and broad gameplay intent.
  Creative names, descriptions, visual elements, and equivalent choices such
  as damage versus piercing may differ without rejecting a valid spell. The
  contract assigns numeric power and resolves it immediately. Unsupported
  intent reverts atomically without burning cards.
- Focus to draw up to two cards, or spend match gold on standard and arcane
  ingredient packs. These actions end the turn.
- Knock out the other wallet or accept a concession to earn 10 XP.

Common ingredients provide damage, piercing, healing, and shield affinities.
Light, Metal, and Shadow are rarer catalysts. The 0.5% One Man Stand mythic
requires a Grand Fusion and sets both players to exactly 10 health, including a
player already below 10.

The complete affinity and power model is documented in
[`GAME_ARCHITECTURE.md`](GAME_ARCHITECTURE.md).

## Current Studionet deployment

- Contract: [`0xBfcC…6E04`](https://explorer-studio.genlayer.com/address/0xBfcCd5b915D674249A6C3Ef6D93aba66ABdA6E04)
- Deployment: [`0x26b8…595b`](https://explorer-studio.genlayer.com/tx/0x26b83cd373edb8442586f26adb592ef53299197b7316d0c00eecc747d9a4595b)
- Chain ID: `61999`
- Status: `FINALIZED`
- Consensus: `MAJORITY_AGREE`
- Leader execution: `SUCCESS`

The deployed contract was read back after finality and reported
`architecture: intelligent-transmutation-v3`, `win_xp: 10`,
`starting_hand: 12`, and `single_card_casting: false`. Machine-readable deployment and test evidence is
stored in [`deployments/studionet-pvp.json`](deployments/studionet-pvp.json).

## Web deployment

The production game client is available at
<https://age-of-spells.vercel.app>. It is deployed as the Vercel project
`age-of-spells` and is configured to build the Vite application into
`dist` using [`vercel.json`](vercel.json).

## Run locally

1. In the Privy dashboard, enable wallet login and allow the application's
   origin. For local development, allow `http://localhost:5173`.
2. Copy `.env.example` to `.env.local` and set `VITE_PRIVY_APP_ID`.
3. Keep `VITE_AGE_OF_SPELLS_PVP_CONTRACT_ADDRESS` on the finalized address above.
4. Install and start:

```powershell
npm install
npm run dev
```

Open <http://localhost:5173>. Use two different wallets in separate browser
profiles to play. MetaMask and other custom-network EVM wallets can add
Studionet through Privy. Studionet is gasless, so a zero GEN balance is normal,
but the active player still signs each game action.

## Verify

```powershell
npm run verify
npm run test:integration:pvp
```

`npm run verify` runs GenVM lint and typechecking, 12 direct contract tests, all
client parser/network/reconciliation tests, TypeScript, and a production build.
The hosted integration test deploys a fresh contract, performs two-wallet
matchmaking, and runs the previously rejected Air + Air + Earth projectile
incantation through full Studionet consensus. It verifies that equivalent
offensive interpretations finalize as a playable spell.

Useful individual commands:

```powershell
npm run lint:contract
npm run typecheck:contract
npm run test:contract
npm run test
npm run build
npm run build:functions
npm run schema:pvp
npm run network:studionet
npm run account
```

If automatic receipt polling is throttled after submission, the app preserves
the transaction hash, links to the explorer, and reconciles finalized match
state before enabling another move.

## Leaderboard read model

The contract remains the authority for XP, wins, losses, and streaks. The
read-only Vercel Function at `/api/leaderboard` discovers participating wallets
from finalized Studionet transactions, reads each authoritative onchain
profile, sorts the result, and returns at most 100 winners. Its response is
cached at the edge for 30 seconds with stale-while-revalidate support. It has no
signer, private key, mutable game state, or database. If the application read
model is unavailable, matches and XP settlement continue to work unchanged.
The typed function source lives in `server/leaderboard.ts`; the production
build bundles its GenLayer dependencies into the ESM entry point
`api/leaderboard.mjs` so the Vercel runtime does not depend on mixed module
formats.
