# fluffyx/github-workflows

Reusable GitHub Actions workflows for `fluffyx/*` repositories.

This repo currently provides a shared review pipeline that prepares PR state labels, clears previous review-pipeline labels on each new PR push, and requests a review from the `CharlieHelps` GitHub user.

## Add Charlie Auto-Review

Create `.github/workflows/review-pipeline.yml` in the repository that should request Charlie reviews:

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

The caller owns the event trigger. The reusable workflow receives the caller's `github.event` context through `workflow_call`, checks out the shared pipeline scripts from this repo, and runs the Charlie review request flow for the pull request.

If the shared workflow needs repository secrets in the future, add `secrets: inherit` to the caller job:

```yaml
jobs:
  review:
    uses: fluffyx/github-workflows/.github/workflows/review-pipeline.yml@main
    secrets: inherit
```
