import { paymentProxy, x402ResourceServer } from "@x402/next";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { ExactStellarScheme } from "@x402/stellar/exact/server";
import { createPaywall } from "@x402-stellar/paywall";
import { stellarPaywall } from "@x402-stellar/paywall/stellar";

// --- Environment variable validation ---
const requiredEnvVars = [
  "FACILITATOR_URL",
  "SERVER_STELLAR_ADDRESS",
] as const;

for (const key of requiredEnvVars) {
  if (!process.env[key]) {
    throw new Error(
      `Missing required environment variable: ${key}. See .env.local setup in Step 4.`,
    );
  }
}

// --- Network configuration ---
// Defaults to testnet. Set STELLAR_NETWORK=stellar:pubnet for mainnet.
const network = (process.env.STELLAR_NETWORK ?? "stellar:testnet") as
  | "stellar:testnet"
  | "stellar:pubnet";

const isMainnet = network === "stellar:pubnet";

// Mainnet requires an explicit Soroban RPC URL for the paywall's wallet interaction.
if (isMainnet && !process.env.SOROBAN_RPC_URL) {
  throw new Error(
    "SOROBAN_RPC_URL is required when STELLAR_NETWORK is stellar:pubnet. " +
    "Set it to a mainnet Soroban RPC endpoint (e.g., https://mainnet.sorobanrpc.com). " +
    "See: https://developers.stellar.org/docs/data/apis/rpc/providers",
  );
}

// --- Facilitator client ---
// The facilitator is a third-party service (OpenZeppelin Channels) that
// verifies payment proofs and settles transactions on the Stellar network.
const facilitatorClient = new HTTPFacilitatorClient({
  url: process.env.FACILITATOR_URL!,
  createAuthHeaders: process.env.FACILITATOR_API_KEY
    ? async () => {
        const headers = {
          Authorization: `Bearer ${process.env.FACILITATOR_API_KEY}`,
        };
        return { verify: headers, settle: headers, supported: headers };
      }
    : undefined,
});

// --- Paywall UI ---
// appName is a display name shown in the paywall UI -- customize it to your app.
const paywall = createPaywall()
  .withNetwork(stellarPaywall)
  .withConfig({
    appName: "My x402 App",
    ...(isMainnet && {
      testnet: false,
      stellarRpcUrl: process.env.SOROBAN_RPC_URL,
    }),
  })
  .build();

// --- Resource server ---
// ExactStellarScheme implements a one-time, fixed-price payment model.
// It is network-agnostic -- the network string passed to register() determines
// which USDC contract address is used (testnet vs mainnet).
const server = new x402ResourceServer(facilitatorClient).register(
  network,
  new ExactStellarScheme(),
);

// --- Payment proxy ---
// This intercepts requests to protected paths and handles the full
// payment flow: show paywall → verify payment → let request through → settle.
//
// Note: The `paywall as any` cast works around a type mismatch between the
// vendored paywall's bundled type declarations and @x402/core@2.6.0.
// The paywall's types define `resource.description` as `string` (required),
// while @x402/core defines it as `string | undefined` (optional). This is
// a known issue when vendoring packages that bundle their own type copies.
// It does not affect runtime behavior.
export const proxy = paymentProxy(
  {
    "/protected": {
      accepts: [
        {
          scheme: "exact" as const,
          price: process.env.PAYMENT_PRICE ?? "0.01",
          network: network,
          payTo: process.env.SERVER_STELLAR_ADDRESS!,
        },
      ],
      description: "Access to premium content",
    },
  },
  server,
  undefined, // paywallConfig (using custom paywall)
  paywall as any,
);

// Only run the proxy on protected paths
export const config = {
  matcher: ["/protected/:path*"],
};
