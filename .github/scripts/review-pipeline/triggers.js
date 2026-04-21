const { GREPTILE_TRIGGER_MARKER } = require('./constants.js');

function greptileTriggerBody(headSha) {
  const marker = `${GREPTILE_TRIGGER_MARKER} sha:${headSha}`;
  return `${marker}\n@greptileai`;
}

async function triggerGreptile(helpers, prNumber, headSha) {
  const { github, owner, repo, core } = helpers;
  const marker = `${GREPTILE_TRIGGER_MARKER} sha:${headSha}`;

  const comments = await github.paginate(github.rest.issues.listComments, {
    owner,
    repo,
    issue_number: prNumber,
    per_page: 100,
  });

  const alreadyRequested = comments.some((c) => c.body?.includes(marker));

  if (alreadyRequested) {
    core.info(`Greptile already triggered for ${headSha.slice(0, 7)}`);
    return;
  }

  await helpers.createComment(prNumber, greptileTriggerBody(headSha));
  core.info(`Triggered Greptile review for ${headSha.slice(0, 7)}`);
}

module.exports = { triggerGreptile, greptileTriggerBody };
