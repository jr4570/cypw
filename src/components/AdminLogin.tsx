/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { ShieldAlert, Mail, Lock, User, ArrowRight, CheckCircle, Sparkles } from 'lucide-react';
import { UserProfile } from '../types';
import { cleanErrorMessage } from '../utils/formatError';
import { apiFetch } from '../utils/apiInterceptor';

interface AdminLoginProps {
  onLoginSuccess: (user: UserProfile, token: string) => void;
  switchToUser: () => void;
}

export default function AdminLogin({ onLoginSuccess, switchToUser }: AdminLoginProps) {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [selectedRole, setSelectedRole] = useState<'admin' | 'scanner'>('admin');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const DEFAULT_DEMO_CONFIG = {
    demoMode: true,
    admin: { email: 'admin@ticket.com', password: 'admin123', name: '系統管理員 (Demo Admin)' },
    adminAlias: { email: 'staff@ticket.com', password: 'staff123' }
  };
  const [demoConfig, setDemoConfig] = useState<any>(DEFAULT_DEMO_CONFIG);

  useEffect(() => {
    apiFetch('/api/demo/credentials')
      .then(async res => {
        if (res.ok) {
          try {
            return await res.json();
          } catch {
            return DEFAULT_DEMO_CONFIG;
          }
        }
        return DEFAULT_DEMO_CONFIG;
      })
      .then(data => setDemoConfig(data || DEFAULT_DEMO_CONFIG))
      .catch(() => setDemoConfig(DEFAULT_DEMO_CONFIG));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const url = isRegister ? '/api/auth/register' : '/api/auth/login';
    const payload = isRegister
      ? { email, password, name, role: selectedRole }
      : { email, password, role: selectedRole };

    try {
      const res = await apiFetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      let data: any = {};
      try {
        data = await res.json();
      } catch (parseErr) {
        data = { error: '伺服器回應資料解析失敗' };
      }

      if (!res.ok) {
        throw new Error(data.error || '驗證不通過，請檢查輸入');
      }

      if (isRegister) {
        setSuccessMsg('管理員帳密建立成功！正在自動登入儀表板...');
        setTimeout(async () => {
          try {
            const loginRes = await apiFetch('/api/auth/login', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email, password, role: selectedRole }),
            });
            const loginData = await loginRes.json();
            if (loginRes.ok) {
              onLoginSuccess(loginData.user, loginData.token);
            } else {
              setIsRegister(false);
              setSuccessMsg('');
            }
          } catch {
            setIsRegister(false);
            setSuccessMsg('');
          }
        }, 1500);
      } else {
        onLoginSuccess(data.user, data.token);
      }
    } catch (err: any) {
      setError(cleanErrorMessage(err, '無法連線至驗證伺服器'));
    } finally {
      setLoading(false);
    }
  };

  const loadDemoAdmin = (emailChoice = 'admin@ticket.com', passChoice = 'admin123') => {
    setEmail(emailChoice);
    setPassword(passChoice);
    setIsRegister(false);
    setError('');
  };

  return (
    <div id="admin-login-view" className="min-h-[80vh] flex flex-col justify-center items-center py-10 px-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden text-slate-100"
      >
        {/* Banner */}
        <div className="bg-slate-950 p-6 border-b border-slate-800 text-center relative">
          <div className="absolute right-3 top-3 bg-red-500/10 text-red-400 text-[10px] font-bold px-2 py-0.5 rounded border border-red-500/20 flex items-center gap-1">
            <ShieldAlert size={10} />
            <span>ADMIN MODE</span>
          </div>
          
          <div className="flex items-center justify-center gap-2 mt-2 flex-wrap">
            <h2 className="text-xl font-bold tracking-wider font-sans text-white">程閱票務後台系統</h2>
            {demoConfig?.demoMode && (
              <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 inline-flex items-center gap-1 shadow-xs">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
                演示版
              </span>
            )}
          </div>
          <p className="text-slate-400 text-xs mt-1">即時跨平台核銷、防偽防雙花與數據分析儀表板</p>
        </div>

        {/* Tab switcher */}
        <div className="flex border-b border-slate-800 bg-slate-950/40">
          <button
            id="admin-tab-login"
            onClick={() => { setIsRegister(false); setError(''); }}
            className={`flex-1 py-3 text-center font-medium text-xs transition-colors ${!isRegister ? 'text-blue-400 border-b-2 border-blue-400 bg-slate-900/30' : 'text-slate-500 hover:text-slate-300'}`}
          >
            後台登入
          </button>
          <button
            id="admin-tab-register"
            onClick={() => { setIsRegister(true); setError(''); }}
            className={`flex-1 py-3 text-center font-medium text-xs transition-colors ${isRegister ? 'text-blue-400 border-b-2 border-blue-400 bg-slate-900/30' : 'text-slate-500 hover:text-slate-300'}`}
          >
            建立管理帳密
          </button>
        </div>

        {/* Form Body */}
        <div className="p-8">
          {error && (
            <div id="admin-error-alert" className="p-3 mb-4 bg-red-500/10 text-red-400 rounded-lg text-xs font-medium border border-red-500/20">
              {error}
            </div>
          )}
          {successMsg && (
            <div id="admin-success-alert" className="p-3 mb-4 bg-blue-500/10 text-blue-400 rounded-lg text-xs font-medium border border-blue-500/20">
              {successMsg}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {isRegister ? (
              <>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">管理員姓名 <span className="text-red-500">*</span></label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                      <User size={16} />
                    </span>
                    <input
                      id="admin-register-name"
                      type="text"
                      required
                      placeholder="例：陳主任"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-all placeholder:text-slate-600"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">系統授權權限組 <span className="text-red-500">*</span></label>
                  <select
                    id="admin-role-select"
                    value={selectedRole}
                    onChange={(e) => setSelectedRole(e.target.value as 'admin' | 'scanner')}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-blue-500 transition-all cursor-pointer"
                  >
                    <option value="admin">🏆 系統管理員 (Full Admin - 儀表板、活動新增、掃描驗票)</option>
                    <option value="scanner">🔍 專屬驗票員 (Scanner Only - 僅有掃描驗票核銷功能)</option>
                  </select>
                </div>
              </>
            ) : (
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">選擇登入身份 / 角色組 <span className="text-red-500">*</span></label>
                <select
                  id="admin-login-role-select"
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value as 'admin' | 'scanner')}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-blue-500 transition-all cursor-pointer font-sans font-bold text-blue-400"
                >
                  <option value="admin">🏆 系統管理員 (Full Admin Dashboard)</option>
                  <option value="scanner">🔍 專屬驗票員 (Scanner Gate Only)</option>
                </select>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">管理帳號 (E-mail) <span className="text-red-500">*</span></label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                  <Mail size={16} />
                </span>
                <input
                  id="admin-login-email"
                  type="email"
                  required
                  placeholder="admin@ticket.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-all placeholder:text-slate-600"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">後台安全密碼 <span className="text-red-500">*</span></label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                  <Lock size={16} />
                </span>
                <input
                  id="admin-login-password"
                  type="password"
                  required
                  placeholder="請輸入管理密碼"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-all placeholder:text-slate-600"
                />
              </div>
            </div>

            <button
              id="admin-submit-btn"
              type="submit"
              disabled={loading}
              className="w-full mt-4 bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-1 shadow-md hover:shadow-lg disabled:opacity-50 cursor-pointer"
            >
              {loading ? (
                <span>正在進行安全校驗...</span>
              ) : (
                <>
                  <span>{isRegister ? '建立並進入控制台' : '安全驗證並登入'}</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>

          {/* Demo Account Box (Shown if demoMode is active, solves Netlify hidden server log problem) */}
          {demoConfig?.demoMode !== false ? (
            <div className="mt-6 p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2.5 text-xs text-slate-300">
              <div className="flex items-center justify-between">
                <span className="font-bold flex items-center gap-1.5 text-blue-400 text-xs">
                  <Sparkles size={13} />
                  <span>演示模式測試帳號 (免查後台終端日誌)</span>
                </span>
                <span className="text-[10px] bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded-full font-mono">DEMO READY</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                在 Netlify / 雲端環境中無需翻閱伺服器終端輸出，點擊下方即可一鍵填入標準演示管理員憑證：
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  type="button"
                  id="fill-demo-admin-btn"
                  onClick={() => loadDemoAdmin('admin@ticket.com', 'admin123')}
                  className="flex-1 py-1.5 px-3 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 rounded-lg text-xs font-semibold cursor-pointer transition-all active:scale-95 text-center"
                >
                  填入主辦管理員 (admin@ticket.com)
                </button>
                <button
                  type="button"
                  onClick={() => loadDemoAdmin('staff@ticket.com', 'staff123')}
                  className="py-1.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-lg text-xs font-medium cursor-pointer transition-all active:scale-95"
                >
                  填入主管 (staff@ticket.com)
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-6 p-3.5 rounded-xl bg-slate-950 border border-slate-800/80 text-xs text-slate-400 space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-amber-400 text-xs">
                <ShieldAlert size={14} />
                <span>非演示正式營運模式 (Production Mode)</span>
              </div>
              <p className="text-[11px] leading-relaxed">
                展示測試帳密已清空。請點擊上方「建立管理帳密」註冊您的官方主辦管理員帳號！
              </p>
            </div>
          )}

          {/* Switch view */}
          <div className="mt-8 text-center pt-6 border-t border-slate-850">
            <button
              id="switch-to-user-login"
              onClick={switchToUser}
              className="text-xs text-slate-400 hover:text-blue-400 font-medium underline underline-offset-4 cursor-pointer"
            >
              切換回「一般用戶登入 / 購票專區」
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
