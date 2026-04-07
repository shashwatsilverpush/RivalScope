import React from 'react';
import { scoreCell } from '../lib/scoring.js';

function borderColor(score) {
  if (score >= 2) return 'border-l-green-500';
  if (score === 0) return 'border-l-red-400';
  return 'border-l-yellow-400';
}

export default function FeatureComparison({ data }) {
  if (!data?.columns || !data?.rows) return null;

  const productNames = data.columns.slice(1);

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            {productNames.map(name => (
              <th
                key={name}
                className="sticky top-0 px-3 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 dark:border-slate-700 bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 min-w-44 whitespace-nowrap"
              >
                {name}
              </th>
            ))}
            {/* Feature column — rightmost, sticky right */}
            <th className="sticky top-0 right-0 z-20 px-3 py-2 text-left text-xs font-semibold border-b border-l-2 border-gray-200 dark:border-slate-700 bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 min-w-44 whitespace-nowrap">
              Feature
            </th>
          </tr>
        </thead>
        <tbody>
          {data.rows.map((row, i) => (
            <tr key={i} className="border-b border-gray-100 dark:border-slate-800 hover:bg-gray-50 dark:hover:bg-slate-800/50">
              {productNames.map(name => {
                const cellValue = row[name] || '';
                const score = scoreCell(cellValue);
                return (
                  <td
                    key={name}
                    className={`px-3 py-2.5 border-r border-gray-100 dark:border-slate-800 border-l-4 ${borderColor(score)} align-top`}
                  >
                    <p className="text-xs text-gray-800 dark:text-slate-200 leading-relaxed">
                      {cellValue || <span className="italic text-gray-300 dark:text-slate-600">—</span>}
                    </p>
                  </td>
                );
              })}
              {/* Feature name — sticky right */}
              <td className="sticky right-0 px-3 py-2.5 bg-gray-50 dark:bg-slate-800 border-l-2 border-gray-200 dark:border-slate-700 align-top z-10">
                <span className="text-xs font-medium text-gray-600 dark:text-slate-400">{row.Field}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
