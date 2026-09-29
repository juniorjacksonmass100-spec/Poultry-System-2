import React, { useState } from 'react';
import {
  Shield,
  Database,
  Award,
  Clock,
  CheckCircle,
  Trash2,
  AlertTriangle,
  RefreshCw,
  Lock,
} from 'lucide-react';
import { useAuth, ADMIN_EMAIL, ADMIN_NAME } from '../context/AuthContext';
import { HEN_INCUBATION_DAYS, DUCK_INCUBATION_DAYS } from '../utils/calculations';
import { isSupabaseConfigured } from '../services/supabase';

interface SettingsViewProps {
  onOpenSupabaseModal: () => void;
  onResetAllData?: () => Promise<void>;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  onOpenSupabaseModal,
  onResetAllData,
}) => {
  const { profile, isAdmin } = useAuth();
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [isResetting, setIsResetting] = useState(false);
  const [resetSuccessMessage, setResetSuccessMessage] = useState<string | null>(null);

  const handleExecuteReset = async () => {
    if (!isAdmin) {
      alert('Unauthorized: Only CEO Admin Junior Jackson can reset database records.');
      return;
    }

    if (confirmText.trim().toUpperCase() !== 'RESET') {
      return;
    }
    try {
      setIsResetting(true);
      if (onResetAllData) {
        await onResetAllData();
      }
      setIsResetModalOpen(false);
      setConfirmText('');
      setResetSuccessMessage('All farm records, flocks, batches, and transactions have been permanently cleared for all users across the system.');
      setTimeout(() => setResetSuccessMessage(null), 8000);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error resetting data');
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">System Preferences & Settings</h1>
          <p className="text-xs text-slate-500 mt-1">
            Kingdom Group Poultry Management System Configuration
          </p>
        </div>
        <div className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
          v2.5.0 Production
        </div>
      </div>

      {resetSuccessMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-xl text-emerald-900 text-xs flex items-center space-x-2">
          <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
          <span className="font-bold">{resetSuccessMessage}</span>
        </div>
      )}

      {/* Executive Developer Profile Card */}
      <div className="bg-gradient-to-br from-slate-900 via-emerald-950 to-slate-950 text-white rounded-2xl p-6 shadow-xl border border-emerald-800/40 relative overflow-hidden">
        <div className="absolute right-0 top-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col sm:flex-row items-center sm:items-start space-y-4 sm:space-y-0 sm:space-x-6 relative z-10">
          {/* Executive portrait */}
          <div className="relative shrink-0">
            <div className="w-24 h-24 rounded-2xl overflow-hidden border-2 border-emerald-400 shadow-2xl ring-4 ring-emerald-500/20 bg-slate-800 flex items-center justify-center text-white">
              <img
                src="/1787747918623.jpg"
                alt="CEO Junior Jackson Massawe"
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
              <span className="font-extrabold text-2xl tracking-widest">JM</span>
            </div>
            <div className="absolute -bottom-2 -right-2 bg-amber-400 text-slate-950 rounded-lg px-1.5 py-0.5 text-[10px] font-black shadow-md flex items-center space-x-0.5">
              <Award className="w-3 h-3" />
              <span>CEO</span>
            </div>
          </div>

          <div className="text-center sm:text-left flex-1">
            <div className="inline-block px-2.5 py-0.5 bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-[10px] font-bold uppercase tracking-wider rounded-md mb-2">
              Kingdom Group Executive Authority
            </div>
            <h2 className="text-xl font-black tracking-tight text-white">
              {ADMIN_NAME} Massawe
            </h2>
            <p className="text-xs text-emerald-300 font-semibold mt-0.5">
              Chief Executive Officer & Administrator • {ADMIN_EMAIL}
            </p>
            <p className="text-xs text-slate-300 mt-2 max-w-xl leading-relaxed">
              Leading sustainable, modern poultry enterprise operations across East Africa. Specializing in improved Kienyeji chickens, commercial duck production, biosecure brooding, and automated agricultural financial accounting.
            </p>
          </div>
        </div>
      </div>

      {/* Account Info Card */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-4">
        <h2 className="text-sm font-bold text-slate-900 flex items-center">
          <Shield className="w-4 h-4 mr-2 text-emerald-600" />
          Current User Profile & Permissions
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
            <span className="text-[11px] font-semibold text-slate-400 block uppercase">Name & Email</span>
            <div className="font-bold text-slate-900 mt-1">{profile?.full_name || 'Staff Member'}</div>
            <div className="text-slate-600 mt-0.5">{profile?.email || 'Active Account'}</div>
          </div>

          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
            <span className="text-[11px] font-semibold text-slate-400 block uppercase">Role & Access</span>
            <div className="font-bold text-slate-900 mt-1 flex items-center space-x-1.5">
              {isAdmin ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  <span className="text-amber-800">Administrator (Full Master Privileges)</span>
                </>
              ) : (
                <>
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span className="text-emerald-800">Staff Member (Operational Entry Only)</span>
                </>
              )}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              {isAdmin
                ? 'Authorized to wipe data, modify database configuration, and export company audit books.'
                : 'Authorized to enter flocks, record egg collections, register sales, and track day-to-day farm operations.'}
            </p>
          </div>
        </div>
      </div>

      {/* Biological Constants */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-4">
        <h2 className="text-sm font-bold text-slate-900 flex items-center">
          <Clock className="w-4 h-4 mr-2 text-indigo-600" />
          Biological Incubation Constants
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
            <div className="flex items-center justify-between mb-1">
              <span className="font-bold text-slate-900">🐔 Hen (Chicken) Brooding:</span>
              <span className="font-extrabold text-indigo-700">{HEN_INCUBATION_DAYS} Days</span>
            </div>
            <p className="text-[11px] text-slate-500">
              Standard incubation period from clutch placement to pipping and hatching.
            </p>
          </div>

          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
            <div className="flex items-center justify-between mb-1">
              <span className="font-bold text-slate-900">🦆 Duck Brooding:</span>
              <span className="font-extrabold text-teal-700">{DUCK_INCUBATION_DAYS} Days</span>
            </div>
            <p className="text-[11px] text-slate-500">
              Standard waterfowl incubation period for local and improved ducks.
            </p>
          </div>
        </div>
      </div>

      {/* ADMIN-ONLY SECTION: SUPABASE DATABASE CONFIGURATION */}
      {isAdmin ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-900 flex items-center">
              <Database className="w-4 h-4 mr-2 text-emerald-600" />
              Supabase Connection & Database Schema
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Status: {isSupabaseConfigured() ? 'Live Connected to Supabase' : 'Offline Engine Active (Pending Keys)'}
            </p>
          </div>
          <button
            onClick={onOpenSupabaseModal}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors"
          >
            Manage Database Keys & SQL
          </button>
        </div>
      ) : (
        <div className="bg-slate-50 rounded-2xl border border-slate-200/80 p-4 text-xs text-slate-500 flex items-center space-x-2">
          <Lock className="w-4 h-4 text-slate-400 shrink-0" />
          <span>Supabase backend credentials and database architecture are restricted to CEO Administrator.</span>
        </div>
      )}

      {/* ADMIN-ONLY SECTION: FACTORY RESET (GLOBAL CLEAR DATA) */}
      {isAdmin && (
        <div className="bg-rose-50/70 rounded-2xl border border-rose-200 p-6 shadow-xs space-y-3">
          <div className="flex items-center space-x-2 text-rose-800 font-bold text-sm">
            <AlertTriangle className="w-5 h-5 text-rose-600" />
            <span>Executive Danger Zone: Clear Global Database (All Users)</span>
          </div>
          <p className="text-xs text-rose-900/80">
            Wipes all records across the entire database for <strong>all users</strong>. This will delete all poultry flock entries, egg logs, brooding schedules, hatch records, sales receipts, and farm expenses from Supabase.
          </p>
          <button
            onClick={() => {
              setConfirmText('');
              setIsResetModalOpen(true);
            }}
            className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors flex items-center space-x-1.5"
          >
            <Trash2 className="w-4 h-4" />
            <span>Reset All Farm Data / Clear Database (All Users)</span>
          </button>
        </div>
      )}

      {/* Reset Confirmation Dialog */}
      {isResetModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-xs p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl p-6 border border-slate-200 space-y-4">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div className="text-center">
              <h3 className="text-base font-bold text-slate-900">Confirm Global Farm Data Wipe</h3>
              <p className="text-xs text-slate-600 mt-1">
                This action is executed by <strong>CEO Junior Jackson</strong> and <strong className="text-rose-600">CANNOT</strong> be undone. It wipes all tables throughout all user accounts:
              </p>
              <ul className="text-[11px] text-slate-500 mt-2 list-disc list-inside text-left bg-slate-50 p-2.5 rounded-xl space-y-0.5">
                <li>All registered poultry flocks & birds</li>
                <li>All daily egg production logs</li>
                <li>All brooding incubation batches (21d & 40d)</li>
                <li>All hatching records & chick recruitments</li>
                <li>All sales transactions & expense records</li>
              </ul>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 text-center">
                Type <span className="font-mono text-rose-600 font-black">RESET</span> to confirm:
              </label>
              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="RESET"
                className="w-full text-xs px-3 py-2 rounded-xl border border-slate-300 text-center font-bold tracking-widest uppercase focus:ring-2 focus:ring-rose-500"
              />
            </div>

            <div className="flex items-center space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setIsResetModalOpen(false)}
                className="flex-1 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteReset}
                disabled={confirmText.trim().toUpperCase() !== 'RESET' || isResetting}
                className="flex-1 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50 disabled:hover:bg-rose-600 rounded-xl shadow-xs transition-colors flex items-center justify-center space-x-1"
              >
                {isResetting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Clearing Database...</span>
                  </>
                ) : (
                  <span>Confirm Global Reset</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
