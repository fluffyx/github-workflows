# Charlie Review Output Format

Charlie (`charliecreates[bot]`) submits PR reviews with a consistent structured format. This document describes how to classify review output programmatically.

## Review categories

Every PR review body falls into one of these categories:

| Category | Count* | Signal |
|----------|--------|--------|
| **Clean** | 81 | Body contains `"actionable"` without blocking/non-blocking sections |
| **Blocking** | 60 | Body contains `### Blocking feedback` |
| **Non-blocking** | 22 | Body contains `Non-blocking feedback` summary without blocking section |
| **Blocking + non-blocking** | 5 | Both markers present |
| **Empty** | 2 | No body text (follow-up review action with only inline replies) |

*Counts from 170 reviews between April 17–22, 2026. Zero ambiguous classifications.

## Classification algorithm

First match wins:

1. `"### Blocking feedback"` **and** `"Non-blocking feedback"` in body → **BLOCKING**
2. `"### Blocking feedback"` in body → **BLOCKING**
3. `"Blocking issue:"` in body → **BLOCKING** (rare variant)
4. `"Non-blocking feedback"` in body → **NON-BLOCKING**
5. `"actionable"` in body → **CLEAN**
6. `"No issues found"` or `"looks correct"` or `"bump looks safe"` in body → **CLEAN**
7. Empty body → **CLEAN**

For gating purposes, categories 1–3 are blocking (fail the check), and 4–7 are non-blocking (pass the check).

## Body formats

### Clean

A single sentence:

```
Reviewed the latest changes, and I don't have actionable feedback to address.
```

Observed variants:
- `"...and I dont have actionable feedback..."` (no apostrophe)
- `"...and I do not have actionable feedback..."` 
- `"...I don't have additional actionable feedback..."` (re-review)
- `"...I don't have actionable code/config feedback..."` (scoped)
- `"...I don't see actionable issues..."` 
- `"Reviewed — plan change ... looks correct."` (short-form approval)
- `"Dependency bump looks safe: ..."` 
- `"No issues found in the changes shown; ..."` 

### Blocking

```markdown
### Blocking feedback
1. Description — [path/to/file.ts#L42](link)
2. Description — [path/to/other.rb#L10](link)
```

### Blocking + non-blocking

```markdown
### Blocking feedback
1. Must-fix issue — [path/to/file.ts#L42](link)

<details>
<summary>Non-blocking feedback (2)</summary>

1. Suggestion — [path/to/file.ts#L10](link)
2. Suggestion — [path/to/other.ts#L5](link)
</details>
```

### Non-blocking only

```markdown
<details>
<summary>Non-blocking feedback (1)</summary>

1. Suggestion — [path/to/file.ts#L10](link)
</details>
```

## Inline code comments

Charlie attaches inline code annotations (`pr_review_comment`) **only to blocking reviews**. Clean and non-blocking reviews never have inline comments — all feedback goes in the review body.

This means the presence of any inline comment from Charlie is itself a blocking signal.

| Parent review category | Has inline comments |
|------------------------|---------------------|
| Blocking | Yes (63 of 65) |
| Blocking + non-blocking | Yes (5 of 5) |
| Clean | Never |
| Non-blocking | Never |

## Issue comments

Charlie occasionally posts PR conversation-level comments (`issue_comment`) for status updates, acknowledgments, and coordination. These are informational and do not carry a blocking/clean signal — only the `pr_review` body matters for gating.

Patterns observed:
- `"Noted the latest update — I'm re-checking..."` (acknowledgment)
- `"Thanks for the heads-up — ..."` (follow-up coordination)
- `"Status update: ..."` (progress)
- `"I reviewed this PR and left feedback here: [link]"` (pointer to review)

## Comment types summary

| GitHub type | What it is | Relevant for gating? |
|-------------|-----------|----------------------|
| `pr_review` | Top-level review (approve/comment/request changes) with body text | **Yes** — this is the only type that carries the blocking signal |
| `pr_review_comment` | Inline comment on a specific code line/hunk | No — inherits severity from parent `pr_review` |
| `issue_comment` | Conversation-level comment on the PR | No — informational only |
