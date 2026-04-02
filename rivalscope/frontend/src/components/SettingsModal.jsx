import React, { useState, useEffect } from 'react';
import { X, Eye, EyeOff, CheckCircle } from 'lucide-react';
import api from '../lib/api.js';

const SENSITIVE_KEYS = ['CEREBRAS_API_KEY', 'SERPER_API_KEY', 'SMTP_PASS', 'CRUNCHBASE_API_KEY'];

const CONFIG_FIELDS = [
  { key: 'CEREBRAS_API_KEY', label: 'Cerebras API Key — required (free at cerebras.ai)' },
  { key: 'SERPER_API_KEY', label: 'Serper.dev API Key — optional (free at serper.dev)' },
  { key: 'CRUNCHBASE_API_KEY', label: 'Crunchbase API Key — optional (for Company Structure scope)' },
  { key: 'SMTP_HOST', label: 'SMTP Host — server only, e.g. smtp.gmail.com', type: 'text', placeholder: 'smtp.gmail.com' },
  { key: 'SMTP_PORT', label: 'SMTP Port (587 for TLS, 465 for SSL)', type: 'text' },
  { key: 'SMTP_USER', label: 'SMTP Username / Email', type: 'email' },
  { key: 'SMTP_PASS', label: 'SMTP Password / App Password' },
  { key: 'SMTP_FROM', label: 'From Email Address', type: 'email' },
];

const SESSION_KEY = 'rivalscope_settings';

export default function SettingsModal({ onClose }) {
  const [values, setValues] = useState({});
  const [configured, setConfigured] = useState({});
  const [showKeys, setShowKeys] = useState({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [stats, setStats] = useState(null);

  useEffect(() => {
    // Try sessionStorage first — avoids re-fetching within the same tab
    const cached = sessionStorage.getItem(SESSION_KEY);
    if (cached) {
      try {
        setValues(JSON.parse(cached));
      } catch {}
    }

    // Always fetch from backend to get configured status and fill in any new keys
    api.get('/config').then(({ data }) => {
      const cfg = {};
      const v = {};
      for (const [k, val] of Object.entries(data)) {
        cfg[k] = val.configured;
        // Use masked value from backend so user can see it's set; don't overwrite
        // something already in sessionStorage unless it was empty
        if (!cached || !JSON.parse(cached)[k]) {
          v[k] = val.value || '';
        }
      }
      setConfigured(cfg);
      if (!cached) {
        setValues(v);
        sessionStorage.setItem(SESSION_KEY, JSON.stringify(v));
      } else {
        // Merge configured status but keep session values
        setConfigured(cfg);
      }
    }).catch(() => {});

    api.get('/config/stats').then(({ data }) => setStats(data)).catch(() => {});
  }, []);

  const handleChange = (key, val) => {
    const next = { ...values, [key]: val };
    setValues(next);
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(next));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {};
      for (const [k, v] of Object.entries(values)) {
        if (!v) continue;
        // Skip if value is the unchanged masked version from the backend
        if (SENSITIVE_KEYS.includes(k) && v.startsWith('••••••••')) continue;
        payload[k] = v;
      }
      await api.post('/config', payload);
      // Mark newly saved keys as configured
      const newCfg = { ...configured };
      for (const k of Object.keys(payload)) newCfg[k] = true;
      setConfigured(newCfg);
      setSaved(true);
      setTimeout(() => { setSaved(false); onClose(); }, 1500);
    } catch (e) {
      console.error('Save failed:', e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl w-full max-w-md mx-4 shadow-2xl flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-6 pb-4 shrink-0">
          <h2 className="text-gray-900 dark:text-white font-semibold text-lg">Settings</h2>
          <button onClick={onClose}><X size={18} className="text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white" /></button>
        </div>

        <div className="overflow-y-auto flex-1 px-6 pb-2">
        <div className="space-y-4">
          {CONFIG_FIELDS.map((field) => {
          const { key, label, type } = field;
          return (
            <div key={key}>
              <div className="flex items-center justify-between mb-1">
                <label className="text-gray-500 dark:text-slate-400 text-xs">{label}</label>
                {configured[key] && (
                  <span className="flex items-center gap-1 text-green-500 text-xs">
                    <CheckCircle size={10} /> Configured
                  </span>
                )}
              </div>
              <div className="relative">
                <input
                  type={type || (showKeys[key] ? 'text' : 'password')}
                  value={values[key] || ''}
                  onChange={(e) => handleChange(key, e.target.value)}
                  placeholder={field.placeholder || `Enter ${label}`}
                  className="w-full bg-gray-100 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-lg px-3 py-2 text-gray-900 dark:text-white text-sm outline-none focus:border-sky-500 pr-10"
                />
                {type !== 'email' && type !== 'text' && (
                  <button
                    onClick={() => setShowKeys(s => ({ ...s, [key]: !s[key] }))}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white"
                  >
                    {showKeys[key] ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                )}
              </div>
            </div>
          );
          })}
        </div>

        {stats && (
          <div className="mt-4 p-3 bg-gray-100 dark:bg-slate-800 rounded-lg text-xs text-gray-500 dark:text-slate-400 space-y-1">
            <p className="font-medium text-gray-700 dark:text-slate-300 mb-2">System</p>
            <p>{stats.productsEnriched} products enriched</p>
            <p>{stats.searchResultsCached} search results cached</p>
            {stats.lastEnrichedAt && <p>Last enrichment: {new Date(stats.lastEnrichedAt).toLocaleDateString()}</p>}
          </div>
        )}
        </div>

        <div className="px-6 py-4 shrink-0 border-t border-gray-100 dark:border-slate-800">
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-sm font-medium disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
        >
          {saved ? <><CheckCircle size={14} /> Saved!</> : saving ? 'Saving...' : 'Save Settings'}
        </button>
        </div>
      </div>
    </div>
  );
}
