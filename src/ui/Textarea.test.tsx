import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Textarea } from './Textarea';

describe('Textarea', () => {
  it('renders a label wired to the textarea via htmlFor/id', () => {
    render(<Textarea label="Description" />);
    expect(screen.getByLabelText('Description')).toBeInTheDocument();
  });

  it('derives an id from the label when none is given', () => {
    render(<Textarea label="Short Bio" />);
    expect(screen.getByLabelText('Short Bio')).toHaveAttribute('id', 'short-bio');
  });

  it('calls onChange as the user types', async () => {
    const onChange = vi.fn();
    render(<Textarea label="Notes" onChange={onChange} />);
    await userEvent.type(screen.getByLabelText('Notes'), 'ab');
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it('shows the error message instead of helper text', () => {
    render(<Textarea label="Bio" helperText="hint" error="Bio is required" />);
    expect(screen.getByText('Bio is required')).toBeInTheDocument();
    expect(screen.queryByText('hint')).not.toBeInTheDocument();
  });
});
