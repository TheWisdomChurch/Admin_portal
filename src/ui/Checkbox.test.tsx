import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Checkbox } from './Checkbox';

describe('Checkbox', () => {
  it('renders the label wired to the checkbox', () => {
    render(<Checkbox label="Accept terms" onChange={() => {}} />);
    expect(screen.getByLabelText('Accept terms')).toBeInTheDocument();
  });

  it('toggles and calls onChange when clicked', async () => {
    const onChange = vi.fn();
    render(<Checkbox label="Accept terms" onChange={onChange} />);
    await userEvent.click(screen.getByLabelText('Accept terms'));
    expect(onChange).toHaveBeenCalledOnce();
  });

  it('is disabled and does not fire onChange when disabled', async () => {
    const onChange = vi.fn();
    render(<Checkbox label="Accept terms" onChange={onChange} disabled />);
    const checkbox = screen.getByLabelText('Accept terms');
    expect(checkbox).toBeDisabled();
    await userEvent.click(checkbox);
    expect(onChange).not.toHaveBeenCalled();
  });
});
