import { env } from '../config/env';

export type SalesforceSession = {
  accessToken: string;
  instanceUrl: string;
};

type ParsedAuthUrl = {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  host: string;
};

export function hasRefreshTokenAuth(): boolean {
  return Boolean(env.authUrl);
}

export async function refreshSalesforceSession(authUrl = env.authUrl): Promise<SalesforceSession> {
  if (!authUrl) {
    throw new Error('SF_AUTH_URL is empty. Run `npm run auth:url` after `sf org login web` (complete the mobile OTP once).');
  }

  const parsed = parseSfdxAuthUrl(authUrl);
  const tokenHosts = Array.from(
    new Set([parsed.host, env.loginHost.replace(/^https?:\/\//, ''), 'login.salesforce.com']),
  );

  let lastError = 'Unknown OAuth error';

  for (const host of tokenHosts) {
    const response = await requestAccessToken(host, parsed);
    if (response.ok) {
      return {
        accessToken: response.accessToken,
        instanceUrl: response.instanceUrl.replace(/\/$/, ''),
      };
    }
    lastError = response.error;
  }

  throw new Error(
    `Could not refresh the Salesforce session from SF_AUTH_URL (${lastError}). Re-run \`sf org login web\` and complete the mobile OTP once, then \`npm run auth:url\`.`,
  );
}

export function parseSfdxAuthUrl(authUrl: string): ParsedAuthUrl {
  const trimmed = authUrl.trim();
  if (!trimmed.startsWith('force://')) {
    throw new Error('SF_AUTH_URL must start with force:// (the sfdxAuthUrl from `sf org display --verbose --json`).');
  }

  const withoutScheme = trimmed.slice('force://'.length);
  const at = withoutScheme.lastIndexOf('@');
  if (at < 0) {
    throw new Error('SF_AUTH_URL is missing the instance host after @.');
  }

  const credentials = withoutScheme.slice(0, at);
  const host = withoutScheme.slice(at + 1).replace(/\/$/, '');
  const firstColon = credentials.indexOf(':');
  const secondColon = credentials.indexOf(':', firstColon + 1);

  if (firstColon < 0 || secondColon < 0) {
    throw new Error('SF_AUTH_URL must be force://clientId:clientSecret:refreshToken@instance.');
  }

  return {
    clientId: decodeURIComponent(credentials.slice(0, firstColon)),
    clientSecret: decodeURIComponent(credentials.slice(firstColon + 1, secondColon)),
    refreshToken: decodeURIComponent(credentials.slice(secondColon + 1)),
    host,
  };
}

async function requestAccessToken(
  host: string,
  parsed: ParsedAuthUrl,
): Promise<{ ok: true; accessToken: string; instanceUrl: string } | { ok: false; error: string }> {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: parsed.clientId,
    refresh_token: parsed.refreshToken,
  });

  if (parsed.clientSecret) {
    body.set('client_secret', parsed.clientSecret);
  }

  const response = await fetch(`https://${host}/services/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  const payload = (await response.json().catch(() => ({}))) as {
    access_token?: string;
    instance_url?: string;
    error?: string;
    error_description?: string;
  };

  if (!response.ok || !payload.access_token || !payload.instance_url) {
    return {
      ok: false,
      error: payload.error_description || payload.error || `HTTP ${response.status}`,
    };
  }

  return {
    ok: true,
    accessToken: payload.access_token,
    instanceUrl: payload.instance_url,
  };
}
