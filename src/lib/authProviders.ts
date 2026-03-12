export type AuthIdentityProvider = {
  id: 'google' | 'microsoft';
  label: string;
  href: string;
};

function readProviderUrl(value?: string): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function getConfiguredAuthIdentityProviders(): AuthIdentityProvider[] {
  const providers: Array<AuthIdentityProvider | null> = [
    (() => {
      const href = readProviderUrl(process.env.NEXT_PUBLIC_AUTH_GOOGLE_URL);
      return href ? { id: 'google', label: 'Continue with Google', href } : null;
    })(),
    (() => {
      const href = readProviderUrl(process.env.NEXT_PUBLIC_AUTH_MICROSOFT_URL);
      return href ? { id: 'microsoft', label: 'Continue with Microsoft', href } : null;
    })(),
  ];

  return providers.filter((provider): provider is AuthIdentityProvider => Boolean(provider));
}
