#!/usr/bin/env bash
#
# Lefthook pre-push wrapper. Lefthook executes this from the consumer's
# repo root (so CHANGELOG.md / package.json are resolved correctly), but
# $0 still points into this remote repo's clone — so we can locate the
# canonical script next to the composite action.

set -euo pipefail

script_dir=$(cd "$(dirname "$0")" && pwd)
exec bash "${script_dir}/../../actions/check-version/check-version.sh"
