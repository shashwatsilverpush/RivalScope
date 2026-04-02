import React, { useState, useEffect } from 'react';
import { Play, Trash2, ToggleLeft, ToggleRight } from 'lucide-react';
import api from '../lib/api.js';

export default function Schedules() {
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [runningId, setRunningId] = useState(null);

  useEffect(() => {
    api.get('/schedules').then(({ data }) => {
      setSchedules(data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const handleToggle = async (schedule) => {
    const { data } = await api.put(`/schedules/${schedule.id}`, { enabled: !schedule.enabled });
    setSchedules(prev => prev.map(s => s.id === schedule.id ? data : s));
  };

  const handleRunNow = async (id) => {
    setRunningId(id);
    try {
      await api.post(`/schedules/${id}/run`);
      alert('Schedule triggered successfully');
    } catch (e) {
      alert('Run failed: ' + (e.response?.data?.error || e.message));
    } finally {
      setRunningId(null);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this schedule?')) return;
    await api.delete(`/schedules/${id}`);
    setSchedules(prev => prev.filter(s => s.id !== id));
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Schedules</h1>
      </div>

      {loading ? (
        <div className="text-gray-500 dark:text-slate-400">Loading...</div>
      ) : schedules.length === 0 ? (
        <div className="text-gray-400 dark:text-slate-500 text-center py-12">
          <p>No schedules yet.</p>
          <p className="text-sm mt-1">Open any analysis result and click "Schedule This" to set up recurring analysis.</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-slate-800">
                <th className="text-left px-4 py-3 text-gray-500 dark:text-slate-400 font-medium">Label</th>
                <th className="text-left px-4 py-3 text-gray-500 dark:text-slate-400 font-medium">Frequency</th>
                <th className="text-left px-4 py-3 text-gray-500 dark:text-slate-400 font-medium">Email</th>
                <th className="text-left px-4 py-3 text-gray-500 dark:text-slate-400 font-medium">Last Run</th>
                <th className="text-left px-4 py-3 text-gray-500 dark:text-slate-400 font-medium">Status</th>
                <th className="text-right px-4 py-3 text-gray-500 dark:text-slate-400 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {schedules.map(schedule => (
                <tr key={schedule.id} className="border-b border-gray-100 dark:border-slate-800 hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors">
                  <td className="px-4 py-3 text-gray-900 dark:text-white font-medium">{schedule.label}</td>
                  <td className="px-4 py-3 text-gray-500 dark:text-slate-400 font-mono text-xs">{schedule.cron_expression}</td>
                  <td className="px-4 py-3 text-gray-500 dark:text-slate-400">{schedule.email_to}</td>
                  <td className="px-4 py-3 text-gray-500 dark:text-slate-400">
                    {schedule.last_run_at ? new Date(schedule.last_run_at).toLocaleDateString() : 'Never'}
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => handleToggle(schedule)} className="flex items-center gap-1.5 text-xs">
                      {schedule.enabled ? (
                        <><ToggleRight size={16} className="text-green-500" /><span className="text-green-600 dark:text-green-400">Active</span></>
                      ) : (
                        <><ToggleLeft size={16} className="text-gray-400 dark:text-slate-500" /><span className="text-gray-400 dark:text-slate-500">Paused</span></>
                      )}
                    </button>
                    {schedule.last_error && (
                      <p className="text-red-500 dark:text-red-400 text-xs mt-1">Error: {schedule.last_error.slice(0, 40)}...</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleRunNow(schedule.id)}
                        disabled={runningId === schedule.id}
                        className="text-gray-400 dark:text-slate-400 hover:text-sky-600 dark:hover:text-sky-400 transition-colors disabled:opacity-50"
                        title="Run now"
                      >
                        <Play size={14} />
                      </button>
                      <button onClick={() => handleDelete(schedule.id)} className="text-gray-400 dark:text-slate-400 hover:text-red-500 dark:hover:text-red-400 transition-colors" title="Delete">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
