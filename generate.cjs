/**
 * Generate the public runner repo's workflows from the private repo's cron jobs.
 *
 * Two transformations, both load-bearing:
 *
 *  1. `actions/checkout` is repointed at the PRIVATE repo via PRIVATE_REPO_TOKEN.
 *     This repo holds workflow YAML only — no business logic, no secrets in code.
 *
 *  2. `if: github.repository == '...be-fit-pro'` is REMOVED. Every job in the
 *     private repo carries that guard so a fork cannot spend the master repo's
 *     Actions minutes. Copied verbatim into a different repo the condition is
 *     simply FALSE, so every job would be skipped and the repo would look
 *     healthy while running nothing at all. Silent, and invisible in logs.
 *
 * regression.yml is deliberately NOT copied: it is push-triggered, and a public
 * repo never receives the private repo's push events — moving it would silently
 * stop deploy-on-green. Push-triggered work stays private; cron moves.
 */
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', '.github', 'workflows');
const OUT = path.join(__dirname, '.github', 'workflows');
fs.mkdirSync(OUT, { recursive: true });

const JOBS = [
  'finance-nightly',
  'media-sweep',
  'nudge-planner',
  'process-email-queue',
  'process-push-queue',
  'process-safepay-queue',
  'push-reminders',
  'shop-nightly',
];

const HEADER = (name) => `# GENERATED — source of truth is the PRIVATE repo:
#   khawaryaqoob-cell/be-fit-pro @ .github/workflows/${name}.yml
#
# This public repo exists ONLY to run the scheduled jobs on a free, high-priority
# runner pool. It contains workflow YAML and nothing else: no application code,
# no business logic, no secrets in source. Each job checks out the PRIVATE repo
# with PRIVATE_REPO_TOKEN and runs the real scripts from there.
#
# To change a schedule or a step, edit the PRIVATE repo's copy and re-run
#   node scripts/generateRunnerRepo.cjs
# (copy that script into the private repo) — never hand-edit the file here.
#
# Required repo secrets (Settings → Secrets and variables → Actions):
#   PRIVATE_REPO_TOKEN    fine-grained PAT, contents:read on be-fit-pro ONLY
#   FIREBASE_SA_KEY       master instance service account
#   GETFITEZ1_SA_KEY      getfitez1 instance service account
#   SAFEPAY_SECRET_KEY    SafePay secret key (sandbox)
#   SAFEPAY_MERCHANT_API_KEY
#   EMAIL_CRED_PRIVATE_KEY + 3 × Cloudinary keys (email + media workflows)
#
# The Apps Script relay dispatches workflow_dispatch at a hardcoded repo. Until
# it is repointed here, relay pings still land on the PRIVATE repo — so the
# cron path benefits from the public runner while the "Send now" fast path does
# not. See README.md.
`;

let guards = 0, checkouts = 0;
for (const job of JOBS) {
  const src = fs.readFileSync(path.join(SRC, `${job}.yml`), 'utf8');

  const out = src
    // 1. repoint checkout at the private repo
    .replace(
      /^(\s*)- uses: actions\/checkout@v4\s*$/m,
      (m, indent) => `${indent}- uses: actions/checkout@v4
${indent}  with:
${indent}    repository: khawaryaqoob-cell/be-fit-pro
${indent}    ref: main
${indent}    token: \${{ secrets.PRIVATE_REPO_TOKEN }}`
    )
    // 2. drop the repo guard — false in this repo, would skip every job
    .replace(/^\s*if: github\.repository == 'khawaryaqoob-cell\/be-fit-pro'\s*$/gm, () => { guards++; return ''; });

  const before = (src.match(/- uses: actions\/checkout@v4/g) || []).length;
  checkouts += before;

  fs.writeFileSync(path.join(OUT, `${job}.yml`), HEADER(job) + out, 'utf8');
  console.log(`wrote ${job}.yml  (checkout blocks: ${before})`);
}

console.log(`\n${JOBS.length} workflow(s), ${checkouts} checkout repointed, ${guards} repo guard(s) removed`);
