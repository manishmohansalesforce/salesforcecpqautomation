import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../../.env'), quiet: true });

export const AUTH_FILE = path.resolve(__dirname, '../../playwright/.auth/salesforce.json');

export const env = {
  baseUrl: process.env.SF_BASE_URL || 'https://sayu2-dev-ed.develop.lightning.force.com',
  loginHost: process.env.SF_LOGIN_URL || 'https://login.salesforce.com',
  username: process.env.SF_USERNAME || '',
  password: process.env.SF_PASSWORD || '',
  mfaSecret: process.env.SF_MFA_SECRET || '',
  authUrl: process.env.SF_AUTH_URL || '',
};

export function ensureAuthDir(): void {
  fs.mkdirSync(path.dirname(AUTH_FILE), { recursive: true });
}
