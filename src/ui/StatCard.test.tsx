import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StatCard } from './StatCard';

describe('StatCard', () => {
  it('renders the label and value', () => {
    render(<StatCard label="Total members" value={128} />);
    expect(screen.getByText('Total members')).toBeInTheDocument();
    expect(screen.getByText('128')).toBeInTheDocument();
  });

  it('renders a trend line when provided', () => {
    render(<StatCard label="Total members" value={128} trend="+12 this month" />);
    expect(screen.getByText('+12 this month')).toBeInTheDocument();
  });

  it('omits the trend line when not provided', () => {
    render(<StatCard label="Total members" value={128} />);
    expect(screen.queryByText(/this month/)).not.toBeInTheDocument();
  });

  it('renders the icon when provided', () => {
    render(<StatCard label="Total members" value={128} icon={<span data-testid="icon" />} />);
    expect(screen.getByTestId('icon')).toBeInTheDocument();
  });
});
