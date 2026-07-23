import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Table, type TableColumn } from './Table';

type Row = { id: string; name: string; email: string };

const columns: TableColumn<Row>[] = [
  { key: 'name', header: 'Name' },
  { key: 'email', header: 'Email' },
];

const data: Row[] = [
  { id: '1', name: 'Ada Lovelace', email: 'ada@example.com' },
  { id: '2', name: 'Grace Hopper', email: 'grace@example.com' },
];

describe('Table', () => {
  it('renders a loading state instead of rows', () => {
    render(<Table columns={columns} data={data} rowKey={(row) => row.id} loading />);
    expect(screen.getByText('Loading…')).toBeInTheDocument();
    expect(screen.queryByText('Ada Lovelace')).not.toBeInTheDocument();
  });

  it('renders an empty state when there is no data', () => {
    render(<Table columns={columns} data={[]} rowKey={(row) => row.id} emptyTitle="No members yet" />);
    expect(screen.getByText('No members yet')).toBeInTheDocument();
  });

  it('renders column headers and row data', () => {
    render(<Table columns={columns} data={data} rowKey={(row) => row.id} />);
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Email')).toBeInTheDocument();
    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument();
    expect(screen.getByText('grace@example.com')).toBeInTheDocument();
  });

  it('uses a custom render function for a column when provided', () => {
    const customColumns: TableColumn<Row>[] = [
      { key: 'name', header: 'Name', render: (row) => `⭐ ${row.name}` },
    ];
    render(<Table columns={customColumns} data={data} rowKey={(row) => row.id} />);
    expect(screen.getByText('⭐ Ada Lovelace')).toBeInTheDocument();
  });

  it('calls onRowClick with the clicked row', async () => {
    const onRowClick = vi.fn();
    render(<Table columns={columns} data={data} rowKey={(row) => row.id} onRowClick={onRowClick} />);
    await userEvent.click(screen.getByText('Ada Lovelace'));
    expect(onRowClick).toHaveBeenCalledWith(data[0]);
  });
});
