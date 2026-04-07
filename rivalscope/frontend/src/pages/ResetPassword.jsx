import React, { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import api from '../lib/api.js';

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    if (password !== confirm) return setError('Passwords do not match');
    setError('');
    setLoading(true);
    try {
      await api.post('/auth/reset-password', { token, password });
      navigate('/login?reset=1');
    } catch (err) {
      setError(err.response?.data?.error || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-slate-900 flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <p className="text-gray-600 dark:text-slate-400">Invalid reset link.</p>
          <Link to="/login" className="text-sky-600 dark:text-sky-400 hover:underline text-sm">Back to Sign In</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Set new password</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">Choose a new password for your account.</p>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">New Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full px-3 py-2 bg-gray-50 dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-lg text-sm text-gray-900 dark:text-white outline-none focus:border-sky-500 transition-colors"
              placeholder="Min. 8 characters"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Confirm Password</label>
            <input
              type="password"
              required
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              className="w-full px-3 py-2 bg-gray-50 dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-lg text-sm text-gray-900 dark:text-white outline-none focus:border-sky-500 transition-colors"
              placeholder="Re-enter password"
            />
          </div>
          {error && <p className="text-sm text-red-500 dark:text-red-400">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
          >
            {loading ? 'Saving…' : 'Reset Password'}
          </button>
          <div className="text-center">
            <Link to="/login" className="text-sm text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300 transition-colors">
              Back to Sign In
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
