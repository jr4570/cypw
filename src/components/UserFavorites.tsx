/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Calendar, MapPin, Tag, Heart, ShoppingBag, ArrowRight } from 'lucide-react';
import { EventSetting } from '../types';
import { apiFetch } from '../utils/apiInterceptor';

interface UserFavoritesProps {
  token?: string;
  onViewEvents: () => void;
  onBookEvent: (evt: EventSetting) => void;
  onLoginRequired?: () => void;
}

export default function UserFavorites({ token, onViewEvents, onBookEvent, onLoginRequired }: UserFavoritesProps) {
  const [events, setEvents] = useState<EventSetting[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Load favorites from localStorage
    const savedFavs = localStorage.getItem('starpass_favorites_list');
    if (savedFavs) {
      try {
        setFavorites(JSON.parse(savedFavs));
      } catch {
        setFavorites([]);
      }
    }
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    try {
      setLoading(true);
      const res = await apiFetch('/api/events');
      if (res.ok) {
        try {
          const data = await res.json();
          setEvents(Array.isArray(data) ? data : []);
        } catch {
          setEvents([]);
        }
      }
    } catch (err) {
      console.error("Error fetching events:", err);
    } finally {
      setLoading(false);
    }
  };

  const toggleFavorite = (eventId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = favorites.includes(eventId)
      ? favorites.filter(id => id !== eventId)
      : [...favorites, eventId];
    
    setFavorites(updated);
    localStorage.setItem('starpass_favorites_list', JSON.stringify(updated));
  };

  const favoriteEvents = events.filter(evt => favorites.includes(evt.id));

  return (
    <div className="space-y-6">
      {/* Title block */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Heart size={20} className="text-red-500 fill-red-500 animate-pulse" />
            <span>我的收藏活動</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            您感興趣並標記追蹤的活動項目，可在此隨時追蹤席次與進行快速購票。
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      ) : favoriteEvents.length === 0 ? (
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center py-16 bg-white rounded-2xl border border-slate-200 shadow-xs max-w-lg mx-auto space-y-4 p-6"
        >
          <div className="w-12 h-12 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto">
            <Heart size={24} />
          </div>
          <h3 className="font-bold text-slate-700 text-sm">目前尚無收藏的活動</h3>
          <p className="text-xs text-slate-400 leading-relaxed max-w-xs mx-auto">
            您可以前往「熱門活動特區」瀏覽精選活動，並點擊卡片右上角的愛心，將其加入您的追蹤名單中！
          </p>
          <button
            onClick={onViewEvents}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl cursor-pointer shadow-xs hover:shadow-md transition-all inline-flex items-center gap-1"
          >
            <span>瀏覽熱門活動</span>
            <ArrowRight size={14} />
          </button>
        </motion.div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <AnimatePresence>
            {favoriteEvents.map(evt => {
              const isSoldOut = evt.soldCount >= evt.capacity;
              return (
                <motion.div
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  key={evt.id}
                  className="bg-white rounded-2xl border border-slate-200 shadow-xs hover:shadow-md overflow-hidden flex flex-col h-full relative"
                >
                  {/* Cover Image */}
                  <div className="h-44 w-full overflow-hidden relative bg-slate-100">
                    <img 
                      src={evt.coverImage} 
                      alt={evt.title} 
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                    
                    {/* Favorite Heart Button */}
                    <button
                      onClick={(e) => toggleFavorite(evt.id, e)}
                      className="absolute top-3 right-3 p-1.5 bg-white/90 hover:bg-white text-red-500 rounded-full shadow-sm transition-all active:scale-90 cursor-pointer"
                      title="取消收藏"
                    >
                      <Heart size={16} className="fill-red-500" />
                    </button>

                    <div className="absolute top-3 left-3 bg-white/95 backdrop-blur-xs text-blue-800 text-[10px] font-extrabold px-2.5 py-1 rounded-full shadow-xs flex items-center gap-1 border border-blue-50">
                      <Tag size={10} />
                      <span>{evt.category}</span>
                    </div>
                    {isSoldOut ? (
                      <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center">
                        <span className="text-white font-bold text-sm tracking-wider px-3 py-1.5 border border-white/30 rounded-xl bg-black/20">
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
                      <h3 className="font-bold text-sm text-slate-800 line-clamp-2 leading-snug">{evt.title}</h3>
                      
                      <div className="space-y-1 text-xs text-slate-500">
                        <div className="flex items-center gap-2">
                          <Calendar size={13} className="text-slate-400 shrink-0" />
                          <span>{new Date(evt.date).toLocaleDateString('zh-TW')}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <MapPin size={13} className="text-slate-400 shrink-0" />
                          <span className="line-clamp-1">{evt.location}</span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
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
                            onClick={() => {
                              if (!token) {
                                onLoginRequired?.();
                              } else {
                                onBookEvent(evt);
                              }
                            }}
                            className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl transition-colors flex items-center justify-center gap-1 cursor-pointer shadow-xs hover:shadow-md"
                          >
                            <ShoppingBag size={14} />
                            <span>{token ? '立即購票 Booking' : '登入後購票'}</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
