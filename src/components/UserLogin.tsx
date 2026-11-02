/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { User, Mail, Lock, Phone, ArrowRight, Sparkles } from 'lucide-react';
import { UserProfile } from '../types';
import { cleanErrorMessage } from '../utils/formatError';
import { apiFetch } from '../utils/apiInterceptor';

interface UserLoginProps {
  onLoginSuccess: (user: UserProfile, token: string) => void;
  switchToAdmin: () => void;
  hideSwitchToAdmin?: boolean;
  onCancel?: () => void;
}

export default function UserLogin({ onLoginSuccess, switchToAdmin, hideSwitchToAdmin, onCancel }: UserLoginProps) {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const DEFAULT_DEMO_CONFIG = {
    demoMode: true,
    customer: { email: 'user@ticket.com', password: 'user123', name: '示範買家 (Demo Buyer)' },
    customerAlias: { email: 'customer@ticket.com', password: '123456' }
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
      ? { email, password, name, phone, role: 'customer' }
      : { email, password, role: 'customer' };

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
        throw new Error(data.error || '認證程序發生錯誤');
      }

      if (isRegister) {
        setSuccessMsg('註冊成功！正在自動登入...');
        setTimeout(async () => {
          // Auto login after registration
          try {
            const loginRes = await apiFetch('/api/auth/login', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email, password, role: 'customer' }),
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
      setError(cleanErrorMessage(err, '連線伺服器失敗'));
    } finally {
      setLoading(false);
    }
  };

  const loadDemoUser = (emailChoice = 'user@ticket.com', passChoice = 'user123') => {
    setEmail(emailChoice);
    setPassword(passChoice);
    setIsRegister(false);
    setError('');
  };

  return (
    <div id="user-login-view" className="min-h-[80vh] flex flex-col justify-center items-center py-10 px-4">
      <motion.div 
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md bg-white rounded-2xl border border-slate-100 shadow-xl overflow-hidden"
      >
        {/* Banner */}
        <div className="bg-gradient-to-r from-blue-600 to-slate-900 p-6 text-white text-center relative overflow-hidden">
          <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-white/10 rounded-full blur-2xl" />
          <div className="absolute -left-10 -top-10 w-32 h-32 bg-blue-400/20 rounded-full blur-xl" />
          
          <div className="flex items-center justify-center gap-2 flex-wrap">
            <h2 className="text-2xl font-bold font-sans tracking-tight">程閱票務平台</h2>
            {demoConfig?.demoMode && (
              <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/40 inline-flex items-center gap-1 shadow-xs">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
                演示版
              </span>
            )}
          </div>
          <p className="text-blue-100 text-sm mt-1">智慧數位票夾與活動購買前端</p>
        </div>

        {/* Tab switcher */}
        <div className="flex border-b border-slate-200 bg-slate-50/50">
          <button 
            id="tab-btn-login"
            onClick={() => { setIsRegister(false); setError(''); }}
            className={`flex-1 py-3 text-center font-medium text-sm transition-colors ${!isRegister ? 'text-blue-600 border-b-2 border-blue-600 bg-white font-semibold' : 'text-slate-500 hover:text-slate-800'}`}
          >
            帳號登入
          </button>
          <button 
            id="tab-btn-register"
            onClick={() => { setIsRegister(true); setError(''); }}
            className={`flex-1 py-3 text-center font-medium text-sm transition-colors ${isRegister ? 'text-blue-600 border-b-2 border-blue-600 bg-white font-semibold' : 'text-slate-500 hover:text-slate-800'}`}
          >
            新用戶註冊
          </button>
        </div>

        {/* Form Body */}
        <div className="p-8">
          {error && (
            <div id="login-error-alert" className="p-3 mb-4 bg-red-50 text-red-600 rounded-lg text-xs font-medium border border-red-100">
              {error}
            </div>
          )}
          {successMsg && (
            <div id="login-success-alert" className="p-3 mb-4 bg-emerald-50 text-emerald-600 rounded-lg text-xs font-medium border border-emerald-100">
              {successMsg}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {isRegister && (
              <>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">真實姓名 <span className="text-red-500">*</span></label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                      <User size={16} />
                    </span>
                    <input 
                      id="register-input-name"
                      type="text"
                      required
                      placeholder="例：王小明"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all placeholder:text-slate-300 bg-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">行動電話</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                      <Phone size={16} />
                    </span>
                    <input 
                      id="register-input-phone"
                      type="tel"
                      placeholder="例：0912-345-678"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all placeholder:text-slate-300 bg-white"
                    />
                  </div>
                </div>
              </>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">電子郵件 (E-mail) <span className="text-red-500">*</span></label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                  <Mail size={16} />
                </span>
                <input 
                  id="login-input-email"
                  type="email"
                  required
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all placeholder:text-slate-300 bg-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">密碼 (Password) <span className="text-red-500">*</span></label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                  <Lock size={16} />
                </span>
                <input 
                  id="login-input-password"
                  type="password"
                  required
                  placeholder="請輸入您的登入密碼"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all placeholder:text-slate-300 bg-white"
                />
              </div>
            </div>

            <button 
              id="login-submit-btn"
              type="submit"
              disabled={loading}
              className="w-full mt-4 bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-1 shadow-sm hover:shadow-md disabled:opacity-50 cursor-pointer"
            >
              {loading ? (
                <span>處理中...</span>
              ) : (
                <>
                  <span>{isRegister ? '建立帳戶並登入' : '安全登入平台'}</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>

          {/* Demo Account Box (Shown if demoMode is active, solves Netlify hidden server log problem) */}
          {demoConfig?.demoMode !== false ? (
            <div className="mt-6 p-4 rounded-xl bg-blue-50/60 border border-blue-100 space-y-2.5 text-xs text-slate-700">
              <div className="flex items-center justify-between">
                <span className="font-bold flex items-center gap-1.5 text-blue-800 text-xs">
                  <Sparkles size={13} className="text-blue-600" />
                  <span>演示模式測試買家帳號</span>
                </span>
                <span className="text-[10px] bg-blue-200/60 text-blue-800 px-2 py-0.5 rounded-full font-mono font-bold">DEMO READY</span>
              </div>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                在 Netlify 或雲端環境無日誌時，點擊下方即可直接填入測試買家，體驗購票、轉贈與防偽電子票夾：
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  type="button"
                  id="fill-demo-user-btn"
                  onClick={() => loadDemoUser('user@ticket.com', 'user123')}
                  className="flex-1 py-1.5 px-3 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 transition-all active:scale-95 text-center shadow-xs cursor-pointer"
                >
                  填入示範買家 (user@ticket.com)
                </button>
                <button
                  type="button"
                  onClick={() => loadDemoUser('customer@ticket.com', '123456')}
                  className="py-1.5 px-3 bg-white text-slate-700 border border-slate-200 rounded-lg text-xs font-medium hover:bg-slate-50 transition-all active:scale-95 cursor-pointer"
                >
                  填入別名 (customer@ticket.com)
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-6 p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-slate-800 text-xs">
                <span>🔒 雲端同步與高安全帳戶</span>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                您的票券與身分採 AES-256 密碼學加密儲存於伺服器。無論更換手機、平板或電腦，只要以相同帳密登入，票券與核銷狀態自動完整同步，絕不遺失。
              </p>
            </div>
          )}

          {/* Switch view */}
          <div className="mt-8 text-center pt-6 border-t border-slate-200 flex flex-col gap-3 items-center justify-center">
            {onCancel && (
              <button 
                id="login-cancel-btn"
                onClick={onCancel}
                className="text-xs text-blue-600 hover:text-blue-800 font-bold hover:underline cursor-pointer"
              >
                ← 返回活動專區 (繼續瀏覽)
              </button>
            )}
            {!hideSwitchToAdmin && (
              <button 
                id="switch-to-admin-login"
                onClick={switchToAdmin}
                className="text-xs text-slate-500 hover:text-blue-600 font-medium underline underline-offset-4 cursor-pointer"
              >
                切換至「管理員 / 驗票窗口登入」
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
