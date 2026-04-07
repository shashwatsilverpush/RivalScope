import React, { useState, useEffect } from 'react';
import { Routes, Route, NavLink, Link, useNavigate } from 'react-router-dom';
import { BarChart3, PlusCircle, Clock, Calendar, Settings, Sun, Moon, FlaskConical, ChevronLeft, ChevronRight, LogIn, LogOut, Users } from 'lucide-react';
import NewAnalysis from './pages/NewAnalysis.jsx';
import Results from './pages/Results.jsx';
import History from './pages/History.jsx';
import Schedules from './pages/Schedules.jsx';
import QA from './pages/QA.jsx';
import Admin from './pages/Admin.jsx';
import ForgotPassword from './pages/ForgotPassword.jsx';
import ResetPassword from './pages/ResetPassword.jsx';
import SettingsModal from './components/SettingsModal.jsx';
import Login from './pages/Login.jsx';
import { useAuth } from './context/AuthContext.jsx';

export default function App() {
  const [showSettings, setShowSettings] = useState(false);
  const [isDark, setIsDark] = useState(true);
  const [collapsed, setCollapsed] = useState(false);
  const { user, logout } = useAuth();

  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    const stored = localStorage.getItem('theme');
    const dark = stored !== 'light';
    setIsDark(dark);
    if (dark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);

  const toggleTheme = () => {
    const newDark = !isDark;
    setIsDark(newDark);
    if (newDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  };

  const userNavItems = [
    { to: '/', icon: PlusCircle, label: 'New Analysis', end: true },
    { to: '/history', icon: Clock, label: 'History' },
    { to: '/schedules', icon: Calendar, label: 'Schedules' },
  ];

  const adminNavItems = [
    { to: '/', icon: PlusCircle, label: 'New Analysis', end: true },
    { to: '/history', icon: Clock, label: 'History' },
    { to: '/schedules', icon: Calendar, label: 'Schedules' },
    { to: '/admin', icon: Users, label: 'Users' },
    { to: '/qa', icon: FlaskConical, label: 'QA Tests' },
  ];

  const navItems = isAdmin ? adminNavItems : userNavItems;

  return (
    <div className="flex h-screen bg-gray-100 dark:bg-slate-950">
      {/* Sidebar */}
      <aside className={`${collapsed ? 'w-14' : 'w-56'} transition-all duration-200 bg-white dark:bg-slate-900 border-r border-gray-200 dark:border-slate-800 flex flex-col shrink-0`}>
        <div className="p-3 border-b border-gray-200 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <BarChart3 className="text-sky-600 dark:text-sky-400 shrink-0" size={22} />
              {!collapsed && <span className="font-bold text-gray-900 dark:text-white text-lg truncate">RivalScope</span>}
            </div>
            <button
              onClick={() => setCollapsed(c => !c)}
              className="text-gray-400 dark:text-slate-500 hover:text-gray-700 dark:hover:text-white transition-colors shrink-0 ml-1"
              title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
            </button>
          </div>
          {!collapsed && <p className="text-gray-500 dark:text-slate-400 text-xs mt-1">AdTech Intel</p>}
        </div>
        <nav className="flex-1 p-2 space-y-1">
          {navItems.map(({ to, icon: Icon, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              title={collapsed ? label : undefined}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${collapsed ? 'justify-center' : ''} ${
                  isActive
                    ? 'bg-sky-500/20 text-sky-600 dark:text-sky-400'
                    : 'text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800 hover:text-gray-900 dark:hover:text-white'
                }`
              }
            >
              <Icon size={16} className="shrink-0" />
              {!collapsed && label}
            </NavLink>
          ))}
        </nav>
        <div className="p-2 border-t border-gray-200 dark:border-slate-800 space-y-1">
          {!collapsed && (
            user ? (
              <div className="flex items-center gap-2 px-3 py-2 text-sm">
                <div className="flex-1 min-w-0">
                  <p className="truncate text-gray-600 dark:text-slate-400 text-xs">{user.email}</p>
                  {isAdmin && <p className="text-[10px] text-sky-500 dark:text-sky-400 font-medium">Admin</p>}
                </div>
                <button onClick={logout} title="Sign out" className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-300">
                  <LogOut size={15} />
                </button>
              </div>
            ) : (
              <Link to="/login" className="flex items-center gap-2 px-3 py-2 text-sm text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white transition-colors rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700">
                <LogIn size={15} />
                <span>Sign In</span>
              </Link>
            )
          )}
          <button
            onClick={toggleTheme}
            title={collapsed ? (isDark ? 'Light Mode' : 'Dark Mode') : undefined}
            className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800 hover:text-gray-900 dark:hover:text-white transition-colors w-full ${collapsed ? 'justify-center' : ''}`}
          >
            {isDark ? <Sun size={16} className="shrink-0" /> : <Moon size={16} className="shrink-0" />}
            {!collapsed && (isDark ? 'Light Mode' : 'Dark Mode')}
          </button>
          <button
            onClick={() => setShowSettings(true)}
            title={collapsed ? 'Settings' : undefined}
            className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800 hover:text-gray-900 dark:hover:text-white transition-colors w-full ${collapsed ? 'justify-center' : ''}`}
          >
            <Settings size={16} className="shrink-0" />
            {!collapsed && 'Settings'}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto relative">
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/" element={<NewAnalysis />} />
          <Route path="/results/:id" element={<Results />} />
          <Route path="/history" element={<History />} />
          <Route path="/schedules" element={
            user === undefined ? null : user ? <Schedules /> : (
              <div className="flex flex-col items-center justify-center h-full gap-4 text-center p-8">
                <div className="text-4xl">🔒</div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Sign in to use Schedules</h2>
                <p className="text-sm text-gray-500 dark:text-slate-400 max-w-xs">Create an account to schedule recurring analyses and get email reports.</p>
                <Link to="/login" className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white text-sm font-medium rounded-lg transition-colors">Sign In / Create Account</Link>
              </div>
            )
          } />
          <Route path="/admin" element={
            user === undefined ? null : isAdmin ? <Admin /> : (
              <div className="flex flex-col items-center justify-center h-full gap-4 text-center p-8">
                <div className="text-4xl">🔒</div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Admin access required</h2>
              </div>
            )
          } />
          <Route path="/qa" element={
            user === undefined ? null : isAdmin ? <QA /> : (
              <div className="flex flex-col items-center justify-center h-full gap-4 text-center p-8">
                <div className="text-4xl">🔒</div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Admin access required</h2>
              </div>
            )
          } />
        </Routes>
      </main>

      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
    </div>
  );
}
