import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PasswordStrengthMeter } from './PasswordStrengthMeter';

describe('PasswordStrengthMeter', () => {
  it('renders nothing when the password is empty', () => {
    const { container } = render(<PasswordStrengthMeter password="" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('labels a short password as weak', () => {
    render(<PasswordStrengthMeter password="abc" />);
    expect(screen.getByText(/Strength: (Too short|Weak)/)).toBeInTheDocument();
  });

  it('labels a long, varied password as strong', () => {
    render(<PasswordStrengthMeter password="Sup3r-Str0ng!Passphrase" />);
    expect(screen.getByText('Strength: Strong')).toBeInTheDocument();
  });

  it('shows improvement suggestions for a weak password', () => {
    render(<PasswordStrengthMeter password="abc" />);
    expect(screen.getByText(/Use 12\+ characters/)).toBeInTheDocument();
  });
});
