# Salesforce CPQ Playwright Framework

End-to-end automation for [Salesforce Lightning](https://sayu2-dev-ed.develop.lightning.force.com) with Playwright.

Tests **do not sign in**. They load a saved browser auth state so MFA is completed once, not on every run.

## Prerequisites

- Node.js 18 or newer (`node -v`)
- npm (`npm -v`)
- Access to the org: [https://sayu2-dev-ed.develop.lightning.force.com](https://sayu2-dev-ed.develop.lightning.force.com)
- Ability to complete the **mobile OTP** Salesforce sends (once). Tests never read the phone.

## Mobile OTP: how auth works

Playwright cannot receive an SMS or Authenticator push. The OTP is completed **once by you**. After that, tests reuse either:

1. A saved browser session (`playwright/.auth/salesforce.json`) — local, expires with the Salesforce session
2. A **refresh token** (`SF_AUTH_URL`) — local and CI, no phone on later runs

```
You + phone (once)  →  refresh token or saved session  →  tests skip login
```

## 1. Setup and initialization

From the project root:

```bash
npm install
npx playwright install chromium
cp .env.example .env
```

`.env` is already pointed at the org. Leave credentials blank for local headed login.

```
SF_BASE_URL=https://sayu2-dev-ed.develop.lightning.force.com
SF_AUTH_URL=
```

Confirm the install:

```bash
npx playwright test --list
```

You should see:

- `[setup]` `reuse or capture Salesforce auth state`
- `[salesforce-cpq]` `shows Salesforce CPQ in the 9-dot App Launcher`

## 2. Capture auth (mobile OTP once)

### Local tests

```bash
npm run auth:save
```

A headed Chromium window opens. Sign in, enter the OTP from your phone, and wait until Lightning home (9-dot App Launcher) is visible. Setup writes `playwright/.auth/salesforce.json` (gitignored). Later `npm test` reuses that file and does not prompt the phone.

Re-run `auth:save` when the Salesforce session expires.

### CI and unattended refresh (no phone)

Username/password in GitHub Actions cannot complete a mobile OTP. Capture a **refresh token** once, then later runs mint a browser session through `frontdoor.jsp`.

```bash
npm install -g @salesforce/cli
sf org login web --alias cpq-de
```

Complete username, password, and the OTP on your phone in that browser. Then:

```bash
npm run auth:url
```

Paste the printed `force://...` value into `.env` as `SF_AUTH_URL`. Put the same value in GitHub Actions secret `SF_AUTH_URL`.

When `SF_AUTH_URL` is set, setup:

1. Exchanges the refresh token for an access token (no OTP)
2. Opens `/secur/frontdoor.jsp?sid=...`
3. Saves Playwright storage state
4. Tests start already logged in

If both a saved `salesforce.json` and `SF_AUTH_URL` exist, a still-valid browser session is reused first.

## 3. Execute tests

After auth state exists:

```bash
npm test
```

That runs the setup project first (reuses `playwright/.auth/salesforce.json` if still valid), then the App Launcher spec. Specs never fill username, password, or an MFA code.

Other commands:

```bash
npm run test:headed    # visible browser
npm run test:ui        # Playwright UI mode
npm run test:debug     # step through tests
npm run report         # open the last HTML report
```

Run one spec:

```bash
npx playwright test tests/app-launcher.spec.ts
```

The setup project still runs first because tests depend on it.

## First automated case

`tests/app-launcher.spec.ts`:

1. Opens Lightning home using saved auth state.
2. Clicks the 9-dot **App Launcher**.
3. Searches for **Salesforce CPQ**.
4. Asserts the app is listed.

## Why auth state

Salesforce requires MFA. Logging in through the UI in every test is slow and fails on the identity challenge. The setup project:

1. Reuses `playwright/.auth/salesforce.json` when the session is still valid.
2. Only opens the login page when that file is missing or the session has expired.
3. Injects cookies and storage into every test browser context afterward.

If a test lands on the Salesforce login page, it fails fast with instructions to run `npm run auth:save`.

## CI (GitHub Actions)

Workflow: `.github/workflows/ci.yml`. On every push and pull request it installs dependencies and **compiles** TypeScript (`npm run compile`). That job does not need Salesforce secrets.

Playwright e2e runs in a second job only when `SF_AUTH_URL` is set. If the secret is missing, e2e is skipped and compile still passes.

GitHub-hosted runners cannot receive a mobile OTP. Do not use `SF_USERNAME` / `SF_PASSWORD` in CI for this org.

1. On your laptop: `sf org login web --alias cpq-de` and complete the OTP on your phone.
2. `npm run auth:url` and store the value as GitHub secret `SF_AUTH_URL`.
3. Each CI job: setup refreshes that token → frontdoor → `salesforce.json` on the runner → tests reuse it.
4. The runner is destroyed. The auth file is not committed, cached, or uploaded.

```
Laptop + phone (once):  sf org login web  →  SF_AUTH_URL secret
Every CI job:           refresh token  →  frontdoor.jsp  →  npm test
```

Repo **Settings → Secrets and variables → Actions**:

| Secret | Required | Purpose |
|---|---|---|
| `SF_AUTH_URL` | Required for e2e | `sfdxAuthUrl` from `npm run auth:url` |
| `SF_BASE_URL` | Optional | Defaults to the DE Lightning URL |
| `DASHBOARD_URL` | Required for dashboard ingest | Render API origin, e.g. `https://salesforce-cpq-dashboard-api.onrender.com` |
| `DASHBOARD_INGEST_TOKEN` | Required for dashboard ingest | Same value as `GITHUB_ACTIONS_INGEST_TOKEN` on Render |

After Playwright finishes (pass or fail), CI wakes the API and POSTs `test-results/results.json` plus a zip of `playwright-report/` to `/api/ingest/github-actions/run-with-report`. If the dashboard secrets are missing, ingest is skipped and the job still succeeds.

Live GitHub Actions step status and failed-test triage are read by the dashboard API (`GITHUB_CI_TOKEN` on Render), not by this workflow. Use **Run pipeline** on the dashboard (this workflow already has `workflow_dispatch`) and open **CI Failure Triage** after a failed run.

Compile and e2e stay in one workflow. E2e login and tests stay in one job.

If GitHub runner IPs are blocked, clear profile **Login IP Ranges** or use a self-hosted runner. Use a dedicated automation user when you can.

## Layout

```
playwright.config.ts          # setup project + storageState for tests
tests/auth.setup.ts           # validate or capture auth state
tests/app-launcher.spec.ts    # CPQ visibility in App Launcher
src/pages/                    # page objects (Home, App Launcher)
src/fixtures/test.ts          # Playwright fixtures
src/utils/auth.ts             # headed login + mobile OTP wait
src/utils/oauth.ts            # refresh token from SF_AUTH_URL
src/utils/frontdoor.ts        # browser session from access token
src/utils/lightning.ts        # Lightning-ready waits (no networkidle)
playwright/.auth/             # saved session (local only)
```

## Adding tests

Import fixtures from `src/fixtures/test.ts`. Do not add login steps. Start from `homePage.goto()` or another Lightning URL. Keep `workers` at 1 unless you use separate Salesforce users; one session shared across parallel workers can hit CSRF and concurrent-session limits.
