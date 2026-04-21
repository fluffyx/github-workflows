# fluffyx/github-workflows

Reusable GitHub Actions workflows for `fluffyx/*` repositories.

## Workflows

| Workflow | File | For |
|----------|------|-----|
| **CI (Rails)** | `ci-rails.yml` | Rails + SvelteKit apps |
| **CI (Frontend)** | `ci-frontend.yml` | Pure frontend / component library repos |
| **Review Pipeline** | `review-pipeline.yml` | Charlie auto-review on PRs |

## CI (Rails)

Full CI for Rails apps that may include one or more SvelteKit frontends. Runs Ruby security scanning (Brakeman, Bundler Audit), RuboCop, RSpec with Postgres, and auto-discovers `frontend/` or `frontend-*/` directories for frontend linting, typechecking, and testing.

### Caller example

Create `.github/workflows/ci.yml` in your Rails repo:

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

CI for standalone frontend or component library repos (e.g. fx-glass). Lints, builds, tests, and optionally runs Playwright e2e tests.

### Caller example

Create `.github/workflows/ci.yml` in your frontend repo:

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

Create `.github/workflows/review-pipeline.yml` in your repo:

```yaml
name: Review Pipeline
on:
  pull_request:
    types: [opened, reopened, synchronize]
permissions:
  contents: read
  issues: write
  pull-requests: write
jobs:
  review:
    uses: fluffyx/github-workflows/.github/workflows/review-pipeline.yml@main
```

If the shared workflow needs repository secrets in the future, add `secrets: inherit` to the caller job.

## Conventions

- **Node 22, pnpm 10** — hardcoded in the shared workflows. Bump here to update all consumers.
- **Ruby version** — read from `.ruby-version` in each consumer repo.
- **Frontend discovery** — `ci-rails` auto-discovers `frontend/` and `frontend-*/` directories via a matrix strategy.
- **GitHub Packages** — auth is configured automatically when a `GH_PACKAGES_TOKEN` secret exists in the caller repo, skipped otherwise.
- **GraphQL codegen** — `pnpm codegen` runs with `continue-on-error: true` because not all frontends use it.
- **`svelte-kit sync`** — runs with `continue-on-error: true` because only SvelteKit projects need it.
