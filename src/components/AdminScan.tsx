/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  QrCode, ShieldAlert, CheckCircle2, AlertTriangle, User, Phone, Tag, Trash2, Camera, 
  Info, Copy, X, Download, FileSpreadsheet, RefreshCw, Search, Calendar, ChevronDown, Check, Filter
} from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';
import { EventSetting, CheckInLog } from '../types';

interface AdminScanProps {
  token: string;
}

export default function AdminScan({ token }: AdminScanProps) {
  const [ticketCode, setTicketCode] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Event & Check-In Log States for Audit & Export
  const [events, setEvents] = useState<EventSetting[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>('all');
  const [recentLogs, setRecentLogs] = useState<CheckInLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [exportingCsv, setExportingCsv] = useState(false);
  const [logSearchQuery, setLogSearchQuery] = useState('');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Verification Results
  const [scanResult, setScanResult] = useState<{
    success: boolean;
    status: 'success' | 'duplicate' | 'invalid_sig' | 'not_found' | null;
    message?: string;
    error?: string;
    ticketInfo?: {
      eventTitle: string;
      ownerName?: string;
      ownerEmail?: string;
      ownerPhone?: string;
      zone: string;
      seat: string;
      price?: number;
      checkedInAt?: string;
    };
  } | null>(null);

  // Camera Scanning States
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraDevices, setCameraDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');
  const [cameraError, setCameraError] = useState<string>('');
  const html5QrCodeInstanceRef = useRef<Html5Qrcode | null>(null);
  const lastScannedRef = useRef<{ text: string; time: number }>({ text: '', time: 0 });

  useEffect(() => {
    fetchEvents();
  }, []);

  useEffect(() => {
    fetchLogs(true);
    const interval = setInterval(() => {
      fetchLogs(false);
    }, 3500);
    return () => clearInterval(interval);
  }, [selectedEventId]);

  const fetchEvents = async () => {
    try {
      const res = await fetch('/api/events');
      if (res.ok) {
        const data = await res.json();
        setEvents(data);
      }
    } catch (e) {
      console.error("Error loading events:", e);
    }
  };

  const fetchLogs = async (showLoading = true) => {
    try {
      if (showLoading) setLoadingLogs(true);
      const url = selectedEventId && selectedEventId !== 'all'
        ? `/api/admin/logs?eventId=${selectedEventId}&limit=100`
        : `/api/admin/logs?limit=100`;
      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setRecentLogs(data);
      }
    } catch (e) {
      console.error("Error loading logs:", e);
    } finally {
      if (showLoading) setLoadingLogs(false);
    }
  };

  const stats = useMemo(() => {
    const total = recentLogs.length;
    const success = recentLogs.filter(l => l.status === 'success').length;
    const duplicate = recentLogs.filter(l => l.status === 'duplicate').length;
    const failed = recentLogs.filter(l => l.status === 'invalid_sig' || l.status === 'not_found').length;
    return { total, success, duplicate, failed };
  }, [recentLogs]);

  const filteredLogs = useMemo(() => {
    if (!logSearchQuery.trim()) return recentLogs;
    const q = logSearchQuery.toLowerCase();
    return recentLogs.filter(l => 
      l.ticketCode.toLowerCase().includes(q) ||
      (l.ownerEmail && l.ownerEmail.toLowerCase().includes(q)) ||
      (l.ownerName && l.ownerName.toLowerCase().includes(q)) ||
      (l.eventTitle && l.eventTitle.toLowerCase().includes(q)) ||
      (l.seat && l.seat.toLowerCase().includes(q))
    );
  }, [recentLogs, logSearchQuery]);

  const handleExportCSV = async () => {
    try {
      setExportingCsv(true);
      const selectedEvent = events.find(e => e.id === selectedEventId);
      const eventTitle = selectedEvent ? selectedEvent.title : '全部活動';
      
      const url = selectedEventId && selectedEventId !== 'all'
        ? `/api/admin/logs/export-csv?eventId=${selectedEventId}`
        : `/api/admin/logs/export-csv`;

      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!res.ok) {
        throw new Error("伺服器端串流未回應，切換至前端離線報表生成器");
      }

      const blob = await res.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `核銷紀錄報表_${eventTitle.replace(/[\/\\:*?"<>|]/g, '_')}_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      console.warn("Server CSV export failed, generating client-side fallback CSV:", err);
      exportClientSideCSV();
    } finally {
      setExportingCsv(false);
    }
  };

  const exportClientSideCSV = () => {
    const selectedEvent = events.find(e => e.id === selectedEventId);
    const eventTitle = selectedEvent ? selectedEvent.title : '全部活動';
    
    let target = recentLogs;
    if (selectedEventId && selectedEventId !== 'all') {
      target = target.filter(l => l.eventId === selectedEventId);
    }

    const headers = [
      "序號",
      "核銷時間",
      "活動名稱",
      "票券代碼",
      "核銷狀態",
      "持票人姓名",
      "持票人信箱",
      "持票人電話",
      "分區",
      "座位",
      "票價(TWD)",
      "驗票設備",
      "備註原因"
    ];

    const escapeCsv = (str: any) => `"${String(str ?? '').replace(/"/g, '""').replace(/\r?\n/g, ' ')}"`;

    const rows = target.map((log, idx) => {
      let statusLabel = "驗證成功 (准予進場)";
      if (log.status === "duplicate") statusLabel = "重複核銷警報";
      else if (log.status === "invalid_sig") statusLabel = "防偽核簽失敗";
      else if (log.status === "not_found") statusLabel = "查無票券實體";

      return [
        idx + 1,
        escapeCsv(new Date(log.checkedInAt).toLocaleString("zh-TW")),
        escapeCsv(log.eventTitle),
        escapeCsv(log.ticketCode),
        escapeCsv(statusLabel),
        escapeCsv(log.ownerName || "未登記姓名"),
        escapeCsv(log.ownerEmail),
        escapeCsv(log.ownerPhone || "未提供"),
        escapeCsv(log.zone || "未指定"),
        escapeCsv(log.seat || "未指定"),
        log.price !== undefined ? log.price : "",
        escapeCsv(log.device || "閘門掃描器"),
        escapeCsv(log.errorReason || (log.status === "success" ? "安全驗證通過" : ""))
      ].join(",");
    });

    const csvContent = "\uFEFF" + [headers.join(","), ...rows].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const downloadUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = `核銷紀錄報表_${eventTitle.replace(/[\/\\:*?"<>|]/g, '_')}_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(downloadUrl);
  };

  useEffect(() => {
    return () => {
      stopScanner();
    };
  }, []);

  const startScanner = async () => {
    setCameraActive(true);
    setScanResult(null);
    setCameraError('');
    setCameraDevices([]);
    setSelectedCameraId('environment');
    lastScannedRef.current = { text: '', time: 0 }; // reset on start

    try {
      const html5QrCode = new Html5Qrcode("qr-reader-container");
      html5QrCodeInstanceRef.current = html5QrCode;

      // Start scanning directly with environmental back camera constraint (highly compatible on mobile browsers)
      await html5QrCode.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 }
        },
        (decodedText) => {
          const now = Date.now();
          if (decodedText === lastScannedRef.current.text && now - lastScannedRef.current.time < 3000) {
            // Ignore scanning the exact same code within 3 seconds
            return;
          }
          lastScannedRef.current = { text: decodedText, time: now };
          setTicketCode(decodedText);
          handleVerify(decodedText);
        },
        (errorMessage) => {
          // Silence standard capture attempts
        }
      );

      // After successfully active, query other devices so the user has standard dropdown options to switch
      try {
        const devices = await Html5Qrcode.getCameras();
        if (devices && devices.length > 0) {
          setCameraDevices(devices);
        }
      } catch (deviceErr) {
        console.warn("Could not query device labels for switching:", deviceErr);
      }

    } catch (err: any) {
      console.error("Camera access failed:", err);
      // Fallback if environment facingMode fails
      try {
        if (html5QrCodeInstanceRef.current) {
          await html5QrCodeInstanceRef.current.start(
            true, // fallback to any available camera
            {
              fps: 10,
              qrbox: { width: 250, height: 250 }
            },
            (decodedText) => {
              const now = Date.now();
              if (decodedText === lastScannedRef.current.text && now - lastScannedRef.current.time < 3000) {
                return;
              }
              lastScannedRef.current = { text: decodedText, time: now };
              setTicketCode(decodedText);
              handleVerify(decodedText);
            },
            (errorMessage) => {}
          );
          
          try {
            const devices = await Html5Qrcode.getCameras();
            if (devices && devices.length > 0) {
              setCameraDevices(devices);
            }
          } catch (deviceErr) {}
          return; // Success on fallback
        }
      } catch (fallbackErr: any) {
        setCameraError(`相機啟動失敗：請確保此平台已授權本網頁取得相機權限，且連線為 HTTPS 安全加密網址或 localhost 本地測試。錯誤: ${fallbackErr.message || fallbackErr}`);
      }
      if (!cameraError) {
        setCameraError(`相機啟動失敗：請確保此平台已授權本網頁取得相機權限，且連線為 HTTPS 安全加密網址或 localhost 本地測試。錯誤: ${err.message || err}`);
      }
    }
  };

  const stopScanner = async () => {
    if (html5QrCodeInstanceRef.current) {
      try {
        if (html5QrCodeInstanceRef.current.isScanning) {
          await html5QrCodeInstanceRef.current.stop();
        }
      } catch (err) {
        console.error("Error clearing scanner:", err);
      }
      html5QrCodeInstanceRef.current = null;
    }
    setCameraActive(false);
    setCameraDevices([]);
    setSelectedCameraId('');
    setCameraError('');
  };

  const handleCameraChange = async (deviceId: string) => {
    setSelectedCameraId(deviceId);
    if (html5QrCodeInstanceRef.current) {
      try {
        if (html5QrCodeInstanceRef.current.isScanning) {
          await html5QrCodeInstanceRef.current.stop();
        }
        
        const constraints = deviceId === 'environment' ? { facingMode: "environment" } : deviceId;
        
        await html5QrCodeInstanceRef.current.start(
          constraints,
          {
            fps: 10,
            qrbox: { width: 250, height: 250 }
          },
          (decodedText) => {
            const now = Date.now();
            if (decodedText === lastScannedRef.current.text && now - lastScannedRef.current.time < 3000) {
              // Ignore scanning the exact same code within 3 seconds
              return;
            }
            lastScannedRef.current = { text: decodedText, time: now };
            setTicketCode(decodedText);
            handleVerify(decodedText);
          },
          (errorMessage) => {
            // Silence standard capture attempts
          }
        );
      } catch (err: any) {
        setCameraError(`更換鏡頭時出錯: ${err.message || err}`);
      }
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setCameraError('');
    setScanResult(null);

    try {
      const tempScanner = new Html5Qrcode("qr-file-reader-temp");
      const decodedText = await tempScanner.scanFile(file, false);
      setTicketCode(decodedText);
      await handleVerify(decodedText);
      e.target.value = '';
    } catch (err: any) {
      console.error("File scan failed:", err);
      setCameraError(`QR Code 辨識失敗：未在此照片中偵測到清晰的 QR 條碼。請確保拍攝之條碼完整、光線充足，或試著調整拍攝角度後再次重試。`);
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (codeToVerify?: string) => {
    const code = codeToVerify || ticketCode;
    if (!code) {
      alert("請提供欲核銷的電子票號條碼！");
      return;
    }

    setLoading(true);
    setScanResult(null);

    try {
      const res = await fetch('/api/tickets/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ ticketCode: code })
      });

      const data = await res.json();
      
      if (res.ok) {
        setScanResult({
          success: true,
          status: 'success',
          message: data.message,
          ticketInfo: data.ticketInfo
        });
      } else {
        setScanResult({
          success: false,
          status: data.status || 'not_found',
          error: data.error,
          ticketInfo: data.ticketInfo
        });
      }



    } catch (err: any) {
      setScanResult({
        success: false,
        status: null,
        error: "連線核銷伺服器失敗，請檢查網路配置。"
      });
    } finally {
      setLoading(false);
      fetchLogs(false);
    }
  };

  const fillAndVerify = (code: string) => {
    setTicketCode(code);
    handleVerify(code);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(text);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const currentEventTitle = useMemo(() => {
    if (selectedEventId === 'all') return '全部活動';
    const evt = events.find(e => e.id === selectedEventId);
    return evt ? evt.title : '指定活動';
  }, [events, selectedEventId]);

  return (
    <div className="space-y-6 max-w-5xl mx-auto text-slate-800">
      
      {/* 1. Top Control Bar: Event Filter & CSV Report Export Action */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-5">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          
          {/* Left: Event Selection Dropdown */}
          <div className="flex-1 min-w-0 space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
              <Calendar size={15} className="text-blue-600 shrink-0" />
              <span>當前核銷活動 (Active Event)</span>
            </div>
            <div className="relative">
              <select
                id="admin-scan-event-select"
                value={selectedEventId}
                onChange={(e) => setSelectedEventId(e.target.value)}
                className="w-full bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-all appearance-none cursor-pointer pr-9"
              >
                <option value="all">🌐 全部活動 (All Events Check-in Records)</option>
                {events.map((evt) => (
                  <option key={evt.id} value={evt.id}>
                    🎫 {evt.title} ({evt.status === 'upcoming' ? '即將舉行' : evt.status})
                  </option>
                ))}
              </select>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                <ChevronDown size={14} />
              </div>
            </div>
          </div>

          {/* Right: Quick Stats & Export CSV Action Button */}
          <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 shrink-0">
            {/* Quick Metrics Badges */}
            <div className="flex items-center gap-1.5 bg-slate-50 p-1.5 rounded-xl border border-slate-200/80 text-[11px] font-semibold">
              <span className="px-2 py-1 bg-white rounded-lg text-slate-600 shadow-xs border border-slate-100" title="總核銷記錄筆數">
                總計: <strong className="text-slate-900">{stats.total}</strong>
              </span>
              <span className="px-2 py-1 bg-emerald-50 rounded-lg text-emerald-700 border border-emerald-100" title="成功放行">
                成功: <strong>{stats.success}</strong>
              </span>
              <span className="px-2 py-1 bg-amber-50 rounded-lg text-amber-800 border border-amber-200" title="重複核銷警報">
                重複: <strong>{stats.duplicate}</strong>
              </span>
              {stats.failed > 0 && (
                <span className="px-2 py-1 bg-rose-50 rounded-lg text-rose-700 border border-rose-100" title="無效票券攔截">
                  阻擋: <strong>{stats.failed}</strong>
                </span>
              )}
            </div>

            {/* Refresh Button */}
            <button
              onClick={() => fetchLogs(true)}
              disabled={loadingLogs}
              className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-all cursor-pointer active:scale-95 shrink-0"
              title="重新整理核銷資料"
            >
              <RefreshCw size={15} className={loadingLogs ? "animate-spin" : ""} />
            </button>

            {/* CSV Export Button */}
            <button
              id="export-checkin-csv-btn"
              onClick={handleExportCSV}
              disabled={exportingCsv}
              className="px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white rounded-xl text-xs font-bold shadow-md hover:shadow-lg transition-all flex items-center gap-2 cursor-pointer active:scale-95 disabled:opacity-50 shrink-0"
              title="將當前活動驗票核銷紀錄匯出為 CSV 報表"
            >
              {exportingCsv ? (
                <>
                  <RefreshCw size={15} className="animate-spin" />
                  <span>生成報表中...</span>
                </>
              ) : (
                <>
                  <FileSpreadsheet size={16} />
                  <span>匯出核銷報表 (CSV)</span>
                  <Download size={13} className="opacity-80" />
                </>
              )}
            </button>
          </div>

        </div>
      </div>

      {/* 2. Main Scan & Real-time Verification Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Scanner Controller Left Section */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-100 shadow-md p-6 space-y-6">
          <div className="border-b border-slate-100 pb-4 flex justify-between items-center">
            <div>
              <h2 className="text-base font-bold text-slate-800">閘口核銷進場通道</h2>
              <p className="text-[10px] text-slate-400 mt-0.5">
                主辦方進場核銷。支援行動條碼攝影掃描與手動登錄驗證。
              </p>
            </div>
            <div className="flex items-center gap-1.5 bg-emerald-50 text-emerald-800 text-[10px] font-extrabold px-2.5 py-1 rounded-full shadow-xs border border-emerald-100 shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
              <span>通道監聽中</span>
            </div>
          </div>

          {/* Real-time Verification Result Modal Overlay (Mobile & Desktop Responsive) */}
          <AnimatePresence>
            {scanResult && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-xs">
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="w-full max-w-md max-h-[85vh] flex flex-col bg-white rounded-2xl shadow-2xl relative border border-slate-200 overflow-hidden text-slate-800"
                >
                  {/* Top Header with Sticky Close Button */}
                  <div className={`p-4 border-b flex justify-between items-center shrink-0 ${
                    scanResult.status === 'success'
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                      : scanResult.status === 'duplicate'
                      ? 'bg-amber-50 border-amber-300 text-amber-950'
                      : 'bg-rose-50 border-rose-200 text-rose-950'
                  }`}>
                    <div className="flex items-center gap-2 pr-8">
                      {scanResult.status === 'success' && <CheckCircle2 size={22} className="text-emerald-600 shrink-0" />}
                      {scanResult.status === 'duplicate' && <AlertTriangle size={22} className="text-amber-600 shrink-0" />}
                      {scanResult.status !== 'success' && scanResult.status !== 'duplicate' && <ShieldAlert size={22} className="text-rose-600 shrink-0" />}
                      <h3 className="font-extrabold text-sm leading-tight">
                        {scanResult.status === 'success' && '✅ 核銷驗證成功 (准予進場)'}
                        {scanResult.status === 'duplicate' && '⚠️ 重複核銷警報'}
                        {scanResult.status !== 'success' && scanResult.status !== 'duplicate' && '❌ 驗票失敗：拒絕放行'}
                      </h3>
                    </div>

                    {/* Top-Right Fixed Close Button */}
                    <button
                      onClick={() => setScanResult(null)}
                      className="p-1.5 bg-white/80 hover:bg-white text-slate-700 hover:text-slate-900 rounded-full transition-colors cursor-pointer shadow-xs border border-slate-200 shrink-0"
                      title="關閉視窗"
                    >
                      <X size={18} />
                    </button>
                  </div>

                  {/* Scrollable Body Content */}
                  <div className="p-4 space-y-3 overflow-y-auto flex-1 text-xs">
                    {scanResult.status === 'success' && (
                      <div className="space-y-2.5">
                        <div className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-100 space-y-1.5 text-emerald-900">
                          <p className="text-[10px] text-emerald-600 font-bold uppercase">門票詳細資訊</p>
                          <p className="font-bold text-sm text-emerald-950">{scanResult.ticketInfo?.eventTitle}</p>
                          <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-emerald-200/50">
                            <div>
                              <span className="text-emerald-600 block text-[10px]">持票姓名</span>
                              <span className="font-bold">{scanResult.ticketInfo?.ownerName}</span>
                            </div>
                            <div>
                              <span className="text-emerald-600 block text-[10px]">聯絡電話</span>
                              <span className="font-mono font-bold">{scanResult.ticketInfo?.ownerPhone || '未提供'}</span>
                            </div>
                          </div>
                          <div className="pt-1 text-xs">
                            <span className="text-emerald-600 block text-[10px]">座位區域</span>
                            <span className="font-bold">{scanResult.ticketInfo?.zone} / {scanResult.ticketInfo?.seat}</span>
                          </div>
                        </div>
                        <p className="text-[10px] text-emerald-600 text-center font-medium">● 安全憑證計算正確，請予以開閘進入。</p>
                      </div>
                    )}

                    {scanResult.status === 'duplicate' && (
                      <div className="space-y-2.5">
                        <div className="p-3 bg-amber-50/80 rounded-xl border border-amber-200 space-y-1.5 text-amber-950">
                          <p className="font-bold text-xs text-amber-900">{scanResult.error}</p>
                          <p className="text-[11px] leading-relaxed">
                            本門票先前已於 <span className="font-mono font-bold text-amber-950">{scanResult.ticketInfo?.checkedInAt ? new Date(scanResult.ticketInfo.checkedInAt).toLocaleString('zh-TW') : '日前'}</span> 完成核銷進場。
                          </p>
                          <div className="pt-2 border-t border-amber-200/60 space-y-1 text-amber-900 text-[11px]">
                            <p>▪ 登記持有人：<span className="font-bold">{scanResult.ticketInfo?.ownerName}</span> ({scanResult.ticketInfo?.ownerEmail})</p>
                            <p>▪ 席位：<span className="font-bold">{scanResult.ticketInfo?.zone} / {scanResult.ticketInfo?.seat}</span></p>
                          </div>
                        </div>
                        <p className="text-[10px] text-amber-700 text-center font-bold">⚠️ 警惕截圖重製或二手票重複刷卡。</p>
                      </div>
                    )}

                    {scanResult.status !== 'success' && scanResult.status !== 'duplicate' && (
                      <div className="space-y-2.5">
                        <div className="p-3 bg-rose-50/80 rounded-xl border border-rose-200 space-y-1.5 text-rose-950">
                          <p className="font-bold text-xs text-rose-900">{scanResult.error || '防偽核簽驗證失敗，非本系統開出票券'}</p>
                          <p className="text-[11px] text-rose-800 leading-relaxed">
                            安全簽署特徵碼不吻合，無法完成放行核銷。請向入場顧客重新確認實體購票憑證。
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Bottom Footer with Sticky Prominent Close Button */}
                  <div className="p-3 bg-slate-50 border-t border-slate-100 flex justify-end shrink-0">
                    <button
                      onClick={() => setScanResult(null)}
                      className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-md transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <X size={15} />
                      <span>關閉視窗，繼續驗票 (Close & Continue)</span>
                    </button>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          {/* Live Camera Scanner Box */}
          <div className="space-y-3">
            <label className="block text-xs font-bold text-slate-500">📷 鏡頭條碼掃描核銷 (QR Camera Scanner)</label>
            
            {!cameraActive ? (
              <div className="space-y-3">
                <button
                  id="start-camera-scan-btn"
                  onClick={startScanner}
                  className="w-full h-32 border-2 border-dashed border-slate-200 hover:border-blue-400 rounded-2xl bg-slate-50 hover:bg-blue-50/20 transition-all flex flex-col items-center justify-center gap-1.5 text-slate-500 cursor-pointer text-xs font-semibold group"
                >
                  <Camera size={26} className="text-slate-400 group-hover:text-blue-500 group-hover:scale-110 transition-transform" />
                  <span>啟動相機自動掃描</span>
                  <span className="text-[10px] text-slate-400 font-normal">（呼叫裝置鏡頭串流）</span>
                </button>

                <div className="relative flex items-center justify-center my-1.5 text-slate-300 text-[10px] font-bold">
                  <div className="border-t border-slate-100 flex-grow" />
                  <span className="px-3 text-slate-400 uppercase tracking-widest">或 (OR)</span>
                  <div className="border-t border-slate-100 flex-grow" />
                </div>

                {/* Universal Native Camera Capture / File Upload Option */}
                <label 
                  id="file-scan-upload-label"
                  className="w-full h-24 border-2 border-dashed border-blue-100 hover:border-blue-400 rounded-2xl bg-blue-50/10 hover:bg-blue-50/30 transition-all flex flex-col items-center justify-center gap-1 text-blue-600 cursor-pointer text-xs font-bold group text-center px-4"
                >
                  <QrCode size={22} className="text-blue-500 group-hover:scale-110 transition-transform" />
                  <span>上傳 QR 圖片 / 拍照直接識別核銷</span>
                  <span className="text-[10px] text-slate-400 font-normal">（相機不支援時，點擊拍照/選圖 100% 成功）</span>
                  <input
                    id="file-scan-upload-input"
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </label>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Camera devices switch */}
                {cameraDevices.length > 1 && (
                  <div className="flex items-center gap-2 text-xs bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                    <span className="font-bold text-slate-500 text-[11px] shrink-0">📷 切換鏡頭:</span>
                    <select
                      id="camera-device-select"
                      value={selectedCameraId}
                      onChange={(e) => handleCameraChange(e.target.value)}
                      className="flex-1 p-1.5 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none"
                    >
                      {selectedCameraId === 'environment' && (
                        <option value="environment">預設後置鏡頭 (Rear Camera)</option>
                      )}
                      {cameraDevices.map(dev => (
                        <option key={dev.id} value={dev.id}>
                          {dev.label || `攝影機 ${dev.id.substring(0, 5)}`}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Troubleshooting Info */}
                {cameraError && (
                  <div className="p-3 bg-amber-50 text-amber-800 text-[11px] rounded-xl border border-amber-200 space-y-1">
                    <div className="flex items-center gap-1 font-bold">
                      <AlertTriangle size={12} className="text-amber-600" />
                      <span>相機排障診斷提示：</span>
                    </div>
                    <p className="leading-relaxed font-medium">{cameraError}</p>
                    <div className="pt-1.5 text-[10px] text-amber-600 space-y-0.5 leading-normal border-t border-amber-200/50">
                      <p>1. 點擊關閉鏡頭，並使用上方的「上傳 QR 圖片 / 拍照直接識別」，手機可直接開啟相機拍照解碼，100% 能用！</p>
                      <p>2. 請檢查您的瀏覽器，確認本網站具有「相機授權」使用權力。</p>
                      <p>3. 若您在沒有實體相機的模擬器上，請直接使用下方的「快速測試沙盒」免相機一鍵驗證！</p>
                    </div>
                  </div>
                )}
                
                <button
                  id="stop-camera-scan-btn"
                  onClick={stopScanner}
                  className="w-full py-2 bg-slate-100 text-slate-600 font-semibold text-xs rounded-xl hover:bg-slate-200 cursor-pointer"
                >
                  關閉相機攝影模組
                </button>
              </div>
            )}
            
            {/* Unconditionally rendered but visually hidden when not active to preserve DOM for Html5Qrcode initialization */}
            <div className={cameraActive ? "block" : "hidden"}>
              <div id="qr-reader-container" className="overflow-hidden rounded-xl border border-slate-200 bg-black min-h-[250px]" />
            </div>
          </div>

          {/* Manual Enter Box */}
          <div className="space-y-2 pt-2 border-t border-slate-100">
            <label className="block text-xs font-bold text-slate-500">🎫 手動輸入電子票號進行銷帳</label>
            <div className="flex gap-2">
              <input 
                id="manual-ticket-input"
                type="text"
                placeholder="請輸入或黏貼完好之 TIX- 開頭加密票號"
                value={ticketCode}
                onChange={(e) => setTicketCode(e.target.value)}
                className="flex-1 px-3 py-2 border border-slate-200 rounded-xl text-xs font-mono focus:outline-none focus:border-blue-500 bg-white"
              />
              <button
                id="manual-verify-submit-btn"
                onClick={() => handleVerify()}
                disabled={loading}
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs px-5 py-2 rounded-xl disabled:opacity-50 transition-colors cursor-pointer"
              >
                {loading ? '銷帳中...' : '核銷票卡'}
              </button>
            </div>
          </div>

        </div>

        {/* Diagnostics Verification Monitor Right Section */}
        <div className="lg:col-span-5 flex flex-col justify-between bg-slate-900 text-white rounded-2xl border border-slate-800 shadow-xl p-6 relative overflow-hidden min-h-[400px]">
          {/* Glow decoration */}
          <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/10 rounded-full blur-2xl" />
          
          <div>
            {/* Header */}
            <div className="border-b border-slate-800 pb-3 flex justify-between items-center">
              <h3 className="text-xs font-bold tracking-widest text-blue-400 font-mono uppercase">VERIFICATION MONITOR</h3>
              <span className="text-[10px] text-slate-400 font-mono">{currentEventTitle}</span>
            </div>

            {/* Verification Screens */}
            <div className="py-6 flex flex-col justify-center h-full">
              <AnimatePresence mode="wait">
                {!scanResult ? (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="text-center py-10 space-y-4"
                  >
                    <div className="w-16 h-16 bg-slate-800 text-slate-500 rounded-full flex items-center justify-center mx-auto border border-slate-700/50 animate-pulse">
                      <QrCode size={28} />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-400">閘機通道靜置中</p>
                      <p className="text-[10px] text-slate-600 mt-1 max-w-[200px] mx-auto">請開啟相機鏡頭對準電子票券 QR 條碼，或於左側手動輸入票號進行即時認證核銷。</p>
                    </div>
                  </motion.div>
                ) : scanResult.status === 'success' ? (
                  /* Success screen */
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="space-y-5"
                  >
                    <div className="text-center space-y-2">
                      <CheckCircle2 size={44} className="mx-auto text-emerald-500 bg-emerald-500/10 p-1.5 rounded-full border border-emerald-500/20" />
                      <p className="text-sm font-black text-emerald-400">{scanResult.message}</p>
                      <p className="text-[9px] font-bold text-slate-400 tracking-wider">● 票券核銷成功，准予放行進場</p>
                    </div>

                    <div className="bg-slate-950 p-4 rounded-xl border border-slate-850 space-y-2.5 text-[11px] text-slate-300">
                      <div className="flex gap-2 items-start">
                        <Tag size={13} className="text-blue-400 mt-0.5 shrink-0" />
                        <div>
                          <p className="text-[9px] text-slate-500 uppercase font-bold">活動名稱</p>
                          <p className="font-semibold text-white">{scanResult.ticketInfo?.eventTitle}</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 border-t border-slate-800/50 pt-2">
                        <div className="flex gap-1.5 items-start">
                          <User size={13} className="text-blue-400 mt-0.5 shrink-0" />
                          <div>
                            <p className="text-[9px] text-slate-500 uppercase font-bold">持票人姓名</p>
                            <p className="font-semibold text-white">{scanResult.ticketInfo?.ownerName}</p>
                          </div>
                        </div>
                        <div className="flex gap-1.5 items-start">
                          <Phone size={13} className="text-blue-400 mt-0.5 shrink-0" />
                          <div>
                            <p className="text-[9px] text-slate-500 uppercase font-bold">聯絡電話</p>
                            <p className="font-semibold text-white font-mono">{scanResult.ticketInfo?.ownerPhone}</p>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2 items-center border-t border-slate-800/50 pt-2 text-[10px]">
                        <span className="text-slate-500">席位分區：</span>
                        <span className="font-semibold text-white">{scanResult.ticketInfo?.zone} / {scanResult.ticketInfo?.seat}</span>
                      </div>
                    </div>
                  </motion.div>
                ) : scanResult.status === 'duplicate' ? (
                  /* Duplicate Check-in warning screen */
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="space-y-4 text-center"
                  >
                    <AlertTriangle size={48} className="mx-auto text-amber-500 bg-amber-500/10 p-1.5 rounded-full border border-amber-500/20 animate-bounce" />
                    <div className="space-y-1">
                      <p className="text-xs font-black text-amber-500 uppercase tracking-widest">⚠️ 重複核銷警報 !</p>
                      <p className="text-[10px] text-slate-300 leading-relaxed max-w-xs mx-auto mt-2">{scanResult.error}</p>
                    </div>

                    <div className="bg-slate-950 p-4 rounded-xl border border-slate-850 text-left text-[11px] text-slate-400 space-y-1.5">
                      <p className="font-bold text-slate-200">重複進場偵測詳情：</p>
                      <p>▪ 本票券早前已於：<span className="text-white font-mono font-bold">{scanResult.ticketInfo?.checkedInAt ? new Date(scanResult.ticketInfo.checkedInAt).toLocaleString('zh-TW') : '日前'}</span> 進行過核銷進場放行。</p>
                      <p>▪ 登記所有人信箱：<span className="text-white font-mono">{scanResult.ticketInfo?.ownerEmail}</span></p>
                      <p>▪ 席位：<span className="text-white">{scanResult.ticketInfo?.zone} / {scanResult.ticketInfo?.seat}</span></p>
                    </div>
                  </motion.div>
                ) : (
                  /* Forged or invalid signature warning screen */
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="space-y-4 text-center"
                  >
                    <ShieldAlert size={48} className="mx-auto text-red-500 bg-red-500/10 p-1.5 rounded-full border border-red-500/20" />
                    <div className="space-y-1">
                      <p className="text-xs font-black text-red-500 uppercase tracking-widest">❌ 票券核簽驗證失敗 !</p>
                      <p className="text-[10px] text-red-400 leading-relaxed max-w-xs mx-auto mt-2 font-bold">{scanResult.error}</p>
                    </div>

                    <div className="bg-slate-950 p-4 rounded-xl border border-slate-850 text-left text-[10px] text-slate-500 space-y-1.5 leading-relaxed">
                      <p className="font-semibold text-slate-300">防偽防竄校驗失敗：</p>
                      <p>本電子門票之安全簽署特徵碼比對不對稱，可能為非法假造、非系統核發之原始格式、或條碼部分經惡意修改。雷達已拒絕此票券通行，保障現場票務之安全性。</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-800 text-[10px] text-slate-500 flex justify-between items-center">
            <span>閘口認證加密模式: HMAC-SHA256</span>
            <span className="text-emerald-400">● 伺服器同步中</span>
          </div>
        </div>

      </div>

      {/* 3. Live Check-in Audit Logs & CSV Export Panel */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        
        {/* Table Header with Search & Quick Export */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-50/50">
          <div>
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <FileSpreadsheet size={16} className="text-blue-600" />
              <span>當前活動核銷審計紀錄 (Live Check-in Audit Logs)</span>
              <span className="text-[10px] bg-blue-100 text-blue-700 font-extrabold px-2 py-0.5 rounded-full">
                {filteredLogs.length} 筆
              </span>
            </h3>
            <p className="text-[10px] text-slate-400 mt-0.5">
              顯示「{currentEventTitle}」即時核銷流水號、持票人姓名、分區席位與閘口防偽驗證紀錄。
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* Search Input */}
            <div className="relative flex-1 sm:w-60">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="搜尋票號、姓名、信箱..."
                value={logSearchQuery}
                onChange={(e) => setLogSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-blue-500 text-slate-700 placeholder:text-slate-400"
              />
              {logSearchQuery && (
                <button
                  onClick={() => setLogSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X size={12} />
                </button>
              )}
            </div>

            {/* Quick CSV Export */}
            <button
              onClick={handleExportCSV}
              disabled={exportingCsv || filteredLogs.length === 0}
              className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shrink-0"
              title="匯出此列表至 CSV 檔案"
            >
              <Download size={13} />
              <span className="hidden sm:inline">匯出報表</span>
            </button>
          </div>
        </div>

        {/* Audit Log Table */}
        <div className="overflow-x-auto">
          {filteredLogs.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-xs space-y-1.5">
              <FileSpreadsheet size={28} className="mx-auto text-slate-300 opacity-60" />
              <p className="font-semibold">目前無核銷紀錄</p>
              <p className="text-[10px] text-slate-400">當前選擇活動尚未有進場掃描紀錄，掃描票券後將在此處即時呈現。</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 text-slate-500 font-bold uppercase text-[9px] border-b border-slate-200">
                  <th className="py-2.5 px-3">#</th>
                  <th className="py-2.5 px-3">核銷時間</th>
                  <th className="py-2.5 px-3">活動名稱</th>
                  <th className="py-2.5 px-3">票券代碼</th>
                  <th className="py-2.5 px-3">持票姓名 / 電話</th>
                  <th className="py-2.5 px-3">席位</th>
                  <th className="py-2.5 px-3">狀態</th>
                  <th className="py-2.5 px-3">閘口裝置</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {filteredLogs.map((log, index) => {
                  const isSuccess = log.status === 'success';
                  const isDuplicate = log.status === 'duplicate';
                  const isCopied = copiedCode === log.ticketCode;

                  return (
                    <tr key={log.id || index} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-2.5 px-3 text-slate-400 font-mono text-[10px]">
                        {index + 1}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 font-mono text-[11px] whitespace-nowrap">
                        {new Date(log.checkedInAt).toLocaleTimeString('zh-TW', { hour12: false })}
                        <span className="block text-[9px] text-slate-400 font-normal">
                          {new Date(log.checkedInAt).toLocaleDateString('zh-TW')}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-800 font-semibold max-w-[160px] truncate" title={log.eventTitle}>
                        {log.eventTitle}
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-1 font-mono text-[11px] text-slate-700 bg-slate-100/70 px-2 py-0.5 rounded border border-slate-200/50 w-fit">
                          <span className="truncate max-w-[120px]">{log.ticketCode}</span>
                          <button
                            onClick={() => copyToClipboard(log.ticketCode)}
                            className="text-slate-400 hover:text-slate-700 cursor-pointer p-0.5"
                            title="複製票號"
                          >
                            {isCopied ? <Check size={11} className="text-emerald-600" /> : <Copy size={11} />}
                          </button>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span className="font-bold text-slate-800 block text-xs">
                          {log.ownerName || '未登記'}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {log.ownerPhone || log.ownerEmail}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 text-[11px] whitespace-nowrap">
                        {log.zone ? `${log.zone} / ${log.seat || '自由座'}` : '一般席'}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        {isSuccess && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            <CheckCircle2 size={11} />
                            <span>准予進場</span>
                          </span>
                        )}
                        {isDuplicate && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200" title={log.errorReason}>
                            <AlertTriangle size={11} />
                            <span>重複核銷</span>
                          </span>
                        )}
                        {!isSuccess && !isDuplicate && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200" title={log.errorReason}>
                            <ShieldAlert size={11} />
                            <span>無效/拒絕</span>
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-slate-400 text-[10px] whitespace-nowrap font-mono">
                        {log.device || '掃描終端'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Table Footer */}
        {filteredLogs.length > 0 && (
          <div className="p-3 bg-slate-50/70 border-t border-slate-100 flex justify-between items-center text-[10px] text-slate-400">
            <span>● 報表包含 UTF-8 BOM，支援 Microsoft Excel 與 Apple Numbers 正確顯示繁體中文。</span>
            <button
              onClick={handleExportCSV}
              className="text-blue-600 font-bold hover:underline cursor-pointer flex items-center gap-1"
            >
              <Download size={11} />
              <span>匯出完整 CSV 報表</span>
            </button>
          </div>
        )}

      </div>

      <div id="qr-file-reader-temp" className="hidden" />
    </div>
  );
}
