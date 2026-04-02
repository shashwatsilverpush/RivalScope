import React, { useState } from 'react';

export default function DiffBadge({ diff, value }) {
  const [showTooltip, setShowTooltip] = useState(false);
  if (!diff || diff.status === 'same') return <span>{value}</span>;

  if (diff.status === 'new') {
    return (
      <span className="inline-flex items-center gap-1">
        <span>{value}</span>
        <span className="text-xs bg-green-500/20 text-green-600 dark:text-green-400 px-1 rounded">NEW</span>
      </span>
    );
  }

  if (diff.status === 'removed') {
    return <span className="text-red-500 dark:text-red-400 line-through opacity-60">{value}</span>;
  }

  if (diff.status === 'changed') {
    return (
      <div className="relative">
        <button
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
          className="text-left"
        >
          <span>{diff.new}</span>
          <span className="ml-1 text-xs bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 px-1 rounded">CHANGED</span>
        </button>
        {showTooltip && (
          <div className="absolute z-50 bottom-full left-0 mb-1 bg-gray-200 dark:bg-slate-700 rounded-lg p-2 shadow-xl min-w-48 text-xs">
            <p className="text-gray-500 dark:text-slate-400 mb-1">Previous:</p>
            <p className="text-gray-700 dark:text-slate-300 line-through">{diff.old}</p>
          </div>
        )}
      </div>
    );
  }

  return <span>{value}</span>;
}
