import React, { useState, useRef } from 'react';
import { Download, Play, X } from 'lucide-react';
import api from '../lib/api.js';

// Pre-populated AdTech company list from user's dataset
const ADTECH_COMPANIES = [
  "The Trade Desk","PubMatic","Magnite","InMobi","Criteo","LiveRamp","DoubleVerify","Integral Ad Science",
  "Innovid","MNTN","Simpli.fi","Basis Technologies","Zeta Global","Mediaocean","Samba TV","Comscore",
  "Nielsen","Kantar","GumGum","Seedtag","Cognitiv","Audigent","LiveIntent","Lotame","Eyeota",
  "Viant Technology","Tremor International","Digital Turbine","ironSource","AppLovin","Unity Technologies",
  "Moloco","Liftoff","Jampp","Remerge","Adjust","AppsFlyer","Branch","Singular","Kochava","Airbridge",
  "Smartly.io","Flashtalking","Celtra","Jivox","Clinch","Sizmek","Innovid","Extreme Reach",
  "SpotX","Beachfront","Unruly","Outbrain","Taboola","Sharethrough","TripleLift","Teads","Nativo",
  "Conversant","Epsilon","Merkle","Neustar","TransUnion","Experian Marketing Services","Acxiom",
  "Oracle Data Cloud","Salesforce DMP","Adobe Audience Manager","Tealium","mParticle","Segment",
  "Lytics","BlueConic","Amperity","ActionIQ","Simon Data","Treasure Data","Redpoint Global",
  "Rokt","Criteo","CitrusAd","Quotient Technology","Bazaarvoice","PowerReviews","Yotpo",
  "Attain","Cardlytics","Affinity","Throtle","LiveRamp","InfoSum","Habu","Optable","Snowflake",
  "Amazon DSP","Google DV360","Yahoo DSP","Microsoft Invest","MediaMath","Xandr","OpenX",
  "Equativ","Smart AdServer","Index Exchange","Rubicon Project","AppNexus","33Across","Sovrn",
  "Raptive","Freestar","AdThrive","Mediavine","Playwire","Newor Media","Assertive Yield",
  "Pixalate","White Ops (HUMAN)","Protected Media","GeoEdge","Confiant","The Media Trust",
  "Moat (Oracle)","Peer39","ContextWeb","Grapeshot","Zefr","OpenSlate","Veritone",
  "Perion","Digital Media Solutions","Undertone","YuMe","RhythmOne","Tremor Video",
  "SpotX","FreeWheel","Operative","WideOrbit","Adstream","Extreme Reach","Comcast Technology Solutions",
  "Innovid","Brightcove","JW Player","Ooyala","Kaltura","Phenixd","Wurl","Frequency",
  "TVREV","Xumo","Plex","Philo","FuboTV","Sling","Hulu","Peacock","Paramount+","Max"
];

function escapeCsvCell(value) {
  if (value == null) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function rowToCsv(row) {
  return [
    row.name, row.headcount, row.founded, row.total_funding, row.last_round, row.hq
  ].map(escapeCsvCell).join(',');
}

export default function CompanyEnrich() {
  const [companies, setCompanies] = useState(ADTECH_COMPANIES.join('\n'));
  const [results, setResults] = useState([]);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState(null);
  const abortRef = useRef(false);

  const companyList = companies.split('\n').map(s => s.trim()).filter(Boolean);

  const runEnrich = async () => {
    setRunning(true);
    setResults([]);
    setProgress(null);
    setError(null);
    abortRef.current = false;

    try {
      const response = await fetch('/api/competitors/bulk-enrich', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companies: companyList }),
        credentials: 'include',
      });

      if (!response.ok) {
        const err = await response.json();
        setError(err.error || 'Request failed');
        setRunning(false);
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        if (abortRef.current) break;
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop(); // keep incomplete last line
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const obj = JSON.parse(line);
            setProgress(obj._progress || null);
            setResults(prev => [...prev, obj]);
          } catch {}
        }
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setRunning(false);
    }
  };

  const downloadCsv = () => {
    const header = 'Company,Headcount,Founded,Total Funding,Last Round,HQ';
    const rows = results.map(rowToCsv);
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'adtech-companies-enriched.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const filled = results.filter(r => r.hq || r.founded || r.total_funding).length;

  return (
    <div className="flex h-full">
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-6xl mx-auto">
          <div className="mb-5">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Company Enrichment</h1>
            <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
              Fetch headcount, founding year, total funding, and HQ from Crunchbase for a list of companies.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Left: company list editor */}
            <div className="lg:col-span-1">
              <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between">
                  <span className="font-semibold text-sm text-gray-900 dark:text-white">
                    Companies <span className="font-normal text-gray-400 dark:text-slate-500">({companyList.length})</span>
                  </span>
                  <button
                    onClick={() => setCompanies('')}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-300"
                    title="Clear list"
                  >
                    <X size={14} />
                  </button>
                </div>
                <textarea
                  value={companies}
                  onChange={e => setCompanies(e.target.value)}
                  disabled={running}
                  placeholder="One company per line..."
                  className="w-full h-64 p-3 text-xs font-mono bg-transparent text-gray-700 dark:text-slate-300 resize-none outline-none"
                />
                <div className="px-4 py-3 border-t border-gray-200 dark:border-slate-700">
                  <button
                    onClick={runEnrich}
                    disabled={running || companyList.length === 0}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    <Play size={14} />
                    {running
                      ? progress
                        ? `Enriching… ${progress.completed}/${progress.total}`
                        : 'Starting…'
                      : `Enrich ${companyList.length} companies`}
                  </button>
                </div>
              </div>

              {error && (
                <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-xs text-red-600 dark:text-red-400">
                  {error}
                </div>
              )}
            </div>

            {/* Right: results table */}
            <div className="lg:col-span-2">
              {results.length > 0 && (
                <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between">
                    <span className="font-semibold text-sm text-gray-900 dark:text-white">
                      Results
                      <span className="ml-2 text-xs font-normal text-gray-400 dark:text-slate-500">
                        {results.length} fetched · {filled} with data
                      </span>
                    </span>
                    <button
                      onClick={downloadCsv}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 rounded-lg text-xs text-gray-700 dark:text-slate-300 transition-colors"
                    >
                      <Download size={13} /> Export CSV
                    </button>
                  </div>
                  <div className="overflow-auto max-h-[calc(100vh-280px)]">
                    <table className="w-full text-xs border-collapse">
                      <thead>
                        <tr className="bg-gray-50 dark:bg-slate-800">
                          {['Company', 'Headcount', 'Founded', 'Total Funding', 'Last Round', 'HQ'].map(h => (
                            <th key={h} className="px-3 py-2 text-left font-semibold text-gray-600 dark:text-slate-300 border-b border-gray-200 dark:border-slate-700 whitespace-nowrap">
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {results.map((r, i) => (
                          <tr key={i} className="border-b border-gray-100 dark:border-slate-800 hover:bg-gray-50 dark:hover:bg-slate-800/50">
                            <td className="px-3 py-2 font-medium text-gray-900 dark:text-white whitespace-nowrap">{r.name}</td>
                            <td className="px-3 py-2 text-gray-600 dark:text-slate-400">{r.headcount || <span className="text-gray-300 dark:text-slate-600 italic">—</span>}</td>
                            <td className="px-3 py-2 text-gray-600 dark:text-slate-400">{r.founded || <span className="text-gray-300 dark:text-slate-600 italic">—</span>}</td>
                            <td className="px-3 py-2 text-gray-600 dark:text-slate-400">{r.total_funding || <span className="text-gray-300 dark:text-slate-600 italic">—</span>}</td>
                            <td className="px-3 py-2 text-gray-600 dark:text-slate-400">{r.last_round || <span className="text-gray-300 dark:text-slate-600 italic">—</span>}</td>
                            <td className="px-3 py-2 text-gray-600 dark:text-slate-400">{r.hq || <span className="text-gray-300 dark:text-slate-600 italic">—</span>}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {!running && results.length === 0 && (
                <div className="h-full flex items-center justify-center text-gray-400 dark:text-slate-500 text-sm">
                  Results will appear here as companies are enriched
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
