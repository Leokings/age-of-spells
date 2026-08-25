# Wallet and Studionet Architecture

## Transaction path

1. A player authenticates and selects an EVM wallet through Privy.
2. The client requests GenLayer Studionet, chain ID `61999`, through the
   wallet's EIP-1193 provider.
3. Reads and writes target the finalized `AgeOfSpellsPvP` deployment.
4. Match actions are signed by the active player's wallet and submitted with
   value `0`; Studionet does not require the player to hold GEN.
5. For `forge_and_cast`, the leader and validators independently interpret the
   same two or three selected ingredients and the same incantation. They must
   agree on semantic validity and broad gameplay intent—offense, restoration,
   defense, or equalization. Creative names, visuals, and equivalent choices
   such as damage versus piercing may differ.
6. The contract verifies that the leader's concrete effects are permitted by
   the selected ingredient affinities, assigns fixed numeric power, burns the
   ingredients, resolves the spell, and passes the turn atomically.
7. Both clients read the same wallet-oriented finalized match state without
   exposing the opponent's hand contents.

Privy supplies authentication and wallet access. It is not a gameplay backend,
relayer, or custody service. The application never receives or stores a private
key, and a wallet signature is still required for every game write.

## Authority and reliability

The intelligent contract is the only gameplay authority. React renders state
and collects intent; it does not decide whether a spell is legal, how much
damage it deals, who owns the turn, who won, or how much XP was awarded.
XP-derived titles and the public Top 100 are maintained by a read-only
application projection. It discovers participant wallets from finalized calls
to the deployed contract, reads their authoritative onchain profiles, and
sorts at most 100 winners. The result is cached by Vercel; there is no database
or backend signer. A projection failure can hide or delay ranking data, but it
cannot change a match result or a player's XP. Players outside the published
Top 100 are identified as such rather than being assigned an invented rank.

Studionet RPC is rate-limited. The client retries transient finalized reads,
retains a submitted transaction hash when receipt polling is throttled, and
reconciles the match revision before enabling another move. A finalized receipt
is also checked for successful GenVM execution rather than treated as success
from finality alone.
