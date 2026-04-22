# Charlie Review Consumer Migration

This guide explains how consuming repositories should update their Charlie Review workflow for the `charliecreates` check-run pipeline.

## What changed

The shared Charlie Review workflow now creates a pending `charliecreates` check run when a PR needs Charlie review, then completes that check when Charlie submits a review for the current head SHA.

That adds two caller requirements:

- The caller must grant `checks: write`, because the shared workflow uses the GitHub Checks API.
- The caller must trigger on `pull_request_review`, because Charlie's submitted review is the event that completes the pending check.

The reusable workflow also checks out its own pipeline scripts from `job.workflow_repository` and `job.workflow_sha`. This means callers can point at `@main`, a feature branch, a tag, or a SHA, and the workflow file and scripts come from the same shared-workflow commit.

## Required caller workflow

Use this shape in each consuming repository:

```yaml
name: Request Charlie Review

on:
  pull_request:
    types: [opened, reopened, synchronize]
  pull_request_review:
    types: [submitted]

permissions:
  contents: read
  checks: write
  issues: write
  pull-requests: write

jobs:
  review:
    uses: fluffyx/github-workflows/.github/workflows/charlie-review.yml@main
    secrets: inherit
```

If the repository wants Greptile auto-triggered after a clean Charlie review, pass the optional input:

```yaml
jobs:
  review:
    uses: fluffyx/github-workflows/.github/workflows/charlie-review.yml@main
    secrets: inherit
    with:
      greptile: true
```

## Testing an unreleased branch

To test a shared-workflow branch before it lands on `main`, change only the `uses:` ref:

```yaml
jobs:
  review:
    uses: fluffyx/github-workflows/.github/workflows/charlie-review.yml@casey/pending-check-no-billing
    secrets: inherit
```

Keep the same triggers and permissions:

```yaml
on:
  pull_request:
    types: [opened, reopened, synchronize]
  pull_request_review:
    types: [submitted]

permissions:
  contents: read
  checks: write
  issues: write
  pull-requests: write
```

After the shared workflow lands on `main`, change the `uses:` ref back to `@main`.

## Why `checks: write` is required

GitHub reusable workflows cannot elevate token permissions above the caller workflow's permission ceiling. If the caller omits `checks: write`, GitHub rejects the workflow at startup before any jobs run.

The symptom looks like this in GitHub Actions:

```text
Request Charlie Review: No jobs were run
```

The run conclusion is usually `startup_failure`, and the jobs list is empty.

## Why `pull_request_review` is required

The `pull_request` trigger handles PR lifecycle events:

- `opened`
- `reopened`
- `synchronize`

Those events let the pipeline clear stale labels, request Charlie review, and create the pending `charliecreates` check for the latest commit.

The `pull_request_review` trigger handles Charlie's submitted review. Without it, the pending check is created but the workflow does not wake up when Charlie reviews, so the check cannot be completed.

## Migration checklist

For each consuming repository:

1. Open `.github/workflows/charlie-review.yml`.
2. Add the `pull_request_review` trigger.
3. Add `checks: write` to `permissions`.
4. Keep `contents: read`, `issues: write`, and `pull-requests: write`.
5. Keep `secrets: inherit`.
6. Point `uses:` at the desired shared-workflow ref.
7. Push the branch and confirm the next `Request Charlie Review` run creates a job instead of a startup failure.

## Troubleshooting

### `No jobs were run`

Check the caller permissions first. The most common cause is missing `checks: write`.

### The pending check never completes

Check that the caller workflow includes:

```yaml
pull_request_review:
  types: [submitted]
```

Also confirm Charlie reviewed the current PR head SHA. Reviews for older commits are ignored.

### The workflow uses old scripts while testing a branch

The shared workflow should check out scripts with:

```yaml
repository: ${{ job.workflow_repository }}
ref: ${{ job.workflow_sha }}
```

If a branch still checks out `ref: main`, update the shared workflow first. Otherwise branch testing can load the workflow file from one ref and the scripts from another.
