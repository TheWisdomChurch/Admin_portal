export type PasswordStrength = {
  score: 0 | 1 | 2 | 3 | 4;
  label: string;
  suggestions: string[];
};

function hasLower(password: string) {
  return /[a-z]/.test(password);
}

function hasUpper(password: string) {
  return /[A-Z]/.test(password);
}

function hasNumber(password: string) {
  return /[0-9]/.test(password);
}

function hasSymbol(password: string) {
  return /[^A-Za-z0-9]/.test(password);
}

export function getPasswordStrength(password: string): PasswordStrength {
  if (!password) {
    return { score: 0, label: 'Too short', suggestions: [] };
  }

  let score = 0;
  const suggestions: string[] = [];

  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (password.length >= 16) score += 1;

  const variety = [hasLower(password), hasUpper(password), hasNumber(password), hasSymbol(password)].filter(Boolean)
    .length;

  if (variety >= 3) score += 1;
  if (variety === 4) score += 1;

  if (password.length < 12) suggestions.push('Use 12+ characters');
  if (!hasUpper(password)) suggestions.push('Add an uppercase letter');
  if (!hasLower(password)) suggestions.push('Add a lowercase letter');
  if (!hasNumber(password)) suggestions.push('Add a number');
  if (!hasSymbol(password)) suggestions.push('Add a symbol');

  const capped = Math.min(score, 4) as 0 | 1 | 2 | 3 | 4;

  const label = ['Too short', 'Weak', 'Fair', 'Good', 'Strong'][capped];
  return { score: capped, label, suggestions };
}
