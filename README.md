# 1-shot-stellar

One prompt => One app

This is a collection of 1-shot (single prompt) apps built on Stellar — each folder contains an AI generated standalone app generated from the guide in one shot.

> **Experimental.** These projects are proofs of concept and have **not** been audited for production readiness. Do not deploy with real funds without a thorough security review.

## Projects

| Folder | Description | Claude Prompt | Resulting App |
|--------|-------------|----------------|------|
| `x402-app` | Payment-gated Next.js app using the x402 protocol. Gates a page behind a USDC micropayment on Stellar. | *"Build a payment gated app for [this youtube video](https://www.youtube.com/watch?v=hMLcKtVwF-A) for $1 following this guide: https://raw.githubusercontent.com/oceans404/1-shot-stellar/main/x402-app/Guide.md"* | [Payment gated video app](https://1-shot-stellar-video-paywall.vercel.app) |
