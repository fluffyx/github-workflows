# TODOs

- **DEV_PORT hardcoded to 4100 in ci-e2e.yml** — `bin/wait-for-e2e` now owns per-suite host selection, but `DEV_PORT` is still hardcoded at `4100` in the job-level env (consumed by `bin/dev-e2e`). Consider making it a `workflow_call` input with default `4100` if any consumer needs a different port.

- **RSpec sharding in ci-rails.yml** — RSpec has no built-in `--shard` flag. When Rails test suites exceed ~5m, add file-list splitting in the discover job (no extra gems needed). Each shard gets a subset of spec files via `rspec spec/file1.rb spec/file2.rb`. Currently billiedoby is ~2m19s (100 specs) and fx-core-rails has 77 specs — not worth the runner spin-up overhead yet.
