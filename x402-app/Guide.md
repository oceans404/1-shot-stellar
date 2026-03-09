# Build a Payment-Gated Next.js App with x402 on Stellar

Build a Next.js app that gates pages behind a USDC micropayment on Stellar using the [x402 protocol](https://www.x402.org/). Users pay directly from their wallet -- no accounts, no OAuth, no subscriptions.

**Time estimate:** Claude code or similar should be able to build this (assuming prerequisites already set up) in less than 5 minutes.

### What you will build

A minimal Next.js application with:

- A **landing page** at `/` with a button that links to the protected content
- A **payment-gated page** at `/protected` that shows a "TADA!" page after the user pays $0.01 USDC on Stellar testnet
- A **paywall UI** (served as an HTTP 402 response by the proxy) that connects to the user's Stellar wallet, prompts for payment, and submits proof to the server

When an unauthenticated request hits the protected page, the proxy intercepts it and returns HTTP 402 with a full-page paywall. After the user pays, the proxy verifies the payment with a facilitator, lets the request through to the page, and settles the transaction on-chain.

### How the pieces fit together

Your app has four components that work together in a simple flow:

```
  ┌─────────────┐        ┌─────────────────┐        ┌──────────────┐        ┌─────────┐
  │   Browser   │        │   Your Server   │        │  Facilitator │        │ Stellar │
  │             │        │                 │        │ (OpenZeppelin│        │ Network │
  │             │        │                 │        │  Channels)   │        │         │
  └──────┬──────┘        └────────┬────────┘        └──────┬───────┘        └────┬────┘
         │                        │                        │                     │
    1.   │ ── GET /protected ──>  │                        │                     │
         │                        │                        │                     │
    2.   │ <── HTTP 402 ───────── │                        │                     │
         │    (paywall HTML)      │                        │                     │
         │                        │                        │                     │
    3.   │ ── payment proof ───>  │                        │                     │
         │                        │                        │                     │
    4.   │                        │ ── verify proof ────>  │                     │
         │                        │ <── OK ──────────────  │                     │
         │                        │                        │                     │
    5.   │ <── 200 + page ──────  │                        │                     │
         │                        │                        │                     │
    6.   │                        │ ── settle payment ──>  │ ── tx ──>          │
         │                        │                        │                     │
         ▼                        ▼                        ▼                     ▼
```

1. **Next.js app** -- serves your pages (Steps 1, 6, 7)
2. **Proxy** (`proxy.ts`) -- intercepts requests to protected paths, shows the paywall for unpaid requests, verifies payment, lets paid requests through (Step 5)
3. **Paywall UI** -- a self-contained HTML page that connects to the user's Stellar wallet and collects payment (Step 3)
4. **Facilitator** -- a third-party service (OpenZeppelin Channels) that verifies payment proofs and settles transactions on the Stellar network (Step 4)

---

## Prerequisites

| Requirement | Why |
|---|---|
| **Node.js 22+** | Required by the x402 packages |
| **pnpm 10+** | Required for workspace packages |
| **git** | Required for cloning the Stellar x402 packages in [Step 2b](#2b-vendor-the-stellar-specific-packages) |
| **Next.js 16** | This guide was tested with Next.js 16.1.x. Next.js 15.x may work but has not been validated. |
| **A Stellar wallet** | [Freighter](https://www.freighter.app/) browser extension recommended |
| **A funded Stellar testnet account** | To receive payments -- see [Stellar account setup](#stellar-account-setup) below |
| **Stellar CLI** *(optional)* | Only needed if you prefer to generate keys and add trustlines from the command line. Each step below also has a browser-based option using [Stellar Lab](https://lab.stellar.org) that requires no installation. Install: `brew install stellar-cli` or `curl -fsSL https://github.com/stellar/stellar-cli/raw/main/install.sh \| sh` ([docs](https://developers.stellar.org/docs/tools/cli)) |

### Stellar account setup

Before building the app, you need a Stellar testnet account that can receive USDC payments. This requires two things:

#### 1. Generate and fund a keypair

**Option A: Stellar Lab (browser)**

Go to https://lab.stellar.org/account/fund:
1. Click **"Generate Keypair"** -- save both the public key (G...) and secret key (S...)
2. Click **"Fund"** to activate with testnet XLM via Friendbot

**Option B: CLI (no browser needed)**

```bash
# Generate a keypair using the Stellar CLI (install: https://developers.stellar.org/docs/tools/cli)
stellar keys generate my-x402-key --network testnet --fund
# View the keys:
stellar keys address my-x402-key   # Public key (G...)
stellar keys show my-x402-key      # Secret key (S...)

# Or generate + fund with just Node.js and curl:
node -e "const { Keypair } = require('@stellar/stellar-sdk'); const kp = Keypair.random(); console.log('Public: ' + kp.publicKey()); console.log('Secret: ' + kp.secret());"
# Then fund via Friendbot:
curl -s "https://friendbot.stellar.org?addr=G_YOUR_PUBLIC_KEY"
```

#### 2. Add a USDC trustline (CRITICAL)

Without this, payments fail with `"trustline entry is missing for account"`. A [trustline](https://developers.stellar.org/docs/learn/fundamentals/stellar-data-structures/accounts#trustlines) tells the Stellar network that your account opts in to holding a specific asset (in this case, USDC).

**Option A: Stellar Lab (browser)**

1. Go to https://lab.stellar.org/transaction/build
2. Set **Source Account** to your public key (G...)
3. Select network: **Testnet**
4. Click **"Add Operation"** and choose **"Change Trust"**
5. Set **Asset Code** to `USDC` and **Issuer** to `GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5`
6. Click **"Sign in Transaction Signer"**, enter your secret key (S...), and submit

**Option B: Stellar CLI (no browser needed)**

```bash
# Build and sign the trustline transaction
stellar tx new change-trust \
  --line USDC:GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5 \
  --source-account my-x402-key \
  --network testnet \
  --sign-with-key my-x402-key \
  --build-only > trustline-tx.xdr

# Sign and send it
cat trustline-tx.xdr | stellar tx sign --network testnet --sign-with-key my-x402-key | stellar tx send --network testnet
rm trustline-tx.xdr
```

> **Both the payer AND the payTo account need USDC trustlines.** This is the most common setup mistake.

#### 3. Get a facilitator API key

The facilitator is a service that verifies and settles payments on your behalf.

```bash
curl https://channels.openzeppelin.com/testnet/gen
# Returns: {"apiKey":"your-key-here"}
```

Save this key -- you will need it in Step 4.

> **Note:** The key generation endpoint (`/testnet/gen`) is different from the facilitator API endpoint (`/x402/testnet`) that you will use in `.env.local`. The first is a one-time setup call; the second is the runtime URL your server talks to.
>
> **If the endpoint is unreachable:** The facilitator is a third-party service operated by OpenZeppelin. If `channels.openzeppelin.com` is temporarily unavailable, wait and retry later. Check [OpenZeppelin Channels](https://channels.openzeppelin.com) for status. You cannot proceed with a working payment flow without a valid API key.

---

## Step 1: Create your Next.js project

```bash
npx create-next-app@latest my-x402-app --typescript --app --use-pnpm --no-eslint --no-tailwind --no-src-dir --no-import-alias --turbopack
cd my-x402-app
```

> **React Compiler prompt:** Despite the flags above, `create-next-app` will still ask **"Would you like to use React Compiler?"** — answer **No**. If you're running this in a script or CI environment where interactive prompts block, pipe the answer:
> ```bash
> echo "No" | npx create-next-app@latest my-x402-app --typescript --app --use-pnpm --no-eslint --no-tailwind --no-src-dir --no-import-alias --turbopack
> ```

> **Why these flags?** Next.js 16's `create-next-app` prompts for several options interactively (linter, Tailwind, src directory, etc.). The flags above skip all prompts and give you a minimal setup. The `--use-pnpm` flag is important because this guide uses pnpm workspaces. The `--turbopack` flag is included for explicitness, though Turbopack is the default for `next dev` in Next.js 16.1.x.
>
> If port 3000 is already in use when you run the dev server later, use `pnpm dev -p 3001` (or any free port).

## Step 2: Install npm packages + vendor Stellar packages

### 2a. Install published x402 packages from npm

```bash
pnpm add -w @x402/core@~2.6.0 @x402/next@~2.6.0
```

> **Why `-w`?** The `-w` (workspace root) flag tells pnpm to install packages at the top level of the workspace rather than in a nested package. This is needed because `pnpm-workspace.yaml` exists in the project root (generated by `create-next-app`), which makes pnpm treat this as a workspace.
>
> **What this gives you:** `@x402/core` provides the protocol engine (resource server, facilitator client, types). `@x402/next` provides `paymentProxy` (proxy that gates pages behind payment), `withX402` (per-route wrapper for API routes), and `NextAdapter`.

### 2b. Vendor the Stellar-specific packages

The Stellar mechanism (`@x402/stellar`) and Stellar paywall (`@x402-stellar/paywall`) are **not yet published to npm**. You need to clone the [stellar/x402-stellar](https://github.com/stellar/x402-stellar) repo and copy them.

```bash
# Clone the reference repo (to /tmp, outside your project, to avoid nesting git repos)
rm -rf /tmp/x402-stellar
git clone https://github.com/stellar/x402-stellar.git /tmp/x402-stellar

# Create the target directories
mkdir -p vendors/x402/typescript/packages/mechanisms packages

# Copy ONLY the Stellar-specific packages (not core, extensions, or express)
cp -r /tmp/x402-stellar/vendors/x402/typescript/packages/mechanisms/stellar ./vendors/x402/typescript/packages/mechanisms/stellar
cp -r /tmp/x402-stellar/packages/paywall ./packages/paywall
cp -r /tmp/x402-stellar/patches ./patches
```

> **Pin the version.** The directory structure of the source repo may change over time. To ensure reproducibility, pin to a specific commit after cloning:
>
> ```bash
> cd /tmp/x402-stellar && git checkout <commit-hash> && cd -
> ```
>
> If you are following this guide for the first time and no specific commit is recommended, cloning `main` is fine -- just be aware that future changes to the repo may require adjustments.

**Verify the files were copied:**

```bash
ls vendors/x402/typescript/packages/mechanisms/stellar/package.json packages/paywall/package.json
# Both files should exist
```

> **Why only `mechanisms/stellar`?** The other x402 packages (`core`, `extensions`, `express`) are published to npm and installed in Step 2a. Only the Stellar-specific packages need to be vendored.

### 2c. Patch vendored package.json files

The vendored packages reference `@x402/core` as `workspace:*`, which assumes core is a local workspace package. Since we're using it from npm, update the references:

In `vendors/x402/typescript/packages/mechanisms/stellar/package.json`, change:
```json
"@x402/core": "workspace:*"
```
to:
```json
"@x402/core": "~2.6.0"
```

In `packages/paywall/package.json`, change:
```json
"@x402/core": "workspace:*"
```
to:
```json
"@x402/core": "~2.6.0"
```

> **Why `~2.6.0`?** The tilde range (`~`) allows patch updates (2.6.x) but not minor updates. This matches the version of `@x402/core` we installed from npm and keeps the vendored packages compatible.

> **Note:** You will also see `"@x402/stellar": "workspace:*"` in the paywall's `devDependencies` -- **leave this as-is**. It correctly references the `@x402/stellar` workspace package you configure in Step 2d. Only the `@x402/core` references need to be changed.

### 2d. Configure the pnpm workspace

Replace the contents of `pnpm-workspace.yaml` with:

> **Note:** `create-next-app` generates this file with `ignoredBuiltDependencies` for `sharp` and `unrs-resolver`. The replacement below preserves those entries and adds the workspace `packages` list.

```yaml
packages:
  - packages/paywall
  - vendors/x402/typescript/packages/mechanisms/stellar
ignoredBuiltDependencies:
  - sharp
  - unrs-resolver
```

> **Why only 2 entries?** Only the Stellar-specific packages need to be in the workspace. Everything else comes from npm.

### 2e. Add the patched dependency and workspace references

Add the following entries to your **existing** `package.json`. Do not replace the file -- merge these into the existing JSON:

1. Add a new top-level `"pnpm"` key at the end of the JSON (this won't exist yet -- it goes at the same level as `"name"`, `"dependencies"`, etc.)
2. Add `"@x402/stellar"` and `"@x402-stellar/paywall"` to your **existing** `"dependencies"` object (alongside `next`, `react`, etc.)

Your `package.json` should look like this after merging (existing entries shown with `...`):

```json
{
  "name": "my-x402-app",
  "version": "0.1.0",
  "private": true,
  "scripts": { "..." : "..." },
  "dependencies": {
    "@x402/core": "~2.6.0",
    "@x402/next": "~2.6.0",
    "@x402/stellar": "workspace:*",
    "@x402-stellar/paywall": "workspace:*",
    "next": "...",
    "react": "...",
    "react-dom": "..."
  },
  "devDependencies": { "..." : "..." },
  "pnpm": {
    "patchedDependencies": {
      "@creit.tech/stellar-wallets-kit@2.0.0": "patches/@creit.tech__stellar-wallets-kit@2.0.0.patch"
    }
  }
}
```

> **The `...` entries represent existing content** -- do not delete or modify them. Your project name may differ from `my-x402-app` depending on what you chose in Step 1 -- that is fine. You are adding two new keys to `"dependencies"` and one new top-level `"pnpm"` key.

> **What does this patch do?** The `@creit.tech/stellar-wallets-kit` package has a bundling issue with its ESM exports that causes build failures in pnpm workspaces. The patch fixes module resolution so the Stellar Wallets Kit can be imported correctly by the paywall package.

### 2f. Install and configure esbuild

First, allow esbuild's native build scripts. pnpm blocks them by default, and esbuild requires them to install its platform-specific binary. Without this, the paywall build in Step 3 will fail. Create a `.npmrc` file in the project root:

```
approve-builds-automatically=true
```

> **Why `.npmrc` instead of `pnpm config set`?** The `.npmrc` file is project-local -- it only affects this project. `pnpm config set` would change a global setting that affects all pnpm projects on your machine.

Now install and rebuild esbuild:

```bash
pnpm install
pnpm rebuild esbuild
```

> `pnpm rebuild esbuild` produces no output on success -- silent completion is expected.

> **Note on peer dependency warnings:** You will see warnings about unmet peer dependencies (e.g., `typescript@^4.8.4`, `@stellar/stellar-sdk@^13.3.0`). These come from transitive dependencies in the paywall's wallet kit and do not affect functionality. They are safe to ignore.

**Verify your setup:** Confirm all three packages are installed correctly:

```bash
pnpm ls @x402/core @x402/stellar @x402-stellar/paywall
# Should list all three packages with their versions
```

## Step 3: Build the paywall package

The paywall is a self-contained HTML page (~2 MB) that handles the wallet connection and payment UI. Building it is a two-step process:

1. **Codegen** (`build.ts`) -- Bundles the paywall's React app, Stellar Wallets Kit, and all CSS into a single HTML template file. This is what gets served as the HTTP 402 response body.
2. **Build** (`tsup`) -- Compiles the paywall package's TypeScript source (including the generated template) into distributable JavaScript.

```bash
cd packages/paywall
npx tsx src/browser/build.ts
npx tsup
cd ../..
```

> **Note:** You will see warnings and errors about `tsconfig.base.json` during both steps -- specifically `Cannot find base config file` warnings from the codegen step, and `error TS5083: Cannot read file '../../tsconfig.base.json'` during the tsup DTS build. These appear because the vendored paywall's `tsconfig.json` extends a shared base config from the original `x402-stellar` monorepo, which doesn't exist in your project. **Despite the error-level output, both builds complete successfully.** If you see a line containing `Build success`, the step worked. You can safely ignore these messages.
>
> To verify the build succeeded, check that the dist directory was created:
> ```bash
> ls packages/paywall/dist/
> # Should show files including: index.js  index.d.ts  stellar.js  stellar.d.ts
> # You may also see chunk files (chunk-*.js), source maps (*.js.map), and
> # additional type declaration files. The exact filenames vary between builds.
> ```

> **Do not skip this step.** If you skip the codegen, the paywall template will be empty and the HTTP 402 response will contain no UI. If you skip the tsup build, the paywall package will fail to import at runtime with module resolution errors. See [Troubleshooting](#troubleshooting) if you encounter issues.

## Step 4: Configure environment variables

This step requires two real values that you must generate now (not placeholders). **If you skip this, the app will fail at runtime with `"no supported payment kinds loaded from any facilitator"`.**

### 4a. Get a facilitator API key

Run this command to generate a testnet API key:

```bash
curl https://channels.openzeppelin.com/testnet/gen
# Returns: {"apiKey":"xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"}
```

Save the `apiKey` value -- you will use it below.

### 4b. Get a funded Stellar testnet address

If you already completed the [Stellar account setup](#stellar-account-setup) in the prerequisites, use the public key (G...) from that step. Otherwise, run these commands now:

```bash
# Generate and fund a testnet keypair (requires Stellar CLI: https://developers.stellar.org/docs/tools/cli)
stellar keys generate my-x402-key --network testnet --fund
# View your public key -- save this for SERVER_STELLAR_ADDRESS below
stellar keys address my-x402-key

# Add a USDC trustline (CRITICAL -- without this, payments will fail)
stellar tx new change-trust \
  --line USDC:GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5 \
  --source-account my-x402-key \
  --network testnet \
  --sign-with-key my-x402-key \
  --build-only | stellar tx sign --network testnet --sign-with-key my-x402-key | stellar tx send --network testnet
```

You should see `"status": "SUCCESS"` for the trustline transaction. Use the public key (G...) from `stellar keys address` as your `SERVER_STELLAR_ADDRESS` below.

### 4c. Create `.env.local`

Create `.env.local` with the **real values** from steps 4a and 4b:

```env
# Which Stellar network to use (stellar:testnet or stellar:pubnet)
STELLAR_NETWORK=stellar:testnet
# Your Stellar public key (G...) -- receives payments
# ⚠️ REPLACE with your real public key from Step 4b (must start with G)
SERVER_STELLAR_ADDRESS=G_YOUR_PUBLIC_KEY
# Facilitator runtime endpoint (NOT the /testnet/gen key generation URL)
FACILITATOR_URL=https://channels.openzeppelin.com/x402/testnet
# ⚠️ REPLACE with the apiKey value from Step 4a
FACILITATOR_API_KEY=your-api-key-here
# Price in USDC (optional -- defaults to 0.01 if omitted)
PAYMENT_PRICE=0.01
```

> **Do not leave placeholder values.** If `FACILITATOR_API_KEY` is not a real key, the proxy will fail to connect to the facilitator and every request to the protected page will return a 500 error (`"no supported payment kinds loaded from any facilitator"`). If `SERVER_STELLAR_ADDRESS` is not a real funded address with a USDC trustline, payments will fail at settlement time.
>
> **Switching to mainnet?** This guide defaults to Stellar testnet. To deploy on mainnet, change only your `.env.local` values -- no code changes needed. See [Switching to Mainnet](#switching-to-mainnet) at the end of this guide.

**Verify `.env.local` is gitignored** (it should be by default from `create-next-app`, but worth confirming):

```bash
grep ".env.local" .gitignore
# Should show: .env.local
```

---

## Step 5: Create the payment proxy

This is the core of the x402 integration. The `paymentProxy` from `@x402/next` acts as a Next.js proxy -- it intercepts requests to protected paths, shows the paywall for unpaid requests, and lets paid requests through to the page.

Create `proxy.ts` **in the project root** (not inside `app/`):

> **Next.js 16 naming convention:** Next.js 16 renamed the middleware file convention from `middleware.ts` to `proxy.ts` (and the export from `middleware` to `proxy`). If you are using Next.js 15.x, name the file `middleware.ts` and change `export const proxy` to `export const middleware` below.

```typescript
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
```

> **Why `export const proxy`?** Next.js 16 requires the proxy function to be a named export called `proxy` from a file called `proxy.ts` at the project root. The `config.matcher` tells Next.js which paths to run the proxy on -- requests to other paths skip it entirely.

> **Note on Node.js runtime:** The `paymentProxy` uses `@x402/core` and `@x402/stellar`, which depend on Node.js APIs. If your Next.js version runs the proxy in the Edge Runtime by default, you may need to add `export const runtime = "nodejs";` to `proxy.ts`. Next.js 16 supports this.

## Step 6: Create the protected page

With `paymentProxy` handling the payment flow in the proxy, the protected page is a **regular Next.js page** -- no payment logic, no API routes, no HTML strings. The proxy intercepts unpaid requests before they reach the page.

Create `app/protected/page.tsx`:

```tsx
export default function TadaPage() {
  return (
    <div style={{
      fontFamily: "system-ui, -apple-system, sans-serif",
      background: "#0a0a0a",
      color: "#fafafa",
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      margin: 0,
    }}>
      <div style={{ textAlign: "center", padding: 48 }}>
        <div style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          background: "rgba(48, 164, 108, 0.15)",
          color: "#30a46c",
          padding: "6px 16px",
          borderRadius: 9999,
          fontSize: 14,
          fontWeight: 600,
          border: "1px solid rgba(48, 164, 108, 0.3)",
          marginBottom: 32,
        }}>
          <span style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: "#30a46c",
            display: "inline-block",
          }} />
          Payment Verified
        </div>

        <h1 style={{
          fontSize: 120,
          fontWeight: 800,
          letterSpacing: -4,
          background: "linear-gradient(135deg, #7c66dc, #5746af, #30a46c)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          marginBottom: 24,
          lineHeight: 1,
        }}>
          TADA!
        </h1>

        <p style={{ fontSize: 18, color: "#a1a1a1", maxWidth: 500, lineHeight: 1.6 }}>
          You paid $0.01 USDC on Stellar to unlock this page.
          This content was gated behind an x402 paywall &mdash; no accounts,
          no OAuth, no subscriptions.
        </p>
      </div>

      <div style={{ position: "fixed", bottom: 24, fontSize: 13, color: "#525252" }}>
        Powered by{" "}
        <a href="https://www.x402.org/" target="_blank" rel="noopener noreferrer"
          style={{ color: "#7c66dc", textDecoration: "none" }}>x402</a>
        {" "}on{" "}
        <a href="https://stellar.org/" target="_blank" rel="noopener noreferrer"
          style={{ color: "#7c66dc", textDecoration: "none" }}>Stellar</a>
      </div>
    </div>
  );
}
```

That's it -- a plain React component with no payment logic. The proxy handles everything before this page ever renders.

> **Using Pages Router?** The proxy, packages, and configuration are identical. The only difference is file paths: create `pages/protected.tsx` (or `pages/protected/index.tsx`) instead of `app/protected/page.tsx`. The proxy config and path matching work the same for both routers.

> **Production note:** The protected content here is a static component in source code. This is appropriate for a demo, but production applications should fetch sensitive or dynamic content from a database, API, or secrets manager at render time.

## Step 7: Create a landing page

Replace `app/page.tsx`:

```tsx
export default function Home() {
  return (
    <main style={{
      background: "#0a0a0a",
      color: "#fafafa",
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "system-ui",
    }}>
      <div style={{ textAlign: "center", padding: 48 }}>
        <h1 style={{ fontSize: 36, fontWeight: 700, marginBottom: 16 }}>
          x402 TADA Demo
        </h1>
        <p style={{ color: "#a1a1a1", marginBottom: 40, maxWidth: 480 }}>
          This demo gates a page behind a $0.01 USDC micropayment on Stellar
          testnet using the x402 protocol.
        </p>
        <a
          href="/protected"
          style={{
            display: "inline-block",
            background: "#5746af",
            color: "white",
            padding: "14px 32px",
            borderRadius: 8,
            textDecoration: "none",
            fontWeight: 600,
          }}
        >
          Unlock the TADA page ($0.01 USDC)
        </a>
        <p style={{ marginTop: 24, fontSize: 13, color: "#525252" }}>
          Requires a Stellar wallet (e.g. Freighter) with testnet USDC
        </p>
      </div>
    </main>
  );
}
```

> **Using Pages Router?** Update `pages/index.tsx` instead of `app/page.tsx`. For cleanup, the equivalent files are `styles/globals.css` and `styles/Home.module.css`, imported from `pages/_app.tsx`.

## Step 8: Clean up default CSS

This demo uses inline styles, so the default files generated by `create-next-app` are not needed. Clean them up in this order:

1. Open `app/layout.tsx` and make these changes:
   - **Remove** the `import "./globals.css"` line
   - **Remove** the Geist font imports (`import { Geist, Geist_Mono } from "next/font/google"`) and the two `const geist...` lines, plus the `className={...}` from the `<body>` tag (these fonts aren't used in this demo and add ~100KB of unnecessary font loading)
   - **Update** the `metadata` title from `"Create Next App"` to `"x402 TADA Demo"` (or whatever you'd like)
   - **Update** the `metadata` description from `"Generated by create next app"` to something relevant (e.g., `"Payment-gated content using x402 on Stellar"`)

2. Delete the unused CSS files:
   ```bash
   rm app/globals.css app/page.module.css
   ```

3. Optionally, delete the default SVGs from `public/` that aren't used:
   ```bash
   rm public/file.svg public/globe.svg public/next.svg public/vercel.svg public/window.svg
   ```

> **Important:** You must remove the `globals.css` import from `layout.tsx` *before* deleting the file, otherwise Next.js will fail to compile.

## Step 9: Build and run

First, verify the production build succeeds:

```bash
pnpm build
```

You should see output similar to:

```
Route (app)                    Size    First Load JS
┌ ○ /                          ...     ...
├ ○ /_not-found                ...     ...
└ ○ /protected                 ...     ...

○  (Static)  prerendered as static content

Proxy (Middleware)              Size
└ ƒ /                          ...
```

All three routes should appear, and the `Proxy (Middleware)` line confirms Next.js detected your `proxy.ts`.

Then start the dev server:

```bash
pnpm dev
```

You should see:

```
  ▲ Next.js 16.x.x (Turbopack)
  - Local:   http://localhost:3000
  ✓ Ready in Xms
```

> If port 3000 is already in use, specify a different port: `pnpm dev -p 3001`

Visit http://localhost:3000 (or your chosen port) and click **"Unlock the TADA page"**.

### What to expect

| Page | With real credentials | With placeholder credentials |
|---|---|---|
| `http://localhost:3000` | Landing page with "Unlock" button | Same -- landing page works regardless |
| `http://localhost:3000/protected` | HTTP 402 paywall UI prompting for payment | HTTP 500 error (`"Failed to initialize: no supported payment kinds loaded from any facilitator"`) |

**If you used placeholder credentials** (e.g., `G_YOUR_PUBLIC_KEY` and `your-api-key-here`), the landing page at `/` will work normally, but `/protected` will return a 500 error. This is expected -- the proxy cannot authenticate with the facilitator using a placeholder API key. To see the full payment flow, replace the placeholder values in `.env.local` with real credentials from the [prerequisite steps](#stellar-account-setup) and restart the dev server.

**If you used real credentials**, visiting `/protected` in a browser will show the paywall UI. Visiting it after paying will show the "TADA!" page.

> **Testing with curl:** If you test the protected route with `curl`, the 402 response body will be `{}` (empty JSON) rather than the paywall HTML. This is expected -- the x402 paywall checks the `User-Agent` and `Accept` headers and only serves the full HTML paywall to browsers. To see the paywall, open the URL in a browser. To verify the 402 status with curl: `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/protected`

---

## Project structure

```
my-x402-app/
  proxy.ts                     # Payment proxy (intercepts /protected, shows paywall)
  app/
    page.tsx                    # Landing page
    layout.tsx                  # Root layout (update metadata title here)
    protected/
      page.tsx                  # Protected page (plain React component, shown after payment)
  packages/paywall/             # Vendored: Stellar paywall UI (from stellar/x402-stellar)
  vendors/x402/.../stellar/     # Vendored: @x402/stellar mechanism (from stellar/x402-stellar)
  patches/                      # SWK patch (from stellar/x402-stellar)
  .env.local                    # Environment variables (do not commit)
  pnpm-workspace.yaml           # Workspace config (2 entries)
  next.config.ts                # Next.js configuration
```

## Protecting additional pages

Add more paths to the routes config and matcher in `proxy.ts`:

```typescript
export const proxy = paymentProxy(
  {
    "/protected": {
      accepts: [{ scheme: "exact", price: "0.01", network: network, payTo: address }],
      description: "Premium content",
    },
    "/premium-data": {
      accepts: [{ scheme: "exact", price: "0.05", network: network, payTo: address }],
      description: "Premium data",
    },
  },
  server,
  undefined,
  paywall as any,
);

export const config = {
  matcher: ["/protected/:path*", "/premium-data/:path*"],
};
```

Then create the page at `app/premium-data/page.tsx` as a regular React component -- no payment logic needed.

### Protecting API routes

If you need to protect API routes (returning JSON instead of HTML), use `withX402` instead of `paymentProxy`. `withX402` wraps individual route handlers and guarantees payment settlement only after a successful response (status < 400):

```typescript
// app/api/premium/route.ts
import { NextRequest, NextResponse } from "next/server";
import { withX402, x402ResourceServer } from "@x402/next";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { ExactStellarScheme } from "@x402/stellar/exact/server";

// Reuse the same server setup (or import from a shared module)
const network = (process.env.STELLAR_NETWORK ?? "stellar:testnet") as "stellar:testnet" | "stellar:pubnet";
const facilitatorClient = new HTTPFacilitatorClient({ url: process.env.FACILITATOR_URL! });
const server = new x402ResourceServer(facilitatorClient)
  .register(network, new ExactStellarScheme());

const handler = async (req: NextRequest) => {
  return NextResponse.json({ data: "premium stuff" });
};

export const GET = withX402(
  handler,
  {
    accepts: [{ scheme: "exact", price: "0.05", network: network, payTo: process.env.SERVER_STELLAR_ADDRESS! }],
    description: "Premium API data",
  },
  server,
);
```

---

## Preparing a test wallet (for paying users)

Before paying, your wallet needs three things **in this order**:

1. **Testnet XLM** -- Fund via https://lab.stellar.org/account/fund
2. **USDC trustline** -- The paywall has an **"Add Trustline"** button, or add manually in Freighter: Settings > Manage Assets > Add Asset > search "USDC" on testnet
3. **Testnet USDC** -- Get from https://faucet.circle.com/ (select **Stellar** and **Testnet**)

---

## Troubleshooting

### Type error: paywall argument in proxy.ts

**Symptom:** `pnpm build` fails with a type error on the `paywall` argument to `paymentProxy()`:

```
Type error: Argument of type '...' is not assignable to parameter of type '...'.
  Types of property 'generateHtml' are incompatible.
    ...
    The types of 'resource.description' are incompatible between these types.
      Type 'string | undefined' is not assignable to type 'string'.
```

**Cause:** The vendored `@x402-stellar/paywall` bundles its own copy of the `@x402/core` type declarations. The paywall's types define `resource.description` as `string` (required), while `@x402/core@2.6.0` defines it as `string | undefined` (optional). TypeScript sees these as structurally incompatible.

**Fix:** Cast the paywall argument: `paywall as any`. The `proxy.ts` code in Step 5 already includes this cast. If you copied an earlier version of the code without the cast, add it to the `paymentProxy()` call:

```typescript
export const proxy = paymentProxy(
  { /* routes */ },
  server,
  undefined,
  paywall as any,  // <-- add the cast here
);
```

This does not affect runtime behavior -- the paywall handles missing descriptions gracefully.

### Facilitator unreachable / initialization failure

**Symptom:** The app starts but every request to the protected page hangs or returns a 500 error.

**Cause:** `paymentProxy` syncs with the facilitator on first request (via `syncFacilitatorOnStart`). If the facilitator (`channels.openzeppelin.com`) is unreachable, requests will fail.

**Fix:** Verify `FACILITATOR_URL` is correct (testnet: `https://channels.openzeppelin.com/x402/testnet`, mainnet: `https://channels.openzeppelin.com/x402`). Check that your `FACILITATOR_API_KEY` is valid. Try curling your facilitator URL from your terminal to confirm the endpoint is reachable.

### Proxy not intercepting requests

**Symptom:** Visiting `/protected` shows the page without any paywall -- no payment required.

**Cause:** The proxy file is not being picked up by Next.js. Common reasons: the file is not named exactly `proxy.ts` (or `middleware.ts` for Next.js 15), it's not in the project root (e.g., it's inside `app/` or `src/`), or the `config.matcher` doesn't match the path.

**Fix:** Ensure `proxy.ts` is in the project root (same level as `package.json`). Verify `config.matcher` includes your protected path (e.g., `["/protected/:path*"]`). Restart the dev server after creating or moving the file.

### Edge Runtime errors in proxy

**Symptom:** Errors about `Buffer`, `crypto`, or other Node.js APIs not being available when the proxy runs.

**Cause:** Next.js may run the proxy in the Edge Runtime by default, which doesn't support Node.js APIs. The x402 packages depend on Node.js APIs.

**Fix:** Add `export const runtime = "nodejs";` to your `proxy.ts` file to force the Node.js runtime.

### Missing USDC trustline

**Symptom:** Payment fails with `"trustline entry is missing for account"`.

**Cause:** Either the payer's wallet or the payTo address (your server's Stellar account) does not have a USDC trustline on testnet.

**Fix:** Both accounts need trustlines. See [Step 2 of Stellar account setup](#2-add-a-usdc-trustline-critical). The USDC issuer on testnet is `GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5`.

### Paywall build was skipped (Step 3)

**Symptom:** The protected route returns a 402 response but the browser shows a blank page or a broken UI, or you get a module import error on server startup.

**Cause:** The paywall package requires a two-step build (codegen + tsup). If either step is skipped, the paywall template is empty or the package is not importable.

**Fix:** Run both build commands:
```bash
cd packages/paywall
npx tsx src/browser/build.ts
npx tsup
cd ../..
```

### `workspace:*` resolution error

**Symptom:** `pnpm install` fails with errors about `@x402/core` not being found in the workspace.

**Cause:** The vendored `@x402/stellar` or `@x402-stellar/paywall` still has `"@x402/core": "workspace:*"` in its `package.json`.

**Fix:** Change `"@x402/core": "workspace:*"` to `"@x402/core": "~2.6.0"` in both vendored `package.json` files. See [Step 2c](#2c-patch-vendored-packagejson-files). Note: do **not** change `"@x402/stellar": "workspace:*"` in the paywall's devDependencies -- that one is correct.

### esbuild build script warning

**Symptom:** `pnpm install` shows a warning about esbuild's postinstall script being ignored.

**Fix:** Create a `.npmrc` file in the project root with `approve-builds-automatically=true`, then run:
```bash
pnpm rebuild esbuild
```

### Missing environment variables

**Symptom:** The app crashes on startup with `Missing required environment variable: FACILITATOR_URL` (or similar).

**Fix:** Create `.env.local` in the project root with all required variables. See [Step 4](#step-4-configure-environment-variables).

### Bundling errors with vendored packages (Webpack)

**Symptom:** Next.js throws errors about modules not being found, or you see unexpected build failures related to native Node.js modules. This is most common when using **Webpack** instead of Turbopack (e.g., `--no-turbopack` or older Next.js versions).

**Fix:** Add the Stellar SDK to `serverExternalPackages` in `next.config.ts`:

```typescript
const nextConfig: NextConfig = {
  serverExternalPackages: ["@stellar/stellar-sdk"],
  // ... rest of config
};
```

> **Note:** This is not needed when using Turbopack (the default in Next.js 16). Turbopack handles the bundling correctly without additional configuration.

### Wrong Stellar network in wallet

**Symptom:** Payment appears to succeed in the wallet but the server rejects it, or the wallet shows unexpected balances.

**Cause:** Stellar wallets do not support programmatic network switching (unlike Ethereum's EIP-3326). If your wallet is set to mainnet while the app uses testnet, transactions will fail.

**Fix:** Manually switch your wallet (e.g., Freighter) to the Stellar testnet network before attempting payment.

---

## Important notes

- **Both the payer AND the payTo account need USDC trustlines.** Most common setup mistake.
- `@x402/stellar` and `@x402-stellar/paywall` are **not on npm**. They must be vendored from [stellar/x402-stellar](https://github.com/stellar/x402-stellar).
- `@x402/core` and `@x402/next` **are on npm** at version 2.6.0. Do not vendor them.
- The paywall package requires a **two-step build** (codegen + tsup). See [Step 3](#step-3-build-the-paywall-package).
- Stellar wallets don't support programmatic network switching (unlike Ethereum's EIP-3326). Users must switch manually in their wallet extension.
- **Stellar testnet is periodically reset.** When this happens, all accounts, trustlines, and balances are wiped. You will need to redo the [Stellar account setup](#stellar-account-setup) after a reset. Check [Stellar status](https://status.stellar.org/) if your account suddenly stops working.
- **Facilitator API keys** from OpenZeppelin Channels are network-specific. Generate testnet keys via `/testnet/gen` and mainnet keys via `/gen`. Check [OpenZeppelin Channels documentation](https://channels.openzeppelin.com) for details on key expiration and rate limits.

---

## Switching to Mainnet

This guide defaults to Stellar testnet. To deploy on mainnet, you only need to change your `.env.local` values -- **no code changes required**. The `proxy.ts` reads all network-specific configuration from environment variables.

> **Mainnet uses real money.** All transactions on Stellar mainnet involve real USDC and real XLM. Payments settled through x402 are **final and non-refundable**. Before switching to mainnet:
> 1. Complete the full guide on testnet first and verify the payment flow works end-to-end.
> 2. Generate a **fresh keypair** for mainnet -- do not reuse testnet keys.
> 3. Store your secret key securely offline after initial account setup. Your running server only needs the public key.
> 4. Start with the minimum amount of XLM and USDC needed (~2 XLM + $0.10 USDC).
> 5. Verify all environment variables match mainnet values before starting the server.

### Mainnet `.env.local`

```env
STELLAR_NETWORK=stellar:pubnet
SERVER_STELLAR_ADDRESS=G_YOUR_MAINNET_PUBLIC_KEY
FACILITATOR_URL=https://channels.openzeppelin.com/x402
FACILITATOR_API_KEY=your-mainnet-api-key
PAYMENT_PRICE=0.01
SOROBAN_RPC_URL=https://mainnet.sorobanrpc.com
```

### What changes between testnet and mainnet

| Item | Testnet | Mainnet |
|---|---|---|
| `STELLAR_NETWORK` | `stellar:testnet` | `stellar:pubnet` |
| `FACILITATOR_URL` | `https://channels.openzeppelin.com/x402/testnet` | `https://channels.openzeppelin.com/x402` |
| API key generation | `curl https://channels.openzeppelin.com/testnet/gen` | `curl https://channels.openzeppelin.com/gen` |
| `SOROBAN_RPC_URL` | Not needed (auto-defaults) | **Required** (e.g., `https://mainnet.sorobanrpc.com`) |
| USDC issuer (for trustline) | `GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5` | `GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN` |
| Server address | Testnet account (Friendbot-funded) | Real mainnet account |
| Wallet network | Testnet | Mainnet (switch manually in Freighter) |
| Funding | Friendbot + Circle faucet (free) | Purchase real XLM + USDC |

### Mainnet account setup

Mainnet has no Friendbot or free USDC faucet. You must:

1. **Generate a fresh keypair** for mainnet (do not reuse your testnet keypair):
   ```bash
   stellar keys generate my-mainnet-key --network mainnet
   stellar keys address my-mainnet-key   # Your mainnet public key (G...)
   ```

2. **Fund with real XLM** (~2 XLM minimum). Purchase from an exchange (Coinbase, Kraken, etc.) and send to your public key, or use another funded Stellar account.

3. **Add a USDC trustline** using the **mainnet** issuer (different from testnet):
   ```bash
   # Build and sign the trustline transaction
   stellar tx new change-trust \
     --line USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN \
     --source-account my-mainnet-key \
     --network mainnet \
     --sign-with-key my-mainnet-key \
     --build-only > trustline-tx.xdr

   # Sign and send it
   cat trustline-tx.xdr | stellar tx sign --network mainnet --sign-with-key my-mainnet-key | stellar tx send --network mainnet
   rm trustline-tx.xdr
   ```

4. **Generate a mainnet facilitator API key:**
   ```bash
   curl https://channels.openzeppelin.com/gen
   ```

### Soroban RPC URL (mainnet only)

On testnet, the Stellar SDK auto-connects to the public testnet Soroban RPC. On mainnet, **you must provide your own RPC endpoint**. The `proxy.ts` will throw a clear error at startup if `SOROBAN_RPC_URL` is missing when `STELLAR_NETWORK=stellar:pubnet`.

Options include:
- `https://mainnet.sorobanrpc.com` (community endpoint)
- Commercial providers like [Validation Cloud](https://www.validationcloud.io/) or [Blockdaemon](https://www.blockdaemon.com/) for production reliability
- See [Stellar RPC Providers](https://developers.stellar.org/docs/data/apis/rpc/providers) for a full list

> **Facilitator trust model:** On mainnet, the facilitator handles real payment settlement. You are trusting the facilitator to correctly verify and settle transactions. Review the facilitator provider's terms and uptime guarantees before routing real money. For production applications, consider the implications of facilitator downtime on your users' experience.

> **Secret key security:** On mainnet, your secret key (S...) controls real funds. Never commit it to version control, even in private repos. After setting up your trustline, store it securely offline -- your running server only needs the public key (G...) to receive payments.

## Reference links

- [x402 Protocol](https://www.x402.org/)
- [x402 npm packages](https://www.npmjs.com/search?q=%40x402) (`@x402/core`, `@x402/next`, etc.)
- [Coinbase x402 Repository](https://github.com/coinbase/x402) (canonical source)
- [Stellar x402 Reference Implementation](https://github.com/stellar/x402-stellar)
- [Stellar Developer Docs -- x402](https://developers.stellar.org/docs/build/apps/x402)
- [Freighter Wallet](https://www.freighter.app/)
- [Circle USDC Faucet (testnet)](https://faucet.circle.com/)
- [OpenZeppelin Channels](https://channels.openzeppelin.com)
