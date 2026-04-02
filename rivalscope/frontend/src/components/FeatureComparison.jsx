import React from 'react';
import { scoreCell } from '../lib/scoring.js';

function CellBorder({ score }) {
  if (score >= 2) return 'border-l-green-500';
  if (score === 0) return 'border-l-red-400';
  return 'border-l-yellow-400';
}

export default function FeatureComparison({ data }) {
  if (!data?.columns || !data?.rows) return null;

  const productNames = data.columns.slice(1);

  return (
    <div className="overflow-x-auto">
      <div className="flex gap-4 min-w-max p-1">
        {productNames.map(name => {
          return (
            <div
              key={name}
              className="w-64 shrink-0 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden"
            >
              {/* Header */}
              <div className="px-4 py-3 border-b border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-800">
                <p className="font-semibold text-sm text-gray-900 dark:text-white">{name}</p>
              </div>

              {/* Feature rows */}
              <div className="divide-y divide-gray-100 dark:divide-slate-800">
                {data.rows.map((row, i) => {
                  const cellValue = row[name] || '';
                  const score = scoreCell(cellValue);
                  const borderColor = CellBorder({ score });
                  return (
                    <div key={i} className={`px-3 py-2.5 border-l-4 ${borderColor}`}>
                      <p className="text-xs text-gray-400 dark:text-slate-500 mb-0.5">{row.Field}</p>
                      <p className="text-xs text-gray-800 dark:text-slate-200 leading-relaxed">
                        {cellValue || <span className="italic text-gray-300 dark:text-slate-600">—</span>}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
