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

Rails apps use `frontend*/` directories at the repo root (e.g. `frontend/`, `frontend-book/`). The shared workflow installs dependencies per-directory automatically — no root `package.json` or `pnpm-lock.yaml` needed. `bin/check`, `bin/test-frontend`, and `bin/audit-frontend` should iterate over all `frontend*/` directories internally.

## CI (Rails)

Full CI for Rails apps that may include one or more SvelteKit frontends.

**Jobs:** `check-version`, `scan_ruby`, `lint` (RuboCop), `test` (RSpec + Postgres), `pack` (gem build dry-run, skips if no gemspec), `audit_frontend`, `check_frontend`, `test_frontend`. The frontend jobs are skipped automatically if no `frontend/` or `frontend-*` directories exist.

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

**Jobs:** `check-version`, `audit` (pnpm audit), `check` (runs `bin/check`), `build-and-test` (build + pack dry-run + tests), and optionally `e2e` (Playwright).

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
- **Auto-discovers** version sources: `VERSION` file, root `package.json` (version field), `version.rb`
- **Auto-detects** changelog format from headings — either semver (`## [1.2.3]`) or date (`## [2026-04-12]`)
- **Fails** if changelog mixes semver and date headings
- **Passes** if the latest CHANGELOG heading is `[Unreleased]` (acceptable on branches)

### Semver changelogs (libraries)

- **Validates** all discovered versions are valid semver (`MAJOR.MINOR.PATCH`)
- **Fails** if any discovered versions disagree with each other
- **Fails** if the latest CHANGELOG heading is a version that doesn't match the discovered version
- **Fails** if any CHANGELOG heading uses a `v` prefix (use `## [0.6.1]`, not `## v0.6.1`)
- **Fails** if CHANGELOG version headings are out of descending semver order

### Date changelogs (apps)

- **Validates** headings are ISO 8601 dates (`YYYY-MM-DD`)
- **Fails** if dates are out of descending order
- **Skips** version cross-reference (apps typically have no version files to compare)

No configuration needed — it runs automatically for all repos using these workflows. The format is detected from your existing headings.

## Dependency audit

Both workflows run `pnpm audit` (hard-fail). To ignore an unfixable CVE, add it to `pnpm.auditConfig.ignoreCves` in your `package.json`.

## Pack dry-run

- **ci-frontend.yml**: runs `pnpm pack && tar tf *.tgz` after build to verify the package is publishable
- **ci-rails.yml**: runs `gem build *.gemspec` if a gemspec exists (skips for Rails apps)

## Test coverage

Both workflows pass `COVERAGE=true` to test steps. To use it, configure thresholds in your repo's test config:

- **Vitest**: add `coverage.thresholds` in `vitest.config.ts` (requires `@vitest/coverage-v8`)
- **SimpleCov**: check `ENV["COVERAGE"]` in `spec_helper.rb`

No artifacts are uploaded — coverage enforcement is local to each repo via threshold gates.

## Conventions

- **Node 22, pnpm 10** — hardcoded in the shared workflows. Bump here to update all consumers.
- **Ruby version** — read from `.ruby-version` in each consumer repo.
- **GitHub Packages** — auth is configured automatically when a `GH_PACKAGES_TOKEN` secret exists in the caller repo, skipped otherwise.
- **`bin/lint` vs `bin/check`** — `bin/lint` auto-fixes files (for developers/lefthook). `bin/check` is read-only (for CI). CI never calls `bin/lint`.
