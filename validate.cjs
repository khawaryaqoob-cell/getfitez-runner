/**
 * Structural validation of the generated runner workflows (no yaml lib here).
 * Deliberately blunt: assert the things that would silently break a run.
 */
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '.github', 'workflows');
let bad = 0;
const fail = (f, msg) => { console.log(`  FAIL ${f}: ${msg}`); bad++; };
const pass = (f, msg) => console.log(`  ok   ${f}: ${msg}`);

for (const f of fs.readdirSync(dir)) {
  const t = fs.readFileSync(path.join(dir, f), 'utf8');
  const lines = t.split('\n');

  if (!/^on:/m.test(t)) fail(f, 'no top-level `on:`');
  else if (!/^\s+schedule:/m.test(t)) fail(f, 'no schedule trigger — this repo exists to run crons');
  else pass(f, 'has `on:` + schedule');

  if (!/^jobs:/m.test(t)) fail(f, 'no `jobs:`');
  else pass(f, 'has `jobs:`');

  if (!/^\s+workflow_dispatch:/m.test(t)) fail(f, 'no workflow_dispatch (manual fallback lost)');

  // checkout must target the private repo WITH a token
  const co = /- uses: actions\/checkout@v4\s*\n\s+with:\s*\n\s+repository: khawaryaqoob-cell\/be-fit-pro\s*\n\s+ref: main\s*\n\s+token: \$\{\{ secrets\.PRIVATE_REPO_TOKEN \}\}/.test(t);
  if (!co) fail(f, 'checkout is NOT repointed at the private repo with PRIVATE_REPO_TOKEN');
  else pass(f, 'checkout → private repo + token');

  // the guard MUST be gone, or every job is skipped
  if (/github\.repository ==/.test(t)) fail(f, 'repo guard still present — every job would be SKIPPED');
  else pass(f, 'no stale repo guard');

  // no leftover orphan keys from the removed guard line
  if (/^\s*:\s*$/m.test(t)) fail(f, 'empty mapping key (orphan from guard removal)');

  // tabs would be invalid YAML
  if (/\t/.test(t)) fail(f, 'contains a TAB character');

  // jobs must have steps. Scan ONLY below `jobs:` — otherwise the 2-space keys
  // under `on:` (`schedule:`, `workflow_dispatch:`) masquerade as job names.
  const jobsSection = t.split(/^jobs:$/m)[1] || '';
  const jobNames = [...jobsSection.matchAll(/^  ([a-z][a-z0-9_-]*):$/gm)].map(m => m[1]);
  if (!jobNames.length) fail(f, 'no jobs parsed');
  for (const j of jobNames) {
    const seg = t.split(new RegExp(`^  ${j}:$`, 'm'))[1] || '';
    if (!/\n\s+steps:/.test(seg.split(new RegExp(`^  [a-z][a-z0-9_-]*:$`, 'm'))[0])) {
      fail(f, `job "${j}" has no steps:`);
    }
  }
  if (jobNames.length) pass(f, `jobs with steps: ${jobNames.join(', ')}`);
}

console.log(bad ? `\n${bad} PROBLEM(S)` : '\nall runner workflows structurally sound');
process.exit(bad ? 1 : 0);
