import React, { useState, useEffect, useRef } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  PomodoroState,
  ActiveTaskSlice,
  TimerTickPayload,
  ProjectNode,
} from "../types/models";
import {
  getTimerState,
  startInstantWork,
  startBreak,
  pauseTimer,
  resumeTimer,
  stopAndResetTimer,
  openDashboardWindow,
  getAllProjects,
  onTimerTick,
  onOvertimeStarted,
  onOvertimeNudge,
} from "../services/ipc";
import { soundFx } from "../services/audio";
import { QuickTaskPopover } from "./QuickTaskPopover";
import {
  Play,
  Pause,
  Square,
  Coffee,
  MoreHorizontal,
  LayoutDashboard,
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
  const [projects, setProjects] = useState<ProjectNode[]>([]);
  const [isHovered, setIsHovered] = useState(false);
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);

  // رفرنس زمان آخرین اکشن کاربر برای جلوگیری از تداخل وضعیت قدیم و جدید
  const lastActionTimestampRef = useRef<number>(0);

  // ۱. دریافت وضعیت اولیه و گوش دادن به رویدادهای زنده هسته Rust
  useEffect(() => {
    getTimerState()
      .then((payload) => {
        if (payload && payload.pomodoro) {
          setPomodoro(payload.pomodoro);
          setActiveTask(payload.task);
        }
      })
      .catch(() => {});

    getAllProjects()
      .then(setProjects)
      .catch(() => {});

    let unlistenTick: (() => void) | undefined;
    let unlistenOt: (() => void) | undefined;
    let unlistenNudge: (() => void) | undefined;

    onTimerTick((payload: TimerTickPayload) => {
      // اگر کمتر از ۱.۵ ثانیه از کلیک دستی کاربر گذشته، اجازه نده تیک قدیمی وضعیت را برگرداند
      if (Date.now() - lastActionTimestampRef.current < 1500) return;
      if (payload && payload.pomodoro) {
        setPomodoro(payload.pomodoro);
        setActiveTask(payload.task);
      }
    }).then((fn) => (unlistenTick = fn));

    onOvertimeStarted(() => soundFx.playOvertimeBell()).then(
      (fn) => (unlistenOt = fn)
    );
    onOvertimeNudge(() => soundFx.playNudgePing()).then(
      (fn) => (unlistenNudge = fn)
    );

    return () => {
      if (unlistenTick) unlistenTick();
      if (unlistenOt) unlistenOt();
      if (unlistenNudge) unlistenNudge();
    };
  }, []);

  // ۲. موتور شمارش معکوس تضمین‌شده در هر ۱۰۰۰ میلی‌ثانیه
  useEffect(() => {
    if (pomodoro.status !== "running" && pomodoro.status !== "overtime") {
      return;
    }

    const timerId = window.setInterval(() => {
      setPomodoro((prev) => {
        if (prev.status !== "running" && prev.status !== "overtime") {
          return prev;
        }
        const nextElapsed = prev.elapsed_seconds + 1;
        const reachedOvertime =
          prev.status === "running" && nextElapsed >= prev.target_seconds;

        if (reachedOvertime) {
          soundFx.playOvertimeBell();
        }

        return {
          ...prev,
          elapsed_seconds: nextElapsed,
          status: reachedOvertime ? "overtime" : prev.status,
        };
      });
    }, 1000);

    return () => window.clearInterval(timerId);
  }, [pomodoro.status]);

  // جابه‌جایی پنجره فقط زمانی که ماوس روی دایره زمان‌سنج فشرده شود
  const handleCircleDrag = (e: React.MouseEvent) => {
    if (e.button === 0) {
      getCurrentWindow().startDragging().catch(() => {});
    }
  };

  // شروع کار یا توقف موقت (واکنش آنی بدون تأخیر)
  const handleTogglePlay = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    lastActionTimestampRef.current = Date.now();
    soundFx.playClickStart();

    if (pomodoro.status === "running" || pomodoro.status === "overtime") {
      setPomodoro((prev) => ({ ...prev, status: "paused" }));
      try {
        const res = await pauseTimer();
        if (res?.pomodoro) setPomodoro(res.pomodoro);
      } catch {}
    } else if (pomodoro.status === "paused") {
      setPomodoro((prev) => ({
        ...prev,
        status:
          prev.elapsed_seconds >= prev.target_seconds ? "overtime" : "running",
      }));
      try {
        const res = await resumeTimer();
        if (res?.pomodoro) setPomodoro(res.pomodoro);
      } catch {}
    } else {
      // شروع فوری از ۲۵:۰۰ و شمارش معکوس لحظه‌ای
      setPomodoro((prev) => ({
        ...prev,
        mode: "focus",
        status: "running",
        elapsed_seconds: 0,
        target_seconds: prev.target_seconds > 0 ? prev.target_seconds : 1500,
      }));
      setIsPopoverOpen(true);

      try {
        const res = await startInstantWork();
        if (res?.pomodoro) {
          setPomodoro(res.pomodoro);
          setActiveTask(res.task);
        }
        getAllProjects().then(setProjects).catch(() => {});
      } catch {}
    }
  };

  // پایان کامل و ذخیره تسک
  const handleStopAndSave = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    lastActionTimestampRef.current = Date.now();
    soundFx.playClickStart();

    setPomodoro((prev) => ({
      ...prev,
      mode: "focus",
      status: "idle",
      elapsed_seconds: 0,
      target_seconds: 1500,
    }));
    setActiveTask(null);
    setIsPopoverOpen(false);

    try {
      const res = await stopAndResetTimer();
      if (res?.pomodoro) {
        setPomodoro(res.pomodoro);
        setActiveTask(res.task);
      }
    } catch {}
  };

  // شروع استراحت (حلقه سبز و شمارش معکوس ۵ دقیقه‌ای)
  const handleBreak = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    lastActionTimestampRef.current = Date.now();
    soundFx.playClickStart();

    const nextSets = pomodoro.completed_sets_in_cycle + 1;
    const isLong = nextSets >= 4;

    setPomodoro({
      mode: isLong ? "long_break" : "short_break",
      status: "running",
      elapsed_seconds: 0,
      target_seconds: isLong ? 3600 : 300,
      completed_sets_in_cycle: isLong ? 0 : nextSets,
    });
    setIsPopoverOpen(false);

    try {
      const res = await startBreak();
      if (res?.pomodoro) {
        setPomodoro(res.pomodoro);
        setActiveTask(res.task);
      }
    } catch {}
  };

  const handleTogglePopover = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    getAllProjects().then(setProjects).catch(() => {});
    setIsPopoverOpen((prev) => !prev);
  };

  const handleOpenDashboard = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await openDashboardWindow();
    } catch {}
  };

  // محاسبه زمان نمایشی (شمارش معکوس کاهشی)
  const isOvertime = pomodoro.status === "overtime";
  const isBreak =
    pomodoro.mode === "short_break" || pomodoro.mode === "long_break";
  const isActive =
    pomodoro.status === "running" ||
    pomodoro.status === "paused" ||
    pomodoro.status === "overtime";

  let displayMinutes = 0;
  let displaySeconds = 0;
  let isNegative = false;

  if (isOvertime) {
    isNegative = true;
    const over = Math.max(0, pomodoro.elapsed_seconds - pomodoro.target_seconds);
    displayMinutes = Math.floor(over / 60);
    displaySeconds = over % 60;
  } else {
    const remain = Math.max(
      0,
      pomodoro.target_seconds - pomodoro.elapsed_seconds
    );
    displayMinutes = Math.floor(remain / 60);
    displaySeconds = remain % 60;
  }

  const formattedTime = `${isNegative ? "-" : ""}${String(
    displayMinutes
  ).padStart(2, "0")}:${String(displaySeconds).padStart(2, "0")}`;

  // محاسبه نوار پیشرفت دایره‌ای (شعاع ۲۲.۵ در باکس ۵۶×۵۶)
  const radius = 22.5;
  const circumference = 2 * Math.PI * radius;
  let progressRatio = 0;

  if (isOvertime) {
    progressRatio = 1;
  } else if (pomodoro.target_seconds > 0 && isActive) {
    const rawRatio = pomodoro.elapsed_seconds / pomodoro.target_seconds;
    // نمایش حداقل ۴٪ کمان اولیه در لحظه شروع تا کاربر بلافاصله حلقه آبی یا سبز را ببیند
    progressRatio = Math.min(1, Math.max(0.04, rawRatio));
  }

  const strokeDashoffset = circumference * (1 - progressRatio);

  // رنگ‌بندی استاندارد: کار = آبی (#3B82F6) | استراحت = سبز (#10B981) | اضافه‌کاری = کهربایی (#F59E0B)
  let strokeColor = "#3B82F6";
  let trackColor = "rgba(59, 130, 246, 0.16)";

  if (isOvertime) {
    strokeColor = "#F59E0B";
    trackColor = "rgba(245, 158, 11, 0.2)";
  } else if (isBreak) {
    strokeColor = "#10B981";
    trackColor = "rgba(16, 185, 129, 0.18)";
  } else if (!isActive) {
    trackColor = "rgba(255, 255, 255, 0.08)";
  }

  const showMenu = isHovered || isPopoverOpen;

  return (
    <div
      dir="ltr"
      className="p-2 select-none flex flex-col items-start w-fit"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* کپسول یکپارچه ۵۶ پیکسلی بدون هیچ بیرون‌زدگی */}
      <div
        className={`h-[56px] bg-[#18181B]/95 border border-white/10 rounded-full shadow-2xl flex items-center p-1 transition-all duration-300 ease-out ${
          showMenu ? "w-[238px] pr-2.5" : "w-[56px]"
        }`}
      >
        {/* ۱. دایره تایمر (تنها بخش دارای قابلیت Drag پنجره) */}
        <div
          onMouseDown={handleCircleDrag}
          title="برای جابه‌جایی ویجت بکشید"
          className="relative w-[48px] h-[48px] shrink-0 flex items-center justify-center cursor-grab active:cursor-grabbing rounded-full"
        >
          <svg
            className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none"
            viewBox="0 0 56 56"
          >
            {/* مسیر پس‌زمینه حلقه */}
            <circle
              cx="28"
              cy="28"
              r={radius}
              fill="none"
              stroke={trackColor}
              strokeWidth="3.8"
            />
            {/* نوار پیشرفت پرشونده (آبی در کار / سبز در استراحت) */}
            <circle
              cx="28"
              cy="28"
              r={radius}
              fill="none"
              stroke={strokeColor}
              strokeWidth="3.8"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              className="transition-all duration-300"
            />
          </svg>

          <span
            className="font-mono text-[12px] font-bold tracking-tight tabular-nums pointer-events-none"
            style={{ color: isActive ? strokeColor : "#F4F4F5" }}
          >
            {formattedTime}
          </span>
        </div>

        {/* ۲. نوار دکمه‌ها (کاملاً ایزوله از Drag تا کلیک‌ها ۱۰۰٪ عمل کنند) */}
        <div
          onMouseDown={(e) => e.stopPropagation()}
          className={`flex items-center gap-1.5 ml-2 transition-all duration-300 ${
            showMenu
              ? "opacity-100 translate-x-0"
              : "opacity-0 -translate-x-3 pointer-events-none"
          }`}
        >
          {/* دکمه شروع / مکث */}
          <button
            type="button"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={handleTogglePlay}
            title={
              pomodoro.status === "running" || pomodoro.status === "overtime"
                ? "توقف موقت"
                : "شروع کار (۲۵ دقیقه)"
            }
            className={`w-7 h-7 rounded-full flex items-center justify-center transition-all active:scale-90 shrink-0 cursor-pointer ${
              pomodoro.status === "running" && !isBreak
                ? "bg-blue-600 text-white shadow-md shadow-blue-500/30"
                : "bg-white/10 hover:bg-blue-600 text-white"
            }`}
          >
            {pomodoro.status === "running" || pomodoro.status === "overtime" ? (
              <Pause size={12} />
            ) : (
              <Play size={12} className="ml-0.5 fill-current" />
            )}
          </button>

          {/* دکمه پایان و ذخیره */}
          {(isActive || activeTask !== null) && (
            <button
              type="button"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={handleStopAndSave}
              title="پایان و ذخیره تسک"
              className="w-7 h-7 rounded-full bg-white/5 hover:bg-rose-500/20 text-white/70 hover:text-rose-400 flex items-center justify-center transition-all active:scale-90 shrink-0 cursor-pointer"
            >
              <Square size={11} className="fill-current" />
            </button>
          )}

          {/* دکمه استراحت (سبز) */}
          <button
            type="button"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={handleBreak}
            title="شروع استراحت (۵ دقیقه)"
            className={`w-7 h-7 rounded-full flex items-center justify-center transition-all active:scale-90 shrink-0 cursor-pointer ${
              isBreak && pomodoro.status === "running"
                ? "bg-emerald-600 text-white shadow-md shadow-emerald-500/30"
                : "bg-white/5 hover:bg-emerald-600/20 text-white/70 hover:text-emerald-400"
            }`}
          >
            <Coffee size={13} />
          </button>

          {/* دکمه سه نقطه (مشخصات تسک) */}
          <button
            type="button"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={handleTogglePopover}
            title="مشخصات تسک جاری"
            className={`w-7 h-7 rounded-full flex items-center justify-center transition-all active:scale-90 shrink-0 cursor-pointer ${
              isPopoverOpen
                ? "bg-blue-600 text-white"
                : "bg-white/5 hover:bg-white/15 text-white/70 hover:text-white"
            }`}
          >
            <MoreHorizontal size={14} />
          </button>

          {/* دکمه باز کردن داشبورد */}
          <button
            type="button"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={handleOpenDashboard}
            title="باز کردن داشبورد مدیریت"
            className="w-7 h-7 rounded-full bg-white/5 hover:bg-white/15 text-white/70 hover:text-blue-400 flex items-center justify-center transition-all active:scale-90 shrink-0 cursor-pointer"
          >
            <LayoutDashboard size={13} />
          </button>
        </div>
      </div>

      {/* منوی بازشونده مشخصات تسک */}
      {isPopoverOpen && (
        <div
          onMouseDown={(e) => e.stopPropagation()}
          className="mt-2 z-40"
        >
          <QuickTaskPopover
            activeLogId={activeTask?.log_id || null}
            projects={projects}
            onClose={() => setIsPopoverOpen(false)}
            onTaskSwitched={(newLogId) => {
              setActiveTask({
                log_id: newLogId,
                started_at: new Date().toISOString(),
                elapsed_task_seconds: 0,
                overtime_seconds: 0,
              });
            }}
          />
        </div>
      )}
    </div>
  );
};