import React, { useState } from 'react';
import { X, CheckCircle, Mail } from 'lucide-react';
import api from '../lib/api.js';

const FREQUENCY_OPTIONS = [
  { label: 'Daily', cron: '0 9 * * *' },
  { label: 'Weekly (Mon 9am)', cron: '0 9 * * 1' },
  { label: 'Monthly (1st 9am)', cron: '0 9 1 * *' },
  { label: 'Custom', cron: '' },
];

export default function ScheduleForm({ analysisId, onSave, onClose }) {
  const [label, setLabel] = useState('');
  const [frequency, setFrequency] = useState(FREQUENCY_OPTIONS[1]);
  const [customCron, setCustomCron] = useState('');
  const [emailTo, setEmailTo] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(null);

  const handleSave = async () => {
    if (!label || !emailTo) return setError('Label and email are required');
    const cronExpr = frequency.label === 'Custom' ? customCron : frequency.cron;
    if (!cronExpr) return setError('Please enter a cron expression');

    setSaving(true);
    setError(null);
    try {
      const { data } = await api.post('/schedules', {
        label,
        analysis_template_id: analysisId,
        cron_expression: cronExpr,
        email_to: emailTo,
      });
      setSaved(true);
      // Close after showing success for 2.5s
      setTimeout(() => onSave?.(data), 2500);
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  if (saved) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-gray-900 dark:text-white font-semibold">Schedule Created</h3>
          {onClose && <button onClick={onClose}><X size={16} className="text-gray-400 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white" /></button>}
        </div>
        <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 space-y-2">
          <div className="flex items-center gap-2 text-green-600 dark:text-green-400 font-medium text-sm">
            <CheckCircle size={16} /> Schedule saved!
          </div>
          <div className="flex items-start gap-2 text-sm text-gray-700 dark:text-slate-300">
            <Mail size={14} className="mt-0.5 shrink-0 text-sky-500" />
            <span>
              First report is being generated and will be emailed to <strong>{emailTo}</strong> shortly.
              Future reports will follow the {frequency.label.toLowerCase()} schedule.
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-gray-900 dark:text-white font-semibold">Schedule This Analysis</h3>
        {onClose && <button onClick={onClose}><X size={16} className="text-gray-400 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white" /></button>}
      </div>

      <div>
        <label className="text-gray-500 dark:text-slate-400 text-xs mb-1 block">Schedule Label</label>
        <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Weekly DSP Monitor"
          className="w-full bg-gray-100 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-lg px-3 py-2 text-gray-900 dark:text-white text-sm outline-none focus:border-sky-500" />
      </div>

      <div>
        <label className="text-gray-500 dark:text-slate-400 text-xs mb-1 block">Frequency</label>
        <div className="grid grid-cols-2 gap-2">
          {FREQUENCY_OPTIONS.map(opt => (
            <button key={opt.label} onClick={() => setFrequency(opt)}
              className={`px-3 py-2 rounded-lg text-sm border ${frequency.label === opt.label ? 'border-sky-500 bg-sky-500/20 text-sky-600 dark:text-sky-300' : 'border-gray-300 dark:border-slate-700 bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 hover:border-gray-400 dark:hover:border-slate-600'}`}>
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {frequency.label === 'Custom' && (
        <div>
          <label className="text-gray-500 dark:text-slate-400 text-xs mb-1 block">Cron Expression</label>
          <input value={customCron} onChange={(e) => setCustomCron(e.target.value)} placeholder="0 9 * * 1"
            className="w-full bg-gray-100 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-lg px-3 py-2 text-gray-900 dark:text-white text-sm font-mono outline-none focus:border-sky-500" />
        </div>
      )}

      <div>
        <label className="text-gray-500 dark:text-slate-400 text-xs mb-1 block">Email Results To</label>
        <input value={emailTo} onChange={(e) => setEmailTo(e.target.value)} placeholder="you@company.com" type="email"
          className="w-full bg-gray-100 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-lg px-3 py-2 text-gray-900 dark:text-white text-sm outline-none focus:border-sky-500" />
      </div>

      {/* Immediate send notice */}
      {emailTo && (
        <div className="flex items-start gap-2 bg-sky-500/10 border border-sky-500/20 rounded-lg px-3 py-2.5">
          <Mail size={13} className="mt-0.5 shrink-0 text-sky-500" />
          <p className="text-xs text-sky-700 dark:text-sky-300">
            First report will be emailed to <strong>{emailTo}</strong> immediately after saving.
          </p>
        </div>
      )}

      {error && <p className="text-red-500 dark:text-red-400 text-xs">{error}</p>}

      <button onClick={handleSave} disabled={saving}
        className="w-full py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-sm font-medium disabled:opacity-50 transition-colors">
        {saving ? 'Saving & sending first report…' : 'Save Schedule & Send First Report'}
      </button>
    </div>
  );
}
