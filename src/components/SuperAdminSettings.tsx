/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Settings, CheckSquare, XSquare, AlertTriangle, ShieldCheck, Users, Trash2, ToggleLeft, ToggleRight, Info, Sparkles, RefreshCw, Star, Lock, Unlock } from 'lucide-react';
import { EventSetting } from '../types';

interface SuperAdminSettingsProps {
  token: string;
  onSettingsUpdated?: () => void;
}

export interface SystemSettings {
  systemName: string;
  systemSlogan: string;
  contactPhone: string;
  demoMode: boolean;
  requireApproval: boolean;
  bannerUrl: string;
  demoLocked?: boolean;
}

export default function SuperAdminSettings({ token, onSettingsUpdated }: SuperAdminSettingsProps) {
  const [activeTab, setActiveTab] = useState<'system' | 'events' | 'users'>('system');

  // System Settings state
  const [sysSettings, setSysSettings] = useState<SystemSettings>({
    systemName: '程閱安全票務管理平台',
    systemSlogan: '採用加密驗證防偽核銷的高安全智慧票務系統',
    contactPhone: '02-2777-6666',
    demoMode: true,
    requireApproval: false,
    bannerUrl: '',
    demoLocked: true
  });
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState('');

  // Events Review list state
  const [events, setEvents] = useState<EventSetting[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [eventActionId, setEventActionId] = useState('');

  // Users list state
  const [users, setUsers] = useState<any[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  useEffect(() => {
    fetchSettings();
    if (activeTab === 'events') {
      fetchEvents();
    } else if (activeTab === 'users') {
      fetchUsers();
    }
  }, [activeTab]);

  const fetchSettings = async () => {
    try {
      setLoadingSettings(true);
      const res = await fetch('/api/settings');
      if (res.ok) {
        const data = await res.json();
        setSysSettings(data);
      }
    } catch (err) {
      console.error("Error fetching settings:", err);
    } finally {
      setLoadingSettings(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveSuccess('');
    setSavingSettings(true);

    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(sysSettings)
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || '儲存設定失敗');
      }

      setSaveSuccess('🎉 系統全域設定已成功儲存與發布！');
      setSysSettings(data.settings);
      
      // Update HTML Document title on the fly if systemName changes
      document.title = data.settings.systemName;
      if (onSettingsUpdated) {
        onSettingsUpdated();
      }
      
      setTimeout(() => setSaveSuccess(''), 4000);
    } catch (err: any) {
      alert(err.message || '儲存設定失敗');
    } finally {
      setSavingSettings(false);
    }
  };

  const fetchEvents = async () => {
    try {
      setLoadingEvents(true);
      const res = await fetch('/api/events');
      if (res.ok) {
        const data = await res.json();
        setEvents(data);
      }
    } catch (err) {
      console.error("Error fetching events:", err);
    } finally {
      setLoadingEvents(false);
    }
  };

  const fetchUsers = async () => {
    try {
      setLoadingUsers(true);
      const res = await fetch('/api/admin/users', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        setUsers(data);
      }
    } catch (err) {
      console.error("Error fetching users:", err);
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleApproveEvent = async (eventId: string) => {
    setEventActionId(eventId);
    try {
      const res = await fetch(`/api/events/${eventId}/approve`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        fetchEvents();
      } else {
        const data = await res.json();
        alert(data.error || '審核通過失敗');
      }
    } catch (err) {
      console.error("Error approving event:", err);
    } finally {
      setEventActionId('');
    }
  };

  const handleRejectEvent = async (eventId: string) => {
    if (!window.confirm("確定要駁回此活動申請並將其設為取消狀態嗎？")) {
      return;
    }
    setEventActionId(eventId);
    try {
      const res = await fetch(`/api/events/${eventId}/reject`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        fetchEvents();
      } else {
        const data = await res.json();
        alert(data.error || '駁回失敗');
      }
    } catch (err) {
      console.error("Error rejecting event:", err);
    } finally {
      setEventActionId('');
    }
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    try {
      const res = await fetch(`/api/admin/users/${userId}/role`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ role: newRole })
      });
      const data = await res.json();
      if (res.ok) {
        alert(data.message || '角色權限變更成功！');
        fetchUsers();
      } else {
        alert(data.error || '角色變更失敗');
      }
    } catch (err) {
      console.error("Error changing role:", err);
    }
  };

  const handleDeleteUser = async (userId: string, email: string) => {
    if (!window.confirm(`🚨 警告：確定要永久刪除帳號「${email}」嗎？\n該帳號擁有的所有電子門票也將被同步刪除且不可回復！`)) {
      return;
    }
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (res.ok) {
        alert(data.message || '使用者帳號已成功刪除！');
        fetchUsers();
      } else {
        alert(data.error || '刪除失敗');
      }
    } catch (err) {
      console.error("Error deleting user:", err);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Title */}
      <div className="border-b border-slate-200 pb-4">
        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          <Settings size={22} className="text-blue-600 animate-spin-slow" />
          <span>超級管理員系統控制中心</span>
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          管理全域系統基本設定、剛搭建系統時的簡易初始化、活動審核與上架流向，以及系統各權限組帳密。
        </p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 gap-1 bg-slate-50 p-1 rounded-xl">
        <button
          onClick={() => setActiveTab('system')}
          className={`flex-1 md:flex-none px-5 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
            activeTab === 'system'
              ? 'bg-white text-blue-600 shadow-sm border border-slate-200/50'
              : 'text-slate-600 hover:text-slate-800 hover:bg-white/40'
          }`}
        >
          ⚙️ 系統基本設定
        </button>
        <button
          onClick={() => setActiveTab('events')}
          className={`flex-1 md:flex-none px-5 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
            activeTab === 'events'
              ? 'bg-white text-blue-600 shadow-sm border border-slate-200/50'
              : 'text-slate-600 hover:text-slate-800 hover:bg-white/40'
          }`}
        >
          📋 活動審核機制
        </button>
        <button
          onClick={() => setActiveTab('users')}
          className={`flex-1 md:flex-none px-5 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
            activeTab === 'users'
              ? 'bg-white text-blue-600 shadow-sm border border-slate-200/50'
              : 'text-slate-600 hover:text-slate-800 hover:bg-white/40'
          }`}
        >
          👤 系統帳號安全
        </button>
      </div>

      {/* Tab Contents */}
      {activeTab === 'system' && (
        <motion.div
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-1 lg:grid-cols-12 gap-6"
        >
          {/* Main settings form */}
          <div className="lg:col-span-8 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-6">
            <h3 className="text-sm font-bold text-slate-700 flex items-center gap-1.5 border-b border-slate-100 pb-3">
              <Sparkles size={16} className="text-blue-500 animate-pulse" />
              <span>系統全域自訂屬性設定 (System Identity)</span>
            </h3>

            {saveSuccess && (
              <div className="p-3 bg-emerald-50 text-emerald-800 rounded-xl text-xs font-semibold border border-emerald-150 flex items-center gap-1.5">
                <CheckSquare size={14} className="text-emerald-500" />
                <span>{saveSuccess}</span>
              </div>
            )}

            <form onSubmit={handleSaveSettings} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-600 mb-1">系統平台名稱 <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    required
                    placeholder="例：程閱安全票務管理平台"
                    value={sysSettings.systemName}
                    onChange={(e) => setSysSettings({ ...sysSettings, systemName: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all placeholder:text-slate-300"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">此欄位將在剛搭建系統時，即時替換全站抬頭與瀏覽器標題。</p>
                </div>

                <div>
                  <label className="block font-semibold text-slate-600 mb-1">系統副標題 / 宣傳標語</label>
                  <input
                    type="text"
                    placeholder="例：採用加密雜湊簽發之高防偽智慧票券系統"
                    value={sysSettings.systemSlogan}
                    onChange={(e) => setSysSettings({ ...sysSettings, systemSlogan: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all placeholder:text-slate-300"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-600 mb-1">客服電話 / 聯絡方式</label>
                  <input
                    type="text"
                    placeholder="例：02-2777-6666"
                    value={sysSettings.contactPhone}
                    onChange={(e) => setSysSettings({ ...sysSettings, contactPhone: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all placeholder:text-slate-300"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-600 mb-1">主打封面宣傳 Banner 圖片 URL</label>
                  <input
                    type="text"
                    placeholder="圖片網址"
                    value={sysSettings.bannerUrl}
                    onChange={(e) => setSysSettings({ ...sysSettings, bannerUrl: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all placeholder:text-slate-300 font-mono"
                  />
                </div>
              </div>

              {/* Toggles */}
              <div className="pt-4 border-t border-slate-100 space-y-4">
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/60 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5 pr-4">
                      <p className="font-bold text-slate-700 flex items-center gap-1.5 flex-wrap">
                        <span>💡 系統「演示模式」(Demo Mode)</span>
                        {sysSettings.demoMode && <span className="bg-blue-100 text-blue-700 font-extrabold text-[9px] px-1.5 py-0.5 rounded-sm">ACTIVE</span>}
                        {sysSettings.demoLocked ? (
                          <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-amber-500/10 text-amber-700 border border-amber-500/30 inline-flex items-center gap-1">
                            <Lock size={10} className="text-amber-600" />
                            <span>線上演示鎖定 (禁止關閉)</span>
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-500/10 text-emerald-700 border border-emerald-500/30 inline-flex items-center gap-1">
                            <Unlock size={10} className="text-emerald-600" />
                            <span>私有部署已解鎖 (可自由開關)</span>
                          </span>
                        )}
                      </p>
                      <p className="text-[10px] text-slate-400">
                        開啟後，系統將顯示演示標籤並提供預載的示範活動與測試帳號；關閉後切換為正式營運模式，僅顯示真實新增的活動。
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (sysSettings.demoLocked) {
                          alert("🔒 此線上託管環境已鎖定演示模式，以防止公共環境展示資料失效。\n\n若您自行部署（Self-hosted），請在環境變數設定 SELF_HOSTED=true 或 DEMO_LOCKED=false，即可解鎖並自由切換開啟或關閉！");
                          return;
                        }
                        setSysSettings({ ...sysSettings, demoMode: !sysSettings.demoMode });
                      }}
                      className={`p-1 shrink-0 transition-all active:scale-95 cursor-pointer ${
                        sysSettings.demoLocked ? 'opacity-70 cursor-not-allowed' : ''
                      }`}
                      title={sysSettings.demoLocked ? "線上託管演示模式已鎖定防止關閉" : "切換演示模式"}
                    >
                      {sysSettings.demoMode ? (
                        <div className="relative inline-flex items-center">
                          <ToggleRight size={38} className={sysSettings.demoLocked ? "text-amber-600" : "text-blue-600"} />
                          {sysSettings.demoLocked && <Lock size={12} className="absolute inset-0 m-auto text-white pointer-events-none" />}
                        </div>
                      ) : (
                        <ToggleLeft size={38} className="text-slate-450" />
                      )}
                    </button>
                  </div>

                  {/* Informational Callout regarding Cloud vs Self-hosted */}
                  {sysSettings.demoLocked && (
                    <div className="p-3 bg-amber-50 border border-amber-200/80 rounded-xl text-amber-900 text-xs flex items-start gap-2.5">
                      <Lock size={15} className="shrink-0 mt-0.5 text-amber-600" />
                      <div className="space-y-1">
                        <p className="font-bold text-amber-950">線上演示模式已鎖定保護（防止公共環境被關閉）</p>
                        <p className="text-[11px] leading-relaxed text-amber-800">
                          當前處於線上公共演示環境，系統鎖定啟用演示模式與預載測試活動，以確保每位訪問者均可順暢體驗購票與核銷流程。
                        </p>
                        <p className="text-[11px] leading-relaxed text-amber-900 font-medium">
                          💡 <strong className="font-bold">自己部署 (Self-hosted) 解鎖方法：</strong>自行架設時，只需在伺服器環境變數中設定 <code className="bg-amber-200/60 text-amber-900 px-1.5 py-0.5 rounded font-mono font-bold">SELF_HOSTED=true</code> 或 <code className="bg-amber-200/60 text-amber-900 px-1.5 py-0.5 rounded font-mono font-bold">DEMO_LOCKED=false</code>，此處即可自由關閉演示模式。
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl border border-slate-200/60">
                  <div className="space-y-0.5 pr-4">
                    <p className="font-bold text-slate-700 flex items-center gap-1">
                      <span>📋 啟用「新建活動審核機制」</span>
                      {sysSettings.requireApproval && <span className="bg-amber-100 text-amber-700 font-extrabold text-[9px] px-1.5 py-0.5 rounded-sm">REQUIRE</span>}
                    </p>
                    <p className="text-[10px] text-slate-400">
                      開啟後，當主辦管理員建立新活動時，預設狀態將為「待審核 (Pending)」，必須由超級管理員於控制中心點擊「審核通過」才可正式公開上架。
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSysSettings({ ...sysSettings, requireApproval: !sysSettings.requireApproval })}
                    className="text-blue-600 hover:text-blue-700 p-1 shrink-0 transition-all active:scale-95 cursor-pointer"
                  >
                    {sysSettings.requireApproval ? <ToggleRight size={38} className="text-blue-600" /> : <ToggleLeft size={38} className="text-slate-450" />}
                  </button>
                </div>
              </div>

              <div className="pt-4 flex justify-end">
                <button
                  type="submit"
                  disabled={savingSettings}
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-xs hover:shadow-md cursor-pointer transition-all flex items-center gap-1.5"
                >
                  {savingSettings ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" />
                      <span>正在更新全站系統設定...</span>
                    </>
                  ) : (
                    <span>儲存並即時套用系統設定</span>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* Quick Setup Wizard Side Panel */}
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-slate-900 text-white p-6 rounded-2xl border border-slate-800 shadow-md space-y-4">
              <div className="flex items-center gap-1.5 border-b border-slate-800 pb-2.5">
                <ShieldCheck size={16} className="text-emerald-400" />
                <h3 className="font-mono text-[11px] font-bold text-emerald-400 tracking-wider uppercase">SETUP MANAGER / 系統初始化精靈</h3>
              </div>

              <p className="text-[11px] leading-relaxed text-slate-400">
                本平台是為高防偽票務需求而開發。若您剛搭建好本票務系統：
              </p>

              <div className="space-y-3.5 text-xs pt-1">
                <div className="flex items-start gap-2.5">
                  <div className="w-5 h-5 rounded-full bg-slate-800 text-[10px] font-bold flex items-center justify-center border border-slate-750 shrink-0 text-slate-300">
                    1
                  </div>
                  <div>
                    <p className="font-bold text-slate-200">設定平台身分</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">修改平台名稱，系統將自動套用於所有買家介面及登入頁面。</p>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <div className="w-5 h-5 rounded-full bg-slate-800 text-[10px] font-bold flex items-center justify-center border border-slate-750 shrink-0 text-slate-300">
                    2
                  </div>
                  <div>
                    <p className="font-bold text-slate-200">測試與演示</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">開啟「演示模式」提供測試帳號，或是關閉它開始正式投入營運。</p>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <div className="w-5 h-5 rounded-full bg-slate-800 text-[10px] font-bold flex items-center justify-center border border-slate-750 shrink-0 text-slate-300">
                    3
                  </div>
                  <div>
                    <p className="font-bold text-slate-200">初始化測試資料</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">可透過「重置資料庫」功能一鍵重構並復原乾淨的展示用資料庫。</p>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800 flex flex-col gap-2.5">
                {/* Clean Slate Button: Switch to Production Mode */}
                <button
                  onClick={async () => {
                    if (sysSettings.demoLocked) {
                      alert("🔒 線上託管演示環境已鎖定演示模式，禁止執行清空操作以防公共測試資料遺失。\n\n若為您自己的私有化獨立部署，請於環境變數設定 SELF_HOSTED=true 即可解鎖清空與切換正式營運模式！");
                      return;
                    }
                    if (window.confirm("🚨 確定要切換至「非演示正式營運模式」嗎？\n這將清空所有的展示測試帳號（@ticket.com）、示範活動與示範票券，保留您目前的管理員帳號，並讓系統進入純淨的正式環境開放使用者註冊購票！")) {
                      try {
                        const res = await fetch('/api/admin/clean-slate', {
                          method: 'POST',
                          headers: {
                            'Authorization': `Bearer ${token}`
                          }
                        });
                        const data = await res.json();
                        alert(data.message || "系統已成功清空測試帳號並進入正式模式！");
                        fetchSettings();
                        if (onSettingsUpdated) onSettingsUpdated();
                      } catch {
                        alert("切換正式模式發生錯誤");
                      }
                    }
                  }}
                  className={`w-full py-2.5 font-bold text-xs rounded-xl cursor-pointer transition-all shadow-sm flex items-center justify-center gap-1.5 ${
                    sysSettings.demoLocked
                      ? 'bg-slate-800 text-slate-400 hover:bg-slate-750 border border-slate-700'
                      : 'bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white'
                  }`}
                >
                  {sysSettings.demoLocked ? <Lock size={14} className="text-amber-400" /> : <ShieldCheck size={14} />}
                  <span>{sysSettings.demoLocked ? "線上演示鎖定：清空展示資料 (自建部署可解鎖)" : "清空展示資料並切換「非演示正式模式」"}</span>
                </button>

                {/* Reset Database Button */}
                <button
                  onClick={async () => {
                    if (window.confirm("🚨 您即將初始化並重置為演示模式！\n這將還原標準展示帳號（admin@ticket.com / admin123）與預載活動。確定執行嗎？")) {
                      try {
                        const res = await fetch('/api/admin/reset', { method: 'POST' });
                        const data = await res.json();
                        alert(data.message || "資料庫初始化重置成功！");
                        window.location.reload();
                      } catch {
                        alert("重置資料庫發生錯誤");
                      }
                    }
                  }}
                  className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs rounded-xl cursor-pointer transition-colors border border-slate-700 shadow-sm flex items-center justify-center gap-1.5"
                >
                  <RefreshCw size={13} />
                  <span>重置與還原系統展示資料庫</span>
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {activeTab === 'events' && (
        <motion.div
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4"
        >
          <div>
            <h3 className="text-sm font-bold text-slate-700">新建立活動審核列表</h3>
            <p className="text-[10px] text-slate-400 mt-0.5">管理系統中所有已被建立的活動，進行安全與名額審核、公開上架或駁回封存操作。</p>
          </div>

          {loadingEvents ? (
            <div className="flex justify-center items-center py-12">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
            </div>
          ) : events.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-xs border border-dashed border-slate-200 rounded-xl bg-slate-50/20">
              目前系統中尚無活動設定紀錄。
            </div>
          ) : (
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 font-bold uppercase text-[9px] border-b border-slate-200">
                    <th className="py-2.5 px-3">活動資訊</th>
                    <th className="py-2.5 px-3">類別</th>
                    <th className="py-2.5 px-3">定價與名額</th>
                    <th className="py-2.5 px-3">狀態</th>
                    <th className="py-2.5 px-3 text-right">管理審核 Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {events.map(evt => {
                    const isPending = evt.status === 'pending' || (evt.status as any) === undefined;
                    const isCancelled = evt.status === 'cancelled';
                    return (
                      <tr key={evt.id} className="hover:bg-slate-50/20">
                        <td className="py-3 px-3">
                          <p className="font-bold text-slate-800">{evt.title}</p>
                          <p className="text-[10px] text-slate-400 mt-0.5">{evt.location} | {new Date(evt.date).toLocaleDateString('zh-TW')}</p>
                        </td>
                        <td className="py-3 px-3">
                          <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-[9px] font-semibold rounded-md">
                            {evt.category}
                          </span>
                        </td>
                        <td className="py-3 px-3 font-mono">
                          <p className="font-bold text-slate-700">NT$ {evt.price.toLocaleString()}</p>
                          <p className="text-[10px] text-slate-400">總容納席：{evt.capacity} 位</p>
                        </td>
                        <td className="py-3 px-3">
                          <span className={`inline-block text-[9px] font-bold px-1.5 py-0.5 rounded-sm ${
                            isPending 
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : isCancelled
                                ? 'bg-red-50 text-red-700 border border-red-200'
                                : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          }`}>
                            {isPending ? '⏳ 待審核 (Pending)' : isCancelled ? '❌ 已下架/駁回' : '✅ 審核通過/熱售中'}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right">
                          <div className="flex gap-1.5 justify-end">
                            {isPending ? (
                              <>
                                <button
                                  onClick={() => handleApproveEvent(evt.id)}
                                  disabled={eventActionId === evt.id}
                                  className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-[10px] cursor-pointer flex items-center gap-1 shadow-xs transition-all active:scale-95 disabled:opacity-50"
                                >
                                  <CheckSquare size={10} />
                                  <span>核准上架</span>
                                </button>
                                <button
                                  onClick={() => handleRejectEvent(evt.id)}
                                  disabled={eventActionId === evt.id}
                                  className="px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-650 rounded-lg border border-red-200 font-bold text-[10px] cursor-pointer flex items-center gap-1 transition-all active:scale-95 disabled:opacity-50"
                                >
                                  <XSquare size={10} />
                                  <span>駁回駁准</span>
                                </button>
                              </>
                            ) : !isCancelled ? (
                              <button
                                onClick={() => handleRejectEvent(evt.id)}
                                disabled={eventActionId === evt.id}
                                className="px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold text-[10px] cursor-pointer flex items-center gap-1 transition-all active:scale-95 disabled:opacity-50 shadow-xs"
                              >
                                <XSquare size={10} className="text-white" />
                                <span className="text-white font-bold">下架封存</span>
                              </button>
                            ) : (
                              <button
                                onClick={() => handleApproveEvent(evt.id)}
                                disabled={eventActionId === evt.id}
                                className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg border border-emerald-200 font-bold text-[10px] cursor-pointer flex items-center gap-1 transition-all active:scale-95 disabled:opacity-50"
                              >
                                <CheckSquare size={10} />
                                <span>重新上架</span>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </motion.div>
      )}

      {activeTab === 'users' && (
        <motion.div
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4"
        >
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-sm font-bold text-slate-700">系統全帳密防偽註冊清冊</h3>
              <p className="text-[10px] text-slate-400 mt-0.5">檢視本系統已安全雜湊與加密存檔的所有帳號清單，並可任意調配其權限群組。</p>
            </div>
            <button
              onClick={fetchUsers}
              className="p-1.5 hover:bg-slate-100 rounded-lg border border-slate-200/50 cursor-pointer"
              title="重新整理清單"
            >
              <RefreshCw size={14} className={loadingUsers ? 'animate-spin' : ''} />
            </button>
          </div>

          {loadingUsers ? (
            <div className="flex justify-center items-center py-12">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-xs">
              尚無已註冊的帳號清單。
            </div>
          ) : (
            <div className="space-y-4">
              {/* Mobile Card List View */}
              <div className="block md:hidden space-y-3">
                {users.map(u => {
                  const isDefaultAdmin = u.id.includes('default') || u.id === 'usr-admin-seed';
                  const canDelete = !isDefaultAdmin;

                  return (
                    <div key={u.id} className="p-3.5 bg-slate-50/70 rounded-xl border border-slate-200/80 space-y-2.5 text-xs">
                      <div className="flex justify-between items-start gap-2 border-b border-slate-200/60 pb-2">
                        <div>
                          <p className="font-bold text-slate-800 text-sm">{u.name}</p>
                          <span className="text-[9px] text-slate-400 font-mono">ID: {u.id}</span>
                        </div>
                        {canDelete ? (
                          <button
                            onClick={() => handleDeleteUser(u.id, u.email)}
                            className="p-1.5 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg border border-red-200/60 transition-colors cursor-pointer inline-flex items-center gap-1 text-[10px] font-bold shrink-0"
                            title="徹底註銷並刪除此帳號"
                          >
                            <Trash2 size={11} />
                            <span>刪除帳號</span>
                          </button>
                        ) : (
                          <span className="text-[10px] text-slate-400 italic bg-slate-200/50 px-2 py-0.5 rounded-md shrink-0">核心保護</span>
                        )}
                      </div>

                      <div className="space-y-1.5 text-[11px]">
                        <div className="flex justify-between items-center">
                          <span className="text-slate-400">權限角色：</span>
                          <select
                            value={u.role}
                            disabled={isDefaultAdmin}
                            onChange={(e) => handleRoleChange(u.id, e.target.value)}
                            className="bg-white border border-slate-200 rounded-lg px-2 py-1 font-bold text-[10px] focus:outline-none cursor-pointer"
                          >
                            <option value="customer">👤 持票顧客 (Customer)</option>
                            <option value="scanner">🔍 驗票員 (Scanner Only)</option>
                            <option value="admin">🏆 系統管理員 (Full Admin)</option>
                          </select>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-slate-400">電子信箱：</span>
                          <span className="font-mono text-slate-700 font-medium truncate max-w-[200px]">{u.email}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-slate-400">行動電話：</span>
                          <span className="font-mono text-slate-600">{u.phone || '—'}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Desktop Table View */}
              <div className="hidden md:block border border-slate-200 rounded-xl overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs min-w-[600px]">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 font-bold uppercase text-[9px] border-b border-slate-200">
                      <th className="py-2.5 px-3">真實姓名</th>
                      <th className="py-2.5 px-3">權限組 (Role)</th>
                      <th className="py-2.5 px-3">電子信箱</th>
                      <th className="py-2.5 px-3">行動電話</th>
                      <th className="py-2.5 px-3 text-right">帳號操作 (Actions)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {users.map(u => {
                      const isDefaultAdmin = u.id.includes('default') || u.id === 'usr-admin-seed';
                      const canDelete = !isDefaultAdmin;
                      
                      return (
                        <tr key={u.id} className="hover:bg-slate-50/20">
                          <td className="py-3 px-3">
                            <p className="font-bold text-slate-800">{u.name}</p>
                            <span className="text-[9px] text-slate-400 font-mono">ID: {u.id}</span>
                          </td>
                          <td className="py-3 px-3">
                            <select
                              value={u.role}
                              disabled={isDefaultAdmin}
                              onChange={(e) => handleRoleChange(u.id, e.target.value)}
                              className="bg-slate-50 border border-slate-200 rounded-md p-1 font-bold text-[10px] focus:outline-none cursor-pointer"
                            >
                              <option value="customer">👤 持票顧客 (Customer)</option>
                              <option value="scanner">🔍 驗票員 (Scanner Only)</option>
                              <option value="admin">🏆 系統管理員 (Full Admin)</option>
                            </select>
                          </td>
                          <td className="py-3 px-3 font-mono text-slate-600">{u.email}</td>
                          <td className="py-3 px-3 text-slate-500 font-mono">{u.phone || '—'}</td>
                          <td className="py-3 px-3 text-right">
                            {canDelete ? (
                              <button
                                onClick={() => handleDeleteUser(u.id, u.email)}
                                className="p-1.5 text-red-650 hover:bg-red-50 rounded-lg border border-transparent hover:border-red-100 transition-colors cursor-pointer inline-flex items-center gap-1 text-[10px] font-bold"
                                title="徹底註銷並刪除此帳號"
                              >
                                <Trash2 size={11} />
                                <span>刪除帳號</span>
                              </button>
                            ) : (
                              <span className="text-[10px] text-slate-400 italic px-2">系統核心保護</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}
