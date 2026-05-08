const { createHelpers } = require('./github-helpers.js');
const { handlePullRequest } = require('./events/pull-request.js');
const { handleWorkflowRun } = require('./events/workflow-run.js');
// Greptile/Macroscope pipeline disabled — only Charlie auto-request is active.
// Uncomment these handlers to re-enable the full review pipeline.
// const { handlePullRequestReview } = require('./events/pull-request-review.js');
// const { handleCheckRun } = require('./events/check-run.js');
// const { handleIssueComment } = require('./events/issue-comment.js');

const HANDLERS = {
  pull_request: handlePullRequest,
  workflow_run: handleWorkflowRun,
  // pull_request_review: handlePullRequestReview,
  // check_run: handleCheckRun,
  // issue_comment: handleIssueComment,
};

async function run({ github, context, core }) {
  const helpers = createHelpers({ github, context, core });
  await helpers.ensureRepoLabels();

  const handler = HANDLERS[context.eventName];

  if (!handler) {
    core.info(`No handler registered for event: ${context.eventName}`);
    return;
  }

  await handler({ helpers, context });
}

module.exports = { run };
