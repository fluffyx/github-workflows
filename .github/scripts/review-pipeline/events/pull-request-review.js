const { LABELS, CHARLIE_LOGINS } = require('../constants.js');
const { triggerGreptile } = require('../triggers.js');

async function handlePullRequestReview({ helpers, context }) {
  const { core } = helpers;
  const pr = context.payload.pull_request;
  const reviewerLogin = context.payload.review.user?.login;
  const reviewState = context.payload.review.state;
  const reviewCommit = context.payload.review.commit_id;

  if (!CHARLIE_LOGINS.has(reviewerLogin)) {
    core.info(`Ignoring review from ${reviewerLogin}`);
    return;
  }

  if (reviewState !== 'approved') {
    core.info(`Ignoring non-approval review (state: ${reviewState}) from ${reviewerLogin}`);
    return;
  }

  if (reviewCommit && reviewCommit !== pr.head.sha) {
    core.info(`Ignoring Charlie review for ${reviewCommit}; current head is ${pr.head.sha}`);
    return;
  }

  const labels = await helpers.listLabels(pr.number);
  await helpers.addMissingLabels(pr.number, labels, [LABELS.charlieDone]);

  const unresolvedThreads = await helpers.getUnresolvedThreadCount(pr.number);

  if (pr.draft) {
    core.info('Draft PR — skipping Greptile auto-trigger');
  } else if (unresolvedThreads === 0) {
    core.info('All threads resolved — auto-triggering Greptile');
    await helpers.addMissingLabels(pr.number, labels, [LABELS.reviewGreptile]);
    await triggerGreptile(helpers, pr.number, pr.head.sha);
  } else {
    core.info(`${unresolvedThreads} unresolved thread(s) — waiting for resolution before Greptile`);
  }

}

module.exports = { handlePullRequestReview };
