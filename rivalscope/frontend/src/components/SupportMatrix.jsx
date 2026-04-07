import React, { useState } from 'react';

const ICONS = {
  yes:     { symbol: '✓', label: 'Supported',       classes: 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20' },
  partial: { symbol: '~', label: 'Partial support',  classes: 'text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20' },
  no:      { symbol: '✗', label: 'Not supported',    classes: 'text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-900/20' },
  unknown: { symbol: '?', label: 'Unconfirmed',      classes: 'text-gray-400 dark:text-slate-500 bg-gray-50 dark:bg-slate-800' },
};

// ─── Fallback parser for older analyses that lack support_matrix ──────────────
const QUALIFIER_STARTS = [
  'and ', 'or ', 'but ', 'strong', 'focus', 'focused', 'broad', 'primarily',
  'image-heavy', 'mainly', 'especially', 'particularly', 'known for',
  'emerging', 'limited ', 'expanding', 'across ',
];

function toTitleCase(str) {
  return str.replace(/\b([a-z])(\w*)/g, (_, first, rest) => first.toUpperCase() + rest);
}

function cleanItem(raw) {
  let s = raw.trim().replace(/[;.]+$/, '').trim();
  if (s.length < 2) return null;
  const lower = s.toLowerCase();
  if (QUALIFIER_STARTS.some(q => lower.startsWith(q))) return null;
  if (s.split(/\s+/).length > 5) return null;
  return toTitleCase(s);
}

function buildFallbackRows(rows, productNames) {
  const result = [];
  for (const row of rows) {
    const allValues = productNames.map(p => row[p] || '');
    const isListField = allValues.some(v => {
      if (v.toLowerCase().includes('unconfirmed')) return false;
      const parts = v.split(/[,;]/).map(s => s.trim()).filter(s => {
        if (s.length < 2) return false;
        return !QUALIFIER_STARTS.some(q => s.toLowerCase().startsWith(q));
      });
      return parts.length >= 2 && parts.every(p => p.length <= 40);
    });
    if (!isListField) continue;

    const allItems = new Map();
    allValues.forEach(v => {
      if (!v || v.toLowerCase().includes('unconfirmed')) return;
      v.split(/[,;]/).forEach(raw => {
        const c = cleanItem(raw);
        if (c && !allItems.has(c.toLowerCase())) allItems.set(c.toLowerCase(), c);
      });
    });

    for (const [lcItem, displayItem] of allItems) {
      const capRow = { Field: displayItem, _fieldGroup: row.Field };
      productNames.forEach(p => {
        const cell = row[p] || '';
        if (!cell || cell.toLowerCase().includes('unconfirmed')) {
          capRow[p] = 'unknown';
        } else {
          const cellItems = cell.split(/[,;]/).map(cleanItem).filter(Boolean);
          capRow[p] = cellItems.some(i => i.toLowerCase() === lcItem) ? 'yes' : 'no';
        }
      });
      result.push(capRow);
    }
  }
  return result;
}
// ─────────────────────────────────────────────────────────────────────────────

export default function SupportMatrix({ data }) {
  const [tooltip, setTooltip] = useState(null);

  if (!data?.columns || !data?.rows) return null;

  const productNames = data.columns.slice(1);

  // Prefer LLM-generated support_matrix (new analyses); fall back to parsed rows (old analyses)
  const hasLLMMatrix = Array.isArray(data.support_matrix) && data.support_matrix.length > 0;

  const rows = hasLLMMatrix
    ? data.support_matrix.map(e => ({ Field: e.capability, _fieldGroup: null, ...e }))
    : buildFallbackRows(data.rows, productNames);

  if (rows.length === 0) {
    return (
      <div className="py-12 text-center">
        <p className="text-sm text-gray-500 dark:text-slate-400">
          No feature-level capability data to compare for this analysis.
        </p>
        <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">
          Re-run the analysis to get an AI-generated Support Matrix, or switch to{' '}
          <strong>Feature Comparison</strong> for a full view.
        </p>
      </div>
    );
  }

  let lastGroup = null;

  return (
    <div className="overflow-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            <th className="sticky top-0 left-0 z-30 px-3 py-2 text-left text-xs font-semibold border-b border-r-2 border-gray-200 dark:border-slate-700 min-w-48 bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 whitespace-nowrap">
              Capability
            </th>
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
            const showGroupHeader = !hasLLMMatrix && row._fieldGroup && row._fieldGroup !== lastGroup;
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
                  <td className="sticky left-0 px-3 py-2 bg-white dark:bg-slate-900 border-r-2 border-gray-200 dark:border-slate-700 text-xs font-medium text-gray-700 dark:text-slate-300 z-10">
                    {row.Field}
                  </td>
                  {productNames.map(name => {
                    const rawValue = (row[name] || '').toLowerCase().trim();
                    const status = ['yes', 'partial', 'no'].includes(rawValue) ? rawValue : 'unknown';
                    const icon = ICONS[status];
                    const isActive = tooltip?.rowIndex === rowIndex && tooltip?.colName === name;

                    return (
                      <td key={name} className="px-3 py-2 text-center border-r border-gray-100 dark:border-slate-800">
                        <div className="relative group inline-block">
                          <button
                            className={`w-8 h-8 rounded-full flex items-center justify-center mx-auto text-sm font-bold transition-opacity cursor-pointer ${icon.classes} ${isActive ? 'ring-2 ring-sky-400' : 'hover:opacity-80'}`}
                            onClick={() => setTooltip(isActive ? null : { rowIndex, colName: name, status, field: row.Field })}
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
                              <p className="text-gray-300 leading-relaxed">{row.Field}</p>
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
        <div className="mt-3 p-3 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg text-xs max-w-xl flex items-start gap-3">
          <span className={`text-lg font-bold shrink-0 ${
            tooltip.status === 'yes' ? 'text-green-500' :
            tooltip.status === 'partial' ? 'text-yellow-500' :
            tooltip.status === 'no' ? 'text-red-500' : 'text-gray-400'
          }`}>{ICONS[tooltip.status].symbol}</span>
          <div>
            <p className="font-semibold text-gray-900 dark:text-white">{tooltip.field}</p>
            <p className="text-gray-500 dark:text-slate-400 mt-0.5">
              {tooltip.status === 'yes' && <><strong className="text-gray-700 dark:text-slate-200">{tooltip.colName}</strong> supports this capability.</>}
              {tooltip.status === 'partial' && <><strong className="text-gray-700 dark:text-slate-200">{tooltip.colName}</strong> has partial or limited support.</>}
              {tooltip.status === 'no' && <><strong className="text-gray-700 dark:text-slate-200">{tooltip.colName}</strong> does not support this capability.</>}
              {tooltip.status === 'unknown' && <>Support status for <strong className="text-gray-700 dark:text-slate-200">{tooltip.colName}</strong> is unconfirmed.</>}
            </p>
          </div>
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
