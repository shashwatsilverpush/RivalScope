import React, { useState } from 'react';
import DiffBadge from './DiffBadge.jsx';

export default function ResultsTable({ data, products, diff }) {
  const [expandedCells, setExpandedCells] = useState(new Set());
  if (!data?.columns || !data?.rows) return null;

  const { columns, rows } = data;
  const mainProducts = products?.filter(p => p.role === 'main').map(p => p.identifier) || [];

  // Product columns are everything except "Field" (first column)
  const productCols = columns.slice(1);

  const toggleExpand = (key) => {
    setExpandedCells(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  return (
    <div className="overflow-auto max-h-[calc(100vh-280px)] scrollbar-thin">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            {/* Product columns first */}
            {productCols.map(col => (
              <th
                key={col}
                className={`sticky top-0 z-20 px-3 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 dark:border-slate-700 whitespace-nowrap min-w-40 ${
                  mainProducts.includes(col)
                    ? 'bg-sky-50 dark:bg-sky-900/50 text-sky-600 dark:text-sky-300'
                    : 'bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300'
                }`}
              >
                {col}
              </th>
            ))}
            {/* Field column last — sticky right */}
            <th className="sticky top-0 right-0 z-30 px-3 py-2 text-left text-xs font-semibold border-b border-l-2 border-gray-200 dark:border-slate-700 whitespace-nowrap min-w-48 bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300">
              Field
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex} className="border-b border-gray-100 dark:border-slate-800 hover:bg-gray-50 dark:hover:bg-slate-800/50">
              {/* Product value cells */}
              {productCols.map((col, colIndex) => {
                const cellKey = `${rowIndex}-${colIndex}`;
                const isExpanded = expandedCells.has(cellKey);
                const cellValue = row[col] || '';
                const cellDiff = diff?.[row.Field]?.[col];
                const isLong = cellValue.length > 80;

                return (
                  <td
                    key={col}
                    className={`px-3 py-2 border-r border-gray-100 dark:border-slate-800 align-top ${
                      cellDiff?.status === 'changed'
                        ? 'bg-yellow-500/5'
                        : cellDiff?.status === 'new'
                        ? 'bg-green-500/5'
                        : cellDiff?.status === 'removed'
                        ? 'bg-red-500/5'
                        : ''
                    }`}
                  >
                    <div>
                      <div className={isLong && !isExpanded ? 'line-clamp-2' : ''}>
                        <DiffBadge diff={cellDiff} value={cellValue} />
                      </div>
                      {isLong && (
                        <button
                          onClick={() => toggleExpand(cellKey)}
                          className="text-xs text-gray-400 dark:text-slate-500 hover:text-sky-600 dark:hover:text-sky-400 mt-1"
                        >
                          {isExpanded ? 'Show less' : 'Show more'}
                        </button>
                      )}
                    </div>
                  </td>
                );
              })}
              {/* Field name cell — sticky right */}
              <td className="sticky right-0 px-3 py-2 bg-gray-50 dark:bg-slate-800 font-semibold text-xs z-10 border-l-2 border-gray-200 dark:border-slate-700 align-top">
                <span className="uppercase tracking-wide text-[10px] font-semibold text-gray-500 dark:text-slate-400">{row.Field || ''}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
