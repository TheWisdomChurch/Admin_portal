import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SectionCard } from './SectionCard';

describe('SectionCard', () => {
  it('renders the title, subtitle, and children', () => {
    render(
      <SectionCard title="Leadership by role" subtitle="Role distribution">
        Chart goes here
      </SectionCard>
    );
    expect(screen.getByText('Leadership by role')).toBeInTheDocument();
    expect(screen.getByText('Role distribution')).toBeInTheDocument();
    expect(screen.getByText('Chart goes here')).toBeInTheDocument();
  });

  it('renders the icon and actions when provided', () => {
    render(
      <SectionCard title="Leadership" icon={<span data-testid="icon" />} actions={<button>Export</button>}>
        Body
      </SectionCard>
    );
    expect(screen.getByTestId('icon')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Export' })).toBeInTheDocument();
  });

  it('omits the subtitle paragraph when not provided', () => {
    render(<SectionCard title="Leadership">Body</SectionCard>);
    expect(screen.queryByText(/distribution/)).not.toBeInTheDocument();
  });
});
