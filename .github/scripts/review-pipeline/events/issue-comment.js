const { LABELS, ALLOWED_PERMISSIONS } = require('../constants.js');
const { greptileTriggerBody } = require('../triggers.js');

const COMMANDS = {
  '/run greptile': {
    displayName: 'Greptile',
    requestedLabel: LABELS.reviewGreptile,
    requiredLabel: LABELS.charlieDone,
    doneLabel: LABELS.greptileDone,
    failedLabel: LABELS.greptileFailed,
    blocker: 'Charlie has not approved the latest push yet.',
  },
  '/review greptile': {
    displayName: 'Greptile',
    requestedLabel: LABELS.reviewGreptile,
    requiredLabel: LABELS.charlieDone,
    doneLabel: LABELS.greptileDone,
    failedLabel: LABELS.greptileFailed,
    blocker: 'Charlie has not approved the latest push yet.',
  },
  '/run macroscope': {
    displayName: 'Macroscope',
    requestedLabel: LABELS.reviewMacroscope,
    requiredLabel: LABELS.greptileDone,
    doneLabel: LABELS.macroscopeDone,
    failedLabel: LABELS.macroscopeFailed,
    blocker: 'Greptile has not finished reviewing the latest push yet.',
  },
  '/review macroscope': {
    displayName: 'Macroscope',
    requestedLabel: LABELS.reviewMacroscope,
    requiredLabel: LABELS.greptileDone,
    doneLabel: LABELS.macroscopeDone,
    failedLabel: LABELS.macroscopeFailed,
    blocker: 'Greptile has not finished reviewing the latest push yet.',
  },
};

function firstNonEmptyLine(text) {
  return (text || '')
    .split(/\r?\n/)
    .map((line) => line.trim().toLowerCase())
    .find(Boolean) || '';
}

async function handleIssueComment({ helpers, context }) {
  const { core } = helpers;

  if (!context.payload.issue?.pull_request) {
    core.info('Comment is not on a pull request');
    return;
  }

  if (context.payload.comment?.user?.type === 'Bot') {
    core.info('Ignoring bot-authored comment');
    return;
  }

  const command = COMMANDS[firstNonEmptyLine(context.payload.comment.body)];

  if (!command) {
    core.info('Comment does not contain a staged review command');
    return;
  }

  const commenter = context.payload.comment.user?.login;

  if (!commenter) {
    core.info('Missing commenter login; skipping command processing');
    return;
  }

  const issueNumber = context.payload.issue.number;
  const pr = await helpers.getPullRequest(issueNumber);

  async function reply(body) {
    await helpers.createComment(issueNumber, body);
  }

  if (pr.draft) {
    await reply(`@${commenter} this PR is still a draft. Mark it ready for review before running ${command.displayName}.`);
    return;
  }

  const permissionLevel = await helpers.getCollaboratorPermission(commenter);

  if (!ALLOWED_PERMISSIONS.has(permissionLevel)) {
    await reply(`@${commenter} only collaborators with write access or higher can run staged review commands on this PR.`);
    return;
  }

  const labels = await helpers.listLabels(issueNumber);

  if (labels.has(command.doneLabel)) {
    await reply(`@${commenter} ${command.displayName} already finished reviewing the latest push.`);
    return;
  }

  if (!labels.has(command.requiredLabel)) {
    await reply(`@${commenter} ${command.blocker}`);
    return;
  }

  if (labels.has(command.requestedLabel)) {
    await reply(`@${commenter} ${command.displayName} has already been requested for the latest push.`);
    return;
  }

  const unresolvedThreads = await helpers.getUnresolvedThreadCount(issueNumber);

  if (unresolvedThreads > 0) {
    await reply(`@${commenter} ${unresolvedThreads} review thread${unresolvedThreads === 1 ? ' is' : 's are'} still unresolved. Resolve them before running ${command.displayName}.`);
    return;
  }

  if (labels.has(command.failedLabel)) {
    await helpers.removePresentLabels(issueNumber, labels, [command.failedLabel]);
  }

  await helpers.addMissingLabels(issueNumber, labels, [command.requestedLabel]);

  if (command.requestedLabel === LABELS.reviewGreptile) {
    await reply(greptileTriggerBody(pr.head.sha));
  }

  await reply(`@${commenter} queued ${command.displayName} for the latest push.`);
}

module.exports = { handleIssueComment };
