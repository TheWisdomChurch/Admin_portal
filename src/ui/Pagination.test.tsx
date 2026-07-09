import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Pagination } from './Pagination';

describe('Pagination', () => {
  it('renders nothing when there is only one page', () => {
    const { container } = render(<Pagination page={1} pageCount={1} onPageChange={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders page buttons and marks the current page', () => {
    render(<Pagination page={2} pageCount={3} onPageChange={() => {}} />);
    expect(screen.getByRole('button', { name: '2' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('button', { name: '1' })).not.toHaveAttribute('aria-current');
  });

  it('disables previous on the first page and next on the last page', () => {
    render(<Pagination page={1} pageCount={3} onPageChange={() => {}} />);
    expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Next page' })).not.toBeDisabled();
  });

  it('calls onPageChange with the target page when a page button is clicked', async () => {
    const onPageChange = vi.fn();
    render(<Pagination page={1} pageCount={3} onPageChange={onPageChange} />);
    await userEvent.click(screen.getByRole('button', { name: '3' }));
    expect(onPageChange).toHaveBeenCalledWith(3);
  });

  it('calls onPageChange with page + 1 when next is clicked', async () => {
    const onPageChange = vi.fn();
    render(<Pagination page={2} pageCount={5} onPageChange={onPageChange} />);
    await userEvent.click(screen.getByRole('button', { name: 'Next page' }));
    expect(onPageChange).toHaveBeenCalledWith(3);
  });

  it('renders ellipsis for large page counts', () => {
    render(<Pagination page={10} pageCount={20} onPageChange={() => {}} />);
    expect(screen.getAllByText('…').length).toBeGreaterThan(0);
  });
});
