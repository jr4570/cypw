/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Ticket, CalendarDays, Wallet, LayoutDashboard, QrCode, FileEdit, LogOut, ShieldCheck, UserCheck, Sparkles, AlertCircle, UserMinus, Heart, Settings, ShieldAlert } from 'lucide-react';
import { UserProfile, UserRole } from './types';

// Component imports
import UserLogin from './components/UserLogin';
import AdminLogin from './components/AdminLogin';
import UserEvents from './components/UserEvents';
import UserWallet from './components/UserWallet';
import AdminDashboard from './components/AdminDashboard';
import AdminEvents from './components/AdminEvents';
import AdminScan from './components/AdminScan';
import UserFavorites from './components/UserFavorites';
import UserSettings from './components/UserSettings';
import SuperAdminSettings from './components/SuperAdminSettings';
import { apiFetch } from './utils/apiInterceptor';

export default function App() {
  const [role, setRole] = useState<'customer' | 'admin'>(() => {
    return (localStorage.getItem('starpass_role') as 'customer' | 'admin') || 'customer';
  });
  const [customerUser, setCustomerUser] = useState<UserProfile | null>(() => {
    const saved = localStorage.getItem('starpass_customerUser');
    try { return saved ? JSON.parse(saved) : null; } catch { return null; }
  });
  const [adminUser, setAdminUser] = useState<UserProfile | null>(() => {
    const saved = localStorage.getItem('starpass_adminUser');
    try { return saved ? JSON.parse(saved) : null; } catch { return null; }
  });
  const [showCustomerLogin, setShowCustomerLogin] = useState<boolean>(false);
  
  // Simulated session JWT token mapping to user ID
  const [customerToken, setCustomerToken] = useState<string>(() => {
    return localStorage.getItem('starpass_customerToken') || '';
  });
  const [adminToken, setAdminToken] = useState<string>(() => {
    return localStorage.getItem('starpass_adminToken') || '';
  });

  // Navigation sub-views
  const [customerSubView, setCustomerSubView] = useState<'events' | 'wallet' | 'favorites' | 'settings'>(() => {
    return (localStorage.getItem('starpass_customerSubView') as any) || 'events';
  });
  const [adminSubView, setAdminSubView] = useState<'dashboard' | 'create-event' | 'scan' | 'system-settings'>(() => {
    return (localStorage.getItem('starpass_adminSubView') as any) || 'dashboard';
  });

  const [systemSettings, setSystemSettings] = useState<{
    systemName: string;
    systemSlogan: string;
    contactPhone: string;
    demoMode: boolean;
    requireApproval: boolean;
    bannerUrl?: string;
    demoLocked?: boolean;
  }>({
    systemName: "程閱安全票務管理平台",
    systemSlogan: "採用加密驗證防偽核銷的高安全智慧票務系統",
    contactPhone: "02-2777-6666",
    demoMode: true,
    requireApproval: false,
    bannerUrl: "https://images.unsplash.com/photo-1540039155733-5bb30b53aa14?w=1600&auto=format&fit=crop&q=80",
    demoLocked: true
  });

  const [showDemoPopup, setShowDemoPopup] = useState<boolean>(false);
  const [demoAgreed, setDemoAgreed] = useState<boolean>(false);
  const [rememberDemoChoice, setRememberDemoChoice] = useState<boolean>(true);

  // Sync state to localStorage
  useEffect(() => {
    localStorage.setItem('starpass_role', role);
  }, [role]);

  useEffect(() => {
    if (customerUser) {
      localStorage.setItem('starpass_customerUser', JSON.stringify(customerUser));
    } else {
      localStorage.removeItem('starpass_customerUser');
    }
  }, [customerUser]);

  useEffect(() => {
    if (adminUser) {
      localStorage.setItem('starpass_adminUser', JSON.stringify(adminUser));
    } else {
      localStorage.removeItem('starpass_adminUser');
    }
  }, [adminUser]);

  useEffect(() => {
    localStorage.setItem('starpass_customerToken', customerToken);
  }, [customerToken]);

  useEffect(() => {
    localStorage.setItem('starpass_adminToken', adminToken);
  }, [adminToken]);

  useEffect(() => {
    localStorage.setItem('starpass_customerSubView', customerSubView);
  }, [customerSubView]);

  useEffect(() => {
    localStorage.setItem('starpass_adminSubView', adminSubView);
  }, [adminSubView]);

  useEffect(() => {
    if (systemSettings?.systemName) {
      document.title = systemSettings.demoMode 
        ? `${systemSettings.systemName} (演示版)` 
        : systemSettings.systemName;
    }
  }, [systemSettings]);

  const fetchSystemSettings = async () => {
    try {
      const res = await apiFetch('/api/settings');
      let data: any = null;
      if (res.ok) {
        try {
          data = await res.json();
        } catch {
          data = null;
        }
      }
      const safeData = data ? {
        ...data,
        demoMode: data.demoMode !== false,
        demoLocked: data.demoLocked ?? true
      } : {
        systemName: "程閱安全票務管理平台",
        systemSlogan: "採用加密驗證防偽核銷的高安全智慧票務系統",
        contactPhone: "02-2777-6666",
        demoMode: true,
        demoLocked: true,
        requireApproval: false,
        bannerUrl: "https://images.unsplash.com/photo-1540039155733-5bb30b53aa14?w=1600&auto=format&fit=crop&q=80"
      };
      setSystemSettings(safeData);
      const isRemembered = localStorage.getItem('starpass_remember_demo_agree') === 'true';
      if (safeData.demoMode && !isRemembered) {
        setShowDemoPopup(true);
        setDemoAgreed(false);
      } else {
        setShowDemoPopup(false);
        setDemoAgreed(true);
      }
    } catch (err) {
      console.warn("Could not fetch remote system settings, maintaining default demo mode:", err);
      const isRemembered = localStorage.getItem('starpass_remember_demo_agree') === 'true';
      if (!isRemembered) {
        setShowDemoPopup(true);
      }
    }
  };

  useEffect(() => {
    fetchSystemSettings();

    // Verify session tokens with server on mount for cross-device data consistency
    if (customerToken) {
      apiFetch('/api/auth/me', {
        headers: { 'Authorization': `Bearer ${customerToken}` }
      })
      .then(async res => {
        if (res.ok) {
          try {
            return await res.json();
          } catch {
            return null;
          }
        }
        return null;
      })
      .then(freshUser => {
        if (freshUser) {
          setCustomerUser(freshUser);
        }
      })
      .catch(() => {
        // Keep existing customer user if offline or network glitch
      });
    }

    if (adminToken) {
      apiFetch('/api/auth/me', {
        headers: { 'Authorization': `Bearer ${adminToken}` }
      })
      .then(async res => {
        if (res.ok) {
          try {
            return await res.json();
          } catch {
            return null;
          }
        }
        return null;
      })
      .then(freshAdmin => {
        if (freshAdmin) {
          setAdminUser(freshAdmin);
        }
      })
      .catch(() => {
        // Keep existing admin user if offline or network glitch
      });
    }
  }, []);

  const handleCustomerLogin = (user: UserProfile, token: string) => {
    setCustomerUser(user);
    setCustomerToken(token);
    setCustomerSubView('events');
    setShowCustomerLogin(false);
  };

  const handleAdminLogin = (user: UserProfile, token: string) => {
    setAdminUser(user);
    setAdminToken(token);
    if (user.role === UserRole.SCANNER) {
      setAdminSubView('scan');
    } else {
      setAdminSubView('dashboard');
    }
  };

  const handleLogout = () => {
    if (role === 'customer') {
      setCustomerUser(null);
      setCustomerToken('');
      localStorage.removeItem('starpass_customerUser');
      localStorage.setItem('starpass_customerToken', '');
      setShowCustomerLogin(false);
    } else {
      setAdminUser(null);
      setAdminToken('');
      localStorage.removeItem('starpass_adminUser');
      localStorage.setItem('starpass_adminToken', '');
    }
  };

  const handleDeleteAccount = async () => {
    if (customerUser?.id === "usr-cust-default") {
      alert("⚠️ 預設展示帳號 (Demo User) 不開放註銷，請註冊新帳號進行測試。");
      return;
    }
    if (!window.confirm("🚨 警告：確定要註銷並永久刪除此帳號嗎？\n這將會徹底移除您的帳號資訊及所有購買的票券！此操作不可回復且無法進場。")) {
      return;
    }
    try {
      const res = await apiFetch('/api/auth/delete-me', {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${customerToken}`
        }
      });
      const data = await res.json();
      if (res.ok) {
        alert(data.message || "帳號已成功註銷並刪除！");
        setCustomerUser(null);
        setCustomerToken('');
        localStorage.removeItem('starpass_customerUser');
        localStorage.setItem('starpass_customerToken', '');
        setShowCustomerLogin(false);
      } else {
        alert(data.error || "刪除帳號失敗");
      }
    } catch (err) {
      alert("連線失敗，請稍後再試");
    }
  };

  const switchToAdmin = () => {
    setRole('admin');
  };

  const switchToCustomer = () => {
    setRole('customer');
  };

  const activeUser = role === 'customer' ? customerUser : adminUser;
  const activeToken = role === 'customer' ? customerToken : adminToken;

  return (
    <div className={`min-h-screen transition-colors duration-300 font-sans ${role === 'admin' ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-800'}`}>
      
      {/* Top Header Navigation Bar */}
      <header className={`sticky top-0 z-40 backdrop-blur-md border-b transition-all duration-300 ${
        role === 'admin' 
          ? 'bg-slate-950/80 border-slate-800 shadow-lg' 
          : 'bg-white/80 border-slate-200/80 shadow-xs'
      }`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          
          {/* Logo Brand */}
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg flex items-center justify-center shadow-sm bg-blue-600 text-white shrink-0">
              <Ticket size={20} className="transform -rotate-12" />
            </div>
            <div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-bold text-base tracking-tight font-sans">
                  {systemSettings?.systemName || "程閱安全票務管理平台"}
                </span>
                {systemSettings?.demoMode && (
                  <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-300 border border-amber-500/40 inline-flex items-center gap-1 shadow-xs">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                    演示版
                  </span>
                )}
              </div>
              <span className={`text-[9px] font-bold block leading-none px-2 py-0.5 rounded mt-0.5 text-center ${
                role === 'admin' 
                  ? 'text-blue-400 bg-blue-500/10 border border-blue-500/20' 
                  : 'text-blue-600 bg-blue-50 border border-blue-100'
              }`}>
                {role === 'admin' ? '主辦方後台 CONTROL' : (systemSettings?.systemSlogan || '活動與票券前端 CLIENT')}
              </span>
            </div>
          </div>

          {/* Nav Sub Tabs (If Logged In) */}
          {(activeUser || role === 'customer') && (
            <div className="hidden md:flex items-center gap-1.5 bg-slate-100/70 dark:bg-slate-900/40 p-1 rounded-xl border border-slate-200/40">
              {role === 'customer' ? (
                <>
                  <button
                    id="nav-btn-events"
                    onClick={() => {
                      setCustomerSubView('events');
                      setShowCustomerLogin(false);
                    }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      customerSubView === 'events' && !showCustomerLogin
                        ? 'bg-white text-blue-600 shadow-sm border border-slate-200/50' 
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <CalendarDays size={14} />
                    <span>熱門活動</span>
                  </button>
                  <button
                    id="nav-btn-favorites"
                    onClick={() => {
                      setCustomerSubView('favorites');
                      setShowCustomerLogin(false);
                    }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      customerSubView === 'favorites' && !showCustomerLogin
                        ? 'bg-white text-blue-600 shadow-sm border border-slate-200/50 font-bold' 
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <Heart size={14} className="text-red-500 fill-red-500" />
                    <span>我的收藏</span>
                  </button>
                  <button
                    id="nav-btn-wallet"
                    onClick={() => {
                      setCustomerSubView('wallet');
                      setShowCustomerLogin(false);
                    }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      customerSubView === 'wallet' && !showCustomerLogin
                        ? 'bg-white text-blue-600 shadow-sm border border-slate-200/50' 
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <Wallet size={14} />
                    <span>我的票夾</span>
                  </button>
                  {customerToken && (
                    <button
                      id="nav-btn-settings"
                      onClick={() => {
                        setCustomerSubView('settings');
                        setShowCustomerLogin(false);
                      }}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                        customerSubView === 'settings' && !showCustomerLogin
                          ? 'bg-white text-blue-600 shadow-sm border border-slate-200/50' 
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      <Settings size={14} />
                      <span>我的設定</span>
                    </button>
                  )}
                </>
              ) : (
                <>
                  {adminUser?.role !== UserRole.SCANNER && (
                    <>
                      <button
                        id="nav-btn-dashboard"
                        onClick={() => setAdminSubView('dashboard')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                          adminSubView === 'dashboard' 
                            ? 'bg-slate-800 text-blue-400 font-bold shadow-sm' 
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <LayoutDashboard size={14} />
                        <span>數據分析儀表板</span>
                      </button>
                      <button
                        id="nav-btn-create-event"
                        onClick={() => setAdminSubView('create-event')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                          adminSubView === 'create-event' 
                            ? 'bg-slate-800 text-blue-400 font-bold shadow-sm' 
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <FileEdit size={14} />
                        <span>活動設定與審核</span>
                      </button>
                      <button
                        id="nav-btn-system-settings"
                        onClick={() => setAdminSubView('system-settings')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                          adminSubView === 'system-settings' 
                            ? 'bg-slate-800 text-blue-400 font-bold shadow-sm' 
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <Settings size={14} />
                        <span>系統與權限設定</span>
                      </button>
                    </>
                  )}
                  <button
                    id="nav-btn-scan"
                    onClick={() => setAdminSubView('scan')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      adminSubView === 'scan' 
                        ? 'bg-slate-800 text-blue-400 font-bold shadow-sm' 
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <QrCode size={14} />
                    <span>掃描驗票通道</span>
                  </button>
                </>
              )}
            </div>
          )}

          {/* User Profile Info Card */}
          <div className="flex items-center gap-3">
            {activeUser ? (
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="text-right hidden sm:block">
                  <p className="text-xs font-bold font-sans text-slate-700 dark:text-slate-300">{activeUser.name}</p>
                  <p className={`text-[10px] font-mono ${role === 'admin' ? 'text-blue-400' : 'text-blue-600'}`}>{activeUser.email}</p>
                </div>
                {role === 'customer' && (
                  <>
                    <button
                      id="header-switch-admin-btn"
                      onClick={() => {
                        setRole('admin');
                      }}
                      className="px-2.5 py-1.5 text-[11px] font-bold rounded-xl text-slate-600 hover:text-slate-950 hover:bg-slate-100 border border-slate-200 transition-all cursor-pointer active:scale-95 hidden sm:block shadow-2xs"
                      title="進入主辦方管理後台"
                    >
                      切換至主辦方
                    </button>
                    <button
                      id="btn-delete-me"
                      onClick={handleDeleteAccount}
                      className="p-2 rounded-xl transition-all border bg-white border-slate-200 text-slate-500 hover:text-red-650 hover:bg-red-50 hover:border-red-100 flex items-center justify-center cursor-pointer shadow-2xs hover:shadow-xs"
                      title="註銷並刪除帳號"
                    >
                      <UserMinus size={16} className="text-slate-550 group-hover:text-red-600" />
                    </button>
                  </>
                )}
                <button
                  id="btn-logout"
                  onClick={handleLogout}
                  className={`p-2 rounded-xl transition-all border flex items-center justify-center cursor-pointer ${
                    role === 'admin' 
                      ? 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800' 
                      : 'bg-white border-slate-200 text-slate-500 hover:text-red-650 hover:bg-slate-50'
                  }`}
                  title="登出帳戶"
                >
                  <LogOut size={16} />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 sm:gap-2">
                {role === 'customer' ? (
                  <>
                    <button
                      id="header-admin-portal-btn"
                      onClick={() => {
                        setRole('admin');
                      }}
                      className="px-2.5 py-1.5 text-[11px] sm:text-xs font-bold rounded-xl text-slate-650 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 transition-all cursor-pointer active:scale-95"
                    >
                      主辦方管理
                    </button>
                    <button
                      id="header-login-btn"
                      onClick={() => {
                        setShowCustomerLogin(true);
                      }}
                      className="px-2.5 py-1.5 text-[11px] sm:text-xs font-bold rounded-xl text-white bg-blue-600 hover:bg-blue-700 transition-all cursor-pointer shadow-2xs hover:shadow-xs active:scale-95"
                    >
                      登入 / 註冊
                    </button>
                  </>
                ) : (
                  <button
                    id="header-customer-portal-btn"
                    onClick={() => {
                      setRole('customer');
                      setShowCustomerLogin(false);
                    }}
                    className="px-2.5 py-1.5 text-[11px] sm:text-xs font-bold rounded-xl text-blue-400 hover:text-white bg-slate-900 hover:bg-slate-850 border border-slate-800 transition-all cursor-pointer active:scale-95"
                  >
                    返回顧客前台
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Mobile Navigation Tabs (removed from top header, now at the bottom) */}
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-28 md:pb-8">
        <AnimatePresence mode="wait">
          {role === 'admin' && !adminUser ? (
            /* Admin Login View */
            <AdminLogin 
              onLoginSuccess={handleAdminLogin} 
              switchToUser={switchToCustomer} 
            />
          ) : role === 'customer' && showCustomerLogin ? (
            /* Customer login screen */
            <UserLogin 
              onLoginSuccess={handleCustomerLogin} 
              switchToAdmin={switchToAdmin}
              onCancel={() => setShowCustomerLogin(false)}
            />
          ) : (
            /* Main workspace view */
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="space-y-6"
            >
              {role === 'customer' ? (
                /* Customer SubViews */
                customerSubView === 'events' ? (
                  <UserEvents 
                    token={customerToken} 
                    onPurchaseSuccess={() => setCustomerSubView('wallet')} 
                    onLoginRequired={() => setShowCustomerLogin(true)}
                  />
                ) : customerSubView === 'favorites' ? (
                  <UserFavorites 
                    token={customerToken}
                    onViewEvents={() => setCustomerSubView('events')} 
                    onBookEvent={() => setCustomerSubView('events')}
                    onLoginRequired={() => setShowCustomerLogin(true)}
                  />
                ) : customerSubView === 'settings' ? (
                  customerToken ? (
                    <UserSettings 
                      user={customerUser!}
                      token={customerToken} 
                      onLogout={handleLogout}
                      onUpdateProfile={(updatedUser) => setCustomerUser(updatedUser)} 
                    />
                  ) : (
                    <div className="max-w-md mx-auto text-center p-8 bg-white rounded-2xl border border-slate-200 shadow-md space-y-4">
                      <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto">
                        <Settings size={24} />
                      </div>
                      <h3 className="font-bold text-base text-slate-800">請先登入帳戶</h3>
                      <p className="text-xs text-slate-500">個人安全密碼與姓名電話設定需要進行核簽，請先登入您的帳戶。</p>
                      <button
                        onClick={() => setShowCustomerLogin(true)}
                        className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl cursor-pointer shadow-xs hover:shadow-md"
                      >
                        立即登入 / 註冊
                      </button>
                    </div>
                  )
                ) : (
                  customerToken ? (
                    <UserWallet token={customerToken} />
                  ) : (
                    <div className="max-w-md mx-auto text-center p-8 bg-white rounded-2xl border border-slate-200 shadow-md space-y-4">
                      <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto">
                        <Wallet size={24} />
                      </div>
                      <h3 className="font-bold text-base text-slate-800">請先登入帳戶</h3>
                      <p className="text-xs text-slate-500">我的電子票夾需要進行身分核簽，請登入您的帳戶以同步您擁有的數位票券。</p>
                      <button
                        onClick={() => setShowCustomerLogin(true)}
                        className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl cursor-pointer shadow-xs hover:shadow-md"
                      >
                        立即登入 / 註冊
                      </button>
                    </div>
                  )
                )
              ) : (
                /* Admin SubViews */
                adminSubView === 'dashboard' ? (
                  <AdminDashboard token={activeToken} />
                ) : adminSubView === 'create-event' ? (
                  <AdminEvents 
                    token={activeToken} 
                    onEventCreated={() => setAdminSubView('dashboard')} 
                  />
                ) : adminSubView === 'system-settings' ? (
                  <SuperAdminSettings 
                    token={activeToken} 
                    onSettingsUpdated={fetchSystemSettings} 
                  />
                ) : (
                  <AdminScan token={activeToken} />
                )
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Mobile Sticky Bottom Navigation Bar */}
      {(activeUser || role === 'customer') && (
        <div className={`md:hidden fixed bottom-0 left-0 right-0 z-40 border-t py-2 px-3 flex justify-around shadow-2xl transition-colors duration-300 pb-safe ${
          role === 'admin' ? 'bg-slate-950 border-slate-850 text-slate-100' : 'bg-white/95 backdrop-blur-md border-slate-200 text-slate-850'
        }`}>
          {role === 'customer' ? (
            <>
              <button
                id="nav-mobile-events"
                onClick={() => {
                  setCustomerSubView('events');
                  setShowCustomerLogin(false);
                }}
                className={`flex flex-col items-center gap-1 py-1 px-2 text-[10px] font-bold flex-1 ${
                  customerSubView === 'events' && !showCustomerLogin ? 'text-blue-600 font-extrabold' : 'text-slate-400'
                }`}
              >
                <CalendarDays size={18} />
                <span>熱門活動</span>
              </button>
              <button
                id="nav-mobile-favorites"
                onClick={() => {
                  setCustomerSubView('favorites');
                  setShowCustomerLogin(false);
                }}
                className={`flex flex-col items-center gap-1 py-1 px-2 text-[10px] font-bold flex-1 ${
                  customerSubView === 'favorites' && !showCustomerLogin ? 'text-blue-600 font-extrabold' : 'text-slate-400'
                }`}
              >
                <Heart size={18} className="text-red-500 fill-red-500" />
                <span>我的收藏</span>
              </button>
              <button
                id="nav-mobile-wallet"
                onClick={() => {
                  setCustomerSubView('wallet');
                  setShowCustomerLogin(false);
                }}
                className={`flex flex-col items-center gap-1 py-1 px-2 text-[10px] font-bold flex-1 ${
                  customerSubView === 'wallet' && !showCustomerLogin ? 'text-blue-600 font-extrabold' : 'text-slate-400'
                }`}
              >
                <Wallet size={18} />
                <span>我的票夾</span>
              </button>
              {customerToken && (
                <button
                  id="nav-mobile-settings"
                  onClick={() => {
                    setCustomerSubView('settings');
                    setShowCustomerLogin(false);
                  }}
                  className={`flex flex-col items-center gap-1 py-1 px-2 text-[10px] font-bold flex-1 ${
                    customerSubView === 'settings' && !showCustomerLogin ? 'text-blue-600 font-extrabold' : 'text-slate-400'
                  }`}
                >
                  <Settings size={18} />
                  <span>我的設定</span>
                </button>
              )}
            </>
          ) : (
            <>
              {adminUser?.role !== UserRole.SCANNER && (
                <>
                  <button
                    id="nav-mobile-dashboard"
                    onClick={() => setAdminSubView('dashboard')}
                    className={`flex flex-col items-center gap-1 py-1 px-2 text-[10px] font-bold flex-1 ${
                      adminSubView === 'dashboard' ? 'text-blue-400 font-extrabold' : 'text-slate-400'
                    }`}
                  >
                    <LayoutDashboard size={18} />
                    <span>數據圖表</span>
                  </button>
                  <button
                    id="nav-mobile-create"
                    onClick={() => setAdminSubView('create-event')}
                    className={`flex flex-col items-center gap-1 py-1 px-2 text-[10px] font-bold flex-1 ${
                      adminSubView === 'create-event' ? 'text-blue-400 font-extrabold' : 'text-slate-400'
                    }`}
                  >
                    <FileEdit size={18} />
                    <span>新增活動</span>
                  </button>
                  <button
                    id="nav-mobile-sys-settings"
                    onClick={() => setAdminSubView('system-settings')}
                    className={`flex flex-col items-center gap-1 py-1 px-2 text-[10px] font-bold flex-1 ${
                      adminSubView === 'system-settings' ? 'text-blue-400 font-extrabold' : 'text-slate-400'
                    }`}
                  >
                    <Settings size={18} />
                    <span>系統設定</span>
                  </button>
                </>
              )}
              <button
                id="nav-mobile-scan"
                onClick={() => setAdminSubView('scan')}
                className={`flex flex-col items-center gap-1 py-1 px-2 text-[10px] font-bold flex-1 ${
                  adminSubView === 'scan' ? 'text-blue-400 font-extrabold' : 'text-slate-400'
                }`}
              >
                <QrCode size={18} />
                <span>驗票閘口</span>
              </button>
            </>
          )}
        </div>
      )}

      {/* Demo Mode Startup Popup Modal */}
      <AnimatePresence>
        {showDemoPopup && (
          <div id="demo-mode-popup" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 text-slate-100"
            >
              <div className="flex items-center gap-3 text-amber-400 border-b border-slate-800 pb-3 mb-4">
                <ShieldAlert size={24} className="animate-pulse" />
                <h3 className="font-bold text-base tracking-wider font-sans">程閱票務 測試演示模式已啟用</h3>
              </div>
              
              <div className="space-y-3.5 text-xs text-slate-300 leading-relaxed">
                <p className="font-semibold text-slate-200">
                  您好！本開源項目目前處於 <span className="text-amber-400 font-bold">演示測試模式 (Demo Mode)</span>。
                </p>
                <p>
                  如果您要進行購票測試或主辦方核銷測試，請使用 <span className="text-amber-300 font-bold">臨時信箱及密碼（或隨意填寫亂打）</span> 進行註冊與登入。
                </p>
                <div className="p-3 bg-slate-950/80 border border-slate-850 rounded-xl space-y-1.5 text-[11px] font-mono">
                  <div className="text-blue-400 font-bold">💡 快速測試推薦：</div>
                  <div>● 買家顧客：您可以使用任意信箱註冊，或一鍵代入預設買家。</div>
                  <div>● 主辦後台：可使用一鍵代入系統超級管理員，模擬 QR-Code 核銷。</div>
                </div>
                <p className="text-slate-400">
                  當處於演示模式時，系統才會載入預載的測試活動數據（如周杰倫演唱會）。關閉演示模式後，測試數據將會隱藏。
                </p>
              </div>

              {/* Mandatory Checkbox Agreement */}
              <div className="space-y-2 mt-4">
                <label className="flex items-center gap-2.5 p-3 bg-slate-950/80 rounded-xl border border-slate-800 cursor-pointer select-none group transition-all hover:border-blue-500/50">
                  <input
                    type="checkbox"
                    id="checkbox-agree-demo"
                    checked={demoAgreed}
                    onChange={(e) => setDemoAgreed(e.target.checked)}
                    className="w-4 h-4 rounded text-blue-600 bg-slate-900 border-slate-700 focus:ring-blue-500 focus:ring-offset-slate-900 cursor-pointer accent-blue-600 shrink-0"
                  />
                  <span className="text-xs font-semibold text-slate-200 group-hover:text-white">
                    我已閱讀並知悉測試模式說明，同意進行測試
                  </span>
                </label>

                <label className="flex items-center gap-2.5 p-3 bg-slate-950/80 rounded-xl border border-slate-800/80 cursor-pointer select-none group transition-all hover:border-blue-500/50">
                  <input
                    type="checkbox"
                    id="checkbox-remember-demo-choice"
                    checked={rememberDemoChoice}
                    onChange={(e) => setRememberDemoChoice(e.target.checked)}
                    className="w-4 h-4 rounded text-blue-600 bg-slate-900 border-slate-700 focus:ring-blue-500 focus:ring-offset-slate-900 cursor-pointer accent-blue-600 shrink-0"
                  />
                  <span className="text-xs font-medium text-slate-300 group-hover:text-white">
                    記憶我的選擇（以以瀏覽器偏好記錄，下次自動進入）
                  </span>
                </label>
              </div>

              <div className="mt-4">
                <button
                  id="btn-dismiss-demo-popup"
                  disabled={!demoAgreed}
                  onClick={() => {
                    if (demoAgreed) {
                      if (rememberDemoChoice) {
                        localStorage.setItem('starpass_remember_demo_agree', 'true');
                      }
                      setShowDemoPopup(false);
                    }
                  }}
                  className={`w-full py-2.5 text-xs font-bold rounded-xl transition-all shadow-md text-center ${
                    demoAgreed 
                      ? 'bg-blue-600 hover:bg-blue-700 text-white active:scale-95 cursor-pointer shadow-blue-900/30' 
                      : 'bg-slate-800 text-slate-500 cursor-not-allowed opacity-70 border border-slate-700/50'
                  }`}
                >
                  {demoAgreed ? "同意並進入系統" : "請勾選上方同意條款以進入系統"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modern footer with tech summary */}
      <footer className={`py-6 border-t text-center transition-colors duration-300 text-xs font-medium ${
        role === 'admin' 
          ? 'bg-slate-950 border-slate-900 text-slate-500 mb-16 md:mb-0' 
          : 'bg-slate-50 border-slate-100 text-slate-400 mb-16 md:mb-0'
      }`}>
        <div className="max-w-7xl mx-auto px-4">
          <p>程閱安全票務管理平台 © 2026 StarPass. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
