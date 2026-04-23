export type AuthIdentityProviderId = 'google';

export type AuthIdentityProvider = {
  id: AuthIdentityProviderId;
  label: string;
  href: string;
};

type AuthIdentityProviderOptions = {
  rememberMe?: boolean;
  redirectTo?: string;
};

const GOOGLE_ENABLED = process.env.NEXT_PUBLIC_AUTH_GOOGLE_ENABLED !== 'false';
const OAUTH_BASE_PATH = '/api/v1/auth';

function normalizeRedirectPath(path?: string): string | undefined {
  if (!path) return undefined;

  const trimmed = path.trim();
  if (!trimmed) return undefined;

  // Allow only internal relative redirects.
  if (!trimmed.startsWith('/')) return undefined;
  if (trimmed.startsWith('//')) return undefined;

  return trimmed;
}

function buildProviderHref(
  path: string,
  options: AuthIdentityProviderOptions = {}
): string {
  const query = new URLSearchParams();

  if (options.rememberMe) {
    query.set('rememberMe', 'true');
  }

  const safeRedirectTo = normalizeRedirectPath(options.redirectTo);
  if (safeRedirectTo) {
    query.set('redirectTo', safeRedirectTo);
  }

  const serialized = query.toString();
  return serialized ? `${path}?${serialized}` : path;
}

export function getConfiguredAuthIdentityProviders(
  options: AuthIdentityProviderOptions = {}
): AuthIdentityProvider[] {
  const providers: AuthIdentityProvider[] = [];

  if (GOOGLE_ENABLED) {
    providers.push({
      id: 'google',
      label: 'Continue with Google',
      href: buildProviderHref(`${OAUTH_BASE_PATH}/oauth/google/start`, options),
    });
  }

  return providers;
}