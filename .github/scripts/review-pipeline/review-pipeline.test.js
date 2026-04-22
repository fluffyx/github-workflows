const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const { LABELS } = require('./constants.js');
const { handlePullRequest } = require('./events/pull-request.js');
const {
  classifyReview,
  handlePullRequestReview,
} = require('./events/pull-request-review.js');
const { createHelpers } = require('./github-helpers.js');
const { run } = require('./index.js');

function createCore() {
  const messages = [];
  return {
    messages,
    info(message) {
      messages.push(message);
    },
  };
}

test('createPendingCheck creates an in-progress charliecreates check run', async () => {
  const created = [];
  const helpers = createHelpers({
    github: {
      rest: {
        checks: {
          create: async (params) => created.push(params),
        },
      },
    },
    context: { repo: { owner: 'fluffyx', repo: 'demo' } },
    core: createCore(),
  });

  await helpers.createPendingCheck('abc123');

  assert.deepEqual(created, [
    {
      owner: 'fluffyx',
      repo: 'demo',
      name: 'charliecreates',
      head_sha: 'abc123',
      status: 'in_progress',
      output: {
        title: 'charliecreates',
        summary: 'Waiting for Charlie to review this PR.',
      },
    },
  ]);
});

test('completeCheck updates the existing charliecreates check run for the head SHA', async () => {
  const updated = [];
  const helpers = createHelpers({
    github: {
      rest: {
        checks: {
          listForRef: async () => {},
          update: async (params) => updated.push(params),
        },
      },
      paginate: async (fn, params) => {
        assert.equal(params.ref, 'abc123');
        assert.equal(params.check_name, 'charliecreates');
        return [{ id: 42, name: 'charliecreates', head_sha: 'abc123' }];
      },
    },
    context: { repo: { owner: 'fluffyx', repo: 'demo' } },
    core: createCore(),
  });

  await helpers.completeCheck('abc123', 'failure', 'Non-blocking feedback found.');

  assert.equal(updated.length, 1);
  assert.equal(updated[0].owner, 'fluffyx');
  assert.equal(updated[0].repo, 'demo');
  assert.equal(updated[0].check_run_id, 42);
  assert.equal(updated[0].status, 'completed');
  assert.equal(updated[0].conclusion, 'failure');
  assert.equal(updated[0].output.title, 'charliecreates');
  assert.equal(updated[0].output.summary, 'Non-blocking feedback found.');
  assert.match(updated[0].completed_at, /^\d{4}-\d{2}-\d{2}T/);
});

test('handlePullRequest requests Charlie and creates a pending check for the latest head', async () => {
  const calls = [];
  const helpers = {
    listLabels: async (number) => {
      calls.push(['listLabels', number]);
      return new Set(['state:charlie-done']);
    },
    removePresentLabels: async (number, labels, names) => {
      calls.push(['removePresentLabels', number, names]);
    },
    requestCharlieReview: async (number) => {
      calls.push(['requestCharlieReview', number]);
    },
    createPendingCheck: async (headSha) => {
      calls.push(['createPendingCheck', headSha]);
    },
  };

  await handlePullRequest({
    helpers,
    context: {
      payload: {
        pull_request: { number: 7, head: { sha: 'abc123' } },
      },
    },
  });

  assert.deepEqual(
    calls.map((call) => call[0]),
    ['listLabels', 'removePresentLabels', 'requestCharlieReview', 'createPendingCheck'],
  );
  assert.deepEqual(calls.at(-1), ['createPendingCheck', 'abc123']);
});

test('classifyReview treats blocking and non-blocking Charlie feedback as failures', () => {
  assert.deepEqual(classifyReview('### Blocking feedback\n1. Fix this'), {
    conclusion: 'failure',
    label: 'blocking',
  });
  assert.deepEqual(classifyReview('<summary>Non-blocking feedback (1)</summary>'), {
    conclusion: 'failure',
    label: 'non-blocking',
  });
  assert.deepEqual(classifyReview('I only have non-blocking suggestions.'), {
    conclusion: 'failure',
    label: 'non-blocking',
  });
});

test('classifyReview treats clean Charlie review bodies as success', () => {
  for (const body of [
    '',
    'Reviewed the latest changes, and I do not have actionable feedback to address.',
    'No issues found in the changes shown.',
    'Reviewed - this plan change looks correct.',
    'Dependency bump looks safe: patch-only release.',
  ]) {
    assert.deepEqual(classifyReview(body), { conclusion: 'success', label: 'clean' });
  }
});

test('classifyReview fails safe on unknown review formats', () => {
  assert.deepEqual(classifyReview('I reviewed this.'), {
    conclusion: 'failure',
    label: 'unclassified',
  });
});

test('handlePullRequestReview completes a current-head non-blocking review as failure without marking Charlie done', async () => {
  const completed = [];
  const labelsAdded = [];
  const helpers = {
    core: createCore(),
    completeCheck: async (...args) => completed.push(args),
    listLabels: async () => new Set(),
    addMissingLabels: async (number, labels, names) => labelsAdded.push(names),
    getUnresolvedThreadCount: async () => 0,
  };

  await handlePullRequestReview({
    helpers,
    context: {
      payload: {
        pull_request: { number: 7, draft: false, head: { sha: 'abc123' } },
        review: {
          user: { login: 'charliecreates[bot]' },
          state: 'commented',
          commit_id: 'abc123',
          body: '<summary>Non-blocking feedback (1)</summary>\n\n1. Consider renaming this.',
        },
      },
    },
  });

  assert.equal(completed.length, 1);
  assert.equal(completed[0][0], 'abc123');
  assert.equal(completed[0][1], 'failure');
  assert.match(completed[0][2], /Non-blocking feedback/);
  assert.deepEqual(labelsAdded, []);
});

test('handlePullRequestReview completes a clean commented review as success and marks Charlie done', async () => {
  const completed = [];
  const labelsAdded = [];
  const helpers = {
    owner: 'fluffyx',
    repo: 'demo',
    github: {
      rest: { issues: { listComments: async () => {} } },
      paginate: async () => [],
    },
    core: createCore(),
    completeCheck: async (...args) => completed.push(args),
    listLabels: async () => new Set(),
    addMissingLabels: async (number, labels, names) => labelsAdded.push(names),
    getUnresolvedThreadCount: async () => 1,
    createComment: async () => {},
  };

  await handlePullRequestReview({
    helpers,
    context: {
      payload: {
        pull_request: { number: 7, draft: false, head: { sha: 'abc123' } },
        review: {
          user: { login: 'charliecreates' },
          state: 'commented',
          commit_id: 'abc123',
          body: 'Reviewed the latest changes, and I do not have actionable feedback to address.',
        },
      },
    },
  });

  assert.equal(completed.length, 1);
  assert.equal(completed[0][0], 'abc123');
  assert.equal(completed[0][1], 'success');
  assert.deepEqual(labelsAdded, [[LABELS.charlieDone]]);
});

test('handlePullRequestReview ignores Charlie reviews for an old commit', async () => {
  const completed = [];
  const helpers = {
    core: createCore(),
    completeCheck: async (...args) => completed.push(args),
  };

  await handlePullRequestReview({
    helpers,
    context: {
      payload: {
        pull_request: { number: 7, head: { sha: 'current' } },
        review: {
          user: { login: 'charliecreates' },
          state: 'commented',
          commit_id: 'old',
          body: '### Blocking feedback\n1. Fix this',
        },
      },
    },
  });

  assert.deepEqual(completed, []);
});

test('run dispatches pull_request_review events', async () => {
  const core = createCore();
  await run({
    github: {
      rest: {
        issues: {
          getLabel: async () => ({ data: {} }),
        },
      },
    },
    context: {
      repo: { owner: 'fluffyx', repo: 'demo' },
      eventName: 'pull_request_review',
      payload: {
        pull_request: { number: 7, head: { sha: 'abc123' } },
        review: {
          user: { login: 'octocat' },
          state: 'commented',
          commit_id: 'abc123',
          body: 'Looks good.',
        },
      },
    },
    core,
  });

  assert(core.messages.some((message) => message.includes('Ignoring review from octocat')));
  assert(!core.messages.some((message) => message.includes('No handler registered')));
});

test('workflow and docs include Charlie check-run review events', () => {
  const root = path.resolve(__dirname, '../../..');
  const workflow = fs.readFileSync(path.join(root, '.github/workflows/charlie-review.yml'), 'utf8');
  const readme = fs.readFileSync(path.join(root, 'README.md'), 'utf8');
  const docs = fs.readFileSync(path.join(root, 'docs/charlie-review-format.md'), 'utf8');

  assert.match(workflow, /checks:\s*write/);
  assert.match(readme, /pull_request_review:\n\s+types: \[submitted\]/);
  assert.match(docs, /Non-blocking feedback.*failure/s);
});
