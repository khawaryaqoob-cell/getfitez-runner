# getfitez-runner

**This repository contains no application code and no business logic.** It is a
public GitHub Actions runner for the **private** repository
[`khawaryaqoob-cell/be-fit-pro`](https://github.com/khawaryaqoob-cell/be-fit-pro).

## Why this exists

Every checkout mint, settlement, email dispatch, push notification and nightly
sweep in GetFitEz is a scheduled job, because the platform is on Firebase
**Spark** and cannot host Cloud Functions. Those jobs therefore depend on
GitHub-hosted runners.

On a private repository those runners sit in a lower-priority queue and draw on
a finite minutes allowance. In practice the jobs were observed sitting
`queued` for 8–10 minutes, and two were cancelled having executed **zero
steps** — the customer waiting to pay was simply left on a spinner.

**Public repositories get unlimited free runner minutes and materially better
queue priority.** Moving the *scheduled* jobs here fixes that without moving an
application line out of the private repository.

## How it works

Each workflow checks out the **private** repo and runs the real scripts from
there:

```yaml
- uses: actions/checkout@v4
  with:
    repository: khawaryaqoob-cell/be-fit-pro
    ref: main
    token: ${{ secrets.PRIVATE_REPO_TOKEN }}
```

The workflow files here are **generated**. The source of truth is the private
repo's `.github/workflows/*.yml`. Never hand-edit the files here — change the
private copy and re-run the generator.

## What is NOT here, and why

`regression.yml` **stays in the private repo.** It is `push:`-triggered, and a
public repository never receives the private repository's push events. Moving
it would silently stop the gate from running on every push and would stop
deploy-on-green. Push-triggered work must stay where the pushes happen.

## Required repository secrets

Set these under **Settings → Secrets and variables → Actions**:

| Secret | Purpose |
|---|---|
| `PRIVATE_REPO_TOKEN` | Fine-grained PAT, **`contents: read` on `be-fit-pro` only** |
| `FIREBASE_SA_KEY` | Master instance service account JSON |
| `GETFITEZ1_SA_KEY` | getfitez1 instance service account JSON |
| `SAFEPAY_SECRET_KEY` | SafePay secret key (sandbox) |
| `SAFEPAY_MERCHANT_API_KEY` | SafePay merchant API key |
| `EMAIL_CRED_PRIVATE_KEY` | Per-staff Gmail credential encryption key |
| Cloudinary ×3 | Image/media pipeline |

GitHub **never displays an existing secret's value**, so these cannot be copied
programmatically from the private repo — each must be re-entered from its
original source.

## Note on the relay

The Apps Script relay dispatches `workflow_dispatch` at a **hardcoded**
repository. Until it is repointed here, relay "Send now" pings still land on
the private repo. The cron path benefits immediately; the instant fast path only
does once the relay is updated.
