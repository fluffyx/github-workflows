#!/usr/bin/env bash
#
# Verifies version files (VERSION, package.json, version.rb) agree and that
# CHANGELOG.md follows a consistent format. Used by both the GitHub composite
# action (CI) and the shared lefthook config (pre-push).
#
# Run from a project root that contains CHANGELOG.md.
#
# Portable across bash 3.2 (macOS default) and bash 4+ (Linux CI), and
# across BSD grep/sed (macOS) and GNU grep/sed (Linux). No PCRE / mapfile.

set -euo pipefail

semver_re='^[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z-]+(\.[0-9A-Za-z-]+)*)?(\+[0-9A-Za-z-]+(\.[0-9A-Za-z-]+)*)?$'
release_re='^[0-9]+\.[0-9]+\.[0-9]+$'
date_re='^[0-9]{4}-[0-9]{2}-[0-9]{2}$'

error_count=0

if [ -n "${GITHUB_ACTIONS:-}" ]; then
  err_prefix='::error::'
else
  err_prefix='ERROR: '
fi

hint() {
  echo "${err_prefix}$1" >&2
  error_count=$((error_count + 1))
}

# --- Require CHANGELOG.md ---
if [ ! -f CHANGELOG.md ]; then
  echo "${err_prefix}CHANGELOG.md is missing. Create one with a heading like: ## [1.0.0] — $(date +%Y-%m-%d)" >&2
  exit 1
fi

# --- Heading extractor: pulls "Foo" from "## [Foo] — date", "## [Foo]", or "## Foo".
# Trims surrounding whitespace and any "— date" / "- date" trailing tail. ---
extract_heading() {
  sed -nE 's/^##[[:space:]]+\[?([^]]+)\]?.*/\1/p' "$1" \
    | sed -E 's/[[:space:]]+[—–\-].*//' \
    | sed -E 's/^[[:space:]]+//; s/[[:space:]]+$//'
}

# --- Auto-discover version sources ---
versions=()
sources=()

if [ -f VERSION ]; then
  v=$(tr -d '[:space:]' < VERSION)
  if [[ ! "$v" =~ $semver_re ]]; then
    hint "VERSION file contains '$v' which is not valid semver. Expected format: 1.2.3 or 1.2.3-beta.1 (no 'v' prefix)"
  else
    versions+=("$v")
    sources+=("VERSION")
    echo "Found VERSION: $v"
  fi
fi

while IFS= read -r pj; do
  v=$(python3 -c "import json,sys; d=json.load(open(sys.argv[1])); print(d.get('version',''))" "$pj" 2>/dev/null || true)
  if [ -n "$v" ]; then
    if [[ ! "$v" =~ $semver_re ]]; then
      hint "$pj version field is '$v' which is not valid semver. Set \"version\": \"1.2.3\" or \"1.2.3-beta.1\" (no 'v' prefix)"
    else
      versions+=("$v")
      sources+=("$pj")
      echo "Found $pj: $v"
    fi
  fi
done < <(find . -name package.json -not -path '*/node_modules/*' -not -path '*/.git/*' -not -path '*/frontend*/*' | sort)

while IFS= read -r vr; do
  v=$(sed -nE "s/.*VERSION[[:space:]]*=[[:space:]]*[\"']([^\"']+).*/\1/p" "$vr" 2>/dev/null | head -1 || true)
  if [ -n "$v" ]; then
    if [[ ! "$v" =~ $semver_re ]]; then
      hint "$vr contains '$v' which is not valid semver. Expected: VERSION = \"1.2.3\" or \"1.2.3-beta.1\""
    else
      versions+=("$v")
      sources+=("$vr")
      echo "Found $vr: $v"
    fi
  fi
done < <(find . -name version.rb -not -path '*/node_modules/*' -not -path '*/.git/*' | sort)

# --- Compare all discovered versions ---
if [ ${#versions[@]} -eq 0 ]; then
  echo "No version sources found — skipping version comparison"
else
  canonical="${versions[0]}"
  for i in "${!versions[@]}"; do
    if [ "${versions[$i]}" != "$canonical" ]; then
      hint "Version mismatch: ${sources[0]} says $canonical but ${sources[$i]} says ${versions[$i]}. Update ${sources[$i]} to $canonical (or update all files to the same version)"
    fi
  done
fi

# --- Collect all CHANGELOG headings ---
all_headings=()
while IFS= read -r h; do
  [ -n "$h" ] && all_headings+=("$h")
done < <(extract_heading CHANGELOG.md)

# --- Check [Unreleased] position ---
if [ ${#all_headings[@]} -gt 0 ]; then
  for i in "${!all_headings[@]}"; do
    if echo "${all_headings[$i]}" | grep -qi '^unreleased'; then
      if [ "$i" -ne 0 ]; then
        hint "[Unreleased] must be the first heading in CHANGELOG.md, but it appears at position $((i+1)). Move '## [Unreleased]' above all version headings"
      fi
    fi
  done
fi

# --- Strip Unreleased from headings used for version checks ---
raw_headings=()
for h in "${all_headings[@]+"${all_headings[@]}"}"; do
  if ! echo "$h" | grep -qi '^unreleased'; then
    raw_headings+=("$h")
  fi
done

for h in "${raw_headings[@]+"${raw_headings[@]}"}"; do
  if [[ "$h" =~ ^v ]]; then
    hint "CHANGELOG.md heading has v-prefix: '$h'. Remove the 'v', e.g. change '## [$h]' to '## [${h#v}]'"
  fi
done

headings=()
for h in "${raw_headings[@]+"${raw_headings[@]}"}"; do
  headings+=("${h#v}")
done

# --- Detect changelog format: semver or date ---
changelog_format=""
if [ ${#headings[@]} -gt 0 ]; then
  semver_count=0
  date_count=0
  for h in "${headings[@]+"${headings[@]}"}"; do
    if [[ "$h" =~ $semver_re ]]; then
      semver_count=$((semver_count + 1))
    elif [[ "$h" =~ $date_re ]]; then
      date_count=$((date_count + 1))
    fi
  done

  if [ "$semver_count" -gt 0 ] && [ "$date_count" -gt 0 ]; then
    hint "CHANGELOG.md mixes semver and date headings. Use one format: either '## [1.2.3]' for all entries or '## [2026-04-12]' for all entries"
  elif [ "$semver_count" -gt 0 ]; then
    changelog_format="semver"
  elif [ "$date_count" -gt 0 ]; then
    changelog_format="date"
  fi
fi

echo "Changelog format: ${changelog_format:-none detected}"

# --- Validate headings based on format ---
if [ "$changelog_format" = "semver" ]; then
  for h in "${headings[@]+"${headings[@]}"}"; do
    if [[ ! "$h" =~ $semver_re ]]; then
      hint "CHANGELOG.md heading '$h' is not valid semver. Expected: '## [1.2.3]', '## [1.2.3-beta.1]', or '## [1.2.3] — 2026-04-12'"
    fi
  done
elif [ "$changelog_format" = "date" ]; then
  for h in "${headings[@]+"${headings[@]}"}"; do
    if [[ ! "$h" =~ $date_re ]]; then
      hint "CHANGELOG.md heading '$h' is not a valid date. Expected format: '## [2026-04-12]' (YYYY-MM-DD)"
    fi
  done
else
  for h in "${headings[@]+"${headings[@]}"}"; do
    if [[ ! "$h" =~ $semver_re ]] && [[ ! "$h" =~ $date_re ]]; then
      hint "CHANGELOG.md heading '$h' is not recognized. Use '## [1.2.3]', '## [1.2.3-beta.1]', '## [1.2.3] — 2026-04-12', or '## [2026-04-12]'"
    fi
  done
fi

# --- Check latest CHANGELOG version matches (semver only) ---
if [ "$changelog_format" = "semver" ] && [ ${#versions[@]} -gt 0 ]; then
  canonical="${versions[0]}"
  if [ ${#all_headings[@]} -eq 0 ]; then
    hint "CHANGELOG.md has no version headings. Add one like: ## [${canonical}]"
  else
    latest_heading="${all_headings[0]}"
    if echo "$latest_heading" | grep -qi '^unreleased'; then
      echo "Latest CHANGELOG heading is [Unreleased] — OK"
    else
      changelog_version="${latest_heading#v}"
      if [ "$changelog_version" != "$canonical" ]; then
        hint "CHANGELOG.md top version is $changelog_version but version files say $canonical. Either update the CHANGELOG heading to '## [$canonical]' or update your version files to $changelog_version"
      else
        echo "CHANGELOG.md matches version: $changelog_version"
      fi
    fi
  fi
elif [ "$changelog_format" = "date" ]; then
  echo "Date-based changelog — skipping version cross-reference"
fi

# --- Check CHANGELOG ordering ---
if [ "$changelog_format" = "semver" ]; then
  release_headings=()
  for h in "${headings[@]+"${headings[@]}"}"; do
    if [[ "$h" =~ $release_re ]]; then
      release_headings+=("$h")
    fi
  done

  if [ ${#release_headings[@]} -ge 2 ]; then
    for ((i=0; i<${#release_headings[@]}-1; i++)); do
      a="${release_headings[$i]}"
      b="${release_headings[$((i+1))]}"
      higher=$(printf '%s\n%s\n' "$a" "$b" | sort -t. -k1,1nr -k2,2nr -k3,3nr | head -1)
      if [ "$higher" != "$a" ]; then
        hint "CHANGELOG.md out of order: $a appears before $b but $b is higher. Newest versions go first"
      fi
    done
  fi
elif [ "$changelog_format" = "date" ]; then
  valid_dates=()
  for h in "${headings[@]+"${headings[@]}"}"; do
    if [[ "$h" =~ $date_re ]]; then
      valid_dates+=("$h")
    fi
  done

  if [ ${#valid_dates[@]} -ge 2 ]; then
    for ((i=0; i<${#valid_dates[@]}-1; i++)); do
      a="${valid_dates[$i]}"
      b="${valid_dates[$((i+1))]}"
      if [[ "$b" > "$a" ]]; then
        hint "CHANGELOG.md out of order: $a appears before $b but $b is a later date. Newest dates go first"
      fi
    done
  fi
fi

# --- Check for empty changelog entries ---
empty_sections=$(awk '
  /^##[[:space:]]/ {
    if (heading != "" && content == 0) print heading
    heading = $0; content = 0; next
  }
  heading != "" && /[^ \t]/ && !/^#/ { content = 1 }
END {
  if (heading != "" && content == 0) print heading
}' CHANGELOG.md | grep -iv 'unreleased' || true)

if [ -n "$empty_sections" ]; then
  while IFS= read -r section; do
    hint "CHANGELOG.md has empty section: $section. Add content or remove the heading"
  done <<< "$empty_sections"
fi

# --- Report ---
if [ "$error_count" -gt 0 ]; then
  echo ""
  echo "Expected CHANGELOG.md heading format:"
  echo "  ## [Unreleased]            (optional, must be first)"
  echo "  ## [1.2.3] — 2026-04-12    (preferred: semver with date)"
  echo "  ## [1.2.3]                 (semver without date)"
  echo "  ## [1.2.3-beta.1]          (semver with prerelease)"
  echo "  ## [2026-04-12]            (date-only changelog)"
  echo ""
  echo "Version files must all contain the same semver (no 'v' prefix):"
  echo "  VERSION, package.json \"version\", version.rb VERSION ="
  echo "  Prerelease (1.2.3-alpha.1) and build metadata (1.2.3+build) are allowed"
  echo ""
  exit 1
fi

echo "Version sync check passed"
