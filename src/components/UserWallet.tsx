/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CreditCard, Calendar, MapPin, QrCode, Send, ShieldCheck, History, ArrowRight, X, AlertTriangle, CheckCircle, Gift } from 'lucide-react';
import { Ticket } from '../types';

interface UserWalletProps {
  token: string;
}

export default function UserWallet({ token }: UserWalletProps) {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [transferEmail, setTransferEmail] = useState('');
  const [transfering, setTransfering] = useState(false);
  const [transferSuccess, setTransferSuccess] = useState('');
  const [transferError, setTransferError] = useState('');
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    fetchTickets(true);
    
    // Setup real-time auto polling every 3 seconds to reflect instant check-ins
    pollIntervalRef.current = setInterval(() => {
      fetchTickets(false);
    }, 3000);

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, []);

  const fetchTickets = async (showLoading: boolean) => {
    try {
      if (showLoading) setLoading(true);
      const res = await fetch('/api/tickets/my', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        try {
          const data = await res.json();
          // If selected ticket status changed during poll, update selected too
          setTickets(prev => {
            if (selectedTicket) {
              const updated = data.find((t: Ticket) => t.id === selectedTicket.id);
              if (updated && updated.status !== selectedTicket.status) {
                setSelectedTicket(updated);
              }
            }
            return data;
          });
        } catch {
          // ignore
        }
      }
    } catch (err) {
      console.error("Error fetching wallet tickets:", err);
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  const openTransferModal = (ticket: Ticket) => {
    setSelectedTicket(ticket);
    setTransferEmail('');
    setTransferError('');
    setTransferSuccess('');
  };

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket || !transferEmail) return;
    
    setTransfering(true);
    setTransferError('');
    setTransferSuccess('');

    try {
      const res = await fetch('/api/tickets/transfer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          ticketId: selectedTicket.id,
          receiverEmail: transferEmail
        })
      });

      let data: any = {};
      try {
        data = await res.json();
      } catch {
        data = { error: '伺服器回應資料解析失敗' };
      }

      if (!res.ok) {
        throw new Error(data.error || '票券轉贈失敗');
      }

      setTransferSuccess(`🎉 轉贈成功！票券已作廢並重新簽署安全數位憑證至 「${transferEmail}」！`);
      fetchTickets(false);

      setTimeout(() => {
        setSelectedTicket(null);
      }, 2500);

    } catch (err: any) {
      const msg = err?.message || '轉贈過程發生異常';
      if (msg.includes('pattern') || msg.includes('SyntaxError')) {
        setTransferError('轉贈通訊格式異常，請確認輸入信箱格式正確。');
      } else {
        setTransferError(msg);
      }
    } finally {
      setTransfering(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Overview Info banner */}
      <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100 flex items-start gap-3">
        <ShieldCheck size={18} className="text-blue-600 shrink-0 mt-0.5" />
        <div className="space-y-1 text-xs text-blue-850">
          <p className="font-bold">✨ 安全即時票夾 (Real-time Secure Wallet)</p>
          <p className="leading-relaxed text-slate-600">本畫面支援跨平台即時同步驗證。若驗票人員在其他裝置或閘口掃描核銷您的 QR Code，此處票卡將於數秒內同步更新為「已進場」狀態，無須手動重整。</p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      ) : tickets.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl border border-slate-200 shadow-xs">
          <div className="w-16 h-16 bg-slate-50 text-slate-300 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-200/60">
            <CreditCard size={28} />
          </div>
          <p className="text-slate-500 font-medium text-sm">您的電子票夾目前是空的</p>
          <p className="text-slate-400 text-xs mt-1">前往「熱門活動特區」訂購您心儀的活動票券吧！</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {tickets.map(ticket => {
            const isCheckedIn = ticket.status === 'checked_in';
            return (
              <motion.div
                id={`ticket-pass-${ticket.id}`}
                key={ticket.id}
                layoutId={`ticket-${ticket.id}`}
                className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden flex flex-col justify-between hover:shadow-md transition-all"
              >
                {/* Upper Card Block */}
                <div className={`p-6 ${isCheckedIn ? 'bg-slate-50 border-b-2 border-dashed border-slate-200' : 'bg-gradient-to-br from-slate-900 to-slate-800 text-white relative'}`}>
                  {/* Decorative Elements */}
                  {!isCheckedIn && (
                    <div className="absolute right-0 bottom-0 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
                  )}

                  <div className="flex justify-between items-start gap-4">
                    <div>
                      <span className={`text-[10px] font-extrabold tracking-wider uppercase px-2 py-0.5 rounded-md ${
                        isCheckedIn 
                          ? 'bg-slate-200 text-slate-600' 
                          : ticket.isGifted 
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/20' 
                            : 'bg-blue-500/20 text-blue-300 border border-blue-500/20'
                      }`}>
                        {isCheckedIn ? '已核銷 USED' : ticket.isGifted ? '親友贈券 GIFTED' : '持票人 PASS'}
                      </span>
                      <h3 className={`font-extrabold text-base mt-2 tracking-tight leading-snug ${isCheckedIn ? 'text-slate-600' : 'text-white'}`}>
                        {ticket.eventTitle}
                      </h3>
                    </div>

                    {/* QR Preview Trigger */}
                    {!isCheckedIn && (
                      <div className="bg-white p-1.5 rounded-lg shrink-0 shadow-md">
                        <img 
                          src={`https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(ticket.ticketCode)}&size=80&color=0f172a`}
                          alt="QR Mini" 
                          className="w-12 h-12"
                        />
                      </div>
                    )}
                  </div>

                  <div className={`grid grid-cols-2 gap-4 mt-5 text-xs ${isCheckedIn ? 'text-slate-500' : 'text-slate-300'}`}>
                    <div>
                      <p className="text-[10px] uppercase font-bold text-slate-400">活動時間 Date</p>
                      <p className="font-semibold mt-0.5">{new Date(ticket.eventDate).toLocaleDateString('zh-TW')} {new Date(ticket.eventDate).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase font-bold text-slate-400">專屬座席 Seat</p>
                      <p className="font-semibold mt-0.5">{ticket.zone} / {ticket.seat}</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-[10px] uppercase font-bold text-slate-400">場地 Location</p>
                      <p className="font-semibold mt-0.5 line-clamp-1">{ticket.eventLocation}</p>
                    </div>
                  </div>
                </div>

                {/* Ticket Divider for Checked-in */}
                {isCheckedIn && (
                  <div className="flex justify-between items-center px-6 py-2 bg-slate-100 text-[11px] font-mono text-slate-500 border-b border-slate-200">
                    <span>核銷時間: {new Date(ticket.checkedInAt || "").toLocaleTimeString("zh-TW")}</span>
                    <span className="font-bold text-red-500">◆ 已入場</span>
                  </div>
                )}

                {/* Lower Card Block */}
                <div className="p-5 bg-white space-y-4">
                  {/* Security Hash Display */}
                  <div className="flex justify-between items-center text-[10px] font-mono text-slate-400 bg-slate-50 p-2 rounded-lg border border-slate-200/60">
                    <span className="truncate">編碼: {ticket.ticketCode.substring(0, 15)}...</span>
                    <span className="text-blue-600 shrink-0 font-bold">● 雜湊認證碼</span>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    {!isCheckedIn ? (
                      <>
                        <button
                          id={`show-qr-btn-${ticket.id}`}
                          onClick={() => openTransferModal(ticket)}
                          className="flex-1 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <QrCode size={14} />
                          <span>出示條碼驗票</span>
                        </button>
                        <button
                          id={`gift-ticket-btn-${ticket.id}`}
                          onClick={() => openTransferModal(ticket)}
                          className="px-4 py-2 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 text-xs font-semibold rounded-xl flex items-center justify-center gap-1 transition-all cursor-pointer"
                        >
                          <Gift size={14} />
                          <span>轉贈親友</span>
                        </button>
                      </>
                    ) : (
                      <div className="w-full text-center py-2 text-xs font-semibold text-slate-400 bg-slate-100 rounded-xl">
                        此票券已被系統鎖定銷帳
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Dynamic Ticket Detail, Scanning, & Transfer Modal */}
      <AnimatePresence>
        {selectedTicket && (
          <div id="ticket-action-modal" className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-md overflow-hidden flex flex-col"
            >
              {/* Header */}
              <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
                <span className="text-xs font-bold text-slate-700">電子票券安全中心</span>
                <button 
                  id="close-ticket-action"
                  onClick={() => setSelectedTicket(null)}
                  className="p-1 rounded-full text-slate-400 hover:bg-slate-200 transition-colors cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Body */}
              <div className="p-6 space-y-6">
                {/* Visual Pass Rendering */}
                <div className="p-5 bg-slate-900 text-white rounded-2xl space-y-4 text-center relative overflow-hidden">
                  <div className="space-y-1">
                    <h4 className="font-extrabold text-sm text-blue-400">{selectedTicket.eventTitle}</h4>
                    <p className="text-[10px] text-slate-400">{new Date(selectedTicket.eventDate).toLocaleString("zh-TW")}</p>
                  </div>

                  {/* High Quality QR code */}
                  <div className="bg-white p-3 rounded-2xl inline-block shadow-lg mx-auto">
                    <img 
                      id="pass-qr-code-image"
                      src={`https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(selectedTicket.ticketCode)}&size=200x200&color=0f172a`}
                      alt="Verify QR Code"
                      className="w-40 h-40"
                    />
                  </div>

                  <div className="space-y-1">
                    <p className="text-xs font-bold text-slate-200">{selectedTicket.zone} / {selectedTicket.seat}</p>
                    <p className="text-[9px] font-mono text-slate-500 select-all select-none">{selectedTicket.ticketCode}</p>
                  </div>

                  {/* Real-time sync radar animation */}
                  {selectedTicket.status !== 'checked_in' && (
                    <div className="flex items-center justify-center gap-1.5 text-[9px] text-blue-400 font-semibold animate-pulse">
                      <span className="w-1.5 h-1.5 bg-blue-500 rounded-full" />
                      <span>行動核銷通道：即時防偽監聽中...</span>
                    </div>
                  )}
                </div>

                {/* Transferring Panel (兌換送人功能) */}
                {selectedTicket.status !== 'checked_in' && (
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                    <div className="flex items-center gap-1.5">
                      <Send size={14} className="text-blue-600" />
                      <span className="text-xs font-bold text-slate-700">轉贈票券予親友 (Gift Ticket)</span>
                    </div>
                    
                    {transferSuccess ? (
                      <div id="transfer-success-msg" className="p-3 bg-emerald-50 text-emerald-700 text-xs font-semibold rounded-lg border border-emerald-100 flex items-center gap-2">
                        <CheckCircle size={14} className="text-emerald-500 shrink-0" />
                        <span>{transferSuccess}</span>
                      </div>
                    ) : (
                      <form onSubmit={handleTransfer} className="space-y-2">
                        {transferError && (
                          <div id="transfer-error-msg" className="p-2.5 bg-red-50 text-red-600 text-[11px] font-semibold rounded-lg border border-red-100 flex items-start gap-1">
                            <AlertTriangle size={14} className="text-red-500 shrink-0 mt-0.5" />
                            <span>{transferError}</span>
                          </div>
                        )}
                        <p className="text-[10px] text-slate-400 leading-relaxed">請輸入接收人已註冊的帳號 (E-mail)。轉贈後，您手上的這張票券條碼將自動註銷作廢，系統會為對方重新生成專屬防偽票券。</p>
                        <div className="flex gap-2">
                          <input
                            id="transfer-email-input"
                            type="email"
                            required
                            placeholder="請輸入親友註冊信箱"
                            value={transferEmail}
                            onChange={(e) => setTransferEmail(e.target.value)}
                            className="flex-1 px-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 bg-white"
                          />
                          <button
                            id="transfer-submit-btn"
                            type="submit"
                            disabled={transfering}
                            className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-4 py-1.5 rounded-lg disabled:opacity-50 transition-colors cursor-pointer"
                          >
                            {transfering ? '正在贈送...' : '確認送出'}
                          </button>
                        </div>
                      </form>
                    )}
                  </div>
                )}

                {/* Audit history */}
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                    <History size={14} className="text-slate-400" />
                    <span>票券安全歷程 (Audit Trail)</span>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-lg text-[10px] text-slate-500 space-y-1 font-mono max-h-24 overflow-y-auto border border-slate-200">
                    {selectedTicket.history.map((h, i) => (
                      <div key={i} className="flex gap-1 items-start">
                        <span className="text-blue-600 font-bold">▪</span>
                        <p>{h}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
