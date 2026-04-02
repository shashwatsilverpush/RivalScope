import React from 'react';
import { scoreProducts } from '../lib/scoring.js';

const MEDALS = ['🥇', '🥈', '🥉'];
const ORDINALS = ['1st', '2nd', '3rd'];

const POSITION_STYLES = [
  { border: 'border-yellow-400', badge: 'bg-yellow-400 text-yellow-900' },
  { border: 'border-gray-400', badge: 'bg-gray-400 text-gray-900' },
  { border: 'border-amber-600', badge: 'bg-amber-600 text-white' },
];

function ordinal(n) {
  if (n <= 3) return ORDINALS[n - 1];
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export default function ScoreCard({ result, products }) {
  if (!result?.columns || result.columns.length < 3 || !result.rows?.length) return null;

  const mainProducts = new Set(
    (products || []).filter(p => p.role === 'main')
      .flatMap(p => [p.identifier, p.resolved_name].filter(Boolean))
  );
  const ranked = scoreProducts(result.columns, result.rows, result.scope_weights || []);

  return (
    <div className="mb-4">
      <p className="text-xs text-gray-500 dark:text-slate-400 mb-2 font-medium">Overall Ranking</p>
      <div className="flex flex-wrap gap-3">
        {ranked.map(({ name, score, position, pct }) => {
          const style = POSITION_STYLES[position - 1] || { border: 'border-gray-300 dark:border-slate-600', badge: 'bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-slate-300' };
          const isMain = mainProducts.has(name);
          return (
            <div
              key={name}
              className={`flex-1 min-w-40 max-w-56 rounded-xl border-2 p-3 bg-white dark:bg-slate-900 ${style.border} ${isMain ? 'ring-2 ring-sky-400 ring-offset-1 dark:ring-offset-slate-900' : ''}`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${style.badge}`}>
                  {position <= 3 ? MEDALS[position - 1] : `#${position}`} {ordinal(position)}
                </span>
                {isMain && <span className="text-xs text-sky-500 font-medium">main</span>}
              </div>
              <p className="font-semibold text-gray-900 dark:text-white text-sm truncate mt-1" title={name}>{name}</p>
              <div className="mt-2 mb-1">
                <div className="w-full bg-gray-200 dark:bg-slate-700 rounded-full h-1.5">
                  <div
                    className="h-1.5 rounded-full bg-sky-500 transition-all duration-500"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
              <p className="text-xs text-gray-500 dark:text-slate-400">{pct}% · score {score}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
