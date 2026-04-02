import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { RefreshCw, Trash2, Search } from 'lucide-react';
import api from '../lib/api.js';

const STATUS_BADGES = {
  done: 'bg-green-500/20 text-green-600 dark:text-green-400',
  running: 'bg-yellow-500/20 text-yellow-600 dark:text-yellow-400',
  error: 'bg-red-500/20 text-red-600 dark:text-red-400',
  pending: 'bg-gray-200 dark:bg-slate-500/20 text-gray-500 dark:text-slate-400',
};

export default function History() {
  const navigate = useNavigate();
  const [analyses, setAnalyses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    api.get('/analysis/history').then(({ data }) => {
      setAnalyses(data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const handleDelete = async (e, id) => {
    e.stopPropagation();
    if (!confirm('Delete this analysis?')) return;
    await api.delete(`/analysis/${id}`);
    setAnalyses(prev => prev.filter(a => a.id !== id));
  };

  const filtered = analyses.filter(a => {
    const q = search.toLowerCase();
    return (
      a.title?.toLowerCase().includes(q) ||
      a.products?.some(p => p.identifier?.toLowerCase().includes(q)) ||
      a.detected_category?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">History</h1>
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search analyses..."
            className="bg-gray-100 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-lg pl-8 pr-3 py-2 text-gray-900 dark:text-white text-sm outline-none focus:border-sky-500 w-64"
          />
        </div>
      </div>

      {loading ? (
        <div className="text-gray-500 dark:text-slate-400">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="text-gray-400 dark:text-slate-500 text-center py-12">
          {search ? 'No results match your search' : 'No analyses yet. Run your first analysis!'}
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-slate-800">
                <th className="text-left px-4 py-3 text-gray-500 dark:text-slate-400 font-medium">Title</th>
                <th className="text-left px-4 py-3 text-gray-500 dark:text-slate-400 font-medium">Category</th>
                <th className="text-left px-4 py-3 text-gray-500 dark:text-slate-400 font-medium">Products</th>
                <th className="text-left px-4 py-3 text-gray-500 dark:text-slate-400 font-medium">Date</th>
                <th className="text-left px-4 py-3 text-gray-500 dark:text-slate-400 font-medium">Status</th>
                <th className="text-right px-4 py-3 text-gray-500 dark:text-slate-400 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(analysis => (
                <tr
                  key={analysis.id}
                  onClick={() => navigate(`/results/${analysis.id}`)}
                  className="border-b border-gray-100 dark:border-slate-800 hover:bg-gray-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3 text-gray-900 dark:text-white font-medium">{analysis.title || `Analysis #${analysis.id}`}</td>
                  <td className="px-4 py-3">
                    {analysis.detected_category && (
                      <span className="text-xs bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-300 px-2 py-0.5 rounded">{analysis.detected_category}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {(analysis.products || []).slice(0, 3).map((p, i) => (
                        <span key={i} className="text-xs bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-300 px-2 py-0.5 rounded">{p.identifier}</span>
                      ))}
                      {(analysis.products || []).length > 3 && (
                        <span className="text-xs text-gray-400 dark:text-slate-500">+{analysis.products.length - 3} more</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-500 dark:text-slate-400">{new Date(analysis.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_BADGES[analysis.status] || STATUS_BADGES.pending}`}>
                      {analysis.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2" onClick={e => e.stopPropagation()}>
                      <button onClick={() => navigate('/', { state: { products: analysis.products, scope: analysis.scope } })} className="text-gray-400 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white transition-colors" title="Re-run">
                        <RefreshCw size={14} />
                      </button>
                      <button onClick={(e) => handleDelete(e, analysis.id)} className="text-gray-400 dark:text-slate-400 hover:text-red-500 dark:hover:text-red-400 transition-colors" title="Delete">
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
