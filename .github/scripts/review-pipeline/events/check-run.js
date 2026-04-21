const {
  LABELS,
  GREPTILE_APP_SLUG,
  GREPTILE_CHECK_NAME,
  MACROSCOPE_APP_SLUG,
  MACROSCOPE_CHECK_NAME,
} = require('../constants.js');
async function handleCheckRun({ helpers, context }) {
  const { core } = helpers;
  const checkRun = context.payload.check_run;
  const isGreptile =
    checkRun.app?.slug === GREPTILE_APP_SLUG &&
    checkRun.name === GREPTILE_CHECK_NAME;
  const isMacroscope =
    checkRun.app?.slug === MACROSCOPE_APP_SLUG &&
    checkRun.name === MACROSCOPE_CHECK_NAME;

  if (!isGreptile && !isMacroscope) {
    core.info(`Ignoring unrelated check run: ${checkRun.app?.slug}/${checkRun.name}`);
    return;
  }

  const prNumbers = [...new Set((checkRun.pull_requests || []).map((pr) => pr.number).filter(Boolean))];

  if (!prNumbers.length) {
    core.info('Check run was not linked to a pull request');
    return;
  }

  for (const prNumber of prNumbers) {
    const pr = await helpers.getPullRequest(prNumber);

    if (pr.head.sha !== checkRun.head_sha) {
      core.info(`Skipping PR #${prNumber} because ${checkRun.head_sha} is not the current head`);
      continue;
    }

    const labels = await helpers.listLabels(pr.number);
    let unresolvedThreads = 0;

    if (isGreptile) {
      await helpers.removePresentLabels(pr.number, labels, [
        LABELS.reviewGreptile,
        LABELS.greptileDone,
        LABELS.greptileFailed,
        LABELS.reviewMacroscope,
        LABELS.macroscopeDone,
        LABELS.macroscopeFailed,
      ]);

      if (checkRun.conclusion === 'success') {
        await helpers.addMissingLabels(pr.number, labels, [LABELS.greptileDone]);

        unresolvedThreads = await helpers.getUnresolvedThreadCount(pr.number);

        if (pr.draft) {
          core.info('Draft PR — skipping Macroscope auto-trigger');
        } else if (unresolvedThreads === 0) {
          core.info('All threads resolved — auto-triggering Macroscope');
          await helpers.addMissingLabels(pr.number, labels, [LABELS.reviewMacroscope]);
        } else {
          core.info(`${unresolvedThreads} unresolved thread(s) — waiting for resolution before Macroscope`);
        }
      } else {
        await helpers.addMissingLabels(pr.number, labels, [LABELS.greptileFailed]);
      }
    }

    if (isMacroscope) {
      await helpers.removePresentLabels(pr.number, labels, [
        LABELS.reviewMacroscope,
        LABELS.macroscopeDone,
        LABELS.macroscopeFailed,
      ]);

      if (checkRun.conclusion === 'success') {
        await helpers.addMissingLabels(pr.number, labels, [LABELS.macroscopeDone]);
      } else {
        await helpers.addMissingLabels(pr.number, labels, [LABELS.macroscopeFailed]);
      }
    }

  }
}

module.exports = { handleCheckRun };
