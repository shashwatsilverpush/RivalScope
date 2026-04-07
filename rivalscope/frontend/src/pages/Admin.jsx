import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, ChevronLeft, Users, Clock, Calendar } from 'lucide-react';
import api from '../lib/api.js';

export default function Admin() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null); // { user, tab: 'history'|'schedules', data }

  useEffect(() => {
    api.get('/admin/users')
      .then(r => setUsers(r.data))
      .catch(e => setError(e.response?.data?.error || 'Failed to load users'))
      .finally(() => setLoading(false));
  }, []);

  const openUser = async (user, tab = 'history') => {
    try {
      const r = await api.get(`/admin/users/${user.id}/${tab}`);
      setSelected({ user, tab, data: r.data });
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to load data');
    }
  };

  const switchTab = async (tab) => {
    if (!selected) return;
    try {
      const r = await api.get(`/admin/users/${selected.user.id}/${tab}`);
      setSelected(s => ({ ...s, tab, data: r.data }));
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to load data');
    }
  };

  if (loading) return <div className="flex items-center justify-center h-full text-gray-400 dark:text-slate-500">Loading…</div>;

  if (selected) {
    return (
      <div className="max-w-4xl mx-auto p-6 space-y-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSelected(null)}
            className="flex items-center gap-1 text-sm text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-white transition-colors"
          >
            <ChevronLeft size={16} /> All Users
          </button>
          <span className="text-gray-300 dark:text-slate-600">/</span>
          <span className="text-sm font-medium text-gray-800 dark:text-white">{selected.user.email}</span>
        </div>

        <div className="flex gap-2">
          {['history', 'schedules'].map(t => (
            <button
              key={t}
              onClick={() => switchTab(t)}
              className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-colors capitalize ${
                selected.tab === t
                  ? 'bg-sky-500/20 text-sky-600 dark:text-sky-400'
                  : 'text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800'
              }`}
            >
              {t === 'history' ? <span className="flex items-center gap-1"><Clock size={13} /> History</span>
                              : <span className="flex items-center gap-1"><Calendar size={13} /> Schedules</span>}
            </button>
          ))}
        </div>

        {selected.data.length === 0 ? (
          <p className="text-sm text-gray-400 dark:text-slate-500 py-8 text-center">No {selected.tab} found for this user.</p>
        ) : selected.tab === 'history' ? (
          <div className="space-y-2">
            {selected.data.map(a => (
              <Link
                key={a.id}
                to={`/results/${a.id}`}
                className="block bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl px-4 py-3 hover:border-sky-400 transition-colors"
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{a.title || 'Untitled'}</p>
                    <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">
                      {a.detected_category || a.scope || '—'} · {new Date(a.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${
                    a.status === 'done'
                      ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                      : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400'
                  }`}>{a.status || 'done'}</span>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {selected.data.map(s => (
              <div key={s.id} className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl px-4 py-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{s.label}</p>
                    <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">
                      {s.cron_expression} · to: {s.email_to}
                    </p>
                    {s.last_run_at && (
                      <p className="text-xs text-gray-400 dark:text-slate-500">Last run: {new Date(s.last_run_at).toLocaleString()}</p>
                    )}
                  </div>
                  <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${
                    s.enabled !== 0
                      ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                      : 'bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-400'
                  }`}>{s.enabled !== 0 ? 'Active' : 'Paused'}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-4">
      <div className="flex items-center gap-2">
        <Users size={20} className="text-sky-500" />
        <h1 className="text-lg font-semibold text-gray-900 dark:text-white">User Management</h1>
        <span className="text-xs text-gray-400 dark:text-slate-500 ml-auto">{users.length} user{users.length !== 1 ? 's' : ''}</span>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      {users.length === 0 ? (
        <p className="text-sm text-gray-400 dark:text-slate-500 py-8 text-center">No users yet.</p>
      ) : (
        <div className="space-y-2">
          {users.map(u => (
            <div
              key={u.id}
              className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl px-4 py-3"
            >
              <div className="flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{u.email}</p>
                  <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">
                    Joined {new Date(u.created_at).toLocaleDateString()} ·{' '}
                    {u.analysisCount} {u.analysisCount === 1 ? 'analysis' : 'analyses'} ·{' '}
                    {u.scheduleCount} {u.scheduleCount === 1 ? 'schedule' : 'schedules'}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => openUser(u, 'history')}
                    className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors"
                  >
                    <Clock size={12} /> History
                  </button>
                  <button
                    onClick={() => openUser(u, 'schedules')}
                    className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors"
                  >
                    <Calendar size={12} /> Schedules
                  </button>
                  <ChevronRight size={14} className="text-gray-300 dark:text-slate-600" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
