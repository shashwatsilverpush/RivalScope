import React, { useState, useEffect } from 'react';
import { CheckCircle, XCircle, RefreshCw, FlaskConical } from 'lucide-react';
import api from '../lib/api.js';

export default function QA() {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const runTests = async () => {
    setLoading(true);
    setReport(null);
    setError(null);
    try {
      const { data } = await api.get('/qa/run');
      setReport(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { runTests(); }, []);

  const allPassed = report && report.failed === 0;

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <FlaskConical className="text-sky-500" size={22} />
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">QA Test Suite</h1>
        </div>
        <button
          onClick={runTests}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white rounded-lg text-sm transition-colors"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          {loading ? 'Running…' : 'Re-run'}
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-sm">
          {error}
        </div>
      )}

      {report && (
        <>
          <div className={`mb-4 p-4 rounded-lg border ${allPassed ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'}`}>
            <p className={`text-lg font-semibold ${allPassed ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}`}>
              {report.passed} / {report.total} tests passed
              {report.failed > 0 && ` — ${report.failed} failing`}
            </p>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-lg overflow-hidden">
            {report.tests.map((t, i) => (
              <div
                key={i}
                className={`flex items-start gap-3 px-4 py-3 border-b last:border-0 border-gray-100 dark:border-slate-800 ${
                  t.status === 'fail' ? 'bg-red-50/50 dark:bg-red-900/10' : ''
                }`}
              >
                {t.status === 'pass'
                  ? <CheckCircle size={16} className="text-green-500 mt-0.5 shrink-0" />
                  : <XCircle size={16} className="text-red-500 mt-0.5 shrink-0" />
                }
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-800 dark:text-slate-200">{t.name}</p>
                  {t.status === 'fail' && (
                    <p className="text-xs text-red-500 dark:text-red-400 mt-0.5 font-mono break-all">{t.message}</p>
                  )}
                </div>
                <span className={`text-xs font-medium shrink-0 ${t.status === 'pass' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                  {t.status}
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      {loading && !report && (
        <div className="text-center text-gray-500 dark:text-slate-400 text-sm py-12">Running tests…</div>
      )}
    </div>
  );
}
