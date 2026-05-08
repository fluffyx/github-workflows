const { LABEL_CONFIG, CHARLIE_REVIEWER } = require('./constants.js');

function createHelpers({ github, context, core }) {
  const { owner, repo } = context.repo;

  async function ensureRepoLabels() {
    for (const [name, config] of Object.entries(LABEL_CONFIG)) {
      try {
        await github.rest.issues.getLabel({ owner, repo, name });
      } catch (error) {
        if (error.status !== 404) {
          throw error;
        }

        await github.rest.issues.createLabel({
          owner,
          repo,
          name,
          color: config.color,
          description: config.description,
        });
      }
    }
  }

  async function listLabels(issueNumber) {
    const labels = await github.paginate(github.rest.issues.listLabelsOnIssue, {
      owner,
      repo,
      issue_number: issueNumber,
      per_page: 100,
    });

    return new Set(labels.map((label) => label.name));
  }

  async function addMissingLabels(issueNumber, labels, names) {
    const missing = names.filter((name) => !labels.has(name));

    if (!missing.length) {
      return;
    }

    await github.rest.issues.addLabels({
      owner,
      repo,
      issue_number: issueNumber,
      labels: missing,
    });

    missing.forEach((name) => labels.add(name));
  }

  async function removePresentLabels(issueNumber, labels, names) {
    for (const name of names) {
      if (!labels.has(name)) {
        continue;
      }

      try {
        await github.rest.issues.removeLabel({
          owner,
          repo,
          issue_number: issueNumber,
          name,
        });
      } catch (error) {
        if (error.status !== 404) {
          throw error;
        }
      }

      labels.delete(name);
    }
  }

  async function getUnresolvedThreadCount(prNumber) {
    let cursor = null;
    let unresolved = 0;

    for (;;) {
      const { repository } = await github.graphql(
        `
        query($owner: String!, $repo: String!, $number: Int!, $cursor: String) {
          repository(owner: $owner, name: $repo) {
            pullRequest(number: $number) {
              reviewThreads(first: 100, after: $cursor) {
                nodes { isResolved }
                pageInfo { hasNextPage endCursor }
              }
            }
          }
        }
      `,
        { owner, repo, number: prNumber, cursor },
      );

      const threads = repository.pullRequest.reviewThreads;
      unresolved += threads.nodes.filter((t) => !t.isResolved).length;

      if (!threads.pageInfo.hasNextPage) {
        return unresolved;
      }

      cursor = threads.pageInfo.endCursor;
    }
  }

  async function createComment(issueNumber, body) {
    await github.rest.issues.createComment({
      owner,
      repo,
      issue_number: issueNumber,
      body,
    });
  }

  async function getPullRequest(prNumber) {
    const { data } = await github.rest.pulls.get({
      owner,
      repo,
      pull_number: prNumber,
    });
    return data;
  }

  async function getCollaboratorPermission(username) {
    try {
      const { data } = await github.rest.repos.getCollaboratorPermissionLevel({
        owner,
        repo,
        username,
      });
      return data.permission;
    } catch (error) {
      if (error.status !== 404) {
        throw error;
      }
      return 'none';
    }
  }

  async function removeCharlieReview(prNumber) {
    try {
      await github.rest.pulls.removeRequestedReviewers({
        owner,
        repo,
        pull_number: prNumber,
        reviewers: [CHARLIE_REVIEWER],
      });
    } catch (error) {
      if (error.status !== 422) {
        throw error;
      }
    }

    core.info(`Removed review request from ${CHARLIE_REVIEWER} on PR #${prNumber}`);
  }

  async function requestCharlieReview(prNumber) {
    await removeCharlieReview(prNumber);

    await github.rest.pulls.requestReviewers({
      owner,
      repo,
      pull_number: prNumber,
      reviewers: [CHARLIE_REVIEWER],
    });

    core.info(`Requested review from ${CHARLIE_REVIEWER} on PR #${prNumber}`);
  }

  return {
    owner,
    repo,
    github,
    core,
    ensureRepoLabels,
    listLabels,
    addMissingLabels,
    removePresentLabels,
    getUnresolvedThreadCount,
    createComment,
    getPullRequest,
    getCollaboratorPermission,
    removeCharlieReview,
    requestCharlieReview,
  };
}

module.exports = { createHelpers };
