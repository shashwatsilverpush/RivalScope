import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../lib/api.js';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.post('/auth/forgot-password', { email });
      setSubmitted(true);
    } catch (err) {
      setError(err.response?.data?.error || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Forgot password</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">Enter your email and we'll send a reset link.</p>
        </div>

        {submitted ? (
          <div className="space-y-4">
            <p className="text-sm text-green-600 dark:text-green-400">
              If an account exists for <strong>{email}</strong>, a reset link has been sent.
            </p>
            <Link to="/login" className="block text-center text-sm text-sky-600 dark:text-sky-400 hover:underline">
              Back to Sign In
            </Link>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full px-3 py-2 bg-gray-50 dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-lg text-sm text-gray-900 dark:text-white outline-none focus:border-sky-500 transition-colors"
                placeholder="you@company.com"
              />
            </div>
            {error && <p className="text-sm text-red-500 dark:text-red-400">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
            >
              {loading ? 'Sending…' : 'Send Reset Link'}
            </button>
            <div className="text-center">
              <Link to="/login" className="text-sm text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300 transition-colors">
                Back to Sign In
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
