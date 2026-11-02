/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Calendar, MapPin, Tag, Users, Check, ShoppingBag, X, Info, Sparkles, Heart } from 'lucide-react';
import { EventSetting } from '../types';

interface UserEventsProps {
  token?: string;
  onPurchaseSuccess: () => void;
  onLoginRequired?: () => void;
}

export default function UserEvents({ token, onPurchaseSuccess, onLoginRequired }: UserEventsProps) {
  const [events, setEvents] = useState<EventSetting[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState<EventSetting | null>(null);
  const [selectedZone, setSelectedZone] = useState<string>('');
  const [ticketQty, setTicketQty] = useState<number>(1);
  const [selectedSeat, setSelectedSeat] = useState<string>('');
  const [buying, setBuying] = useState(false);
  const [purchaseMsg, setPurchaseMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [mapLocation, setMapLocation] = useState<string | null>(null);

  useEffect(() => {
    fetchEvents();
    const saved = localStorage.getItem('starpass_favorites_list');
    if (saved) {
      try {
        setFavorites(JSON.parse(saved));
      } catch {
        setFavorites([]);
      }
    }
  }, []);

  const toggleFavorite = (eventId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = favorites.includes(eventId)
      ? favorites.filter(id => id !== eventId)
      : [...favorites, eventId];
    setFavorites(updated);
    localStorage.setItem('starpass_favorites_list', JSON.stringify(updated));
  };

  const fetchEvents = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/events');
      if (res.ok) {
        try {
          const data = await res.json();
          setEvents(data);
        } catch {
          // ignore
        }
      }
    } catch (err) {
      console.error("Error fetching events:", err);
    } finally {
      setLoading(false);
    }
  };

  const openPurchaseModal = (evt: EventSetting) => {
    setSelectedEvent(evt);
    setSelectedZone(evt.zones[0]?.name || '');
    setTicketQty(1);
    setSelectedSeat('');
    setErrorMsg('');
    setPurchaseMsg('');
  };

  const handlePurchase = async () => {
    if (!selectedEvent || !selectedZone) return;
    setBuying(true);
    setErrorMsg('');
    
    try {
      const res = await fetch('/api/tickets/purchase', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          eventId: selectedEvent.id,
          zoneName: selectedZone,
          quantity: ticketQty
        })
      });

      let data: any = {};
      try {
        data = await res.json();
      } catch {
        data = { error: '伺服器回應資料解析失敗' };
      }

      if (!res.ok) {
        throw new Error(data.error || '購票時發生錯誤');
      }

      setPurchaseMsg(`🎉 購票成功！已為您扣款並簽發 ${ticketQty} 張經防偽加密簽章之數位票券！`);
      
      // Refresh events
      fetchEvents();
      
      setTimeout(() => {
        setSelectedEvent(null);
        onPurchaseSuccess(); // Switch to ticket wallet
      }, 2500);

    } catch (err: any) {
      const msg = err?.message || '交易失敗，請稍後再試';
      if (msg.includes('pattern') || msg.includes('SyntaxError')) {
        setErrorMsg('交易資料格式異常，請重試或切換至示範網路。');
      } else {
        setErrorMsg(msg);
      }
    } finally {
      setBuying(false);
    }
  };

  // Filter events
  const filteredEvents = events.filter(evt => {
    const matchesSearch = evt.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          evt.location.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === 'All' || evt.category.includes(categoryFilter);
    return matchesSearch && matchesCategory;
  });

  const categories = ['All', '演唱會', '科技論壇', '美食展覽'];

  const getPrice = () => {
    if (!selectedEvent || !selectedZone) return 0;
    const zone = selectedEvent.zones.find(z => z.name === selectedZone);
    const modifier = zone ? zone.priceModifier : 1.0;
    return Math.round(selectedEvent.price * modifier) * ticketQty;
  };

  return (
    <div className="space-y-8">
      {/* Search and Filters */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 bg-white rounded-2xl border border-slate-200 shadow-xs">
        <div className="relative flex-1">
          <input 
            id="event-search-input"
            type="text"
            placeholder="搜尋活動名稱、場館地點..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all placeholder:text-slate-300 bg-white"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 md:pb-0">
          {categories.map(cat => (
            <button
              id={`filter-cat-${cat}`}
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`px-4 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                (cat === 'All' && categoryFilter === 'All') || (cat !== 'All' && categoryFilter.includes(cat))
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200/60'
              }`}
            >
              {cat === 'All' ? '全部活動' : cat}
            </button>
          ))}
        </div>
      </div>

      {/* Events Listing */}
      {loading ? (
        <div className="flex justify-center items-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      ) : filteredEvents.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl border border-slate-200 shadow-sm">
          <p className="text-slate-400 text-sm">找不到符合篩選條件的活動，您可以試試重置活動數據或輸入其他關鍵字。</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredEvents.map(evt => {
            const isSoldOut = evt.soldCount >= evt.capacity;
            return (
              <motion.div
                layout
                id={`event-card-${evt.id}`}
                key={evt.id}
                whileHover={{ y: -4 }}
                transition={{ duration: 0.2 }}
                className="bg-white rounded-2xl border border-slate-200 shadow-xs hover:shadow-md overflow-hidden flex flex-col h-full"
              >
                {/* Cover Image */}
                <div className="h-48 w-full overflow-hidden relative bg-slate-100">
                  <img 
                    src={evt.coverImage} 
                    alt={evt.title} 
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                  
                  {/* Favorite button */}
                  <button
                    onClick={(e) => toggleFavorite(evt.id, e)}
                    className="absolute top-3 right-3 p-1.5 bg-white/90 hover:bg-white text-red-500 rounded-full shadow-xs transition-all active:scale-90 cursor-pointer z-10"
                    title={favorites.includes(evt.id) ? "取消收藏" : "加入收藏"}
                  >
                    <Heart size={15} className={favorites.includes(evt.id) ? "fill-red-500" : ""} />
                  </button>

                  <div className="absolute top-3 left-3 bg-white/95 backdrop-blur-xs text-blue-800 text-[10px] font-extrabold px-2.5 py-1 rounded-full shadow-xs flex items-center gap-1 border border-blue-50">
                    <Tag size={10} />
                    <span>{evt.category}</span>
                  </div>
                  {isSoldOut ? (
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center">
                      <span className="text-white font-bold text-sm tracking-wider px-4 py-2 border border-white/30 rounded-xl bg-black/20">
                        額滿 SOLD OUT
                      </span>
                    </div>
                  ) : (
                    <div className="absolute bottom-3 right-3 bg-blue-600/90 backdrop-blur-sm text-white text-xs font-bold px-3 py-1 rounded-xl shadow-xs">
                      NT$ {evt.price.toLocaleString()} 起
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="p-5 flex-1 flex flex-col justify-between">
                  <div className="space-y-3">
                    <h3 className="font-bold text-base text-slate-800 line-clamp-2 leading-snug">{evt.title}</h3>
                    
                    <div className="space-y-1.5 text-xs text-slate-500">
                      <div className="flex items-center gap-2">
                        <Calendar size={14} className="text-slate-400 shrink-0" />
                        <span>{new Date(evt.date).toLocaleString('zh-TW', { dateStyle: 'long', timeStyle: 'short' })}</span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <MapPin size={14} className="text-slate-400 shrink-0" />
                          <span className="line-clamp-1">{evt.location}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setMapLocation(evt.location)}
                          className="text-xs font-bold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200/60 px-2.5 py-1 rounded-lg shrink-0 transition-all flex items-center gap-1 cursor-pointer shadow-2xs hover:shadow-xs active:scale-95"
                          title="查看地圖位置"
                        >
                          <span>🗺️ 查看地圖</span>
                        </button>
                      </div>
                      <div className="flex items-center gap-2">
                        <Users size={14} className="text-slate-400 shrink-0" />
                        <span>席次剩餘 {evt.capacity - evt.soldCount} / {evt.capacity} 位</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between">
                    <div className="w-full">
                      {isSoldOut ? (
                        <button 
                          disabled
                          className="w-full py-2 bg-slate-100 text-slate-400 text-xs font-semibold rounded-xl cursor-not-allowed"
                        >
                          已售罄
                        </button>
                      ) : (
                        <button
                          id={`buy-btn-${evt.id}`}
                          onClick={() => {
                            if (!token) {
                              onLoginRequired?.();
                            } else {
                              openPurchaseModal(evt);
                            }
                          }}
                          className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl transition-colors flex items-center justify-center gap-1 cursor-pointer shadow-xs hover:shadow-md"
                        >
                          <ShoppingBag size={14} />
                          <span>{token ? '立即購票 Booking' : '登入後購票 Login to Book'}</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Booking Modal */}
      <AnimatePresence>
        {selectedEvent && (
          <div id="booking-modal-overlay" className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-lg overflow-hidden flex flex-col"
            >
              {/* Header */}
              <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
                <div className="flex items-center gap-1.5">
                  <Sparkles size={16} className="text-blue-500 animate-pulse" />
                  <span className="text-sm font-bold text-slate-700">選擇席位與區域</span>
                </div>
                <button 
                  id="close-booking-modal"
                  onClick={() => setSelectedEvent(null)}
                  className="text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-200 transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Modal Content */}
              <div className="p-6 space-y-5 overflow-y-auto max-h-[70vh]">
                {purchaseMsg ? (
                  <div id="purchase-success-alert" className="p-6 text-center space-y-3 bg-emerald-50 text-emerald-800 rounded-xl border border-emerald-100">
                    <Check size={36} className="mx-auto text-emerald-500 bg-white p-1 rounded-full shadow-md" />
                    <p className="text-sm font-semibold">{purchaseMsg}</p>
                    <p className="text-xs text-emerald-600">正在引導您前往「我的數位票夾」查看與贈送...</p>
                  </div>
                ) : (
                  <>
                    {/* Event Short Overview */}
                    <div className="flex gap-4 p-3 bg-slate-50 rounded-xl border border-slate-200">
                      <img 
                        src={selectedEvent.coverImage} 
                        alt="Event" 
                        className="w-20 h-20 object-cover rounded-lg bg-slate-200 shrink-0"
                        referrerPolicy="no-referrer"
                      />
                      <div className="space-y-1 flex-1 min-w-0">
                        <h4 className="font-bold text-sm text-slate-800 line-clamp-1">{selectedEvent.title}</h4>
                        <p className="text-[11px] text-slate-500">{new Date(selectedEvent.date).toLocaleDateString("zh-TW")} @ {selectedEvent.location}</p>
                        <div className="flex items-center justify-between gap-2 pt-0.5">
                          <p className="text-[11px] text-blue-600 font-semibold">基本票價: NT$ {selectedEvent.price.toLocaleString()}</p>
                          <button
                            type="button"
                            onClick={() => setMapLocation(selectedEvent.location)}
                            className="text-[10px] font-bold text-blue-600 hover:text-blue-700 bg-white hover:bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-md transition-all flex items-center gap-0.5 cursor-pointer"
                            title="查看地圖位置"
                          >
                            <span>🗺️ 查看地圖</span>
                          </button>
                        </div>
                      </div>
                    </div>

                    {errorMsg && (
                      <div id="booking-error-alert" className="p-3 bg-red-50 text-red-600 text-xs font-semibold rounded-lg border border-red-100">
                        {errorMsg}
                      </div>
                    )}

                    {/* Zone Selector */}
                    <div className="space-y-2">
                      <label className="block text-xs font-semibold text-slate-500">票券區域及價格加成</label>
                      <div className="grid grid-cols-2 gap-3">
                        {selectedEvent.zones.map(zone => (
                          <button
                            id={`zone-selector-${zone.name}`}
                            key={zone.name}
                            type="button"
                            onClick={() => setSelectedZone(zone.name)}
                            className={`p-3 rounded-xl border text-left transition-all relative overflow-hidden cursor-pointer ${
                              selectedZone === zone.name
                                ? 'border-blue-500 bg-blue-50/40 text-blue-900 ring-2 ring-blue-100'
                                : 'border-slate-200 hover:border-slate-300 text-slate-700 bg-white'
                            }`}
                          >
                            <p className="text-xs font-bold line-clamp-1">{zone.name}</p>
                            <p className="text-[10px] text-slate-500 mt-1">加成: x{zone.priceModifier.toFixed(1)} (NT$ {Math.round(selectedEvent.price * zone.priceModifier).toLocaleString()})</p>
                            {selectedZone === zone.name && (
                              <Check size={14} className="absolute right-2 top-2 text-blue-600" />
                            )}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Interactive Seats Preview (Simulated Beautiful Grid) if required */}
                    {selectedEvent.requireSeatSelection !== false ? (
                      <div className="p-4 bg-slate-950 rounded-2xl text-center space-y-3 relative overflow-hidden">
                        {/* Glow elements */}
                        <div className="absolute left-1/2 -translate-x-1/2 top-0 w-32 h-1 bg-blue-500 shadow-[0_0_12px_4px_rgba(59,130,246,0.3)] rounded-full" />
                        <p className="text-[9px] text-blue-400/80 font-mono tracking-widest uppercase">STAGE / 舞台中央</p>
                        
                        <div className="grid grid-cols-6 gap-2 max-w-xs mx-auto pt-2">
                          {Array.from({ length: 18 }).map((_, idx) => {
                            const isOccupied = idx === 3 || idx === 10 || idx === 14;
                            const seatLabel = `${selectedZone ? selectedZone.charAt(0) : 'A'}-${Math.floor(idx / 6) + 1}-${(idx % 6) + 1}`;
                            return (
                              <button
                                id={`seat-cell-${idx}`}
                                key={idx}
                                type="button"
                                disabled={isOccupied}
                                onClick={() => setSelectedSeat(seatLabel)}
                                className={`aspect-square rounded-md text-[8px] font-mono flex items-center justify-center transition-all cursor-pointer ${
                                  isOccupied 
                                    ? 'bg-slate-800 text-slate-600 cursor-not-allowed'
                                    : selectedSeat === seatLabel
                                      ? 'bg-blue-500 text-slate-950 font-bold scale-110 shadow-md shadow-blue-500/20'
                                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600 hover:text-white'
                                }`}
                              >
                                {seatLabel.substring(2)}
                              </button>
                            );
                          })}
                        </div>
                        <div className="flex justify-center gap-4 text-[9px] text-slate-400">
                          <div className="flex items-center gap-1"><div className="w-2.5 h-2.5 bg-slate-700 rounded-xs" /> <span>可選</span></div>
                          <div className="flex items-center gap-1"><div className="w-2.5 h-2.5 bg-blue-500 rounded-xs" /> <span>已選</span></div>
                          <div className="flex items-center gap-1"><div className="w-2.5 h-2.5 bg-slate-800 rounded-xs" /> <span>已佔用</span></div>
                        </div>
                      </div>
                    ) : (
                      <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl text-center space-y-1">
                        <p className="text-xs font-bold text-slate-700">🎟️ 本場次開放自由入座 (免選位)</p>
                        <p className="text-[10px] text-slate-500">本場活動不需要選擇座位，系統將自動為您安排所選區域之自由席，入場時請遵照現場工作人員指引。</p>
                      </div>
                    )}

                    {/* Quantity */}
                    <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                      <div>
                        <p className="text-xs font-semibold text-slate-600">購買張數 (Quantity)</p>
                        <p className="text-[10px] text-slate-400">請設定您要預約的票券數量</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <button
                          id="qty-minus"
                          type="button"
                          onClick={() => setTicketQty(prev => Math.max(1, prev - 1))}
                          className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center font-bold text-slate-600 cursor-pointer"
                        >
                          -
                        </button>
                        <span className="font-bold text-sm w-4 text-center">{ticketQty}</span>
                        <button
                          id="qty-plus"
                          type="button"
                          onClick={() => setTicketQty(prev => Math.min(4, prev + 1))}
                          className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center font-bold text-slate-600 cursor-pointer"
                        >
                          +
                        </button>
                      </div>
                    </div>

                    {/* Security Info Card */}
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex gap-2 items-start text-[10px] text-slate-500">
                      <Info size={14} className="text-blue-600 mt-0.5 shrink-0" />
                      <div>
                        <p className="font-semibold text-slate-700">🔒 全數位防偽購票保障</p>
                        <p className="mt-0.5 leading-relaxed">確認購買後，系統將立即為您簽發綁定您帳戶與信箱的專屬數位凭證，即時生效並支援安全轉贈親友。</p>
                      </div>
                    </div>

                    {/* Checkout Details Footer */}
                    <div className="pt-4 border-t border-slate-200 flex items-center justify-between">
                      <div>
                        <p className="text-[10px] text-slate-400 font-medium">應付總額 Total Amount</p>
                        <p className="text-lg font-black text-blue-600">NT$ {getPrice().toLocaleString()}</p>
                      </div>
                      <button
                        id="purchase-confirm-btn"
                        onClick={handlePurchase}
                        disabled={buying}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs px-6 py-2.5 rounded-xl shadow-xs transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                      >
                        {buying ? (
                          <span>金流認證中...</span>
                        ) : (
                          <>
                            <ShoppingBag size={14} />
                            <span>安全支付結帳</span>
                          </>
                        )}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Venue Map Modal */}
      {mapLocation && (
        <div id="map-modal-overlay" className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-55 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <h3 className="font-bold text-sm text-slate-800">舉辦場地地圖定位：{mapLocation}</h3>
              <button 
                id="close-map-modal"
                onClick={() => setMapLocation(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-200 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>
            <div className="h-72 sm:h-96 w-full bg-slate-100">
              <iframe
                title="Venue Map"
                width="100%"
                height="100%"
                style={{ border: 0 }}
                referrerPolicy="no-referrer"
                src={`https://maps.google.com/maps?q=${encodeURIComponent(mapLocation)}&t=&z=15&ie=UTF8&iwloc=&output=embed`}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
