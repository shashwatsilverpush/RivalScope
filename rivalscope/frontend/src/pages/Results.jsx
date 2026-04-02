import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { RefreshCw, Calendar, Download, ArrowLeft } from 'lucide-react';
import api from '../lib/api.js';
import ResultsTable from '../components/ResultsTable.jsx';
import ScheduleForm from '../components/ScheduleForm.jsx';
import ScoreCard from '../components/ScoreCard.jsx';
import FeatureComparison from '../components/FeatureComparison.jsx';
import SupportMatrix from '../components/SupportMatrix.jsx';

const CATEGORY_COLORS = {
  DSP: 'bg-blue-500/20 text-blue-600 dark:text-blue-300',
  SSP: 'bg-purple-500/20 text-purple-600 dark:text-purple-300',
  AD_SERVER: 'bg-orange-500/20 text-orange-600 dark:text-orange-300',
  SSAI_CTV: 'bg-pink-500/20 text-pink-600 dark:text-pink-300',
  DMP_IDENTITY: 'bg-teal-500/20 text-teal-600 dark:text-teal-300',
  AD_QUALITY: 'bg-red-500/20 text-red-600 dark:text-red-300',
  CMP: 'bg-yellow-500/20 text-yellow-600 dark:text-yellow-300',
  RETARGETING: 'bg-green-500/20 text-green-600 dark:text-green-300',
  CONTEXTUAL_ADVERTISING: 'bg-violet-500/20 text-violet-600 dark:text-violet-300',
  CREATIVE_TECH: 'bg-fuchsia-500/20 text-fuchsia-600 dark:text-fuchsia-300',
  ATTRIBUTION_MEASUREMENT: 'bg-cyan-500/20 text-cyan-600 dark:text-cyan-300',
  NATIVE_ADVERTISING: 'bg-lime-500/20 text-lime-600 dark:text-lime-300',
  BRAND_SAFETY: 'bg-rose-500/20 text-rose-600 dark:text-rose-300',
  PROGRAMMATIC_AUDIO: 'bg-indigo-500/20 text-indigo-600 dark:text-indigo-300',
  MOBILE_DSP: 'bg-sky-500/20 text-sky-600 dark:text-sky-300',
  PUBLISHER_MONETIZATION: 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-300',
  DATA_MARKETPLACE: 'bg-amber-500/20 text-amber-600 dark:text-amber-300',
  RETAIL_MEDIA: 'bg-orange-500/20 text-orange-600 dark:text-orange-300',
  INFLUENCER_CREATOR: 'bg-pink-500/20 text-pink-600 dark:text-pink-300',
  GENERAL: 'bg-gray-200 dark:bg-slate-500/20 text-gray-600 dark:text-slate-300',
};

const TABS = [
  { key: 'matrix', label: 'Comparison Matrix' },
  { key: 'features', label: 'Feature Comparison' },
  { key: 'support', label: 'Support Matrix' },
];

export default function Results() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [analysis, setAnalysis] = useState(null);
  const [diff, setDiff] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showSchedule, setShowSchedule] = useState(false);
  const [activeTab, setActiveTab] = useState('matrix');

  const compareId = searchParams.get('compareId');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data } = await api.get(`/analysis/${id}`);
        setAnalysis(data);
        if (compareId) {
          const { data: diffData } = await api.get(`/analysis/${id}/compare/${compareId}`);
          setDiff(diffData);
        } else {
          setDiff(null);
        }
      } catch (e) {
        console.error('Failed to load analysis:', e);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id, compareId]);

  const exportCsv = () => {
    if (!analysis?.result_csv) return;
    const blob = new Blob([analysis.result_csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rivalscope-${id}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <div className="p-6 text-gray-500 dark:text-slate-400">Loading...</div>;
  if (!analysis) return <div className="p-6 text-red-500 dark:text-red-400">Analysis not found</div>;

  const result = analysis.result;
  const category = analysis.detected_category || result?.category || 'GENERAL';
  const hasMultipleProducts = result?.columns?.length >= 3;

  return (
    <div className="flex h-full">
      <div className="flex-1 overflow-auto p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-4 gap-4">
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{analysis.title}</h1>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <span className={`text-xs px-2 py-0.5 rounded-full ${CATEGORY_COLORS[category] || CATEGORY_COLORS.GENERAL}`}>
                {category}
              </span>
              {analysis.products?.map(p => (p.known_roles || []).length > 1 && (
                <span key={p.identifier} className="flex items-center gap-1">
                  <span className="text-xs text-gray-400 dark:text-slate-500">{p.resolved_name || p.identifier}:</span>
                  {p.known_roles.map(role => (
                    <span key={role} className="text-xs px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-mono">{role}</span>
                  ))}
                </span>
              ))}
              <span className="text-gray-400 dark:text-slate-500 text-xs">
                {new Date(analysis.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
              </span>
              {result?.data_confidence && (
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  result.data_confidence === 'high' ? 'bg-green-500/20 text-green-600 dark:text-green-300' :
                  result.data_confidence === 'medium' ? 'bg-yellow-500/20 text-yellow-600 dark:text-yellow-300' :
                  'bg-red-500/20 text-red-600 dark:text-red-300'
                }`}>
                  {result.data_confidence} confidence
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={() => navigate('/')} className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 rounded-lg text-gray-700 dark:text-slate-300 text-sm transition-colors whitespace-nowrap">
              <ArrowLeft size={14} /> Back
            </button>
            <button onClick={() => navigate('/', { state: { products: analysis.products, scope: analysis.scope } })} className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 rounded-lg text-gray-700 dark:text-slate-300 text-sm transition-colors whitespace-nowrap">
              <RefreshCw size={14} /> Re-run
            </button>
            <button onClick={() => setShowSchedule(!showSchedule)} className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 rounded-lg text-gray-700 dark:text-slate-300 text-sm transition-colors whitespace-nowrap">
              <Calendar size={14} /> Schedule
            </button>
            <button onClick={exportCsv} className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 rounded-lg text-gray-700 dark:text-slate-300 text-sm transition-colors whitespace-nowrap">
              <Download size={14} /> Export CSV
            </button>
          </div>
        </div>

        {/* Summary */}
        {result?.summary && (
          <div className="bg-gray-50 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-700 rounded-lg p-4 mb-4">
            <p className="text-gray-700 dark:text-slate-300 text-sm">{result.summary}</p>
            <p className="text-gray-400 dark:text-slate-500 text-xs mt-2">Generated by Cerebras · SearXNG</p>
          </div>
        )}

        {result ? (
          <>
            {/* ScoreCard — only when 2+ products */}
            {hasMultipleProducts && (
              <ScoreCard result={result} products={analysis.products} />
            )}

            {/* Tab bar */}
            <div className="flex gap-1 mb-3 border-b border-gray-200 dark:border-slate-700">
              {TABS.map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
                    activeTab === tab.key
                      ? 'border-sky-500 text-sky-600 dark:text-sky-400'
                      : 'border-transparent text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-lg overflow-hidden p-1">
              {activeTab === 'matrix' && (
                <ResultsTable data={result} products={analysis.products} diff={diff} />
              )}
              {activeTab === 'features' && (
                <div className="p-3">
                  <FeatureComparison data={result} />
                </div>
              )}
              {activeTab === 'support' && (
                <div className="p-3">
                  <SupportMatrix data={result} />
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="text-gray-500 dark:text-slate-400 text-sm p-4">
            {analysis.status === 'error' ? `Error: ${analysis.error_message}` : 'No results yet'}
          </div>
        )}
      </div>

      {/* Schedule side panel */}
      {showSchedule && (
        <div className="w-72 border-l border-gray-200 dark:border-slate-800 p-4 bg-white dark:bg-slate-900">
          <ScheduleForm
            analysisId={parseInt(id)}
            onSave={() => setShowSchedule(false)}
            onClose={() => setShowSchedule(false)}
          />
        </div>
      )}
    </div>
  );
}
