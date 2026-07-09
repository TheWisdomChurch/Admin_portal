import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Panel } from './Panel';

describe('Panel', () => {
  it('renders children content', () => {
    render(<Panel>Panel body</Panel>);
    expect(screen.getByText('Panel body')).toBeInTheDocument();
  });

  it('applies padding by default', () => {
    render(<Panel>Body</Panel>);
    expect(screen.getByText('Body')).toHaveClass('p-5');
  });

  it('omits padding when padded is false', () => {
    render(<Panel padded={false}>Body</Panel>);
    expect(screen.getByText('Body')).not.toHaveClass('p-5');
  });
});
