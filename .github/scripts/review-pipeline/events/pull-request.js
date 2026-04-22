const { ALL_LABELS } = require('../constants.js');

async function handlePullRequest({ helpers, context }) {
  const pr = context.payload.pull_request;
  const labels = await helpers.listLabels(pr.number);

  await helpers.removePresentLabels(pr.number, labels, ALL_LABELS);
  await helpers.requestCharlieReview(pr.number);
  await helpers.createPendingCheck(pr.head.sha);
}

module.exports = { handlePullRequest };
