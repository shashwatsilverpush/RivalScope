import React, { useState } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function Login() {
  const { login, signup } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState('login');
  const resetSuccess = searchParams.get('reset') === '1';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (tab === 'login') await login(email, password);
      else await signup(email, password);
      navigate('/');
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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">RivalScope</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">AdTech competitor intelligence</p>
        </div>

        <div className="flex rounded-lg bg-gray-100 dark:bg-slate-700 p-1">
          {['login', 'signup'].map(t => (
            <button
              key={t}
              onClick={() => { setTab(t); setError(''); }}
              className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${
                tab === t
                  ? 'bg-white dark:bg-slate-600 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-500 dark:text-slate-400'
              }`}
            >
              {t === 'login' ? 'Sign In' : 'Sign Up'}
            </button>
          ))}
        </div>

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
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full px-3 py-2 bg-gray-50 dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-lg text-sm text-gray-900 dark:text-white outline-none focus:border-sky-500 transition-colors"
              placeholder={tab === 'signup' ? 'Min. 8 characters' : '••••••••'}
            />
          </div>
          {resetSuccess && <p className="text-sm text-green-600 dark:text-green-400">Password reset! Sign in below.</p>}
          {error && <p className="text-sm text-red-500 dark:text-red-400">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
          >
            {loading ? 'Please wait…' : tab === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        <div className="text-center space-y-2">
          {tab === 'login' && (
            <Link to="/forgot-password" className="block text-sm text-sky-600 dark:text-sky-400 hover:underline">
              Forgot password?
            </Link>
          )}
          <Link to="/" className="block text-sm text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300 transition-colors">
            Continue without account →
          </Link>
        </div>
      </div>
    </div>
  );
}
