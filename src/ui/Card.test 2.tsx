import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Card } from './Card';

describe('Card', () => {
  it('renders children content', () => {
    render(<Card>Body content</Card>);
    expect(screen.getByText('Body content')).toBeInTheDocument();
  });

  it('renders a title and actions header when provided', () => {
    render(
      <Card title="Members" actions={<button>Refresh</button>}>
        Body
      </Card>
    );
    expect(screen.getByText('Members')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Refresh' })).toBeInTheDocument();
  });

  it('omits the header entirely when no title or actions are given', () => {
    const { container } = render(<Card>Body</Card>);
    expect(container.querySelector('h3')).not.toBeInTheDocument();
  });
});
