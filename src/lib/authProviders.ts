export type AuthIdentityProvider = {
  id: 'google';
  label: string;
  href: string;
};

type AuthIdentityProviderOptions = {
  rememberMe?: boolean;
};

function buildProviderHref(path: string, options?: AuthIdentityProviderOptions): string {
  const query = new URLSearchParams();
  if (options?.rememberMe) {
    query.set('rememberMe', 'true');
  }

  const serialized = query.toString();
  return serialized ? `${path}?${serialized}` : path;
}

export function getConfiguredAuthIdentityProviders(
  options: AuthIdentityProviderOptions = {}
): AuthIdentityProvider[] {
  if (process.env.NEXT_PUBLIC_AUTH_GOOGLE_ENABLED === 'false') {
    return [];
  }

  return [
    {
      id: 'google',
      label: 'Continue with Google',
      href: buildProviderHref('/api/v1/auth/oauth/google/start', options),
    },
  ];
}
