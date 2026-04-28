# Contributing to ZureMap

Thanks for your interest in contributing. This document covers how to get set up, the workflow we follow, and the licensing terms that govern contributions.

## Prerequisites

- [Node.js](https://nodejs.org/) v22+
- [Azure CLI](https://learn.microsoft.com/en-us/cli/azure/install-azure-cli) — `az login` must work locally
- [Angular CLI](https://github.com/angular/angular-cli) v19+

## Local Setup

```bash
git clone https://github.com/<owner>/ZureMap.git
cd ZureMap
npm ci
az login
npm run dev        # starts the proxy + Angular dev server
```

Open `http://localhost:4200/`.

## Workflow

1. **Open an issue first** for any non-trivial change — this aligns effort before code is written.
2. Fork the repository and create a branch from `main`.
3. Make your changes and ensure all checks pass (see below).
4. Open a pull request against `main`. Fill in the PR template.

## Running Checks

```bash
npm test                          # unit tests (single run)
npm run lint                      # ESLint
npm run build                     # production build
```

Or via Make:

```bash
make test
make lint
make build
```

All three must pass before a PR can be merged.

## Commit Convention

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add DNS record type filtering
fix: correct VNet peering direction
docs: update Docker setup instructions
chore: bump Angular to 19.3
```

Sign off every commit with `-s` (see Licensing below):

```bash
git commit -s -m "feat: ..."
```

## Branching

- PRs go against `main` directly — there is no `develop` branch.
- Keep branches short-lived and focused on a single concern.

## Updating Azure Icons

If you add support for new resource types, update the icon mapping:

```bash
npm run map-icons -- --source /path/to/svg-pack
```

This normalises filenames and regenerates `assets/azure-icons/` and `icon-manifest.json`. Commit both outputs.

## Licensing Your Contribution

ZureMap is licensed under the [Elastic License 2.0 (ELv2)](./LICENSE.md). By submitting a pull request you confirm, via the [Developer Certificate of Origin](https://developercertificate.org/), that you wrote the contribution or otherwise have the right to submit it, and that it may be distributed under the terms of ELv2.

Please sign off your commits to record this:

```bash
git commit -s
```

This adds a `Signed-off-by: Your Name <email>` line to the commit message. It is **required** — PRs without signed-off commits will not be merged.
