import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Send, Zap, Search, X, GripVertical, RotateCcw } from 'lucide-react';
import api from '../lib/api.js';

// ─── constants ───────────────────────────────────────────────────────────────

const SCOPE_QUICK = [
  { label: 'Full Analysis', value: 'Comprehensive analysis covering all key features, pricing, integrations, identity solutions, and competitive positioning' },
  { label: 'Pricing & Commercial', value: 'Compare pricing models, minimum spend requirements, and commercial terms' },
  { label: 'Technical Integration', value: 'Compare API quality, SDK availability, integration complexity, and onboarding time' },
  { label: 'CTV/Video Capabilities', value: 'Compare CTV inventory access, SSAI support, VAST/VPAID versions, and video ad formats' },
  { label: 'Identity & Privacy', value: 'Compare identity solutions (UID2/ID5/RampID), cookieless readiness, and privacy compliance' },
  { label: 'Brand Safety & Measurement', value: 'Compare brand safety tools (IAS/DV/MOAT), viewability standards, fraud prevention, and measurement' },
  { label: 'Audience & Targeting', value: 'Compare first-party data capabilities, audience targeting options, lookalike modeling, and data partnerships' },
  { label: 'Reporting & Analytics', value: 'Compare reporting granularity, real-time dashboards, attribution models, and custom reporting APIs' },
  { label: 'Company Structure', value: 'Compare headcount, founding date, total funding raised, last funding round, HQ location, and key investors' },
  { label: 'New Features & Launches', value: 'Compare recent product launches, new feature announcements, platform updates, roadmap items, and strategic initiatives from the past 12 months' },
];

const STEP_LABELS = {
  enriching: 'Enriching product context',
  classifying: 'Classifying products',
  searching: 'Searching the web',
  analyzing: 'Analyzing with AI',
  formatting: 'Formatting results',
};

let _msgId = 0;
const mkMsg = (role, content, meta = {}) => ({ id: ++_msgId, role, content, meta });

const GREETING = mkMsg('bot', 'Hi! Which products would you like to compare?\n\nType names, domains, or a list — e.g. "DV360, IAS, MOAT". You can also say "find 3 competitors of DV360".');

// ─── sub-components ──────────────────────────────────────────────────────────

function ProductChipRow({ products, onChange }) {
  const toggleRole = (i) =>
    onChange(products.map((p, idx) => idx === i ? { ...p, role: p.role === 'main' ? 'competitor' : 'main' } : p));
  const remove = (i) => onChange(products.filter((_, idx) => idx !== i));
  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {products.map((p, i) => (
        <span key={i} className="flex items-center gap-1 bg-gray-200 dark:bg-slate-700 rounded-md px-2 py-1 text-xs">
          <GripVertical size={10} className="text-gray-400 dark:text-slate-500" />
          <span className="text-gray-900 dark:text-white">{p.identifier}</span>
          <button
            onClick={() => toggleRole(i)}
            className={`text-xs px-1 py-0.5 rounded ${p.role === 'main' ? 'bg-sky-500/30 text-sky-600 dark:text-sky-300' : 'bg-orange-500/30 text-orange-600 dark:text-orange-300'}`}
          >
            {p.role === 'main' ? 'Main' : 'Comp'}
          </button>
          <button onClick={() => remove(i)} className="text-gray-400 hover:text-gray-900 dark:hover:text-white ml-0.5">
            <X size={10} />
          </button>
        </span>
      ))}
    </div>
  );
}

// ChatBubble only renders static content + suggestion chips (which use functional setMessages)
function ChatBubble({ msg, onProductsChange }) {
  const isBot = msg.role === 'bot' || msg.role === 'progress' || msg.role === 'result';
  const isProgress = msg.role === 'progress';
  const isResult = msg.role === 'result';

  return (
    <div className={`flex ${isBot ? 'justify-start' : 'justify-end'} mb-3`}>
      <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${
        isBot
          ? 'bg-gray-100 dark:bg-slate-800 text-gray-900 dark:text-white rounded-tl-sm'
          : 'bg-sky-600 text-white rounded-tr-sm'
      } ${isResult ? 'border border-sky-500/30' : ''}`}>

        {isProgress && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-slate-400">
              <span className="text-sky-500">⠋</span>
              <span>{msg.content}</span>
            </div>
            {msg.meta?.progress > 0 && (
              <div className="w-full bg-gray-200 dark:bg-slate-700 rounded-full h-1">
                <div className="bg-sky-500 h-1 rounded-full transition-all duration-300" style={{ width: `${msg.meta.progress}%` }} />
              </div>
            )}
          </div>
        )}

        {isResult && (
          <div className="space-y-2">
            <p className="text-green-500 font-medium text-xs">Analysis complete</p>
            <p className="whitespace-pre-line">{msg.content}</p>
            <div className="flex gap-2 pt-1 flex-wrap">
              <button
                onClick={() => msg.meta?.onView?.()}
                className="px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white text-xs rounded-lg transition-colors"
              >
                View Full Results →
              </button>
              <button
                onClick={() => msg.meta?.onRerun?.()}
                className="flex items-center gap-1 px-3 py-1.5 bg-gray-200 dark:bg-slate-700 hover:bg-gray-300 dark:hover:bg-slate-600 text-gray-700 dark:text-slate-300 text-xs rounded-lg transition-colors"
              >
                <RotateCcw size={10} /> Re-run with changes
              </button>
            </div>
          </div>
        )}

        {!isProgress && !isResult && (
          <>
            <p className="whitespace-pre-line">{msg.content}</p>
            {/* Product chips embedded in a confirm message */}
            {msg.meta?.showProducts && onProductsChange && (
              <ProductChipRow products={msg.meta.products} onChange={onProductsChange} />
            )}
            {/* Suggestion chips use functional setMessages so no stale-closure risk */}
            {msg.meta?.suggestionChips && (
              <div className="mt-2 space-y-2">
                <div className="flex flex-wrap gap-1.5">
                  {msg.meta.suggestions.map(name => (
                    <button
                      key={name}
                      onClick={() => msg.meta.onToggle(name)}
                      className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${
                        msg.meta.selected.has(name)
                          ? 'border-sky-500 bg-sky-500/10 text-sky-600 dark:text-sky-300'
                          : 'border-gray-300 dark:border-slate-600 text-gray-500 dark:text-slate-400'
                      }`}
                    >
                      {name}
                    </button>
                  ))}
                </div>
                <button
                  onClick={msg.meta.onConfirm}
                  disabled={msg.meta.selected.size === 0}
                  className="px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white text-xs rounded-lg disabled:opacity-40 transition-colors"
                >
                  Add {msg.meta.selected.size} competitor{msg.meta.selected.size !== 1 ? 's' : ''}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ─── main page ───────────────────────────────────────────────────────────────

export default function NewAnalysis() {
  const navigate = useNavigate();
  const location = useLocation();
  const prefill = location.state || {};

  const [messages, setMessages] = useState([GREETING]);
  const [chatState, setChatState] = useState('collecting_products');
  const [products, setProducts] = useState(prefill.products || []);
  const [scopeData, setScopeData] = useState({ scope: prefill.scope || '', scopeWeights: [] });
  const [mode, setMode] = useState('fast');
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [lastAnalysisId, setLastAnalysisId] = useState(null);

  // Refs so async callbacks always see the latest values (avoids stale closures)
  const productsRef = useRef(products);
  const scopeDataRef = useRef(scopeData);
  const modeRef = useRef(mode);
  const chatStateRef = useRef(chatState);
  useEffect(() => { productsRef.current = products; }, [products]);
  useEffect(() => { scopeDataRef.current = scopeData; }, [scopeData]);
  useEffect(() => { modeRef.current = mode; }, [mode]);
  useEffect(() => { chatStateRef.current = chatState; }, [chatState]);

  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Prefill from re-run (History / Results page)
  useEffect(() => {
    if (prefill.products?.length > 0) {
      setMessages(prev => [...prev, mkMsg('bot',
        `Welcome back! Pre-loaded your previous products:\n${prefill.products.map(p => `• ${p.identifier} (${p.role})`).join('\n')}\n\nWhat scope would you like to compare?`,
        { showProducts: true, products: prefill.products }
      )]);
      setChatState('collecting_scope');
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── helpers ────────────────────────────────────────────────────────────────

  const addBotMsg = (content, meta = {}) =>
    setMessages(prev => [...prev, mkMsg('bot', content, meta)]);

  const addUserMsg = (content) =>
    setMessages(prev => [...prev, mkMsg('user', content)]);

  // ── scope / mode handlers (called from live-rendered quick-action buttons) ─
  // These are always fresh from the current render, so no stale-closure risk.

  const handleScopeSelect = (chip) => {
    const val = typeof chip === 'string' ? chip : chip.value;
    const label = typeof chip === 'string' ? chip : chip.label;
    setScopeData({ scope: val, scopeWeights: [] });
    addUserMsg(label);
    addBotMsg(`Got it — ${label}.\n\nWhich analysis mode?`);
    setChatState('collecting_mode');
  };

  const handleModeSelect = (m) => {
    setMode(m);
    addUserMsg(m === 'fast' ? 'Fast ⚡' : 'Deep 🔍');
    // Use refs to guarantee we have the latest products + scopeData
    runAnalysis(productsRef.current, scopeDataRef.current, m);
  };

  // ── analysis runner ────────────────────────────────────────────────────────

  const runAnalysis = async (prods, scope, m) => {
    if (!prods || prods.length === 0) {
      addBotMsg('No products loaded. Please add at least one product first.');
      setChatState('collecting_products');
      return;
    }

    setBusy(true);
    setChatState('running');

    const progressId = ++_msgId;
    setMessages(prev => [...prev, { id: progressId, role: 'progress', content: 'Starting…', meta: { progress: 0 } }]);

    try {
      const res = await fetch('/api/analysis/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          products: prods,
          scope: scope.scope,
          scopeWeights: scope.scopeWeights,
          mode: m,
        }),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        setMessages(prev => prev.filter(msg => msg.id !== progressId));
        addBotMsg(`Something went wrong (${res.status})${text ? ': ' + text : ''}. Try again?`);
        setBusy(false);
        setChatState('collecting_products');
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop();
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.step && data.step !== 'done' && data.step !== 'error') {
              const label = STEP_LABELS[data.step] || data.step;
              setMessages(prev => prev.map(msg =>
                msg.id === progressId
                  ? { ...msg, content: label + '…', meta: { progress: data.progress || 0 } }
                  : msg
              ));
            }
            if (data.step === 'done' && data.analysisId) {
              const aid = data.analysisId;
              setLastAnalysisId(aid);
              const productNames = prods.map(p => p.identifier).join(', ');
              setMessages(prev => [
                ...prev.filter(msg => msg.id !== progressId),
                mkMsg('result', `Compared: ${productNames}`, {
                  onView: () => navigate(`/results/${aid}`),
                  onRerun: () => setChatState('collecting_scope'),
                }),
              ]);
              setChatState('done');
              setBusy(false);
              return;
            }
            if (data.step === 'error') {
              setMessages(prev => prev.filter(msg => msg.id !== progressId));
              addBotMsg(`Analysis error: ${data.error || 'unknown'}. Try again?`);
              setBusy(false);
              setChatState('collecting_products');
              return;
            }
          } catch {}
        }
      }
    } catch (e) {
      setMessages(prev => prev.filter(msg => msg.id !== progressId));
      addBotMsg(`Connection error: ${e.message}. Try again?`);
      setBusy(false);
      setChatState('collecting_products');
    }
  };

  // ── text input / intent dispatch ───────────────────────────────────────────

  const handleSend = async () => {
    const text = input.trim();
    if (!text || busy) return;
    setInput('');
    addUserMsg(text);
    setBusy(true);
    try {
      const { data: intent } = await api.post('/chat/parse', {
        message: text,
        context: { products, scope: scopeData.scope, lastAnalysisId, chatState },
      });
      await handleIntent(intent, text);
    } catch {
      await handleIntent({ intent: 'analyze', products: text.split(/[,\n]+/).map(s => s.trim()).filter(Boolean) }, text);
    } finally {
      setBusy(false);
    }
  };

  const handleIntent = async (intent, rawText) => {
    // ── find competitors ──────────────────────────────────────────────────
    if (intent.intent === 'find_competitors') {
      const target = intent.target || productsRef.current.find(p => p.role === 'main')?.identifier;
      if (!target) { addBotMsg('Which product should I find competitors for?'); return; }
      const count = intent.count || 3;
      addBotMsg(`Searching for top ${count} competitors of ${target}…`);
      try {
        const { data } = await api.post('/competitors/suggest', { product: target, count });
        const suggs = (data.competitors || []).filter(
          n => !productsRef.current.some(p => p.identifier.toLowerCase() === n.toLowerCase())
        );
        if (!suggs.length) { addBotMsg(`No new competitors found for ${target}. Add them manually.`); return; }
        const msgId = ++_msgId;
        // toggle and confirm use functional setMessages → always see latest meta
        const onToggle = (name) => setMessages(prev => prev.map(m => {
          if (m.id !== msgId) return m;
          const next = new Set(m.meta.selected);
          if (next.has(name)) next.delete(name); else next.add(name);
          return { ...m, meta: { ...m.meta, selected: next } };
        }));
        const onConfirm = () => setMessages(prev => {
          const msg = prev.find(m => m.id === msgId);
          if (!msg) return prev;
          const toAdd = msg.meta.suggestions
            .filter(n => msg.meta.selected.has(n))
            .map(n => ({ identifier: n, role: 'competitor' }));
          const newProds = [...productsRef.current, ...toAdd];
          setProducts(newProds);
          // advance state after confirm
          setTimeout(() => {
            addBotMsg(`Added ${toAdd.length} competitor${toAdd.length !== 1 ? 's' : ''}. Pick a scope to compare:`);
            setChatState('collecting_scope');
          }, 0);
          return prev.map(m => m.id === msgId ? { ...m, meta: { ...m.meta, suggestionChips: false } } : m);
        });
        setMessages(prev => [...prev, {
          id: msgId, role: 'bot',
          content: `Found ${suggs.length} competitors of ${target}:`,
          meta: { suggestionChips: true, suggestions: suggs, selected: new Set(suggs), onToggle, onConfirm },
        }]);
      } catch { addBotMsg('Competitor search failed. Try adding them manually.'); }
      return;
    }

    // ── remove product ────────────────────────────────────────────────────
    if (intent.intent === 'remove_product') {
      const target = intent.target || intent.products?.[0];
      if (!target) { addBotMsg('Which product should I remove?'); return; }
      const next = productsRef.current.filter(p => !p.identifier.toLowerCase().includes(target.toLowerCase()));
      if (next.length === productsRef.current.length) { addBotMsg(`"${target}" not found in the list.`); return; }
      setProducts(next);
      addBotMsg(`Removed ${target}. Products now: ${next.map(p => p.identifier).join(', ')}.\n\nRe-run with these changes?`);
      return;
    }

    // ── add product ───────────────────────────────────────────────────────
    if (intent.intent === 'add_product') {
      const toAdd = (intent.products || []).filter(
        n => n && !productsRef.current.some(p => p.identifier.toLowerCase() === n.toLowerCase())
      );
      if (!toAdd.length) { addBotMsg('Those products are already in the list.'); return; }
      const newProds = [...productsRef.current, ...toAdd.map(n => ({ identifier: n, role: 'competitor' }))];
      setProducts(newProds);
      addBotMsg(`Added: ${toAdd.join(', ')}.`);
      return;
    }

    // ── change scope ──────────────────────────────────────────────────────
    if (intent.intent === 'change_scope') {
      const s = intent.scope || rawText;
      setScopeData({ scope: s, scopeWeights: [] });
      addBotMsg(`Scope updated. Re-running…`);
      runAnalysis(productsRef.current, { scope: s, scopeWeights: [] }, modeRef.current);
      return;
    }

    // ── change mode ───────────────────────────────────────────────────────
    if (intent.intent === 'change_mode') {
      const m = intent.mode || 'fast';
      setMode(m);
      addBotMsg(`Switching to ${m} mode and re-running…`);
      runAnalysis(productsRef.current, scopeDataRef.current, m);
      return;
    }

    // ── analyze / extract products ────────────────────────────────────────
    const newNames = (intent.products || []).filter(
      n => n && !productsRef.current.some(p => p.identifier.toLowerCase() === n.toLowerCase())
    );

    if (newNames.length > 0) {
      // Validate that the entered names are real products/companies
      const verifyId = ++_msgId;
      setMessages(prev => [...prev, { id: verifyId, role: 'bot', content: `Searching for ${newNames.length > 1 ? 'those products' : `"${newNames[0]}"`}…`, meta: {} }]);
      const removeVerify = () => setMessages(prev => prev.filter(m => m.id !== verifyId));
      let validNames = newNames;
      try {
        const { data } = await api.post('/competitors/validate', { names: newNames });
        const invalid = (data.results || []).filter(r => !r.valid).map(r => r.name);
        const valid = (data.results || []).filter(r => r.valid);
        removeVerify();
        if (invalid.length > 0) {
          addBotMsg(`I couldn't verify: ${invalid.map(n => `"${n}"`).join(', ')}. Please check the spelling and try again.`);
          if (valid.length === 0) return;
          validNames = valid.map(r => r.resolvedName || r.name);
        } else {
          validNames = valid.map(r => r.resolvedName || r.name);
        }
      } catch {
        removeVerify(); // Validation API down — proceed without blocking
      }

      const isFirst = productsRef.current.length === 0;
      const toAdd = validNames.map((n, i) => ({ identifier: n, role: isFirst && i === 0 ? 'main' : 'competitor' }));
      const newProds = [...productsRef.current, ...toAdd];
      setProducts(newProds);

      if (chatStateRef.current === 'collecting_products') {
        addBotMsg(
          `Got it! I'll compare:\n${newProds.map(p => `• ${p.identifier} (${p.role})`).join('\n')}\n\nWhat should I focus on?`,
          { showProducts: true, products: newProds }
        );
        setChatState('collecting_scope');
      } else if (chatStateRef.current === 'done') {
        addBotMsg(`Added ${toAdd.map(p => p.identifier).join(', ')}. Re-run?`);
      } else {
        addBotMsg(`Added ${toAdd.map(p => p.identifier).join(', ')}.`);
      }
      return;
    }

    // ── fallback by state ─────────────────────────────────────────────────
    if (chatStateRef.current === 'collecting_products') {
      // Unknown intent in product-collection state — validate the raw text as a product name
      const verifyMsg = `Searching for "${rawText}"…`;
      addBotMsg(verifyMsg);
      try {
        const { data } = await api.post('/competitors/validate', { names: [rawText] });
        const result = data.results?.[0];
        setMessages(prev => prev.filter(m => m.content !== verifyMsg));
        if (!result?.valid) {
          addBotMsg(`"${rawText}" doesn't look like a real product or company. Please check the spelling and try again.`);
          return;
        }
        const name = result.resolvedName || rawText;
        const newProds = [...productsRef.current, { identifier: name, role: 'main' }];
        setProducts(newProds);
        addBotMsg(
          `Got it! I'll compare:\n• ${name} (main)\n\nWhat should I focus on?`,
          { showProducts: true, products: newProds }
        );
        setChatState('collecting_scope');
      } catch {
        setMessages(prev => prev.filter(m => m.content !== verifyMsg));
        addBotMsg('Please enter a valid product or company name (e.g. "DV360", "Magnite").');
      }
      return;
    }

    if (chatStateRef.current === 'collecting_scope') {
      setScopeData({ scope: rawText, scopeWeights: [] });
      addBotMsg('Got it. Which mode would you like?');
      setChatState('collecting_mode');
      return;
    }

    if (chatStateRef.current === 'done') {
      addBotMsg('Re-running with current configuration…');
      runAnalysis(productsRef.current, scopeDataRef.current, modeRef.current);
      return;
    }

    addBotMsg('Try typing product names (e.g. "DV360, IAS") or pick an option below.');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  // ── render ─────────────────────────────────────────────────────────────────

  return (
    <div className="absolute inset-0 flex flex-col">
      {/* Header */}
      <div className="shrink-0 px-5 py-3 border-b border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-950 flex items-center justify-between">
        <div>
          <h1 className="text-gray-900 dark:text-white font-semibold text-sm">New Analysis</h1>
          {products.length > 0 && (
            <p className="text-xs text-gray-400 dark:text-slate-500">{products.length} product{products.length !== 1 ? 's' : ''} loaded</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs px-2 py-1 rounded-full border ${
            mode === 'fast' ? 'border-yellow-400/60 text-yellow-600 dark:text-yellow-400' : 'border-sky-400/60 text-sky-600 dark:text-sky-400'
          }`}>
            {mode === 'fast' ? '⚡ Fast' : '🔍 Deep'}
          </span>
          {chatState !== 'running' && products.length > 0 && (
            <button
              onClick={() => { setMessages([GREETING]); setProducts([]); setScopeData({ scope: '', scopeWeights: [] }); setLastAnalysisId(null); setChatState('collecting_products'); }}
              className="text-xs text-gray-400 dark:text-slate-500 hover:text-gray-700 dark:hover:text-slate-300 transition-colors"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Message thread */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {messages.map(msg => (
          <ChatBubble
            key={msg.id}
            msg={msg}
            onProductsChange={msg.meta?.showProducts ? (updated) => {
              setProducts(updated);
              setMessages(prev => prev.map(m =>
                m.id === msg.id ? { ...m, meta: { ...m.meta, products: updated } } : m
              ));
            } : undefined}
          />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Live quick-action area — rendered from chatState, not from stale message meta */}
      {chatState === 'collecting_scope' && (
        <div className="shrink-0 px-4 pb-2 border-t border-gray-100 dark:border-slate-800/50 bg-white dark:bg-slate-950">
          <div className="flex items-center justify-between pt-2 pb-1.5">
            <p className="text-xs text-gray-400 dark:text-slate-500">Pick a scope or type your own:</p>
            {products.find(p => p.role === 'main') && (
              <button
                onClick={() => handleIntent({ intent: 'find_competitors', target: products.find(p => p.role === 'main')?.identifier, count: 3 }, '')}
                className="flex items-center gap-1 text-xs text-sky-600 dark:text-sky-400 hover:underline"
              >
                <Search size={11} /> Find similar competitors
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {SCOPE_QUICK.map(chip => (
              <button
                key={chip.label}
                onClick={() => handleScopeSelect(chip)}
                className="px-3 py-1.5 text-xs rounded-full border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-600 dark:text-slate-300 hover:border-sky-500 hover:text-sky-600 dark:hover:text-sky-300 transition-colors"
              >
                {chip.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {chatState === 'collecting_mode' && (
        <div className="shrink-0 px-4 pb-3 pt-2 border-t border-gray-100 dark:border-slate-800/50 bg-white dark:bg-slate-950">
          <p className="text-xs text-gray-400 dark:text-slate-500 mb-2">Pick analysis mode:</p>
          <div className="flex gap-2">
            <button
              onClick={() => handleModeSelect('fast')}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs border border-yellow-400/60 bg-yellow-500/10 text-yellow-600 dark:text-yellow-300 hover:bg-yellow-500/20 transition-colors"
            >
              <Zap size={12} /> Fast (~5-15s)
            </button>
            <button
              onClick={() => handleModeSelect('deep')}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs border border-sky-400/60 bg-sky-500/10 text-sky-600 dark:text-sky-300 hover:bg-sky-500/20 transition-colors"
            >
              <Search size={12} /> Deep (~25-45s)
            </button>
          </div>
        </div>
      )}

      {chatState === 'done' && (
        <div className="shrink-0 px-4 pb-3 pt-2 border-t border-gray-100 dark:border-slate-800/50 bg-white dark:bg-slate-950">
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setChatState('collecting_scope')}
              className="flex items-center gap-1 px-3 py-1.5 text-xs border border-gray-300 dark:border-slate-600 rounded-lg text-gray-600 dark:text-slate-300 hover:border-sky-500 hover:text-sky-600 dark:hover:text-sky-300 transition-colors"
            >
              <RotateCcw size={11} /> Re-run with different scope
            </button>
            <button
              onClick={() => setChatState('collecting_products')}
              className="px-3 py-1.5 text-xs border border-gray-300 dark:border-slate-600 rounded-lg text-gray-600 dark:text-slate-300 hover:border-sky-500 hover:text-sky-600 dark:hover:text-sky-300 transition-colors"
            >
              + Add/remove products
            </button>
          </div>
        </div>
      )}

      {/* Input bar */}
      <div className="shrink-0 px-4 py-3 border-t border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-950">
        <div className="flex gap-2 items-end">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={chatState === 'running'}
            placeholder={
              chatState === 'running' ? 'Analysis in progress…' :
              chatState === 'collecting_products' ? 'Type product names, e.g. "DV360, IAS, MOAT"…' :
              chatState === 'collecting_scope' ? 'Or type a custom scope…' :
              chatState === 'collecting_mode' ? 'Or type "fast" / "deep"…' :
              'Type a correction or "re-run"…'
            }
            rows={1}
            className="flex-1 resize-none bg-gray-100 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 outline-none focus:border-sky-500 transition-colors leading-relaxed disabled:opacity-50"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || chatState === 'running'}
            className="shrink-0 w-10 h-10 bg-sky-600 hover:bg-sky-500 disabled:bg-gray-200 dark:disabled:bg-slate-700 disabled:text-gray-400 dark:disabled:text-slate-500 text-white rounded-xl flex items-center justify-center transition-colors"
          >
            <Send size={15} />
          </button>
        </div>
        <p className="text-gray-400 dark:text-slate-600 text-xs text-center mt-1.5">Enter to send · Shift+Enter for new line</p>
      </div>
    </div>
  );
}
