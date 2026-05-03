# TODOs

- **DEV_PORT hardcoded to 4100 in ci-e2e.yml** — the wait step always curls `app.lvh.me:4100` regardless of what port a consumer repo's `bin/dev-e2e` actually starts on. Working for current repos that all use 4100, but should become a `workflow_call` input or a convention enforced by `bin/dev-e2e` honouring the `DEV_PORT` env var.

- **RSpec sharding in ci-rails.yml** — RSpec has no built-in `--shard` flag. When Rails test suites exceed ~5m, add file-list splitting in the discover job (no extra gems needed). Each shard gets a subset of spec files via `rspec spec/file1.rb spec/file2.rb`. Currently billiedoby is ~2m19s (100 specs) and fx-core-rails has 77 specs — not worth the runner spin-up overhead yet.
