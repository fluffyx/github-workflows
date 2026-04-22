# fluffyx/github-workflows

Reusable GitHub Actions workflows for `fluffyx/*` repositories.

## Workflows

| Workflow | File | For |
|----------|------|-----|
| **CI (Rails)** | `ci-rails.yml` | Rails + SvelteKit apps |
| **CI (Frontend)** | `ci-frontend.yml` | Pure frontend / component library repos |
| **Review Pipeline** | `charlie-review.yml` | Charlie auto-review on PRs |

## Required bin scripts

These workflows delegate to bin scripts in your repo. Each repo decides what "check", "test", and "lint" mean for itself.

| Script | Purpose | Called by | Example contents |
|--------|---------|-----------|-----------------|
| `bin/check` | Check-only (no file changes). Lint rules, typecheck, svelte-check. | `ci-frontend`, `ci-rails` | `prettier --check . && eslint . && svelte-check` |
| `bin/test-frontend` | Frontend codegen + tests. | `ci-rails` | `pnpm codegen && pnpm test` |
| `bin/audit-frontend` | Dependency audit across frontend dirs. | `ci-rails` | `pnpm audit` per frontend dir |
| `bin/lint` | Auto-fix (transforms files). For developers and lefthook. | (not called by CI) | `prettier --write . && eslint --fix .` |
| `bin/rubocop` | RuboCop wrapper. | `ci-rails` | `bundle exec rubocop "$@"` |
| `bin/brakeman` | Brakeman wrapper. | `ci-rails` | `bundle exec brakeman "$@"` |
| `bin/bundler-audit` | Bundler Audit wrapper. | `ci-rails` | `bundle exec bundler-audit check --update` |

### Multi-frontend repos

For repos with multiple frontend directories (`frontend/`, `frontend-admin/`, etc.), `bin/check`, `bin/test-frontend`, and `bin/audit-frontend` should iterate over all of them internally.

## CI (Rails)

Full CI for Rails apps that may include one or more SvelteKit frontends.

**Jobs:** `scan_ruby`, `lint` (RuboCop), `test` (RSpec + Postgres), `audit_frontend`, `check_frontend`, `test_frontend`. The frontend jobs are skipped automatically if no `frontend/` or `frontend-*` directories exist.

### Caller example

```yaml
name: CI
on:
  pull_request:
  push:
    branches: [main]
jobs:
  ci:
    uses: fluffyx/github-workflows/.github/workflows/ci-rails.yml@main
    secrets: inherit
```

## CI (Frontend)

CI for standalone frontend or component library repos (e.g. fx-glass).

**Jobs:** `check` (runs `bin/check`), `build-and-test`, and optionally `e2e` (Playwright).

### Caller example

```yaml
name: CI
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
jobs:
  ci:
    uses: fluffyx/github-workflows/.github/workflows/ci-frontend.yml@main
    secrets: inherit
    with:
      e2e: true
```

### Inputs

| Input | Type | Default | Description |
|-------|------|---------|-------------|
| `e2e` | `boolean` | `false` | Run Playwright e2e tests |

## Review Pipeline

Prepares PR state labels, clears previous review-pipeline labels on each new PR push, and requests a review from the `CharlieHelps` GitHub user.

### Caller example

```yaml
name: Charlie Review
on:
  pull_request:
    types: [opened, reopened, synchronize]
permissions:
  contents: read
  issues: write
  pull-requests: write
jobs:
  review:
    uses: fluffyx/github-workflows/.github/workflows/charlie-review.yml@main
    secrets: inherit
```

## Version sync check

Both CI workflows automatically run a version sync check (`check-version` job). It:

- **Requires** `CHANGELOG.md` to exist
- **Auto-discovers** version sources: `VERSION` file, `package.json` (version field), `version.rb`
- **Fails** if any discovered versions disagree with each other
- **Fails** if the latest CHANGELOG heading is a version that doesn't match the discovered version
- **Passes** if the latest CHANGELOG heading is `[Unreleased]` (acceptable on branches)

No configuration needed — it runs automatically for all repos using these workflows.

## Conventions

- **Node 22, pnpm 10** — hardcoded in the shared workflows. Bump here to update all consumers.
- **Ruby version** — read from `.ruby-version` in each consumer repo.
- **GitHub Packages** — auth is configured automatically when a `GH_PACKAGES_TOKEN` secret exists in the caller repo, skipped otherwise.
- **`bin/lint` vs `bin/check`** — `bin/lint` auto-fixes files (for developers/lefthook). `bin/check` is read-only (for CI). CI never calls `bin/lint`.
