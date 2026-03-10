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
const network = (process.env.STELLAR_NETWORK ?? "stellar:testnet") as
  | "stellar:testnet"
  | "stellar:pubnet";

const isMainnet = network === "stellar:pubnet";

if (isMainnet && !process.env.SOROBAN_RPC_URL) {
  throw new Error(
    "SOROBAN_RPC_URL is required when STELLAR_NETWORK is stellar:pubnet. " +
    "Set it to a mainnet Soroban RPC endpoint (e.g., https://mainnet.sorobanrpc.com). " +
    "See: https://developers.stellar.org/docs/data/apis/rpc/providers",
  );
}

// --- Facilitator client ---
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
const paywall = createPaywall()
  .withNetwork(stellarPaywall)
  .withConfig({
    appName: "Video Paywall",
    ...(isMainnet && {
      testnet: false,
      stellarRpcUrl: process.env.SOROBAN_RPC_URL,
    }),
  })
  .build();

// --- Resource server ---
const server = new x402ResourceServer(facilitatorClient).register(
  network,
  new ExactStellarScheme(),
);

// --- Payment proxy ---
export const proxy = paymentProxy(
  {
    "/protected": {
      accepts: [
        {
          scheme: "exact" as const,
          price: process.env.PAYMENT_PRICE ?? "1.00",
          network: network,
          payTo: process.env.SERVER_STELLAR_ADDRESS!,
        },
      ],
      description: "Access to premium video content",
    },
  },
  server,
  undefined,
  paywall as any,
);

export const config = {
  matcher: ["/protected/:path*"],
};
