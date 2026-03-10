# Contributing to 1-shot-stellar

Thanks for your interest in contributing! This repo is a collection of single-prompt apps built on Stellar. Each project proves that a useful Stellar app can be generated from one AI prompt + a well-written guide.

## What makes a good contribution

A new project added to the table in the README. Each project must include:

| Required | What it is |
|----------|------------|
| **Folder** | A top-level directory in this repo containing the app code and guide |
| **Description** | A short description of what the app does |
| **Guide** | A markdown guide (`Guide.md`) that an AI coding agent can follow to build the app from scratch |
| **Claude Prompt** | A single prompt that, when given to Claude Code (or similar), produces a working app by following your guide |
| **Live App** | A deployed, working version of the app that anyone can visit and try out |

The live app is non-negotiable — reviewers and users should be able to click a link and see it work, not just read about it.

## How to contribute

1. **Fork the repo** and create a branch for your project.

2. **Create your project folder** at the repo root (e.g., `my-stellar-app/`).

3. **Write a Guide.md** in your folder. This is the most important part. The guide should be detailed enough that an AI agent can follow it end-to-end with no human intervention. Look at [x402-app/Guide.md](x402-app/Guide.md) for an example of the level of detail expected.

4. **Include the generated app** in the same folder. This is the output of running your prompt against your guide — the proof that it works.

5. **Deploy the app** so there's a live link. Vercel, Cloudflare Pages, Netlify, Railway, or anything publicly accessible works.

6. **Add a row to the Projects table** in [README.md](README.md):

   ```markdown
   | `your-folder` | Short description of your app | [Guide.md](your-folder/Guide.md) | *"Your one-shot prompt here"* | [Live app](https://your-deployed-url.example.com) |
   ```

   **Important:** The prompt should reference the **raw** GitHub URL for the guide (e.g., `https://raw.githubusercontent.com/oceans404/1-shot-stellar/main/your-folder/Guide.md`), not the regular GitHub URL. AI agents need the raw URL to read the guide contents directly.

7. **Open a PR.** Include:
   - A brief summary of the project
   - Confirmation that you ran the prompt and it produced a working app
   - The live app link (must be accessible at review time)

## Guidelines

- **Stellar-focused.** Projects should build on the Stellar network in some way.
- **One prompt, one app.** The whole point is that a single prompt + your guide produces a working app. If it takes multiple rounds of back-and-forth to get it working, the guide needs more detail.
- **Keep guides self-contained.** Don't assume the reader (or AI) has context beyond what's in the guide and publicly available docs. Pin dependency versions, link to docs, and explain non-obvious steps.
- **Test your prompt.** Before submitting, run your prompt from scratch (clean directory, no prior context) and confirm it builds and runs without errors.
- **No secrets in the repo.** Use `.env.local` or equivalent for API keys, private keys, etc. Guides should explain how to generate credentials, not include them.

## Questions or ideas?

Open an issue to discuss before starting if you're unsure whether a project idea fits. We're happy to help shape it.

## License

By contributing, you agree that your contributions will be licensed under the [Apache License 2.0](LICENSE).
