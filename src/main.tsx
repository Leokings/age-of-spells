import {StrictMode} from "react";
import {createRoot} from "react-dom/client";
import {PrivyProvider} from "@privy-io/react-auth";

import App from "./App";
import {privyStudionet} from "./studionet";
import "./styles.css";
import "./site.css";

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Root element was not found");

const root = createRoot(rootElement);
const privyAppId = import.meta.env.VITE_PRIVY_APP_ID?.trim();

function MissingPrivyConfiguration() {
  return (
    <main className="configuration-shell">
      <div className="configuration-card">
        <img className="configuration-logo" src="/brand/age-of-spells-elemental-mark-v2.webp" alt="Age of Spells" width="82" height="82" />
        <p className="eyebrow">One setup value required</p>
        <h1>Add your Privy App ID</h1>
        <p>
          Copy <code>.env.example</code> to <code>.env.local</code>, set
          <code> VITE_PRIVY_APP_ID</code>, then restart the development server.
        </p>
      </div>
    </main>
  );
}

root.render(
  <StrictMode>
    {privyAppId ? (
      <PrivyProvider
        appId={privyAppId}
        config={{
          loginMethods: ["wallet"],
          defaultChain: privyStudionet,
          supportedChains: [privyStudionet],
          appearance: {
            theme: "dark",
            accentColor: "#e9b44c",
            showWalletLoginFirst: true,
            walletChainType: "ethereum-only",
            // Coinbase Smart Wallet/Base Account rejects custom chain 61999.
            // Only advertise connectors that can add an EVM custom network.
            walletList: [
              "metamask",
              "okx_wallet",
              "detected_ethereum_wallets",
              "wallet_connect_qr",
            ],
          },
        }}
      >
        <App />
      </PrivyProvider>
    ) : (
      <MissingPrivyConfiguration />
    )}
  </StrictMode>,
);
