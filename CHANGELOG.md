# Changelog

## [Unreleased]

- Renamed `ci-svelte.yml` → `ci-rails-svelte.yml` (SvelteKit jobs for Rails apps)
- Renamed `ci-frontend.yml` → `ci-svelte.yml` (standalone SvelteKit repos)
- Renamed all `ci-frontend-*` workflows to `ci-svelte-*`
- Split e2e into separate workflow, added sharded variants (`ci-svelte-test.yml`, `ci-svelte-e2e-sharded.yml`, `ci-svelte-e2e-2-shards.yml`)
- Unsharded workflows no longer have a `discover` job — cleaner CI output
- Added Playwright browser caching to e2e workflows
- Added `test_shards` input to `ci-rails-svelte.yml` with `TEST_SHARD` env var for `bin/test-frontend`
- Modernized `ci-gem.yml`: renamed `scan`→`audit`, `lint`→`check`, added `version-check`, added audit network error classification
- Added audit network error classification to `ci-svelte.yml`
- Updated README to reflect all current workflows and conventions

## [2026-05-01]

- Audit jobs now warn on network failures instead of failing red (#51)
- Renamed `lint` to `check`, `check-version` to `version-check`, `review-pipeline` to `pipeline` (#51)
- Renamed `discover` display name from `ci-filter` to `discover` (#50)
- Renamed `scan-ruby` to `audit-ruby` (#50)

## [2026-04-30]

- Consolidated `discover_frontends` into `filter` job in `ci-svelte.yml` (#49)
- Consolidated `discover_e2e` into `filter` job in `ci-e2e.yml` (#49)
- Normalized all job IDs to use hyphens instead of underscores (#49)
- Renamed `filter` job ID to `discover` across all workflows (#49)

## [2026-04-29]

- Switched `dorny/paths-filter` to git-diff mode to avoid `pull-requests` permission requirement (#47)
- Removed duplicate E2E job from `ci-rails.yml`, now lives only in `ci-e2e.yml` (#46)
- Split `ci-frontend.yml` build and test into separate jobs (#46)
- Fixed paths-filter permissions and renamed ci-filter jobs (#45)

## [2026-04-28]

- Added `dorny/paths-filter` to skip irrelevant CI jobs based on changed files (#32)
- Cached Caddy binary in e2e job for faster runs (#43)
- Split `ci-rails.yml` into `ci-rails.yml` + `ci-svelte.yml` for clean top-level grouping (#42)
- Fixed e2e check grouping and switched to `#` for shard numbers (#41)

## [2026-04-27]

- Parallel e2e matrix with fast-fail and optional sharding (#39, #37)
- Fixed artifact upload cancellation from dev-server kill trap (#38)
- Addressed bot review findings (#36)

## [2026-04-26]

- Added shared lefthook presets: `lefthook-shared.yml`, `lefthook-frontend.yml`, `lefthook-rails.yml` (#35)
- Made `check-version.sh` portable across macOS and Linux (#35)
- Fixed E2E Stripe secret names, added `pr-title.yml` workflow (#33)
- Added optional E2E job to `ci-rails.yml` (#31)

## [2026-04-25]

- Consolidated preview deploy into single job with shell parallelism (#29)
- Added `ready_for_review` trigger to charlie-review caller example (#30)
- Fixed Neon branch race condition in preview deploys (#28)
- Parallelized Render and Vercel preview deploys (#26)

## [2026-04-24]

- Set `GH_PACKAGES_TOKEN` on Render preview services (#27)
- Switched preview Vercel deploys from `VITE_API_DOMAIN` to `API_BACKEND_URL` (#25)
- Added git auth before `ruby/setup-ruby` for private gem clones (#24)
- Removed redundant preview URL comment from PRs (#21)
- Polyfilled `pnpm.auditConfig.ignoreCves` for pnpm 10 (#22)
- Hardened preview environment against staging DB access (#23)

## [2026-04-23]

- Resolved Vercel project IDs from secrets at runtime (#20)
- Added GitHub Deployment records for Vercel preview URLs (#19)
- Triggered charlie-review on PRs to this repo (#17)
