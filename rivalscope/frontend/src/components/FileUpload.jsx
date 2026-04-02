import React, { useState, useRef } from 'react';
import { Upload, CheckCircle, X } from 'lucide-react';
import api from '../lib/api.js';

export default function FileUpload({ onFormatDetected }) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [detectedFormat, setDetectedFormat] = useState(null);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  const handleFile = async (file) => {
    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const { data } = await api.post('/upload/reference', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setDetectedFormat(data.format);
      onFormatDetected(data.format);
    } catch (e) {
      setError(e.response?.data?.error || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div
      className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer ${
        isDragging ? 'border-sky-400 bg-sky-500/10' : 'border-gray-300 dark:border-slate-600 hover:border-gray-400 dark:hover:border-slate-500'
      }`}
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(e) => { e.preventDefault(); setIsDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
      onClick={() => fileInputRef.current?.click()}
    >
      <input ref={fileInputRef} type="file" className="hidden" accept=".pdf,.docx,.xlsx,.csv,.txt" onChange={(e) => { if (e.target.files[0]) handleFile(e.target.files[0]); }} />

      {uploading ? (
        <div className="text-gray-500 dark:text-slate-400 text-sm">Analyzing format...</div>
      ) : detectedFormat ? (
        <div className="flex items-start gap-2 text-left">
          <CheckCircle size={16} className="text-green-500 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-green-600 dark:text-green-400 text-sm font-medium">Format detected</p>
            <p className="text-gray-500 dark:text-slate-400 text-xs mt-1">{detectedFormat}</p>
          </div>
          <button onClick={(e) => { e.stopPropagation(); setDetectedFormat(null); onFormatDetected(null); }} className="ml-auto text-gray-400 dark:text-slate-500 hover:text-gray-900 dark:hover:text-white">
            <X size={14} />
          </button>
        </div>
      ) : (
        <>
          <Upload size={20} className="mx-auto text-gray-400 dark:text-slate-500 mb-2" />
          <p className="text-gray-500 dark:text-slate-400 text-sm">Drop reference file or click to browse</p>
          <p className="text-gray-400 dark:text-slate-500 text-xs mt-1">PDF, DOCX, XLSX, CSV, TXT</p>
        </>
      )}
      {error && <p className="text-red-500 dark:text-red-400 text-xs mt-2">{error}</p>}
    </div>
  );
}
