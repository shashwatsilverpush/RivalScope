import React from 'react';
import { scoreCell } from '../lib/scoring.js';

function borderColor(score) {
  if (score >= 2) return 'border-l-green-500';
  if (score === 0) return 'border-l-red-400';
  return 'border-l-yellow-400';
}

function getTypeLabel(colName, products) {
  if (!products?.length) return null;
  const product = products.find(p => {
    const rn = (p.resolved_name || '').toLowerCase();
    const id = (p.identifier || '').toLowerCase();
    const cn = colName.toLowerCase();
    return rn === cn || id === cn || rn.includes(cn) || cn.includes(rn) || id.includes(cn) || cn.includes(id);
  });
  if (!product) return null;
  const role = product.known_roles?.[0];
  if (!role || role === 'GENERAL') return 'Company';
  return role.replace(/_/g, ' ');
}

export default function FeatureComparison({ data, products }) {
  if (!data?.columns || !data?.rows) return null;

  const productNames = data.columns.slice(1);

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            {/* Feature column — sticky left */}
            <th className="sticky top-0 left-0 z-30 px-3 py-2 text-left text-xs font-semibold border-b border-r-2 border-gray-200 dark:border-slate-700 bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 min-w-44 whitespace-nowrap">
              Feature
            </th>
            {/* Product columns */}
            {productNames.map(name => {
              const typeLabel = getTypeLabel(name, products);
              return (
                <th
                  key={name}
                  className="sticky top-0 px-3 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 dark:border-slate-700 bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 min-w-44 whitespace-nowrap"
                >
                  <div className="flex flex-col gap-0.5">
                    <span>{name}</span>
                    {typeLabel && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 font-mono w-fit">
                        {typeLabel}
                      </span>
                    )}
                  </div>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {data.rows.map((row, i) => (
            <tr key={i} className="border-b border-gray-100 dark:border-slate-800 hover:bg-gray-50 dark:hover:bg-slate-800/50">
              {/* Feature name — sticky left */}
              <td className="sticky left-0 px-3 py-2.5 bg-gray-50 dark:bg-slate-800 border-r-2 border-gray-200 dark:border-slate-700 align-top z-10">
                <span className="text-xs font-medium text-gray-600 dark:text-slate-400">{row.Field}</span>
              </td>
              {/* Product value cells */}
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
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
