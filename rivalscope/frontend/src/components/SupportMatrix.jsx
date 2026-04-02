import React, { useState } from 'react';

const ICONS = {
  yes:     { symbol: '✓', label: 'Supported',      classes: 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20' },
  partial: { symbol: '~', label: 'Partial support', classes: 'text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20' },
  no:      { symbol: '✗', label: 'Not supported',   classes: 'text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-900/20' },
  unknown: { symbol: '?', label: 'Unconfirmed',     classes: 'text-gray-400 dark:text-slate-500 bg-gray-50 dark:bg-slate-800' },
};

const NEGATIVE_PHRASES = ['not supported', 'not available', 'unavailable', 'n/a', 'none', 'not offered'];
const UNKNOWN_PHRASES  = ['unconfirmed', 'not publicly disclosed', 'unknown'];

/**
 * Classify a cell value as yes / partial / no / unknown.
 * Any substantive descriptive text is treated as "yes" (the product mentions/supports this capability).
 */
function classifyCell(value) {
  if (!value || typeof value !== 'string') return 'unknown';
  const v = value.trim();
  if (!v) return 'unknown';

  const lower = v.toLowerCase();

  if (UNKNOWN_PHRASES.some(p => lower.includes(p))) return 'unknown';
  if (lower === 'no' || NEGATIVE_PHRASES.some(p => lower.includes(p))) return 'no';

  // Partial signals
  if (['partial', 'limited', 'basic', 'some ', 'expanding', 'primarily'].some(p => lower.includes(p))) return 'partial';

  // Any other substantive text = the product mentions / supports this capability
  return 'yes';
}

export default function SupportMatrix({ data }) {
  const [tooltip, setTooltip] = useState(null);

  if (!data?.columns || !data?.rows) return null;

  const productNames = data.columns.slice(1);

  // Use LLM-generated support_matrix if available (future analyses)
  const rows = data.support_matrix?.length > 0
    ? data.support_matrix.map(e => ({ Field: e.capability, ...e }))
    : data.rows;

  return (
    <div className="overflow-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            <th className="sticky left-0 z-20 px-3 py-2 text-left text-xs font-semibold bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 border-b border-r border-gray-200 dark:border-slate-700 min-w-48">
              Capability
            </th>
            {productNames.map(name => (
              <th
                key={name}
                className="px-3 py-2 text-center text-xs font-semibold border-b border-r border-gray-200 dark:border-slate-700 min-w-32 bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300"
              >
                {name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex} className="border-b border-gray-100 dark:border-slate-800 hover:bg-gray-50 dark:hover:bg-slate-800/50">
              <td className="sticky left-0 px-3 py-2 bg-white dark:bg-slate-900 border-r border-gray-100 dark:border-slate-800 text-xs font-medium text-gray-700 dark:text-slate-300 z-10">
                {row.Field}
              </td>
              {productNames.map(name => {
                const rawValue = row[name] || '';
                const status = data.support_matrix?.length > 0
                  ? (rawValue.toLowerCase() === 'yes' ? 'yes' : rawValue.toLowerCase() === 'partial' ? 'partial' : rawValue.toLowerCase() === 'no' ? 'no' : 'unknown')
                  : classifyCell(rawValue);
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
                      {/* Hover tooltip */}
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
          ))}
        </tbody>
      </table>

      {tooltip && (
        <div className="mt-3 p-3 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg text-xs text-gray-700 dark:text-slate-300 max-w-xl">
          <p className="font-semibold text-gray-900 dark:text-white mb-1">{tooltip.field} — {tooltip.colName}</p>
          <p className="leading-relaxed">{tooltip.value || <span className="italic text-gray-400">No data</span>}</p>
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
