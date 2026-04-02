import React, { useState } from 'react';
import { Plus } from 'lucide-react';

const SCOPE_CHIPS = [
  { label: 'Pricing & Commercial', value: 'Compare pricing models, minimum spend requirements, and commercial terms' },
  { label: 'Technical Integration', value: 'Compare API quality, SDK availability, integration complexity, and onboarding time' },
  { label: 'CTV/Video Capabilities', value: 'Compare CTV inventory access, SSAI support, VAST/VPAID versions, and video ad formats' },
  { label: 'Identity & Privacy', value: 'Compare identity solutions (UID2/ID5/RampID), cookieless readiness, and privacy compliance' },
  { label: 'Brand Safety & Measurement', value: 'Compare brand safety tools (IAS/DV/MOAT), viewability standards, fraud prevention, and measurement capabilities' },
  { label: 'Audience & Targeting', value: 'Compare first-party data capabilities, audience targeting options, lookalike modeling, and data partnerships' },
  { label: 'Reporting & Analytics', value: 'Compare reporting granularity, real-time dashboards, attribution models, and custom reporting APIs' },
  { label: 'Support & Onboarding', value: 'Compare customer support tiers, implementation timeline, SLA commitments, and account management quality' },
  { label: 'Company Structure', value: 'Compare headcount, founding date, total funding raised, last funding round, HQ location, and key investors' },
  { label: 'Full Analysis', value: 'Comprehensive analysis covering all key features, pricing, integrations, identity solutions, and competitive positioning' },
  { label: 'New Features & Launches', value: 'Compare recent product launches, new feature announcements, platform updates, roadmap items, and strategic initiatives from the past 12 months' },
];

function buildScope(selected, chips, customText) {
  const chipText = chips
    .filter(c => selected.has(c.label))
    .map(c => c.value)
    .join('\n');
  return [chipText, customText].filter(Boolean).join('\n').trim();
}

export default function ScopeInput({ value, onChange, initialScope = '' }) {
  const [selected, setSelected] = useState(new Set());
  const [weights, setWeights] = useState({});
  const [customText, setCustomText] = useState(initialScope);

  const totalWeight = Array.from(selected).reduce((sum, label) => sum + (weights[label] || 0), 0);
  const hasChips = selected.size > 0;
  const weightValid = !hasChips || totalWeight === 100;

  const toggleChip = (label) => {
    const next = new Set(selected);
    if (next.has(label)) {
      next.delete(label);
    } else {
      next.add(label);
      if (!weights[label]) {
        setWeights(w => ({ ...w, [label]: 0 }));
      }
    }
    setSelected(next);
    const scopeWeights = SCOPE_CHIPS
      .filter(c => next.has(c.label))
      .map(c => ({ field: c.label, weight: weights[c.label] || 0 }));
    onChange({ scope: buildScope(next, SCOPE_CHIPS, customText), scopeWeights });
  };

  const handleWeightChange = (label, val) => {
    const num = Math.max(0, Math.min(100, parseInt(val) || 0));
    const nextWeights = { ...weights, [label]: num };
    setWeights(nextWeights);
    const scopeWeights = SCOPE_CHIPS
      .filter(c => selected.has(c.label))
      .map(c => ({ field: c.label, weight: nextWeights[c.label] || 0 }));
    onChange({ scope: buildScope(selected, SCOPE_CHIPS, customText), scopeWeights });
  };

  const handleCustomText = (text) => {
    setCustomText(text);
    const scopeWeights = SCOPE_CHIPS
      .filter(c => selected.has(c.label))
      .map(c => ({ field: c.label, weight: weights[c.label] || 0 }));
    onChange({ scope: buildScope(selected, SCOPE_CHIPS, text), scopeWeights });
  };

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        {SCOPE_CHIPS.map((chip) => {
          const isSelected = selected.has(chip.label);
          return (
            <div key={chip.label} className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => toggleChip(chip.label)}
                className={`flex-1 min-w-0 text-left px-3 py-2 rounded-lg text-sm border transition-colors ${
                  isSelected
                    ? 'border-sky-500 bg-sky-500/10 text-sky-600 dark:text-sky-300'
                    : 'border-gray-300 dark:border-slate-700 bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400 hover:border-gray-400 dark:hover:border-slate-600 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                {chip.label}
              </button>
              {isSelected && (
                <div className="flex items-center gap-1 shrink-0">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={weights[chip.label] ?? ''}
                    onChange={e => handleWeightChange(chip.label, e.target.value)}
                    placeholder="0"
                    className={`w-14 text-center bg-gray-100 dark:bg-slate-800 border rounded-lg px-1.5 py-1.5 text-sm outline-none transition-colors ${
                      totalWeight === 100
                        ? 'border-green-500 text-green-600 dark:text-green-400'
                        : 'border-red-400 text-red-600 dark:text-red-400'
                    }`}
                  />
                  <span className="text-xs text-gray-400 dark:text-slate-500">%</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {hasChips && (
        <div className={`text-xs text-right font-medium ${weightValid ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>
          Total: {totalWeight} / 100{!weightValid && ' — weights must sum to 100'}
        </div>
      )}

      <textarea
        value={customText}
        onChange={(e) => handleCustomText(e.target.value)}
        placeholder={hasChips ? 'Optional: add custom notes or extra fields to compare…' : 'e.g. Compare CTV inventory access, minimum spend, identity solutions, and pricing transparency'}
        rows={hasChips ? 2 : 3}
        className="w-full bg-gray-100 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-lg px-3 py-2 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 text-sm outline-none focus:border-sky-500 transition-colors resize-y"
      />
    </div>
  );
}
