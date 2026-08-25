/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_PRIVY_APP_ID?: string;
  readonly VITE_AGE_OF_SPELLS_PVP_CONTRACT_ADDRESS?: string;
  /** Backward-compatible local configuration from the v3 deployment. */
  readonly VITE_AGE_OF_SPELLS_PVP_V3_CONTRACT_ADDRESS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
