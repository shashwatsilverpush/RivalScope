import React, { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { scoreCell } from '../lib/scoring.js';

function Section({ icon, title, items, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-gray-200 dark:border-slate-700 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-2.5 bg-gray-50 dark:bg-slate-800 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors text-left"
      >
        <span className="font-semibold text-sm text-gray-800 dark:text-slate-200">
          {icon} {title}
          <span className="ml-2 text-xs font-normal text-gray-400 dark:text-slate-500">({items.length})</span>
        </span>
        {open ? <ChevronDown size={14} className="text-gray-400" /> : <ChevronRight size={14} className="text-gray-400" />}
      </button>
      {open && (
        <ul className="divide-y divide-gray-100 dark:divide-slate-800">
          {items.map((item, i) => (
            <li key={i} className="px-4 py-2.5 flex gap-3 items-start">
              <span className="text-gray-400 dark:text-slate-500 text-xs mt-0.5 shrink-0">•</span>
              <div>
                <span className="font-medium text-xs text-gray-900 dark:text-slate-100">{item.field}</span>
                {item.detail && (
                  <span className="text-xs text-gray-500 dark:text-slate-400 ml-1">— {item.detail}</span>
                )}
              </div>
            </li>
          ))}
          {items.length === 0 && (
            <li className="px-4 py-2.5 text-xs text-gray-400 dark:text-slate-500 italic">None identified</li>
          )}
        </ul>
      )}
    </div>
  );
}

export default function CompetitiveLandscape({ result, products }) {
  if (!result?.columns || !result?.rows || !products?.length) return null;

  // Find main product column name
  const mainProduct = products.find(p => p.role === 'main');
  const mainName = mainProduct?.resolved_name || mainProduct?.identifier;
  if (!mainName) return null;

  // Find the matching column name (may differ slightly in casing/spacing)
  const mainCol = result.columns.find(c =>
    c && c.toLowerCase().replace(/\s+/g, '') === mainName.toLowerCase().replace(/\s+/g, '')
  ) || result.columns.find(c => c !== 'Field' && result.columns.indexOf(c) > 0 &&
    products.find(p => p.role === 'main' && (p.resolved_name === c || p.identifier === c))
  ) || result.columns[1]; // fallback to first product column

  const competitorCols = result.columns.filter(c => c !== 'Field' && c !== mainCol);

  const strengths = [];
  const gaps = [];
  const researchNeeded = [];

  for (const row of result.rows) {
    const field = row.Field;
    if (!field) continue;

    const mainVal = row[mainCol] || '';
    const mainScore = scoreCell(mainVal);
    const mainIsUnconfirmed = !mainVal || mainVal.toLowerCase().includes('unconfirmed');

    // Research needed: main product is unconfirmed
    if (mainIsUnconfirmed) {
      const allUnconfirmed = competitorCols.every(c => {
        const v = (row[c] || '').toLowerCase();
        return !v || v.includes('unconfirmed');
      });
      researchNeeded.push({
        field,
        detail: allUnconfirmed ? 'Unconfirmed for all products' : 'Unconfirmed for your product',
      });
      continue;
    }

    // Find best competitor
    const competitorScores = competitorCols.map(c => ({ col: c, score: scoreCell(row[c] || ''), val: row[c] || '' }));
    const bestCompetitor = competitorScores.sort((a, b) => b.score - a.score)[0];

    if (!bestCompetitor) continue;

    if (mainScore > bestCompetitor.score) {
      // Strength: main leads all competitors
      const allBeaten = competitorCols.every(c => scoreCell(row[c] || '') <= mainScore);
      if (allBeaten) {
        strengths.push({
          field,
          detail: mainVal,
          margin: mainScore - bestCompetitor.score,
        });
      }
    } else if (bestCompetitor.score > mainScore) {
      // Gap: at least one competitor leads
      const detail = bestCompetitor.val && !bestCompetitor.val.toLowerCase().includes('unconfirmed')
        ? `${bestCompetitor.col}: ${bestCompetitor.val}`
        : `${bestCompetitor.col} leads`;
      gaps.push({
        field,
        detail,
        margin: bestCompetitor.score - mainScore,
      });
    }
  }

  // Sort by margin and take top entries
  strengths.sort((a, b) => b.margin - a.margin);
  gaps.sort((a, b) => b.margin - a.margin);

  return (
    <div className="mb-5 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
      {/* Header */}
      <div className="px-5 py-3.5 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between">
        <div>
          <h2 className="font-bold text-base text-gray-900 dark:text-white">Competitive Landscape</h2>
          <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
            How <span className="font-semibold text-sky-600 dark:text-sky-400">{mainCol}</span> compares vs{' '}
            {competitorCols.join(', ')}
          </p>
        </div>
      </div>

      {/* Summary */}
      {result.summary && (
        <div className="px-5 py-3 bg-gray-50 dark:bg-slate-800/50 border-b border-gray-200 dark:border-slate-700">
          <p className="text-sm text-gray-700 dark:text-slate-300 italic leading-relaxed">{result.summary}</p>
        </div>
      )}

      {/* Sections */}
      <div className="p-4 bg-white dark:bg-slate-900 flex flex-col gap-3">
        <Section
          icon="✅"
          title={`Strengths — ${mainCol} leads`}
          items={strengths}
          defaultOpen={true}
        />
        <Section
          icon="⚠️"
          title="Gaps vs competitors"
          items={gaps}
          defaultOpen={true}
        />
        <Section
          icon="🔍"
          title="Research needed"
          items={researchNeeded}
          defaultOpen={false}
        />

        {/* Company data from Crunchbase */}
        {result.company_data && Object.keys(result.company_data).length > 0 && (
          <CompanyDataSection companyData={result.company_data} />
        )}
      </div>
    </div>
  );
}

function CompanyDataSection({ companyData }) {
  const [open, setOpen] = useState(true);
  const entries = Object.entries(companyData);
  const FIELDS = [
    { key: 'headcount', label: 'Employees' },
    { key: 'founded', label: 'Founded' },
    { key: 'total_funding', label: 'Total Funding' },
    { key: 'last_round', label: 'Last Round' },
    { key: 'hq', label: 'HQ' },
  ];

  return (
    <div className="border border-gray-200 dark:border-slate-700 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-2.5 bg-gray-50 dark:bg-slate-800 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors text-left"
      >
        <span className="font-semibold text-sm text-gray-800 dark:text-slate-200">
          🏢 Company Data <span className="ml-1 text-xs font-normal text-gray-400 dark:text-slate-500">via Crunchbase</span>
        </span>
        {open ? <ChevronDown size={14} className="text-gray-400" /> : <ChevronRight size={14} className="text-gray-400" />}
      </button>
      {open && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-gray-50 dark:bg-slate-800/50">
                <th className="px-3 py-2 text-left font-semibold text-gray-500 dark:text-slate-400 border-b border-gray-200 dark:border-slate-700">Field</th>
                {entries.map(([name]) => (
                  <th key={name} className="px-3 py-2 text-left font-semibold text-gray-700 dark:text-slate-300 border-b border-gray-200 dark:border-slate-700 whitespace-nowrap">{name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {FIELDS.map(({ key, label }) => (
                <tr key={key} className="border-b border-gray-100 dark:border-slate-800">
                  <td className="px-3 py-2 font-medium text-gray-500 dark:text-slate-400">{label}</td>
                  {entries.map(([name, data]) => (
                    <td key={name} className="px-3 py-2 text-gray-700 dark:text-slate-300">
                      {data[key] || <span className="italic text-gray-300 dark:text-slate-600">—</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
