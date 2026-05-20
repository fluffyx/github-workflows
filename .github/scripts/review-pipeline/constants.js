const LABELS = {
  charlieDone: 'state:charlie-done',
  greptileDone: 'state:greptile-done',
  macroscopeDone: 'state:macroscope-done',
  greptileFailed: 'state:greptile-failed',
  macroscopeFailed: 'state:macroscope-failed',
  reviewGreptile: 'review:greptile',
  reviewMacroscope: 'review:macroscope',
};

const ALL_LABELS = Object.values(LABELS);

const LABEL_CONFIG = {
  [LABELS.charlieDone]: {
    color: '1d76db',
    description: 'Charlie approved the latest push',
  },
  [LABELS.greptileDone]: {
    color: '0e8a16',
    description: 'Greptile finished reviewing the latest push',
  },
  [LABELS.macroscopeDone]: {
    color: '5319e7',
    description: 'Macroscope finished reviewing the latest push',
  },
  [LABELS.greptileFailed]: {
    color: 'e11d48',
    description: 'Greptile review failed on the latest push',
  },
  [LABELS.macroscopeFailed]: {
    color: 'e11d48',
    description: 'Macroscope review failed on the latest push',
  },
  [LABELS.reviewGreptile]: {
    color: 'fbca04',
    description: 'Request a Greptile review for this PR',
  },
  [LABELS.reviewMacroscope]: {
    color: 'fbca04',
    description: 'Request a Macroscope review for this PR',
  },
};

const CHARLIE_LOGINS = new Set(['charliecreates', 'charliecreates[bot]']);
const CHARLIE_REVIEWER = 'CharlieHelps';
const CHARLIE_CHECK_NAME = 'charliecreates';
const GREPTILE_APP_SLUG = 'greptile-apps';
const GREPTILE_CHECK_NAME = 'Greptile Review';
const MACROSCOPE_APP_SLUG = 'macroscopeapp';
const MACROSCOPE_CHECK_NAME = 'Macroscope - Approvability Check';
const GREPTILE_TRIGGER_MARKER = '<!-- review-pipeline-greptile-trigger -->';
const ALLOWED_PERMISSIONS = new Set(['admin', 'maintain', 'write']);

module.exports = {
  LABELS,
  ALL_LABELS,
  LABEL_CONFIG,
  CHARLIE_LOGINS,
  CHARLIE_REVIEWER,
  CHARLIE_CHECK_NAME,
  GREPTILE_APP_SLUG,
  GREPTILE_CHECK_NAME,
  MACROSCOPE_APP_SLUG,
  MACROSCOPE_CHECK_NAME,
  GREPTILE_TRIGGER_MARKER,
  ALLOWED_PERMISSIONS,
};
