/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { User, ShieldCheck, Key, Phone, Mail, CheckCircle, RefreshCw, LogOut, Cpu, Trash2, AlertTriangle, Clock, RotateCcw } from 'lucide-react';

interface UserSettingsProps {
  user: {
    id: string;
    email: string;
    name: string;
    phone?: string;
    role: string;
    createdAt?: string;
    deletionScheduledAt?: string;
  };
  token: string;
  onLogout: () => void;
  onUpdateProfile: (updatedUser: any) => void;
}

export default function UserSettings({ user, token, onLogout, onUpdateProfile }: UserSettingsProps) {
  // Profile update form state
  const [name, setName] = useState(user.name);
  const [phone, setPhone] = useState(user.phone || '');
  const [updatingProfile, setUpdatingProfile] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState('');
  const [profileError, setProfileError] = useState('');

  // Password update form state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [updatingPassword, setUpdatingPassword] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [passwordError, setPasswordError] = useState('');

  // Account deletion modal and request state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingLoading, setDeletingLoading] = useState(false);
  const [deleteMsg, setDeleteMsg] = useState('');
  const [deleteError, setDeleteError] = useState('');

  const handleRequestDelete = async () => {
    setDeleteError('');
    setDeleteMsg('');
    setDeletingLoading(true);

    try {
      const res = await fetch('/api/auth/request-delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || '申請刪除帳號失敗');
      }

      setDeleteMsg(data.message);
      onUpdateProfile(data.user);
      setShowDeleteModal(false);
    } catch (err: any) {
      setDeleteError(err.message || '網路請求失敗');
    } finally {
      setDeletingLoading(false);
    }
  };

  const handleCancelDelete = async () => {
    setDeleteError('');
    setDeleteMsg('');
    setDeletingLoading(true);

    try {
      const res = await fetch('/api/auth/cancel-delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || '取消刪除申請失敗');
      }

      setDeleteMsg(data.message);
      onUpdateProfile(data.user);
    } catch (err: any) {
      setDeleteError(err.message || '網路請求失敗');
    } finally {
      setDeletingLoading(false);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError('');
    setProfileSuccess('');
    setUpdatingProfile(true);

    try {
      const res = await fetch('/api/auth/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ name, phone })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || '更新個人資料失敗');
      }

      setProfileSuccess('🎉 個人資料已成功更新並安全儲存！');
      onUpdateProfile(data.user);
    } catch (err: any) {
      setProfileError(err.message || '連線錯誤，請稍後再試');
    } finally {
      setUpdatingProfile(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');

    if (newPassword !== confirmPassword) {
      setPasswordError('兩次輸入的新密碼不相符');
      return;
    }

    if (newPassword.length < 6) {
      setPasswordError('新密碼長度必須大於 6 個字元');
      return;
    }

    setUpdatingPassword('changing');

    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ currentPassword, newPassword })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || '變更密碼失敗');
      }

      setPasswordSuccess('🎉 密碼已成功變更！下次登入時請使用新密碼。');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setPasswordError(err.message || '密碼變更失敗');
    } finally {
      setUpdatingPassword('');
    }
  };

  return (
    <div className="space-y-8 pb-10">
      {/* Title block */}
      <div className="border-b border-slate-200 pb-4">
        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          <User size={20} className="text-blue-600" />
          <span>帳戶設定與安全中心</span>
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          管理您的個人票夾聯絡資訊、密碼安全及校驗系統通訊安全等各項基本設定。
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left column: Profile and Password Forms */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* Profile form */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
            <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2 border-b border-slate-100 pb-3 mb-4">
              <User size={16} className="text-blue-600" />
              <span>基本資料編輯</span>
            </h3>

            {profileSuccess && (
              <div className="p-3 mb-4 bg-emerald-50 text-emerald-800 rounded-xl text-xs font-semibold border border-emerald-150 flex items-center gap-2">
                <CheckCircle size={14} className="text-emerald-500" />
                <span>{profileSuccess}</span>
              </div>
            )}
            {profileError && (
              <div className="p-3 mb-4 bg-red-50 text-red-800 rounded-xl text-xs font-semibold border border-red-150">
                {profileError}
              </div>
            )}

            <form onSubmit={handleUpdateProfile} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">電子郵件 (帳號唯一碼)</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                    <Mail size={14} />
                  </span>
                  <input
                    type="email"
                    disabled
                    value={user.email}
                    className="w-full pl-9 pr-4 py-2 bg-slate-50 text-slate-400 border border-slate-200 rounded-xl text-xs cursor-not-allowed font-mono"
                  />
                </div>
                <p className="text-[10px] text-slate-400 mt-1">電子郵件作為本帳號唯一登入標識，無法進行變更。</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">持票人真實姓名 <span className="text-red-500">*</span></label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                    <User size={14} />
                  </span>
                  <input
                    type="text"
                    required
                    placeholder="請輸入購票人的真實姓名"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all placeholder:text-slate-300"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">行動電話（現場核對防偽用途）</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                    <Phone size={14} />
                  </span>
                  <input
                    type="text"
                    placeholder="例：0912-345-678"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all placeholder:text-slate-300"
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={updatingProfile}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl cursor-pointer shadow-xs hover:shadow-md transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  {updatingProfile ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" />
                      <span>正在安全儲存...</span>
                    </>
                  ) : (
                    <span>儲存修改 Save Profile</span>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* Change password */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
            <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2 border-b border-slate-100 pb-3 mb-4">
              <Key size={16} className="text-blue-600" />
              <span>變更後台安全密碼</span>
            </h3>

            {passwordSuccess && (
              <div className="p-3 mb-4 bg-emerald-50 text-emerald-800 rounded-xl text-xs font-semibold border border-emerald-150 flex items-center gap-2">
                <CheckCircle size={14} className="text-emerald-500" />
                <span>{passwordSuccess}</span>
              </div>
            )}
            {passwordError && (
              <div className="p-3 mb-4 bg-red-50 text-red-800 rounded-xl text-xs font-semibold border border-red-150">
                {passwordError}
              </div>
            )}

            <form onSubmit={handleChangePassword} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">目前密碼</label>
                <input
                  type="password"
                  required
                  placeholder="請輸入現有密碼"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all placeholder:text-slate-300"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">新設定密碼</label>
                  <input
                    type="password"
                    required
                    placeholder="至少 6 位字元"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all placeholder:text-slate-300"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">確認新密碼</label>
                  <input
                    type="password"
                    required
                    placeholder="請再次輸入新密碼"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all placeholder:text-slate-300"
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={updatingPassword !== ''}
                  className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold rounded-xl cursor-pointer shadow-xs hover:shadow-md transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  {updatingPassword ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" />
                      <span>正在重寫加密編碼...</span>
                    </>
                  ) : (
                    <span>更換密碼 Update Password</span>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* Account Deletion & Cooling Period Management */}
          <div className="bg-white p-6 rounded-2xl border border-red-200/70 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-red-700 flex items-center gap-2 border-b border-red-100 pb-3">
              <Trash2 size={16} className="text-red-600" />
              <span>註銷與刪除帳號 (Account Deletion & Cooling Period)</span>
            </h3>

            {deleteMsg && (
              <div className="p-3 bg-emerald-50 text-emerald-800 rounded-xl text-xs font-semibold border border-emerald-150 flex items-center gap-2">
                <CheckCircle size={14} className="text-emerald-500" />
                <span>{deleteMsg}</span>
              </div>
            )}
            {deleteError && (
              <div className="p-3 bg-red-50 text-red-800 rounded-xl text-xs font-semibold border border-red-150">
                {deleteError}
              </div>
            )}

            {user.deletionScheduledAt ? (
              /* Active Cooling Period Banner */
              <div className="bg-amber-50/90 border border-amber-300 rounded-xl p-4 space-y-3">
                <div className="flex items-start gap-2.5 text-amber-900">
                  <Clock size={20} className="text-amber-600 shrink-0 mt-0.5 animate-pulse" />
                  <div className="space-y-1">
                    <p className="font-extrabold text-xs">⚠️ 帳號正處於 7 天刪除冷靜期中</p>
                    <p className="text-[11px] text-amber-800 leading-relaxed">
                      您已於早前申請註銷此帳號。預計徹底刪除時間為：
                      <span className="font-bold font-mono text-amber-950 ml-1">
                        {new Date(user.deletionScheduledAt).toLocaleString('zh-TW')}
                      </span>
                    </p>
                    <p className="text-[10px] text-amber-700 font-medium">
                      💡 提示：在 7 天冷靜期內，若您再次登入此帳號，刪除申請將會自動取消並恢復正常！您亦可點擊下方按鈕直接手動撤銷。
                    </p>
                  </div>
                </div>

                <div className="pt-2 flex gap-3">
                  <button
                    type="button"
                    onClick={handleCancelDelete}
                    disabled={deletingLoading}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {deletingLoading ? (
                      <RefreshCw size={13} className="animate-spin" />
                    ) : (
                      <RotateCcw size={13} />
                    )}
                    <span>撤銷刪除申請並恢復帳號</span>
                  </button>
                </div>
              </div>
            ) : (
              /* Normal state - Request deletion button */
              <div className="space-y-3">
                <p className="text-xs text-slate-500 leading-relaxed">
                  申請註銷帳號後，系統將為您開啟 <span className="font-bold text-amber-600">7 天冷靜期</span>。在冷靜期內，您可以隨時登入以自動恢復帳號使用。7 天期滿後，您的個人隱私資料與門票清冊將被徹底刪除。
                </p>

                <button
                  type="button"
                  onClick={() => setShowDeleteModal(true)}
                  className="px-4 py-2 bg-red-50 hover:bg-red-100 text-red-700 font-bold text-xs rounded-xl border border-red-200 transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
                >
                  <Trash2 size={13} className="text-red-600" />
                  <span>申請刪除帳號 (預約 7 天冷靜期)</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Confirmation Modal for Account Deletion */}
        <AnimatePresence>
          {showDeleteModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 space-y-4 text-slate-800"
              >
                <div className="flex items-center gap-2.5 text-red-600 border-b border-slate-100 pb-3">
                  <AlertTriangle size={22} className="shrink-0" />
                  <h3 className="font-bold text-sm">確認要申請刪除個人帳號嗎？</h3>
                </div>

                <div className="space-y-2.5 text-xs text-slate-600 leading-relaxed">
                  <p className="font-bold text-slate-800">
                    請注意：申請後將有 <span className="text-amber-600">7 天冷靜期</span> 緩衝機制。
                  </p>
                  <ul className="list-disc pl-5 space-y-1 text-slate-500">
                    <li>7 天內：只要您重新登入系統，刪除申請將會自動撤銷。</li>
                    <li>7 天後：系統將自動徹底清除您的個人資料與購票清冊，且無法還原。</li>
                  </ul>
                </div>

                <div className="pt-3 flex gap-3 justify-end border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowDeleteModal(false)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition-all cursor-pointer"
                  >
                    取消並保留帳號
                  </button>

                  <button
                    type="button"
                    onClick={handleRequestDelete}
                    disabled={deletingLoading}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {deletingLoading ? (
                      <RefreshCw size={13} className="animate-spin" />
                    ) : (
                      <Trash2 size={13} />
                    )}
                    <span>確定申請刪除 (開啟冷靜期)</span>
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Right column: System Security Profile Info */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-slate-900 text-white p-6 rounded-2xl border border-slate-800 shadow-md space-y-5">
            <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
              <ShieldCheck size={18} className="text-emerald-400" />
              <h3 className="text-xs font-bold font-mono text-emerald-400 tracking-wider uppercase">SECURE PASS CENTER / 安全認證中心</h3>
            </div>

            <div className="space-y-4 text-xs">
              <div className="flex justify-between items-center border-b border-slate-800/40 pb-2">
                <span className="text-slate-400">登入權限角色：</span>
                <span className="bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[10px] px-2 py-0.5 rounded-md font-bold font-sans">
                  {user.role === 'admin' ? '🏆 系統超級管理員' : user.role === 'scanner' ? '🔍 現場驗票窗口' : '👤 一般持票買家'}
                </span>
              </div>
              <div className="flex justify-between items-center border-b border-slate-800/40 pb-2">
                <span className="text-slate-400">電子信箱核備：</span>
                <span className="font-mono text-slate-200">{user.email}</span>
              </div>
              {user.createdAt && (
                <div className="flex justify-between items-center border-b border-slate-800/40 pb-2">
                  <span className="text-slate-400">帳號註冊日期：</span>
                  <span className="font-mono text-slate-200">
                    {new Date(user.createdAt).toLocaleDateString('zh-TW', { dateStyle: 'long' })}
                  </span>
                </div>
              )}
            </div>

            {/* Cryptographic Proof Explanations */}
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-850 space-y-3 text-[11px] leading-relaxed text-slate-400">
              <div className="flex items-start gap-2">
                <Cpu size={14} className="text-blue-400 mt-0.5 shrink-0" />
                <div>
                  <p className="font-bold text-slate-200 text-xs">數位加密安全標準 (AES-256)</p>
                  <p className="mt-1">
                    您的持票人真實姓名與行動電話等隱私欄位，皆採用伺服器專屬密鑰進行 **AES-256-CBC 位元加密封裝** 儲存。即使資料庫外洩，惡意第三方亦無法解密其內容，保障您的交易隱私。
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-2 border-t border-slate-850 pt-3">
                <ShieldCheck size={14} className="text-emerald-400 mt-0.5 shrink-0" />
                <div>
                  <p className="font-bold text-slate-200 text-xs">票券防偽防雙花核銷碼 (HMAC-SHA256)</p>
                  <p className="mt-1">
                    本系統開出之電子門票包含具有防偽雜湊認證的專利一體化票卡。每次驗票時，驗票機之雷達均會重新計算特定 HMAC 簽章，徹底防止截圖複製、重製或雙重核銷。
                  </p>
                </div>
              </div>
            </div>

            {/* Logout button */}
            <div className="pt-2">
              <button
                onClick={onLogout}
                className="w-full py-2.5 bg-red-600/10 hover:bg-red-600/20 text-red-400 hover:text-red-300 border border-red-500/20 hover:border-red-500/40 rounded-xl transition-all font-semibold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
              >
                <LogOut size={14} />
                <span>登出目前帳號 Logout Account</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
