import React, { useState, useEffect } from 'react';
import { Routes, Route, NavLink, useNavigate } from 'react-router-dom';
import { BarChart3, PlusCircle, Clock, Calendar, Settings, Sun, Moon, FlaskConical, ChevronLeft, ChevronRight } from 'lucide-react';
import NewAnalysis from './pages/NewAnalysis.jsx';
import Results from './pages/Results.jsx';
import History from './pages/History.jsx';
import Schedules from './pages/Schedules.jsx';
import QA from './pages/QA.jsx';
import SettingsModal from './components/SettingsModal.jsx';

export default function App() {
  const [showSettings, setShowSettings] = useState(false);
  const [isDark, setIsDark] = useState(true);
  const [collapsed, setCollapsed] = useState(false);

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

  const navItems = [
    { to: '/', icon: PlusCircle, label: 'New Analysis', end: true },
    { to: '/history', icon: Clock, label: 'History' },
    { to: '/schedules', icon: Calendar, label: 'Schedules' },
    { to: '/qa', icon: FlaskConical, label: 'QA Tests' },
  ];

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
          <Route path="/" element={<NewAnalysis />} />
          <Route path="/results/:id" element={<Results />} />
          <Route path="/history" element={<History />} />
          <Route path="/schedules" element={<Schedules />} />
          <Route path="/qa" element={<QA />} />
        </Routes>
      </main>

      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
    </div>
  );
}
