import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Button } from './Button';

describe('Button', () => {
  it('renders children', () => {
    render(<Button>Save</Button>);
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
  });

  it('calls onClick when clicked', async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Click me</Button>);
    await userEvent.click(screen.getByRole('button', { name: 'Click me' }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('does not call onClick when disabled', async () => {
    const onClick = vi.fn();
    render(
      <Button onClick={onClick} disabled>
        Click me
      </Button>
    );
    await userEvent.click(screen.getByRole('button', { name: 'Click me' }));
    expect(onClick).not.toHaveBeenCalled();
  });

  it('disables the button and suppresses onClick while loading', async () => {
    const onClick = vi.fn();
    render(
      <Button onClick={onClick} loading>
        Save
      </Button>
    );
    const button = screen.getByRole('button', { name: 'Save' });
    expect(button).toBeDisabled();
    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('renders an icon when provided and not loading', () => {
    render(<Button icon={<span data-testid="icon" />}>Save</Button>);
    expect(screen.getByTestId('icon')).toBeInTheDocument();
  });

  it('hides the icon while loading in favor of the spinner', () => {
    const { container } = render(
      <Button icon={<span data-testid="icon" />} loading>
        Save
      </Button>
    );
    expect(screen.queryByTestId('icon')).not.toBeInTheDocument();
    expect(container.querySelector('.animate-spin')).toBeInTheDocument();
  });
});
