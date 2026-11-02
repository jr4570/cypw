/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Calendar, MapPin, Tag, Plus, Check, Info, Trash2 } from 'lucide-react';
import { apiFetch } from '../utils/apiInterceptor';

interface AdminEventsProps {
  token: string;
  onEventCreated: () => void;
}

export default function AdminEvents({ token, onEventCreated }: AdminEventsProps) {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('演唱會 (Concert)');
  const [date, setDate] = useState('');
  const [location, setLocation] = useState('');
  const [price, setPrice] = useState('1000');
  const [capacity, setCapacity] = useState('100');
  const [coverImage, setCoverImage] = useState('');
  const [description, setDescription] = useState('');
  
  // Seating Zones Configuration
  const [zones, setZones] = useState<{ name: string; allocation: number; priceModifier: number }[]>([
    { name: "搖滾A區 (Rock Zone A)", allocation: 50, priceModifier: 1.2 },
    { name: "看台B區 (Grandstand B)", allocation: 50, priceModifier: 1.0 }
  ]);
  const [newZoneName, setNewZoneName] = useState('');
  const [newZoneAllocation, setNewZoneAllocation] = useState('20');
  const [newZoneModifier, setNewZoneModifier] = useState('1.0');

  const [requireSeatSelection, setRequireSeatSelection] = useState(true);
  const [creating, setCreating] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const addZone = () => {
    if (!newZoneName) {
      alert("請輸入區域名稱");
      return;
    }
    const alloc = Number(newZoneAllocation);
    const mod = Number(newZoneModifier);
    if (isNaN(alloc) || isNaN(mod)) {
      alert("配置席位數與票價加成係數必須為數值");
      return;
    }

    setZones([...zones, { name: newZoneName, allocation: alloc, priceModifier: mod }]);
    setNewZoneName('');
    setNewZoneAllocation('20');
    setNewZoneModifier('1.0');
  };

  const removeZone = (index: number) => {
    setZones(zones.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    setCreating(true);

    // Compute total capacity from zones if any
    const totalCapacity = zones.reduce((sum, z) => sum + z.allocation, 0);
    const finalCapacity = totalCapacity > 0 ? totalCapacity : Number(capacity);

    try {
      const res = await apiFetch('/api/events', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          title,
          category,
          date,
          location,
          price: Number(price),
          capacity: finalCapacity,
          coverImage: coverImage || undefined,
          description,
          zones,
          requireSeatSelection
        })
      });

      let data: any = {};
      try { data = await res.json(); } catch { data = {}; }
      if (!res.ok) {
        throw new Error(data.error || '建立活動失敗');
      }

      setSuccessMsg("🎉 活動發布成功！此活動已登記到安全票務伺服器，並即時對購票前端公開販售。");
      
      // Reset inputs
      setTitle('');
      setDate('');
      setLocation('');
      setPrice('1000');
      setCapacity('100');
      setCoverImage('');
      setDescription('');
      setZones([
        { name: "搖滾A區 (Rock Zone A)", allocation: 50, priceModifier: 1.2 },
        { name: "看台B區 (Grandstand B)", allocation: 50, priceModifier: 1.0 }
      ]);

      setTimeout(() => {
        onEventCreated(); // Redirect or switch tab
      }, 2000);

    } catch (err: any) {
      setErrorMsg(err.message || '連線錯誤');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-md p-6 max-w-3xl mx-auto space-y-6">
      {/* Title */}
      <div className="border-b border-slate-100 pb-4">
        <h2 className="text-lg font-bold text-slate-800">建立新售票活動</h2>
        <p className="text-xs text-slate-400 mt-1">發布新活動並自訂票價分區席次，即時公開至平台供購票前端登錄選購。</p>
      </div>

      {errorMsg && (
        <div id="event-error-alert" className="p-3 bg-red-50 text-red-600 rounded-xl text-xs font-semibold border border-red-100">
          {errorMsg}
        </div>
      )}
      {successMsg && (
        <div id="event-success-alert" className="p-3 bg-emerald-50 text-emerald-600 rounded-xl text-xs font-semibold border border-emerald-100 flex items-center gap-2">
          <Check size={16} className="text-emerald-500 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6 text-slate-700">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Title */}
          <div className="md:col-span-2">
            <label className="block text-xs font-bold text-slate-500 mb-1">活動主題名稱 <span className="text-red-500">*</span></label>
            <input 
              id="event-title-input"
              type="text"
              required
              placeholder="例如：2026 台北巨星流行演唱會"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-blue-500 bg-white"
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">活動類型 / Category <span className="text-red-500">*</span></label>
            <input
              id="event-category-input"
              type="text"
              required
              placeholder="例如：演唱會、體育賽事、藝術展演"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-blue-500 bg-white"
            />
          </div>

          {/* Date */}
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">活動日期與時間 <span className="text-red-500">*</span></label>
            <input 
              id="event-date-input"
              type="datetime-local"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-blue-500 bg-white"
            />
          </div>

          {/* Location */}
          <div className="md:col-span-2">
            <label className="block text-xs font-bold text-slate-500 mb-1">舉辦場地 / 地點 <span className="text-red-500">*</span></label>
            <input 
              id="event-location-input"
              type="text"
              required
              placeholder="例如：台北小巨蛋 (Taipei Arena) 搖滾舞台"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-blue-500 bg-white"
            />
          </div>

          {/* Base Price */}
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">基準票價 (TWD, 0代表免費) <span className="text-red-500">*</span></label>
            <input 
              id="event-price-input"
              type="number"
              required
              min="0"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-blue-500 bg-white"
            />
          </div>

          {/* Default Cover */}
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">活動宣傳圖網址 / Cover Image URL</label>
            <input 
              id="event-image-input"
              type="url"
              placeholder="留空將自動帶入系統高畫質預設圖"
              value={coverImage}
              onChange={(e) => setCoverImage(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-blue-500 bg-white"
            />
          </div>
        </div>

        {/* Require Seat Selection Toggle */}
        <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
          <input 
            id="event-seat-required-checkbox"
            type="checkbox"
            checked={requireSeatSelection}
            onChange={(e) => setRequireSeatSelection(e.target.checked)}
            className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500 cursor-pointer"
          />
          <div className="cursor-pointer select-none" onClick={() => setRequireSeatSelection(!requireSeatSelection)}>
            <p className="text-xs font-bold text-slate-700">對號座 / 需要對號選位 (Require Seat Selection)</p>
            <p className="text-[10px] text-slate-400">若取消勾選，此活動將視為「自由座（免選位 / General Admission）」，購票時不顯示座位配置盤，由系統直接發放票券。</p>
          </div>
        </div>

        {/* Dynamic Zone Setup */}
        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
          <p className="text-xs font-bold text-slate-700">🎪 席位與票券分區配置 (Zone Setup)</p>
          <p className="text-[10px] text-slate-400">建立不同分區以分配獨立座位，席位總和將自動設定為活動之最大售票容量。</p>

          {/* Configured Zones List */}
          {zones.length > 0 ? (
            <div className="space-y-1.5">
              {zones.map((zone, idx) => (
                <div key={idx} className="flex justify-between items-center bg-white border border-slate-100 p-2.5 rounded-lg text-xs">
                  <div>
                    <span className="font-bold text-slate-800">{zone.name}</span>
                    <span className="text-slate-400 text-[10px] ml-2">席次：{zone.allocation} 位</span>
                    <span className="text-slate-400 text-[10px] ml-2">票價：{zone.priceModifier}x (TWD NT${Math.round(Number(price) * zone.priceModifier)})</span>
                  </div>
                  <button
                    id={`remove-zone-btn-${idx}`}
                    type="button"
                    onClick={() => removeZone(idx)}
                    className="text-red-500 hover:bg-red-50 p-1.5 rounded-md cursor-pointer"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[11px] text-slate-400 text-center py-2">目前無特殊分區，系統將自動套用預設一般票區。</p>
          )}

          {/* Add Zone inputs */}
          <div className="flex flex-wrap md:flex-nowrap gap-2 items-end pt-2 border-t border-slate-200">
            <div className="flex-1 min-w-[120px]">
              <input
                id="zone-add-name"
                type="text"
                placeholder="區域名稱 (例: 搖滾B區)"
                value={newZoneName}
                onChange={(e) => setNewZoneName(e.target.value)}
                className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-[11px] bg-white focus:outline-none"
              />
            </div>
            <div className="w-20">
              <input
                id="zone-add-allocation"
                type="number"
                placeholder="席位數"
                value={newZoneAllocation}
                onChange={(e) => setNewZoneAllocation(e.target.value)}
                className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-[11px] bg-white focus:outline-none"
              />
            </div>
            <div className="w-20">
              <input
                id="zone-add-modifier"
                type="number"
                step="0.1"
                placeholder="價格倍率"
                value={newZoneModifier}
                onChange={(e) => setNewZoneModifier(e.target.value)}
                className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-[11px] bg-white focus:outline-none"
              />
            </div>
            <button
              id="add-zone-submit-btn"
              type="button"
              onClick={addZone}
              className="bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs py-1.5 px-3 rounded-lg border border-blue-200 transition-colors flex items-center gap-1 cursor-pointer whitespace-nowrap"
            >
              <Plus size={14} />
              <span>新增分區</span>
            </button>
          </div>
        </div>

        {/* Description Textarea */}
        <div className="space-y-1">
          <label className="block text-xs font-bold text-slate-500 mb-1">活動詳細說明描述 / Event Description <span className="text-red-500">*</span></label>
          <textarea
            id="event-description-textarea"
            rows={6}
            required
            placeholder="請輸入活動的詳細介紹、場次時程表、退換票說明與現場進場注意事項..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full p-3 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-blue-500 bg-white"
          />
        </div>

        {/* Save button */}
        <div className="pt-4 border-t border-slate-200 flex items-center justify-between">
          <div className="flex items-start gap-1.5 text-[10px] text-slate-400">
            <Info size={12} className="shrink-0 mt-0.5" />
            <span>活動一經發布，平台持卡用戶即可在「活動特區」頁面即時訂購。</span>
          </div>
          <button
            id="publish-event-btn"
            type="submit"
            disabled={creating}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-6 py-2.5 rounded-xl transition-all shadow-xs disabled:opacity-50 cursor-pointer"
          >
            {creating ? '建立中...' : '正式發布活動'}
          </button>
        </div>
      </form>
    </div>
  );
}
