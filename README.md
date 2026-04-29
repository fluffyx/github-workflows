# fluffyx/github-workflows

Reusable GitHub Actions workflows for `fluffyx/*` repositories.

## Workflows

| Workflow | File | For |
|----------|------|-----|
| **CI (Rails)** | `ci-rails.yml` | Rails + SvelteKit apps |
| **CI (Frontend)** | `ci-frontend.yml` | Pure frontend / component library repos |
| **PR Title** | `pr-title.yml` | Enforce conventional commit PR titles |
| **Review Pipeline** | `charlie-review.yml` | Charlie auto-review on PRs |

## Required bin scripts

These workflows delegate to bin scripts in your repo. Each repo decides what "check", "test", and "lint" mean for itself.

| Script | Purpose | Called by | Example contents |
|--------|---------|-----------|-----------------|
| `bin/check` | Check-only (no file changes). Lint rules, typecheck, svelte-check. | `ci-frontend`, `ci-rails` | `prettier --check . && eslint . && svelte-check` |
| `bin/test-frontend` | Frontend codegen + tests. | `ci-rails` | `pnpm codegen && pnpm test` |
| `bin/audit-frontend` | Dependency audit across frontend dirs. | `ci-rails` | `pnpm audit` per frontend dir |
| `bin/lint` | Auto-fix (transforms files). For developers and lefthook. | (not called by CI) | `prettier --write . && eslint --fix .` |
| `bin/typecheck` | Fast read-only typecheck (no lint). For lefthook pre-commit. | (not called by CI) | `pnpm check` (svelte-check) or `tsc --noEmit` |
| `bin/rubocop` | RuboCop wrapper. | `ci-rails` | `bundle exec rubocop "$@"` |
| `bin/brakeman` | Brakeman wrapper. | `ci-rails` | `bundle exec brakeman "$@"` |
| `bin/bundler-audit` | Bundler Audit wrapper. | `ci-rails` | `bundle exec bundler-audit check --update` |
| `bin/e2e` | Start dev stack and run Playwright E2E tests. | `ci-rails` | Starts Rails + frontend dev servers, runs Playwright serially per `frontend*/tests/e2e/` dir |

### Multi-frontend repos

Rails apps use `frontend*/` directories at the repo root (e.g. `frontend/`, `frontend-book/`). The shared workflow installs dependencies per-directory automatically — no root `package.json` or `pnpm-lock.yaml` needed. `bin/check`, `bin/test-frontend`, and `bin/audit-frontend` should iterate over all `frontend*/` directories internally.

## CI (Rails)

Full CI for Rails apps that may include one or more SvelteKit frontends.

**Jobs:** `check-version`, `scan_ruby`, `lint` (RuboCop), `test` (RSpec + Postgres), `pack` (gem build dry-run, skips if no gemspec), `audit_frontend`, `check_frontend`, `test_frontend`, `e2e` (Playwright). The frontend jobs are skipped automatically if no `frontend/` or `frontend-*` directories exist. The `e2e` job is skipped if no `frontend*/tests/e2e/` directories or `bin/e2e` script exist.

### E2E secrets

The `e2e` job expects these secrets in the consuming repo (via `secrets: inherit`):

| Secret | Used as env var |
|--------|----------------|
| `STRIPE_TEST_SECRET_KEY` | `STRIPE_SECRET_KEY` |
| `STRIPE_TEST_PUBLISHABLE_KEY` | `VITE_STRIPE_PUBLISHABLE_KEY` |
| `GH_PACKAGES_TOKEN` | `GH_PACKAGES_TOKEN` + `BUNDLE_RUBYGEMS__PKG__GITHUB__COM` |

The job also installs Caddy (reverse proxy for multi-frontend dev servers) and caches Playwright browser binaries.

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

## PR Title

Enforces conventional commit format on PR titles using `amannn/action-semantic-pull-request`. Allowed types: `feat`, `fix`, `chore`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `revert`. Scopes are optional and unrestricted.

### Caller example

```yaml
name: PR Title
on:
  pull_request:
    types: [opened, edited, synchronize, reopened]
jobs:
  check:
    uses: fluffyx/github-workflows/.github/workflows/pr-title.yml@main
```

## Review Pipeline

Prepares PR state labels, clears previous review-pipeline labels on each new PR push, and requests a review from the `CharlieHelps` GitHub user.

### Caller example

```yaml
name: Charlie Review
on:
  pull_request:
    types: [opened, reopened, synchronize, ready_for_review]
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

### Run the same check locally via lefthook

The version-sync logic also runs as a pre-push lefthook hook so you don't have to wait for CI to find a CHANGELOG/version mismatch. See **Shared lefthook configs** below.

## Shared lefthook configs

Three preset configs at the root of this repo, each pulled in via lefthook's `remotes:` feature. Mix and match — Rails apps with frontends consume all three:

| Preset | Hook | Jobs |
|--------|------|------|
| `lefthook-shared.yml` | `pre-push` | `check-version` (same logic as CI) |
| `lefthook-frontend.yml` | `pre-commit` | `frontend-lint` (`bin/lint`), `frontend-typecheck` (`bin/typecheck`), `node-modules-freshness`, `lockfile-frozen` |
| `lefthook-rails.yml` | `pre-commit` | `rubocop` (autofix on staged Ruby files) |

### Consumer wiring

```yaml
# Frontend-only repo (e.g. fx-glass)
remotes:
  - git_url: https://github.com/fluffyx/github-workflows
    ref: main
    refetch_frequency: 24h
    configs:
      - lefthook-shared.yml
      - lefthook-frontend.yml
```

```yaml
# Rails app with one or more frontend*/ subdirs (e.g. billiedoby)
remotes:
  - git_url: https://github.com/fluffyx/github-workflows
    ref: main
    refetch_frequency: 24h
    configs:
      - lefthook-shared.yml
      - lefthook-frontend.yml
      - lefthook-rails.yml
```

Then run `lefthook install` once. Local jobs in the consumer's own `lefthook.yml` are merged with the remote ones; same-named jobs are overridden by local. `refetch_frequency: 24h` keeps each consumer in sync with upstream changes without fetching on every push.

### Required `bin/` scripts in the consumer

The frontend preset assumes the conventions documented under **Required bin scripts** above:

- `bin/lint` — auto-fix (called with `{staged_files}` as args)
- `bin/typecheck` — read-only typecheck. If your project doesn't have one yet, a 2-line shim is enough:
  ```bash
  #!/usr/bin/env bash
  exec pnpm check "$@"
  ```

### Portability

The `check-version.sh` script (and any future shared scripts) is portable across macOS (bash 3.2 + BSD coreutils) and Linux (CI). No `brew install bash` or GNU grep required on developer machines beyond `lefthook` itself.

### Overriding a single job

To keep all the shared jobs but tweak one (e.g. fx-glass's prettier-only lint flow), redeclare it under the same name in the consumer's local config:

```yaml
# consumer's lefthook.yml
remotes:
  - git_url: https://github.com/fluffyx/github-workflows
    configs: [lefthook-shared.yml, lefthook-frontend.yml]

pre-commit:
  jobs:
    - name: frontend-lint           # overrides the remote's frontend-lint
      glob: "**/*.{ts,svelte}"
      run: pnpm prettier --write {staged_files}
      exclude: "src/lib/components/theme/ThemeInitScript.svelte"
      stage_fixed: true
```

## Dependency audit

Both workflows run `pnpm audit` (hard-fail). To ignore an unfixable CVE, add it to `pnpm.auditConfig.ignoreCves` in your `package.json`:

```json
{
  "pnpm": {
    "auditConfig": {
      "ignoreCves": ["CVE-2024-XXXXX"]
    }
  }
}
```

The `ci-frontend` workflow reads this array and passes `--ignore` flags to `pnpm audit` automatically (pnpm 10 does not read `auditConfig` natively).

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
