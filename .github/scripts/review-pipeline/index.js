const { createHelpers } = require('./github-helpers.js');
const { handlePullRequest } = require('./events/pull-request.js');
const { handlePullRequestReview } = require('./events/pull-request-review.js');
const { handleWorkflowRun } = require('./events/workflow-run.js');
// Greptile/Macroscope check-run and comment handlers are disabled.
// Uncomment these handlers to re-enable the full review pipeline.
// const { handleCheckRun } = require('./events/check-run.js');
// const { handleIssueComment } = require('./events/issue-comment.js');

const HANDLERS = {
  pull_request: handlePullRequest,
  pull_request_review: handlePullRequestReview,
  workflow_run: handleWorkflowRun,
  // check_run: handleCheckRun,
  // issue_comment: handleIssueComment,
};

async function run({ github, context, core, options = {} }) {
  const helpers = createHelpers({ github, context, core });
  await helpers.ensureRepoLabels();

  const handler = HANDLERS[context.eventName];

  if (!handler) {
    core.info(`No handler registered for event: ${context.eventName}`);
    return;
  }

  await handler({ helpers, context, options });
}

module.exports = { run };
