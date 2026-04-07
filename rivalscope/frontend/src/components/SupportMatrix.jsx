import React, { useState } from 'react';

const ICONS = {
  yes:     { symbol: '✓', label: 'Supported',       classes: 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20' },
  partial: { symbol: '~', label: 'Partial support',  classes: 'text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20' },
  no:      { symbol: '✗', label: 'Not supported',    classes: 'text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-900/20' },
  unknown: { symbol: '?', label: 'Unconfirmed',      classes: 'text-gray-400 dark:text-slate-500 bg-gray-50 dark:bg-slate-800' },
};

const NEGATIVE_PHRASES  = ['not supported', 'not available', 'unavailable', 'n/a', 'none', 'not offered'];
const UNKNOWN_PHRASES   = ['unconfirmed', 'not publicly disclosed', 'unknown'];

function classifyCell(value) {
  if (!value || typeof value !== 'string') return 'unknown';
  const v = value.trim();
  if (!v) return 'unknown';
  const lower = v.toLowerCase();
  if (UNKNOWN_PHRASES.some(p => lower.includes(p))) return 'unknown';
  if (lower === 'no' || NEGATIVE_PHRASES.some(p => lower.includes(p))) return 'no';
  if (['partial', 'limited', 'basic', 'some ', 'expanding', 'primarily'].some(p => lower.includes(p))) return 'partial';
  return 'yes';
}

/**
 * Explode list-like fields into one row per capability item.
 * Non-list fields are SKIPPED entirely — they are descriptive text, not capabilities.
 */
function buildCapabilityRows(rows, productNames) {
  const result = [];

  for (const row of rows) {
    const fieldName = row.Field;
    const allValues = productNames.map(p => row[p] || '');

    const isListField = allValues.some(v => {
      const parts = v.split(',').map(s => s.trim()).filter(Boolean);
      return (
        parts.length >= 2 &&
        parts.every(p => p.length <= 30) &&
        !v.toLowerCase().includes('unconfirmed')
      );
    });

    // Skip non-list rows — they're descriptive text, not binary capabilities
    if (!isListField) continue;

    // Collect unique items across all products (preserve insertion order)
    const allItems = new Map(); // lowercase → display form
    allValues.forEach(v => {
      if (!v || v.toLowerCase().includes('unconfirmed')) return;
      v.split(',').map(s => s.trim()).filter(Boolean).forEach(item => {
        if (!allItems.has(item.toLowerCase())) allItems.set(item.toLowerCase(), item);
      });
    });

    for (const [lcItem, displayItem] of allItems) {
      const capRow = { Field: displayItem, _fieldGroup: fieldName };
      productNames.forEach(p => {
        const cell = row[p] || '';
        if (!cell || cell.toLowerCase().includes('unconfirmed')) {
          capRow[p] = '';
        } else {
          const items = cell.split(',').map(s => s.trim().toLowerCase());
          capRow[p] = items.includes(lcItem) ? displayItem : 'No';
        }
      });
      result.push(capRow);
    }
  }

  return result;
}

export default function SupportMatrix({ data }) {
  const [tooltip, setTooltip] = useState(null);

  if (!data?.columns || !data?.rows) return null;

  const productNames = data.columns.slice(1);

  const rawRows = data.support_matrix?.length > 0
    ? data.support_matrix.map(e => ({ Field: e.capability, ...e }))
    : data.rows;

  const rows = buildCapabilityRows(rawRows, productNames);

  // Empty state — no list-like rows found
  if (rows.length === 0) {
    return (
      <div className="py-12 text-center">
        <p className="text-sm text-gray-500 dark:text-slate-400">
          No feature-level capability data to compare for this analysis.
        </p>
        <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">
          Switch to the <strong>Feature Comparison</strong> tab for a full view.
        </p>
      </div>
    );
  }

  // Track field group separators
  let lastGroup = null;

  return (
    <div className="overflow-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            {/* Capability column — sticky left */}
            <th className="sticky top-0 left-0 z-30 px-3 py-2 text-left text-xs font-semibold border-b border-r-2 border-gray-200 dark:border-slate-700 min-w-44 bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 whitespace-nowrap">
              Capability
            </th>
            {/* Product columns */}
            {productNames.map(name => (
              <th
                key={name}
                className="sticky top-0 px-3 py-2 text-center text-xs font-semibold border-b border-r border-gray-200 dark:border-slate-700 min-w-32 bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 whitespace-nowrap"
              >
                {name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => {
            const showGroupHeader = row._fieldGroup && row._fieldGroup !== lastGroup;
            if (showGroupHeader) lastGroup = row._fieldGroup;

            return (
              <React.Fragment key={rowIndex}>
                {showGroupHeader && (
                  <tr>
                    <td
                      colSpan={productNames.length + 1}
                      className="px-3 py-1 bg-gray-50 dark:bg-slate-800/70 text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-slate-500 border-b border-gray-100 dark:border-slate-800"
                    >
                      {row._fieldGroup}
                    </td>
                  </tr>
                )}
                <tr className="border-b border-gray-100 dark:border-slate-800 hover:bg-gray-50 dark:hover:bg-slate-800/50">
                  {/* Capability name — sticky left */}
                  <td className="sticky left-0 px-3 py-2 bg-white dark:bg-slate-900 border-r-2 border-gray-200 dark:border-slate-700 text-xs font-medium text-gray-700 dark:text-slate-300 z-10">
                    {row.Field}
                  </td>
                  {/* Product icon cells */}
                  {productNames.map(name => {
                    const rawValue = row[name] || '';
                    const status = data.support_matrix?.length > 0
                      ? (['yes','partial','no'].includes(rawValue.toLowerCase()) ? rawValue.toLowerCase() : 'unknown')
                      : (rawValue === 'No' ? 'no' : classifyCell(rawValue));
                    const icon = ICONS[status];
                    const isActive = tooltip?.rowIndex === rowIndex && tooltip?.colName === name;

                    return (
                      <td key={name} className="px-3 py-2 text-center border-r border-gray-100 dark:border-slate-800">
                        <div className="relative group inline-block">
                          <button
                            className={`w-8 h-8 rounded-full flex items-center justify-center mx-auto text-sm font-bold transition-opacity cursor-pointer ${icon.classes} ${isActive ? 'ring-2 ring-sky-400' : 'hover:opacity-80'}`}
                            onClick={() => setTooltip(isActive ? null : { rowIndex, colName: name, value: rawValue || '—', field: row.Field })}
                          >
                            {icon.symbol}
                          </button>
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-50 pointer-events-none">
                            <div className="bg-gray-900 dark:bg-slate-700 text-white text-xs rounded-lg px-3 py-2 shadow-lg w-52 text-left">
                              <p className={`font-semibold mb-1 ${
                                status === 'yes' ? 'text-green-400' :
                                status === 'partial' ? 'text-yellow-400' :
                                status === 'no' ? 'text-red-400' : 'text-gray-400'
                              }`}>{icon.symbol} {icon.label}</p>
                              <p className="text-gray-300 leading-relaxed break-words">{rawValue || '—'}</p>
                            </div>
                            <div className="w-2 h-2 bg-gray-900 dark:bg-slate-700 rotate-45 mx-auto -mt-1" />
                          </div>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              </React.Fragment>
            );
          })}
        </tbody>
      </table>

      {tooltip && (
        <div className="mt-3 p-3 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg text-xs text-gray-700 dark:text-slate-300 max-w-xl">
          <p className="font-semibold text-gray-900 dark:text-white mb-1">{tooltip.field} — {tooltip.colName}</p>
          <p className="leading-relaxed">{tooltip.value}</p>
        </div>
      )}

      <div className="mt-3 flex gap-4 text-xs text-gray-500 dark:text-slate-400">
        <span className="flex items-center gap-1"><span className="text-green-600 dark:text-green-400 font-bold">✓</span> Supported</span>
        <span className="flex items-center gap-1"><span className="text-yellow-600 dark:text-yellow-400 font-bold">~</span> Partial</span>
        <span className="flex items-center gap-1"><span className="text-red-500 font-bold">✗</span> Not supported</span>
        <span className="flex items-center gap-1"><span className="font-bold">?</span> Unconfirmed</span>
        <span className="ml-auto text-gray-400 dark:text-slate-500">Click a cell for details</span>
      </div>
    </div>
  );
}
