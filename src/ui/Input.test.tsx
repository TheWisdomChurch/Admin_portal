import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Input } from './Input';

describe('Input', () => {
  it('renders a label wired to the input via htmlFor/id', () => {
    render(<Input label="Email" />);
    const input = screen.getByLabelText('Email');
    expect(input).toBeInTheDocument();
  });

  it('derives an id from the label when none is given', () => {
    render(<Input label="First Name" />);
    expect(screen.getByLabelText('First Name')).toHaveAttribute('id', 'first-name');
  });

  it('calls onChange as the user types', async () => {
    const onChange = vi.fn();
    render(<Input label="Search" onChange={onChange} />);
    await userEvent.type(screen.getByLabelText('Search'), 'abc');
    expect(onChange).toHaveBeenCalledTimes(3);
  });

  it('shows helper text when there is no error', () => {
    render(<Input label="Email" helperText="We will never share this" />);
    expect(screen.getByText('We will never share this')).toBeInTheDocument();
  });

  it('shows the error message instead of helper text', () => {
    render(<Input label="Email" helperText="hint" error="Email is required" />);
    expect(screen.getByText('Email is required')).toBeInTheDocument();
    expect(screen.queryByText('hint')).not.toBeInTheDocument();
  });
});
