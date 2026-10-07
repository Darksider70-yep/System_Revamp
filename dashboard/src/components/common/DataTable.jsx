import React, { useState, useMemo } from 'react';
import { ChevronUp, ChevronDown, ChevronsUpDown, ChevronLeft, ChevronRight, Inbox } from 'lucide-react';
import { TableSkeleton } from './Skeleton';
import { EmptyState } from './EmptyState';

export const DataTable = ({
  columns = [], // [{ id, header, accessor, render, sortable, width, align }]
  data = [],
  loading = false,
  selectable = false,
  selectedRowIds = [],
  onSelectionChange = null,
  onRowClick = null,
  emptyTitle = 'No data available',
  emptyDescription = 'No records match your query.',
  defaultSort = { field: null, direction: 'asc' },
  pageSize = 25,
  showPagination = true,
}) => {
  const [sortField, setSortField] = useState(defaultSort.field);
  const [sortDirection, setSortDirection] = useState(defaultSort.direction);
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(pageSize);

  // Sorting
  const sortedData = useMemo(() => {
    if (!sortField) return data;
    return [...data].sort((a, b) => {
      const valA = a[sortField];
      const valB = b[sortField];
      if (valA === valB) return 0;
      if (valA === null || valA === undefined) return 1;
      if (valB === null || valB === undefined) return -1;
      if (typeof valA === 'number' && typeof valB === 'number') {
        return sortDirection === 'asc' ? valA - valB : valB - valA;
      }
      return sortDirection === 'asc'
        ? String(valA).localeCompare(String(valB))
        : String(valB).localeCompare(String(valA));
    });
  }, [data, sortField, sortDirection]);

  // Pagination
  const totalPages = Math.ceil(sortedData.length / rowsPerPage) || 1;
  const paginatedData = useMemo(() => {
    if (!showPagination) return sortedData;
    const start = (currentPage - 1) * rowsPerPage;
    return sortedData.slice(start, start + rowsPerPage);
  }, [sortedData, currentPage, rowsPerPage, showPagination]);

  const handleSort = (field) => {
    if (sortField === field) {
      if (sortDirection === 'asc') setSortDirection('desc');
      else {
        setSortField(null);
        setSortDirection('asc');
      }
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handleSelectAll = (e) => {
    if (!onSelectionChange) return;
    if (e.target.checked) {
      onSelectionChange(paginatedData.map((d) => d.id || d.device_id || d.name));
    } else {
      onSelectionChange([]);
    }
  };

  const handleSelectRow = (id, e) => {
    e.stopPropagation();
    if (!onSelectionChange) return;
    if (selectedRowIds.includes(id)) {
      onSelectionChange(selectedRowIds.filter((item) => item !== id));
    } else {
      onSelectionChange([...selectedRowIds, id]);
    }
  };

  if (loading) {
    return (
      <div className="panel" style={{ overflow: 'hidden' }}>
        <TableSkeleton rows={rowsPerPage > 10 ? 10 : rowsPerPage} cols={columns.length + (selectable ? 1 : 0)} />
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="panel" style={{ overflow: 'hidden' }}>
        <EmptyState title={emptyTitle} description={emptyDescription} />
      </div>
    );
  }

  const allSelected =
    paginatedData.length > 0 &&
    paginatedData.every((d) => selectedRowIds.includes(d.id || d.device_id || d.name));

  return (
    <div className="panel" style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <div className="data-table-container" style={{ border: 'none', borderRadius: 0 }}>
        <table className="data-table">
          <thead>
            <tr>
              {selectable && (
                <th style={{ width: '36px', textAlign: 'center' }}>
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={handleSelectAll}
                    style={{ cursor: 'pointer', accentColor: 'var(--accent-primary)' }}
                  />
                </th>
              )}

              {columns.map((col) => {
                const isSorted = sortField === (col.accessor || col.id);
                const align = col.align || 'left';
                return (
                  <th
                    key={col.id || col.accessor}
                    onClick={() => col.sortable && handleSort(col.accessor || col.id)}
                    style={{
                      width: col.width || 'auto',
                      textAlign: align,
                      cursor: col.sortable ? 'pointer' : 'default',
                      userSelect: 'none',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: align === 'right' ? 'flex-end' : align === 'center' ? 'center' : 'flex-start',
                        gap: '4px',
                      }}
                    >
                      <span>{col.header}</span>
                      {col.sortable && (
                        <span style={{ color: isSorted ? 'var(--accent-primary)' : 'var(--text-muted)' }}>
                          {isSorted && sortDirection === 'asc' ? (
                            <ChevronUp size={13} />
                          ) : isSorted && sortDirection === 'desc' ? (
                            <ChevronDown size={13} />
                          ) : (
                            <ChevronsUpDown size={13} />
                          )}
                        </span>
                      )}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody>
            {paginatedData.map((row, idx) => {
              const rowId = row.id || row.device_id || row.name || idx;
              const isSelected = selectedRowIds.includes(rowId);

              return (
                <tr
                  key={rowId}
                  onClick={() => onRowClick && onRowClick(row)}
                  style={{
                    cursor: onRowClick ? 'pointer' : 'default',
                    backgroundColor: isSelected ? 'var(--accent-subtle)' : 'transparent',
                  }}
                >
                  {selectable && (
                    <td style={{ textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => handleSelectRow(rowId, e)}
                        style={{ cursor: 'pointer', accentColor: 'var(--accent-primary)' }}
                      />
                    </td>
                  )}

                  {columns.map((col) => {
                    const cellValue = col.accessor ? row[col.accessor] : undefined;
                    const align = col.align || 'left';
                    return (
                      <td key={col.id || col.accessor} style={{ textAlign: align }}>
                        {col.render ? col.render(cellValue, row) : cellValue !== undefined && cellValue !== null ? String(cellValue) : '--'}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      {showPagination && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '8px 16px',
            borderTop: '1px solid var(--border-subtle)',
            backgroundColor: 'var(--bg-surface-elevated)',
            fontSize: 'var(--text-xs)',
            color: 'var(--text-secondary)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>Rows per page:</span>
            <select
              className="input"
              value={rowsPerPage}
              onChange={(e) => {
                setRowsPerPage(Number(e.target.value));
                setCurrentPage(1);
              }}
              style={{ height: '26px', padding: '0 6px', fontSize: '11px' }}
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            <span className="tabular-nums">
              Showing {(currentPage - 1) * rowsPerPage + 1}–
              {Math.min(currentPage * rowsPerPage, sortedData.length)} of {sortedData.length}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <button
              type="button"
              className="btn btn-sm btn-icon"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              aria-label="Previous Page"
            >
              <ChevronLeft size={14} />
            </button>

            <span className="tabular-nums font-mono" style={{ padding: '0 8px', fontWeight: 600 }}>
              Page {currentPage} of {totalPages}
            </span>

            <button
              type="button"
              className="btn btn-sm btn-icon"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              aria-label="Next Page"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
