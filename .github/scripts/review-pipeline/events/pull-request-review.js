const { LABELS, CHARLIE_LOGINS } = require('../constants.js');
const { triggerGreptile } = require('../triggers.js');

function classifyReview(body) {
  const text = body || '';

  if (!text.trim()) {
    return { conclusion: 'success', label: 'clean' };
  }

  const hasBlocking = text.includes('### Blocking feedback') || text.includes('Blocking issue:');
  const hasNonBlocking =
    text.includes('Non-blocking feedback') || text.includes('only have non-blocking');

  if (hasBlocking) {
    return { conclusion: 'failure', label: 'blocking' };
  }

  if (hasNonBlocking) {
    return { conclusion: 'failure', label: 'non-blocking' };
  }

  if (
    text.includes('actionable') ||
    text.includes('No issues found') ||
    text.includes('looks correct') ||
    text.includes('bump looks safe')
  ) {
    return { conclusion: 'success', label: 'clean' };
  }

  return { conclusion: 'failure', label: 'unclassified' };
}

function excerptReview(body) {
  return (body || '')
    .trim()
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 12)
    .join('\n');
}

function checkSummary(body, label) {
  if (label === 'clean') {
    return 'Charlie reviewed this PR and found no actionable feedback.';
  }

  const excerpt = excerptReview(body);

  if (label === 'blocking') {
    return `Charlie found blocking feedback.\n\n${excerpt}`;
  }

  if (label === 'non-blocking') {
    return `Charlie found non-blocking feedback.\n\n${excerpt}`;
  }

  return `Charlie review format was not recognized, so this check failed safe.\n\n${excerpt}`;
}

async function handlePullRequestReview({ helpers, context, options = {} }) {
  const { core } = helpers;
  const pr = context.payload.pull_request;
  const reviewerLogin = context.payload.review.user?.login;
  const reviewCommit = context.payload.review.commit_id;
  const reviewBody = context.payload.review.body || '';

  if (!CHARLIE_LOGINS.has(reviewerLogin)) {
    core.info(`Ignoring review from ${reviewerLogin}`);
    return;
  }

  if (reviewCommit && reviewCommit !== pr.head.sha) {
    core.info(`Ignoring Charlie review for ${reviewCommit}; current head is ${pr.head.sha}`);
    return;
  }

  const classification = classifyReview(reviewBody);
  await helpers.completeCheck(
    pr.head.sha,
    classification.conclusion,
    checkSummary(reviewBody, classification.label),
  );

  if (classification.label !== 'clean') {
    core.info(`Charlie review classified as ${classification.label}; marking check as failure`);
    return;
  }

  const labels = await helpers.listLabels(pr.number);
  await helpers.addMissingLabels(pr.number, labels, [LABELS.charlieDone]);

  const unresolvedThreads = await helpers.getUnresolvedThreadCount(pr.number);

  if (!options.greptile) {
    core.info('Greptile auto-trigger is disabled');
  } else if (pr.draft) {
    core.info('Draft PR — skipping Greptile auto-trigger');
  } else if (unresolvedThreads === 0) {
    core.info('All threads resolved — auto-triggering Greptile');
    await helpers.addMissingLabels(pr.number, labels, [LABELS.reviewGreptile]);
    await triggerGreptile(helpers, pr.number, pr.head.sha);
  } else {
    core.info(`${unresolvedThreads} unresolved thread(s) — waiting for resolution before Greptile`);
  }

}

module.exports = { classifyReview, handlePullRequestReview };
