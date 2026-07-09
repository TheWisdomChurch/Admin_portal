import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Badge, BadgeWithIcon, DotBadge, PillBadge } from './Badge';

describe('Badge', () => {
  it('renders children text', () => {
    render(<Badge>Active</Badge>);
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('applies a custom className alongside variant styles', () => {
    render(<Badge className="custom-class">Active</Badge>);
    expect(screen.getByText('Active')).toHaveClass('custom-class');
  });
});

describe('BadgeWithIcon', () => {
  it('renders icon before children by default', () => {
    const { container } = render(
      <BadgeWithIcon icon={<span data-testid="icon" />}>Verified</BadgeWithIcon>
    );
    expect(screen.getByTestId('icon')).toBeInTheDocument();
    expect(screen.getByText('Verified')).toBeInTheDocument();
    expect(container.textContent).toBe('Verified');
  });
});

describe('PillBadge', () => {
  it('renders children text', () => {
    render(<PillBadge variant="success">Approved</PillBadge>);
    expect(screen.getByText('Approved')).toBeInTheDocument();
  });
});

describe('DotBadge', () => {
  it('renders without visible text content', () => {
    const { container } = render(<DotBadge color="danger" />);
    expect(container.querySelector('span')).toBeInTheDocument();
    expect(container.textContent).toBe('');
  });
});
