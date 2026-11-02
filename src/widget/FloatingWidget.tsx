import React, { useState, useEffect } from "react";
import { getAllWebviewWindows } from "@tauri-apps/api/webviewWindow";
import {
  PomodoroState,
  ActiveTaskSlice,
  TimerTickPayload,
} from "../types/models";
import {
  startInstantWork,
  startBreak,
  pauseTimer,
  resumeTimer,
  onTimerTick,
} from "../services/ipc";
import {
  Play,
  Pause,
  Coffee,
  LayoutDashboard,
  MoreHorizontal,
} from "lucide-react";

export const FloatingWidget: React.FC = () => {
  const [pomodoro, setPomodoro] = useState<PomodoroState>({
    mode: "focus",
    status: "idle",
    elapsed_seconds: 0,
    target_seconds: 1500,
    completed_sets_in_cycle: 0,
  });

  const [activeTask, setActiveTask] = useState<ActiveTaskSlice | null>(null);
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    onTimerTick((payload: TimerTickPayload) => {
      setPomodoro(payload.pomodoro);
      setActiveTask(payload.task);
    }).then((fn) => (unlisten = fn));

    return () => {
      if (unlisten) unlisten();
    };
  }, []);

  const handleTogglePlay = async () => {
    if (pomodoro.status === "running" || pomodoro.status === "overtime") {
      await pauseTimer();
    } else if (pomodoro.status === "paused") {
      await resumeTimer();
    } else {
      const logId = await startInstantWork();
      setActiveTask({
        log_id: logId,
        started_at: new Date().toISOString(),
        elapsed_task_seconds: 0,
        overtime_seconds: 0,
      });
    }
  };

  const handleBreak = async () => {
    await startBreak();
  };

  const handleOpenDashboard = async () => {
    try {
      const windows = await getAllWebviewWindows();
      const mainWindow = windows.find((w) => w.label === "main");
      if (mainWindow) {
        await mainWindow.show();
        await mainWindow.setFocus();
      }
    } catch {
      // نادیده گرفتن خطا
    }
  };

  // محاسبات نمایش زمان
  const isOvertime = pomodoro.status == "overtime";
  const isBreak = pomodoro.mode === "short_break" || pomodoro.mode === "long_break";

  let displayMinutes = 0;
  let displaySeconds = 0;
  let isNegative = false;

  if (isOvertime) {
    isNegative = true;
    const over = pomodoro.elapsed_seconds - pomodoro.target_seconds;
    displayMinutes = Math.floor(over / 60);
    displaySeconds = over % 60;
  } else {
    const remain = Math.max(0, pomodoro.target_seconds - pomodoro.elapsed_seconds);
    displayMinutes = Math.floor(remain / 60);
    displaySeconds = remain % 60;
  }

  const formattedTime = `${isNegative ? "-" : ""}${String(displayMinutes).padStart(2, "0")}:${String(displaySeconds).padStart(2, "0")}`;

  // تنظیمات حلقه پیشرفت دایره‌ای
  const radius = 22;
  const circumference = 2 * Math.PI * radius;
  let progressRatio = 0;

  if (isOvertime) {
    progressRatio = 1;
  } else if (pomodoro.target_seconds > 0) {
    progressRatio = Math.min(1, pomodoro.elapsed_seconds / pomodoro.target_seconds);
  }

  const strokeDashoffset = circumference - progressRatio * circumference;

  let strokeColor = "#10B981"; // سبز زمردی آرام مطابق تصویر هدف
  if (isOvertime) strokeColor = "#F59E0B";
  else if (pomodoro.mode === "focus" && pomodoro.status === "running") strokeColor = "#3B82F6";

  return (
    <div
      dir="ltr"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="p-1 select-none flex items-center justify-start overflow-hidden w-fit h-fit"
    >
      {/* کپسول اصلی با قابلیت جابه‌جایی در ویندوز */}
      <div
        data-tauri-drag-region
        className={`h-14 rounded-full bg-[#18181B]/95 border border-white/10 shadow-2xl flex items-center px-1.5 transition-all duration-300 ease-out cursor-move tauri-drag ${
          isHovered ? "w-[240px] pr-3" : "w-14"
        }`}
      >
        {/* دایره تایمر مینیمال و ارقام هم‌عرض */}
        <div className="relative w-11 h-11 shrink-0 flex items-center justify-center pointer-events-none">
          <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 52 52">
            <circle
              cx="26"
              cy="26"
              r={radius}
              fill="none"
              stroke="rgba(255, 255, 255, 0.08)"
              strokeWidth="3"
            />
            <circle
              cx="26"
              cy="26"
              r={radius}
              fill="none"
              stroke={strokeColor}
              strokeWidth="3.2"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              className="transition-all duration-500"
            />
          </svg>
          <span
            className="font-mono text-[11px] font-bold tracking-tighter tabular-nums select-none"
            style={{ color: strokeColor }}
          >
            {formattedTime}
          </span>
        </div>

        {/* منوی کنترل بازشونده با انیمیشن در هنگام هاور */}
        <div
          className={`flex items-center gap-2 ml-3 no-drag transition-all duration-300 ${
            isHovered ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-3 pointer-events-none"
          }`}
        >
          <button
            onClick={handleTogglePlay}
            title={pomodoro.status === "running" ? "توقف" : "شروع"}
            className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
          >
            {pomodoro.status === "running" || pomodoro.status === "overtime" ? (
              <Pause size={12} />
            ) : (
              <Play size={12} className="ml-0.5" />
            )}
          </button>

          <button
            onClick={handleBreak}
            title="استراحت"
            className="w-7 h-7 rounded-full bg-white/5 hover:bg-white/15 text-white/70 hover:text-white flex items-center justify-center transition-colors"
          >
            <Coffee size={12} />
          </button>

          <button
            onClick={handleOpenDashboard}
            title="داشبورد مدیریت"
            className="w-7 h-7 rounded-full bg-white/5 hover:bg-white/15 text-white/70 hover:text-white flex items-center justify-center transition-colors"
          >
            <LayoutDashboard size={12} />
          </button>

          <button
            onClick={handleOpenDashboard}
            title="بیشتر"
            className="w-7 h-7 rounded-full bg-white/5 hover:bg-white/15 text-white/50 hover:text-white flex items-center justify-center transition-colors"
          >
            <MoreHorizontal size={13} />
          </button>
        </div>
      </div>
    </div>
  );
};