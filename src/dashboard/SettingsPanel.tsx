import React, { useState } from "react";
import { Settings, FileText, Calendar, Clock, Check } from "lucide-react";

export const SettingsPanel: React.FC = () => {
  const [txtPath, setTxtPath] = useState("Documents/MabFocus_WorkLog.txt");
  const [syncLevel, setSyncLevel] = useState<"task" | "pomodoro" | "both">("task");
  const [focusTime, setFocusTime] = useState(25);
  const [shortBreakTime, setShortBreakTime] = useState(5);
  const [longBreakTime, setLongBreakTime] = useState(60);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  return (
    <div className="max-w-3xl space-y-6">
      <form onSubmit={handleSaveSettings} className="space-y-6">
        {/* ۱. تنظیمات فایل متنی محلی */}
        <div className="bg-[#1C1C20] border border-white/10 rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-2 border-b border-white/10 pb-3">
            <FileText size={16} className="text-blue-400" />
            <h3 className="text-sm font-semibold text-white">
              گزارش زنده متنی (.txt) روی هارد دیسک
            </h3>
          </div>

          <div className="space-y-2 text-xs">
            <label className="block text-[11px] text-white/60">
              مسیر ذخیره و نگارش خودکار فایل گزارش در ویندوز
            </label>
            <input
              type="text"
              value={txtPath}
              onChange={(e) => setTxtPath(e.target.value)}
              className="w-full bg-[#141416] border border-white/10 rounded-xl px-3 py-2 font-mono text-white text-xs focus:outline-none focus:border-blue-500"
            />
            <p className="text-[10px] text-white/40">
              پس از بسته شدن هر تسک یا ثبت ویرایش، این فایل به صورت خودکار بدون پرسش مجوز بازنویسی می‌شود.
            </p>
          </div>
        </div>

        {/* ۲. تنظیمات همگام‌سازی تقویم گوگل */}
        <div className="bg-[#1C1C20] border border-white/10 rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-2 border-b border-white/10 pb-3">
            <Calendar size={16} className="text-blue-400" />
            <h3 className="text-sm font-semibold text-white">همگام‌سازی با تقویم گوگل (Google Calendar)</h3>
          </div>

          <div className="space-y-3 text-xs">
            <label className="block text-[11px] text-white/60">سطح ارسال رویدادها به تقویم</label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {[
                { id: "task", title: "سطح تسک (Task-Level)", desc: "هر تسک یک رویداد مجزا" },
                { id: "pomodoro", title: "سطح پومودورو (Block)", desc: "بلوک‌های ۲۵ دقیقه‌ای" },
                { id: "both", title: "هر دو (Both)", desc: "ثبت کامل بلوک‌ها و تسک‌ها" },
              ].map((lvl) => (
                <div
                  key={lvl.id}
                  onClick={() => setSyncLevel(lvl.id as "task" | "pomodoro" | "both")}
                  className={`p-3 rounded-xl border cursor-pointer transition-all ${
                    syncLevel === lvl.id
                      ? "bg-blue-600/20 border-blue-500 text-white"
                      : "bg-[#141416] border-white/5 text-white/60 hover:border-white/10"
                  }`}
                >
                  <div className="font-semibold text-xs mb-1">{lvl.title}</div>
                  <div className="text-[10px] text-white/40">{lvl.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ۳. تنظیم زمان‌بندی‌های چرخه پومودورو */}
        <div className="bg-[#1C1C20] border border-white/10 rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-2 border-b border-white/10 pb-3">
            <Clock size={16} className="text-blue-400" />
            <h3 className="text-sm font-semibold text-white">زمان‌بندی چرخه تمرکز و استراحت</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="block text-[11px] text-white/60 mb-1">
                مدت زمان تمرکز (دقیقه)
              </label>
              <input
                type="number"
                value={focusTime}
                onChange={(e) => setFocusTime(Number(e.target.value))}
                className="w-full bg-[#141416] border border-white/10 rounded-xl px-3 py-2 font-mono text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-[11px] text-white/60 mb-1">
                استراحت کوتاه (دقیقه)
              </label>
              <input
                type="number"
                value={shortBreakTime}
                onChange={(e) => setShortBreakTime(Number(e.target.value))}
                className="w-full bg-[#141416] border border-white/10 rounded-xl px-3 py-2 font-mono text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-[11px] text-white/60 mb-1">
                استراحت طولانی ست چهارم (دقیقه)
              </label>
              <input
                type="number"
                value={longBreakTime}
                onChange={(e) => setLongBreakTime(Number(e.target.value))}
                className="w-full bg-[#141416] border border-white/10 rounded-xl px-3 py-2 font-mono text-white focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            className="bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs px-6 py-2.5 rounded-xl flex items-center gap-2 transition-colors"
          >
            <Check size={14} />
            <span>ذخیره تنظیمات</span>
          </button>
          {savedSuccess && (
            <span className="text-xs text-emerald-400 animate-fade-in">
              تنظیمات با موفقیت ذخیره شد.
            </span>
          )}
        </div>
      </form>
    </div>
  );
};