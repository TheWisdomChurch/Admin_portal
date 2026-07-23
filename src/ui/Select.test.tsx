import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Select } from './Select';

describe('Select', () => {
  it('renders a label wired to the select via htmlFor/id', () => {
    render(
      <Select label="Field type">
        <option value="text">Text</option>
      </Select>
    );
    expect(screen.getByLabelText('Field type')).toBeInTheDocument();
  });

  it('derives an id from the label when none is given', () => {
    render(
      <Select label="Form Type">
        <option value="general">General</option>
      </Select>
    );
    expect(screen.getByLabelText('Form Type')).toHaveAttribute('id', 'form-type');
  });

  it('calls onChange when a new option is selected', async () => {
    const onChange = vi.fn();
    render(
      <Select label="Status" onChange={onChange}>
        <option value="draft">Draft</option>
        <option value="live">Live</option>
      </Select>
    );
    await userEvent.selectOptions(screen.getByLabelText('Status'), 'live');
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('shows the error message instead of helper text', () => {
    render(
      <Select label="Type" helperText="hint" error="Type is required">
        <option value="text">Text</option>
      </Select>
    );
    expect(screen.getByText('Type is required')).toBeInTheDocument();
    expect(screen.queryByText('hint')).not.toBeInTheDocument();
  });
});
