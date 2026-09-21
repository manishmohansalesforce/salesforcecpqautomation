#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const extraBin = path.join(process.env.HOME || '', '.npm-global', 'bin');
const env = {
  ...process.env,
  PATH: `${extraBin}:${process.env.PATH || ''}`,
};

const orgAlias = process.env.SF_ORG_ALIAS || 'cpq-de';
const result = spawnSync(
  'sf',
  ['org', 'auth', 'show-sfdx-auth-url', '--target-org', orgAlias, '--json', '--no-prompt'],
  {
    encoding: 'utf8',
    env,
  },
);

if (result.error || result.status !== 0) {
  process.stderr.write(result.stderr || result.stdout || String(result.error));
  process.stderr.write(
    '\nCould not read the Salesforce refresh token.\n' +
      '  sf org login web --alias cpq-de\n' +
      '  npm run auth:url\n',
  );
  process.exit(1);
}

const parsed = JSON.parse(extractJson(result.stdout || result.stderr || ''));
const authUrl =
  (parsed.result && (parsed.result.sfdxAuthUrl || parsed.result.url || parsed.result.authUrl)) ||
  parsed.sfdxAuthUrl;

if (!authUrl || !String(authUrl).startsWith('force://')) {
  process.stderr.write(
    'No sfdxAuthUrl returned. Sign in again so a refresh token is stored:\n' +
      '  sf org login web --alias cpq-de\n',
  );
  process.exit(1);
}

const envPath = path.resolve(process.cwd(), '.env');
upsertEnvValue(envPath, 'SF_AUTH_URL', authUrl);

process.stdout.write(`${authUrl}\n`);
process.stderr.write(
  `\nWrote SF_AUTH_URL to ${envPath}. Also add that value as a GitHub Actions secret. Do not commit .env.\n`,
);

function extractJson(text) {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    throw new Error(`sf did not return JSON:\n${text}`);
  }
  return text.slice(start, end + 1);
}

function upsertEnvValue(filePath, key, value) {
  const line = `${key}=${value}`;
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, `${line}\n`);
    return;
  }

  const current = fs.readFileSync(filePath, 'utf8');
  if (new RegExp(`^${key}=`, 'm').test(current)) {
    fs.writeFileSync(filePath, current.replace(new RegExp(`^${key}=.*$`, 'm'), line));
    return;
  }

  const suffix = current.endsWith('\n') || current.length === 0 ? '' : '\n';
  fs.writeFileSync(filePath, `${current}${suffix}${line}\n`);
}
