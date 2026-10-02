'use client';

import { useMemo, useState, type ReactNode } from 'react';

import { usePreferences } from './preferences';

export interface ScientificColumn<Row> {
  readonly id: string;
  readonly label: string;
  readonly value: (row: Row) => ReactNode;
  readonly sortValue?: (row: Row) => string | number;
  readonly pinned?: boolean;
  readonly width?: number;
}

export function ScientificTable<Row>({
  rows,
  columns,
  getRowId,
  onExport,
}: {
  rows: readonly Row[];
  columns: readonly ScientificColumn<Row>[];
  getRowId: (row: Row) => string;
  onExport?: (rows: readonly Row[]) => void;
}) {
  const { t } = usePreferences();
  const [filter, setFilter] = useState('');
  const [sort, setSort] = useState<{ id: string; direction: 'asc' | 'desc' }>();
  const [hidden, setHidden] = useState<ReadonlySet<string>>(new Set());
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [compact, setCompact] = useState(false);
  const visibleColumns = columns.filter((column) => !hidden.has(column.id));
  const filteredRows = useMemo(() => {
    let result = rows.filter((row) => {
      if (!filter) return true;
      return columns.some((column) =>
        String(column.value(row) ?? '').toLocaleLowerCase().includes(filter.toLocaleLowerCase()),
      );
    });
    if (sort) {
      const column = columns.find((entry) => entry.id === sort.id);
      if (column?.sortValue) {
        result = [...result].sort((left, right) => {
          const a = column.sortValue?.(left) ?? '';
          const b = column.sortValue?.(right) ?? '';
          const order = typeof a === 'number' && typeof b === 'number'
            ? a - b
            : String(a).localeCompare(String(b));
          return sort.direction === 'asc' ? order : -order;
        });
      }
    }
    return result;
  }, [columns, filter, rows, sort]);

  const toggleSort = (column: ScientificColumn<Row>) => {
    if (!column.sortValue) return;
    setSort((current) => ({
      id: column.id,
      direction: current?.id === column.id && current.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  const toggleSelected = (id: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectedRows = filteredRows.filter((row) => selected.has(getRowId(row)));

  return (
    <div className={`scientific-table-wrap${compact ? ' is-compact' : ''}`}>
      <div className="table-toolbar">
        <label>
          <span className="sr-only">{t('filterRecords')}</span>
          <input aria-label={t('filterRecords')} value={filter} onChange={(event) => setFilter(event.target.value)} placeholder={t('filterRecords')} type="search" />
        </label>
        <details className="table-columns-control">
          <summary>{t('showColumns')} <span aria-hidden="true">⌄</span></summary>
          <fieldset>
            <legend>{t('showColumns')}</legend>
            {columns.map((column) => (
              <label key={column.id}>
                <input
                  checked={!hidden.has(column.id)}
                  onChange={() => setHidden((current) => {
                    const next = new Set(current);
                    if (next.has(column.id)) next.delete(column.id);
                    else next.add(column.id);
                    return next;
                  })}
                  type="checkbox"
                />
                {column.label}
              </label>
            ))}
          </fieldset>
        </details>
        <button aria-pressed={compact} className="text-button" onClick={() => setCompact(!compact)} type="button">
          {t('compactDensity')}
        </button>
        {onExport && (
          <button className="text-button" disabled={selectedRows.length === 0} onClick={() => onExport(selectedRows)} type="button">
            {t('exportSelected')}
          </button>
        )}
        <span className="table-selection" aria-live="polite">
          {selected.size > 0 ? `${selected.size} ${t('selectedRows')}` : ''}
        </span>
      </div>
      <div className="table-scroll" role="region" aria-label={t('scientificTable')} tabIndex={0}>
        <table>
          <thead>
            <tr>
              <th scope="col"><span className="sr-only">{t('selectRow')}</span></th>
              {visibleColumns.map((column) => (
                <th
                  aria-sort={sort?.id === column.id ? (sort.direction === 'asc' ? 'ascending' : 'descending') : undefined}
                  className={column.pinned ? 'is-pinned' : undefined}
                  key={column.id}
                  scope="col"
                  style={column.width ? { width: column.width, minWidth: column.width, resize: 'horizontal', overflow: 'auto' } : undefined}
                >
                  {column.sortValue ? (
                    <button className="table-sort" onClick={() => toggleSort(column)} type="button">
                      {column.label}
                      <span aria-hidden="true">{sort?.id === column.id ? (sort.direction === 'asc' ? ' ↑' : ' ↓') : ' ↕'}</span>
                    </button>
                  ) : column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((row) => {
              const id = getRowId(row);
              return (
                <tr aria-selected={selected.has(id)} key={id}>
                  <td>
                    <input
                      aria-label={`${t('selectRow')} ${id}`}
                      checked={selected.has(id)}
                      onChange={() => toggleSelected(id)}
                      type="checkbox"
                    />
                  </td>
                  {visibleColumns.map((column) => (
                    <td className={column.pinned ? 'is-pinned' : undefined} key={column.id}>
                      {column.value(row)}
                    </td>
                  ))}
                </tr>
              );
            })}
            {filteredRows.length === 0 && (
              <tr><td className="table-empty" colSpan={visibleColumns.length + 1}>{t('noRows')}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}