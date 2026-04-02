import React, { useState, useRef } from 'react';
import { X, GripVertical, Search, Loader2 } from 'lucide-react';
import api from '../lib/api.js';

export default function ProductInput({ products, onChange }) {
  const [inputValue, setInputValue] = useState('');
  const [competitorCount, setCompetitorCount] = useState(3);
  const [suggestions, setSuggestions] = useState([]);
  const [selectedSuggestions, setSelectedSuggestions] = useState(new Set());
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const inputRef = useRef(null);

  const addProduct = (identifier) => {
    const trimmed = identifier.trim();
    if (!trimmed) return;
    const isFirst = products.length === 0;
    onChange([...products, { identifier: trimmed, role: isFirst ? 'main' : 'competitor' }]);
    setInputValue('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addProduct(inputValue);
    } else if (e.key === 'Backspace' && !inputValue && products.length > 0) {
      onChange(products.slice(0, -1));
    }
  };

  const removeProduct = (index) => onChange(products.filter((_, i) => i !== index));

  const toggleRole = (index) => {
    const updated = products.map((p, i) =>
      i === index ? { ...p, role: p.role === 'main' ? 'competitor' : 'main' } : p
    );
    onChange(updated);
  };

  const mainProduct = products.find(p => p.role === 'main');

  const findCompetitors = async () => {
    if (!mainProduct) return;
    setLoadingSuggestions(true);
    setSuggestions([]);
    try {
      const { data } = await api.post('/competitors/suggest', {
        product: mainProduct.identifier,
        count: competitorCount,
      });
      const newSuggs = (data.competitors || []).filter(
        name => !products.some(p => p.identifier.toLowerCase() === name.toLowerCase())
      );
      setSuggestions(newSuggs);
      setSelectedSuggestions(new Set(newSuggs));
    } catch (e) {
      console.error('Competitor suggestion failed:', e);
    } finally {
      setLoadingSuggestions(false);
    }
  };

  const toggleSuggestion = (name) => {
    setSelectedSuggestions(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const confirmSuggestions = () => {
    const toAdd = suggestions
      .filter(name => selectedSuggestions.has(name))
      .map(name => ({ identifier: name, role: 'competitor' }));
    onChange([...products, ...toAdd]);
    setSuggestions([]);
    setSelectedSuggestions(new Set());
  };

  return (
    <div className="space-y-2">
      <div
        className="min-h-12 bg-gray-100 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-lg p-2 flex flex-wrap gap-2 cursor-text focus-within:border-sky-500 transition-colors"
        onClick={() => inputRef.current?.focus()}
      >
        {products.map((p, i) => (
          <span
            key={i}
            className="flex items-center gap-1 bg-gray-200 dark:bg-slate-700 rounded-md px-2 py-1 text-sm"
          >
            <GripVertical size={12} className="text-gray-400 dark:text-slate-500" />
            <span className="text-gray-900 dark:text-white">{p.identifier}</span>
            <button
              onClick={(e) => { e.stopPropagation(); toggleRole(i); }}
              className={`text-xs px-1.5 py-0.5 rounded ${
                p.role === 'main'
                  ? 'bg-sky-500/30 text-sky-600 dark:text-sky-300'
                  : 'bg-orange-500/30 text-orange-600 dark:text-orange-300'
              }`}
            >
              {p.role === 'main' ? 'Main' : 'Competitor'}
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); removeProduct(i); }}
              className="text-gray-400 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white ml-1"
            >
              <X size={12} />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => { if (inputValue.trim()) addProduct(inputValue); }}
          placeholder={products.length === 0 ? 'Enter product name, URL, or Company + Product (e.g. Google + DV360)' : 'Add another...'}
          className="flex-1 min-w-40 bg-transparent text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 outline-none text-sm py-1"
        />
      </div>

      {mainProduct && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 dark:text-slate-400 shrink-0">Find top</span>
          <input
            type="number"
            min={1}
            max={10}
            value={competitorCount}
            onChange={e => setCompetitorCount(Math.max(1, Math.min(10, parseInt(e.target.value) || 1)))}
            className="w-14 text-center bg-gray-100 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-lg px-2 py-1 text-sm text-gray-900 dark:text-white outline-none focus:border-sky-500"
          />
          <span className="text-xs text-gray-500 dark:text-slate-400 shrink-0">competitors of</span>
          <span className="text-xs font-medium text-sky-600 dark:text-sky-400 truncate flex-1">{mainProduct.identifier}</span>
          <button
            type="button"
            onClick={findCompetitors}
            disabled={loadingSuggestions}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-200 dark:bg-slate-700 hover:bg-gray-300 dark:hover:bg-slate-600 text-gray-700 dark:text-slate-300 text-xs rounded-lg transition-colors disabled:opacity-50 shrink-0"
          >
            {loadingSuggestions ? <Loader2 size={12} className="animate-spin" /> : <Search size={12} />}
            Search
          </button>
        </div>
      )}

      {suggestions.length > 0 && (
        <div className="border border-gray-200 dark:border-slate-700 rounded-lg p-3 space-y-2 bg-gray-50 dark:bg-slate-800/50">
          <p className="text-xs text-gray-500 dark:text-slate-400">Select competitors to add:</p>
          <div className="flex flex-wrap gap-2">
            {suggestions.map(name => (
              <button
                key={name}
                type="button"
                onClick={() => toggleSuggestion(name)}
                className={`px-3 py-1.5 rounded-lg text-xs border transition-colors ${
                  selectedSuggestions.has(name)
                    ? 'border-sky-500 bg-sky-500/10 text-sky-600 dark:text-sky-300'
                    : 'border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-500 dark:text-slate-400'
                }`}
              >
                {name}
              </button>
            ))}
          </div>
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={confirmSuggestions}
              disabled={selectedSuggestions.size === 0}
              className="px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white text-xs rounded-lg transition-colors disabled:opacity-40"
            >
              Add {selectedSuggestions.size} competitor{selectedSuggestions.size !== 1 ? 's' : ''}
            </button>
            <button
              type="button"
              onClick={() => { setSuggestions([]); setSelectedSuggestions(new Set()); }}
              className="px-3 py-1.5 text-gray-500 dark:text-slate-400 text-xs hover:text-gray-900 dark:hover:text-white"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
