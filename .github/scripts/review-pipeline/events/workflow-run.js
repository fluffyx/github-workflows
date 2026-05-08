const { ALL_LABELS } = require('../constants.js');

async function handleWorkflowRun({ helpers, context }) {
  const wr = context.payload.workflow_run;
  if (wr.conclusion !== 'success') return;

  const prNumber = wr.pull_requests?.[0]?.number;
  if (!prNumber) return;

  const labels = await helpers.listLabels(prNumber);
  await helpers.removePresentLabels(prNumber, labels, ALL_LABELS);
  await helpers.requestCharlieReview(prNumber);
}

module.exports = { handleWorkflowRun };
