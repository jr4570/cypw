/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { BarChart3, TrendingUp, CheckCircle, Ticket, Wallet, FileDown, RefreshCw, AlertTriangle, ShieldCheck, HelpCircle, Users, Trash2, X } from 'lucide-react';
import { AdminStats, CheckInLog } from '../types';

interface AdminDashboardProps {
  token: string;
}

export default function AdminDashboard({ token }: AdminDashboardProps) {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const [showUserModal, setShowUserModal] = useState(false);
  const [userLoading, setUserLoading] = useState(false);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    fetchStats(true);
    
    // Poll stats every 2.5 seconds to support true real-time multi-platform check-ins tracking
    pollIntervalRef.current = setInterval(() => {
      fetchStats(false);
    }, 2500);

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, []);

  const fetchStats = async (showLoading: boolean) => {
    try {
      if (showLoading) setLoading(true);
      const res = await fetch('/api/admin/stats', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (err) {
      console.error("Error fetching admin stats:", err);
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  const forceRefresh = async () => {
    setRefreshing(true);
    await fetchStats(true);
    setRefreshing(false);
  };

  const fetchUsers = async () => {
    try {
      setUserLoading(true);
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
      setUserLoading(false);
    }
  };

  const handleDeleteUser = async (userId: string, userEmail: string) => {
    if (!window.confirm(`🚨 警告：確定要永久刪除帳號「${userEmail}」嗎？\n該帳號擁有的所有電子門票也將被同步刪除且不可回復！`)) {
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
        alert(data.message || "使用者帳號已成功刪除！");
        fetchUsers();
        fetchStats(false);
      } else {
        alert(data.error || "刪除帳號失敗");
      }
    } catch (err) {
      alert("連線失敗");
    }
  };

  const handleDeleteLog = async (logId: string) => {
    if (!window.confirm("確定要刪除這筆核銷掃描紀錄嗎？\n對應的門票將會自動恢復為「未核銷 (Valid)」狀態，可重新進行掃描。")) {
      return;
    }
    try {
      const res = await fetch(`/api/admin/logs/${logId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (res.ok) {
        fetchStats(false);
      } else {
        alert(data.error || "刪除紀錄失敗");
      }
    } catch (err) {
      alert("連線失敗");
    }
  };

  const handleClearAllLogs = async () => {
    if (!window.confirm("🚨 警告：確定要清空系統中所有的核銷歷史紀錄嗎？\n這將會：\n1. 刪除所有實時核銷監聽日誌。\n2. 重置所有已被核銷門票的狀態為「未核銷」，可以重新掃描。\n此操作適用於活動正式開始前的測試資料清理！")) {
      return;
    }
    try {
      const res = await fetch('/api/admin/clear-logs', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (res.ok) {
        alert(data.message || "核銷紀錄已成功清空！");
        fetchStats(true);
      } else {
        alert(data.error || "清空失敗");
      }
    } catch (err) {
      alert("連線失敗");
    }
  };

  const handleReset = async () => {
    if (!window.confirm("確定要重置系統嗎？這將會清除所有自訂活動，並回復成初始預設的展示活動與票券。")) {
      return;
    }
    try {
      const res = await fetch('/api/admin/reset', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        alert("系統展示資料已成功還原重置！");
        fetchStats(true);
      }
    } catch (err) {
      alert("重置失敗");
    }
  };

  const exportCSV = () => {
    if (!stats || stats.recentLogs.length === 0) {
      alert("目前尚無核銷紀錄可供匯出！");
      return;
    }

    let csvContent = "data:text/csv;charset=utf-8,\uFEFF"; // Include BOM for Chinese characters
    csvContent += "紀錄ID,核銷票號,活動主題,使用者身分(金鑰),持票人電子郵件,核銷時間,核銷狀態,驗票裝置\n";

    stats.recentLogs.forEach(log => {
      const statusText = log.status === 'success' ? '成功進場' 
                       : log.status === 'duplicate' ? '重複掃描警報' 
                       : log.status === 'invalid_sig' ? '防偽雜湊失敗(偽造)' 
                       : '票券不存在';
      
      const row = [
        log.id,
        log.ticketCode,
        log.eventTitle.replace(/,/g, " "),
        log.userId,
        log.ownerEmail,
        new Date(log.checkedInAt).toLocaleString('zh-TW'),
        statusText,
        log.device || 'Admin Gateway'
      ].join(",");
      csvContent += row + "\n";
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `程閱票務_核銷驗票統計報表_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading && !stats) {
    return (
      <div className="flex justify-center items-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  const checkInRate = stats && stats.totalTicketsSold > 0 
    ? (stats.totalCheckedIn / stats.totalTicketsSold) * 100 
    : 0;

  // Custom SVG Chart calculations
  const maxRevenue = stats && stats.salesTimeline.length > 0
    ? Math.max(...stats.salesTimeline.map(s => s.revenue), 1000)
    : 1000;

  return (
    <div className="space-y-6 text-slate-800">
      {/* Title & Real-time Pulsing Badge */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold font-sans text-slate-900 tracking-tight">主辦方數據分析控制台</h2>
          <p className="text-xs text-slate-500 mt-1">即時統計平台票務銷售流速、活動核銷比例及防偽日誌</p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <div className="flex items-center gap-1 bg-blue-50 border border-blue-100 text-blue-700 text-[10px] font-extrabold px-3 py-1.5 rounded-full shadow-xs animate-pulse">
            <span className="w-2 h-2 bg-blue-500 rounded-full" />
            <span>REAL-TIME ENGINE LIVE</span>
          </div>
          <button 
            id="refresh-stats-btn"
            onClick={forceRefresh}
            disabled={refreshing}
            className="p-2 bg-white text-slate-600 hover:text-blue-600 rounded-xl border border-slate-200 transition-all cursor-pointer"
            title="手動刷新"
          >
            <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* Stats Bento Grid */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-xs flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-[10px] uppercase font-bold text-slate-400">累計票房收入 (TWD)</p>
              <h3 className="text-xl font-black text-slate-900">NT$ {stats.totalRevenue.toLocaleString()}</h3>
            </div>
            <div className="bg-emerald-50 text-emerald-600 p-2.5 rounded-xl border border-emerald-100 shrink-0">
              <Wallet size={18} />
            </div>
          </div>

          <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-xs flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-[10px] uppercase font-bold text-slate-400">已售出票券量</p>
              <h3 className="text-xl font-black text-slate-900">{stats.totalTicketsSold} <span className="text-xs font-normal text-slate-400">張</span></h3>
            </div>
            <div className="bg-blue-50 text-blue-600 p-2.5 rounded-xl border border-blue-100 shrink-0">
              <Ticket size={18} />
            </div>
          </div>

          <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-xs flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-[10px] uppercase font-bold text-slate-400">已核銷入場量</p>
              <h3 className="text-xl font-black text-slate-900">{stats.totalCheckedIn} <span className="text-xs font-normal text-slate-400">人次</span></h3>
            </div>
            <div className="bg-teal-50 text-teal-600 p-2.5 rounded-xl border border-teal-100 shrink-0">
              <CheckCircle size={18} />
            </div>
          </div>

          <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-xs flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-[10px] uppercase font-bold text-slate-400">平均驗票核銷率</p>
              <h3 className="text-xl font-black text-slate-900">{checkInRate.toFixed(1)} <span className="text-xs font-normal text-slate-400">%</span></h3>
            </div>
            <div className="bg-amber-50 text-amber-600 p-2.5 rounded-xl border border-amber-100 shrink-0">
              <TrendingUp size={18} />
            </div>
          </div>
        </div>
      )}

      {/* Main Stats Charts & Visuals */}
      {stats && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Revenue Sales Line Chart (Beautiful SVG) */}
          <div className="lg:col-span-2 bg-white p-5 border border-slate-200 rounded-2xl shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-1.5">
                <BarChart3 size={16} className="text-blue-600" />
                <span className="text-xs font-bold text-slate-800">近 7 日每日售票金額趨勢 (TWD)</span>
              </div>
              <span className="text-[10px] text-slate-400 font-medium">基於安全防篡改資料庫統計</span>
            </div>

            {/* SVG Line Chart */}
            <div className="h-56 w-full pt-2">
              <svg className="w-full h-full overflow-visible" viewBox="0 0 500 180">
                {/* Horizontal Gridlines */}
                {[0, 0.25, 0.5, 0.75, 1].map((ratio, idx) => (
                  <line 
                    key={idx}
                    x1="30" 
                    y1={10 + 140 * ratio} 
                    x2="490" 
                    y2={10 + 140 * ratio} 
                    stroke="#f1f5f9" 
                    strokeWidth="1" 
                  />
                ))}

                {/* Plot line */}
                <path
                  d={stats.salesTimeline.map((s, idx) => {
                    const x = 30 + (460 / 6) * idx;
                    const y = 150 - (140 * (s.revenue / maxRevenue));
                    return `${idx === 0 ? 'M' : 'L'} ${x} ${y}`;
                  }).join(" ")}
                  fill="none"
                  stroke="#2563eb"
                  strokeWidth="3"
                  strokeLinecap="round"
                />

                {/* Area under line */}
                <path
                  d={`${stats.salesTimeline.map((s, idx) => {
                    const x = 30 + (460 / 6) * idx;
                    const y = 150 - (140 * (s.revenue / maxRevenue));
                    return `${idx === 0 ? 'M' : 'L'} ${x} ${y}`;
                  }).join(" ")} L 490 150 L 30 150 Z`}
                  fill="url(#blue-glow-gradient)"
                  opacity="0.08"
                />

                {/* Plot Dots & Text */}
                {stats.salesTimeline.map((s, idx) => {
                  const x = 30 + (460 / 6) * idx;
                  const y = 150 - (140 * (s.revenue / maxRevenue));
                  return (
                    <g key={idx}>
                      <circle 
                        cx={x} 
                        cy={y} 
                        r="4" 
                        fill="#2563eb" 
                        stroke="#ffffff" 
                        strokeWidth="2" 
                      />
                      <text 
                        x={x} 
                        y={y - 8} 
                        textAnchor="middle" 
                        fontSize="8" 
                        fill="#64748b" 
                        fontWeight="bold"
                        className="font-mono"
                      >
                        {s.revenue > 0 ? `NT$${s.revenue}` : ''}
                      </text>
                      {/* X Axis Labels */}
                      <text 
                        x={x} 
                        y="166" 
                        textAnchor="middle" 
                        fontSize="9" 
                        fill="#94a3b8" 
                        fontWeight="600"
                        className="font-mono"
                      >
                        {s.date}
                      </text>
                    </g>
                  );
                })}

                {/* Gradient Definition */}
                <defs>
                  <linearGradient id="blue-glow-gradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2563eb" />
                    <stop offset="100%" stopColor="#2563eb" stopOpacity="0" />
                  </linearGradient>
                </defs>
              </svg>
            </div>
          </div>

          {/* Event Check-in Rate Breakdown Bar */}
          <div className="bg-white p-5 border border-slate-200 rounded-2xl shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <span className="text-xs font-bold text-slate-800">各場次驗票核銷率 breakdown</span>
              <span className="text-[10px] text-slate-400">席位進度</span>
            </div>

            <div className="space-y-4 max-h-56 overflow-y-auto pr-1">
              {stats.checkInRatesByEvent.map(item => {
                const rate = item.total > 0 ? (item.checkedIn / item.total) * 100 : 0;
                return (
                  <div key={item.eventId} className="space-y-1.5">
                    <div className="flex justify-between items-center text-xs">
                      <p className="font-semibold text-slate-700 truncate max-w-[150px]" title={item.title}>
                        {item.title}
                      </p>
                      <p className="font-mono text-slate-500 text-[10px]">
                        {item.checkedIn} / {item.total} 人 ({rate.toFixed(0)}%)
                      </p>
                    </div>
                    {/* Progress Track */}
                    <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden flex">
                      <div 
                        className="bg-blue-600 rounded-full h-full"
                        style={{ width: `${Math.max(3, rate)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Real-time Verification Log Feed */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
        {/* Header with Export CSV & Reset */}
        <div className="p-5 border-b border-slate-200 flex flex-col sm:flex-row justify-between sm:items-center gap-3 bg-slate-50/60">
          <div>
            <h3 className="font-bold text-sm text-slate-800 flex items-center gap-1.5">
              <ShieldCheck size={16} className="text-emerald-600" />
              <span>實時核銷防偽監聽日誌 (Live Scan Audits)</span>
            </h3>
            <p className="text-[10px] text-slate-400 mt-0.5">系統自動監聽進場閘機、條碼核銷。若偵測到重複核銷或疑似偽造條碼，將亮起紅燈警告。</p>
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            <button
              id="manage-users-btn"
              onClick={() => {
                fetchUsers();
                setShowUserModal(true);
              }}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg border border-slate-300 transition-colors flex items-center gap-1 cursor-pointer shadow-3xs"
              title="管理與移除註冊帳號 (Account Removal)"
            >
              <Users size={14} />
              <span>帳號安全管理</span>
            </button>
            <button
              id="export-csv-btn"
              onClick={exportCSV}
              className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold rounded-lg border border-blue-200 transition-colors flex items-center gap-1 cursor-pointer shadow-3xs"
            >
              <FileDown size={14} />
              <span>核銷報表匯出</span>
            </button>
            <button
              id="clear-logs-btn"
              onClick={handleClearAllLogs}
              className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 text-xs font-semibold rounded-lg border border-amber-200 transition-colors flex items-center gap-1 cursor-pointer shadow-3xs"
              title="清空所有實時核銷紀錄，並還原門票狀態為可用 (Record Removal)"
            >
              <RefreshCw size={14} />
              <span>清空核銷紀錄</span>
            </button>
            <button
              id="system-reset-btn"
              onClick={handleReset}
              className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-semibold rounded-lg border border-red-200 transition-colors flex items-center gap-1 cursor-pointer shadow-3xs"
              title="清除所有自訂內容，重設為預設展示資料"
            >
              <RefreshCw size={14} />
              <span>重置展示資料</span>
            </button>
          </div>
        </div>

        {/* Audit Log Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-400 uppercase text-[9px] font-bold tracking-wider border-b border-slate-100">
                <th className="py-3 px-4">狀態 Status</th>
                <th className="py-3 px-4">活動 Theme</th>
                <th className="py-3 px-4">持票人 / 票號 Ticket Code</th>
                <th className="py-3 px-4">核銷時間 Check-in Time</th>
                <th className="py-3 px-4">驗票窗口 Device</th>
                <th className="py-3 px-4 text-right">核銷管理</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-sans">
              {stats && stats.recentLogs.length > 0 ? (
                stats.recentLogs.map(log => {
                  const isSuccess = log.status === 'success';
                  const isDuplicate = log.status === 'duplicate';
                  const isForged = log.status === 'invalid_sig';

                  return (
                    <tr id={`log-row-${log.id}`} key={log.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-3.5 px-4">
                        <span className={`inline-flex items-center gap-1 font-bold px-2.5 py-0.5 rounded-full text-[10px] ${
                          isSuccess 
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                            : isDuplicate
                              ? 'bg-amber-50 text-amber-700 border border-amber-100'
                              : 'bg-red-50 text-red-700 border border-red-100'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${isSuccess ? 'bg-emerald-500' : isDuplicate ? 'bg-amber-500' : 'bg-red-500'}`} />
                          {isSuccess ? '核銷成功' : isDuplicate ? '重複核銷(警報)' : isForged ? '偽造簽章' : '票券無效'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-slate-700 truncate max-w-[140px]" title={log.eventTitle}>
                        {log.eventTitle}
                      </td>
                      <td className="py-3.5 px-4 space-y-0.5 font-mono">
                        <p className="text-slate-600 font-bold">{log.ownerEmail}</p>
                        <p className="text-slate-400 text-[10px] tracking-tight">{log.ticketCode}</p>
                      </td>
                      <td className="py-3.5 px-4 text-slate-500">
                        {new Date(log.checkedInAt).toLocaleTimeString('zh-TW')}
                      </td>
                      <td className="py-3.5 px-4 text-slate-500">
                        {log.device || '驗票閘道口'}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => handleDeleteLog(log.id)}
                          className="p-1 px-2 text-red-600 hover:bg-red-50 border border-transparent hover:border-red-100 rounded-lg transition-colors cursor-pointer inline-flex items-center gap-1 text-[11px]"
                          title="單筆移除此核銷紀錄 (讓對應門票恢復為可驗票狀態)"
                        >
                          <Trash2 size={12} />
                          <span>移除</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-slate-400 bg-slate-50/30">
                    目前尚無即時核銷掃描紀錄，請使用「掃描驗票 (Scanner)」頁面進行核銷測試！
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Registered Users Modal */}
      {showUserModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden">
            <div className="p-5 border-b border-slate-200 flex justify-between items-center bg-slate-50">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-blue-100 text-blue-700 rounded-lg">
                  <Users size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-800">系統註冊帳號安全管理</h3>
                  <p className="text-[10px] text-slate-400 mt-0.5">檢視、管理本核銷系統中已註冊的所有使用者帳號</p>
                </div>
              </div>
              <button 
                onClick={() => setShowUserModal(false)}
                className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              {userLoading && users.length === 0 ? (
                <div className="flex justify-center items-center py-12">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
                </div>
              ) : users.length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-xs">
                  目前系統中無註冊之使用者帳號。
                </div>
              ) : (
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 text-slate-500 font-bold uppercase text-[9px] border-b border-slate-200">
                        <th className="py-2.5 px-3">姓名 / 角色</th>
                        <th className="py-2.5 px-3">電子郵件 E-mail</th>
                        <th className="py-2.5 px-3">行動電話</th>
                        <th className="py-2.5 px-3 text-right">操作 Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {users.map(u => {
                        const isDefaultAdmin = u.id.includes('default');
                        const canDelete = !isDefaultAdmin && u.role !== 'admin';

                        return (
                          <tr key={u.id} className="hover:bg-slate-50/40">
                            <td className="py-3 px-3">
                              <p className="font-bold text-slate-800">{u.name}</p>
                              <span className={`inline-block text-[9px] font-bold px-1.5 py-0.5 rounded-sm mt-0.5 ${
                                u.role === 'admin' 
                                  ? 'bg-red-50 text-red-650 border border-red-100'
                                  : u.role === 'scanner'
                                    ? 'bg-amber-50 text-amber-650 border border-amber-100'
                                    : 'bg-blue-50 text-blue-650 border border-blue-100'
                              }`}>
                                {u.role === 'admin' ? '系統管理員' : u.role === 'scanner' ? '驗票窗口' : '持票顧客'}
                              </span>
                            </td>
                            <td className="py-3 px-3 font-mono text-slate-600">{u.email}</td>
                            <td className="py-3 px-3 text-slate-500 font-mono">{u.phone || '—'}</td>
                            <td className="py-3 px-3 text-right">
                              {canDelete ? (
                                <button
                                  onClick={() => handleDeleteUser(u.id, u.email)}
                                  className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg border border-transparent hover:border-red-100 transition-colors cursor-pointer inline-flex items-center gap-1 text-[11px]"
                                  title="徹底註銷並刪除此帳號"
                                >
                                  <Trash2 size={12} />
                                  <span>刪除帳號</span>
                                </button>
                              ) : (
                                <span className="text-[10px] text-slate-400 italic px-2">系統保護</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setShowUserModal(false)}
                className="px-4 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
              >
                關閉視窗
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
