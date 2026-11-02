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

  // بارگذاری داده‌ها و گوش دادن به رویدادهای زنده
  useEffect(() => {
    getTimerState().then((payload) => {
      if (payload && payload.pomodoro) {
        setPomodoro(payload.pomodoro);
        setActiveTask(payload.task);
      }
    }).catch(() => {});

    getAllProjects().then(setProjects).catch(() => {});

    let unlistenTick: (() => void) | undefined;
    let unlistenOt: (() => void) | undefined;
    let unlistenNudge: (() => void) | undefined;

    onTimerTick((payload: TimerTickPayload) => {
      if (payload && payload.pomodoro) {
        setPomodoro(payload.pomodoro);
        setActiveTask(payload.task);
      }
    }).then((fn) => (unlistenTick = fn));

    onOvertimeStarted(() => soundFx.playOvertimeBell()).then((fn) => (unlistenOt = fn));
    onOvertimeNudge(() => soundFx.playNudgePing()).then((fn) => (unlistenNudge = fn));

    return () => {
      if (unlistenTick) unlistenTick();
      if (unlistenOt) unlistenOt();
      if (unlistenNudge) unlistenNudge();
    };
  }, []);

  // زمان‌سنج فعال ۱ ثانیه‌ای فرانت‌اند: شمارش معکوس قطعی و پولینگ زنده از Rust
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;

    if (pomodoro.status === "running" || pomodoro.status === "overtime") {
      interval = setInterval(() => {
        // ۱. استعلام فوری از هسته Rust برای هماهنگی ۱۰۰٪ دقیق
        getTimerState()
          .then((payload) => {
            if (payload && payload.pomodoro) {
              setPomodoro(payload.pomodoro);
              setActiveTask(payload.task);
            }
          })
          .catch(() => {
            // ۲. پیش‌ران لوکال ثانیه‌ها در صورت هرگونه تأخیر در IPC
            setPomodoro((prev) => {
              if (prev.status !== "running" && prev.status !== "overtime") return prev;
              const nextElapsed = prev.elapsed_seconds + 1;
              const isNowOvertime = prev.status === "running" && nextElapsed >= prev.target_seconds;
              return {
                ...prev,
                elapsed_seconds: nextElapsed,
                status: isNowOvertime ? "overtime" : prev.status,
              };
            });
          });
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [pomodoro.status]);

  // رویداد جابه‌جایی آزاد پنجره در مانیتور
  const handleStartDrag = (e: React.MouseEvent) => {
    if (e.button === 0) {
      getCurrentWindow().startDragging().catch(() => {});
    }
  };

  const handleTogglePlay = async (e: React.MouseEvent) => {
    e.stopPropagation();
    soundFx.playClickStart();

    if (pomodoro.status === "running" || pomodoro.status === "overtime") {
      const res = await pauseTimer();
      setPomodoro(res.pomodoro);
      setActiveTask(res.task);
    } else if (pomodoro.status === "paused") {
      const res = await resumeTimer();
      setPomodoro(res.pomodoro);
      setActiveTask(res.task);
    } else {
      const res = await startInstantWork();
      setPomodoro(res.pomodoro);
      setActiveTask(res.task);
      getAllProjects().then(setProjects).catch(() => {});
      setIsPopoverOpen(true);
    }
  };

  const handleStopAndSave = async (e: React.MouseEvent) => {
    e.stopPropagation();
    soundFx.playClickStart();
    const res = await stopAndResetTimer();
    setPomodoro(res.pomodoro);
    setActiveTask(res.task);
    setIsPopoverOpen(false);
  };

  const handleBreak = async (e: React.MouseEvent) => {
    e.stopPropagation();
    soundFx.playClickStart();
    const res = await startBreak();
    setPomodoro(res.pomodoro);
    setActiveTask(res.task);
    setIsPopoverOpen(false);
  };

  const handleTogglePopover = (e: React.MouseEvent) => {
    e.stopPropagation();
    getAllProjects().then(setProjects).catch(() => {});
    setIsPopoverOpen((prev) => !prev);
  };

  const handleOpenDashboard = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await openDashboardWindow();
  };

  // محاسبات نمایش زمان کاهشی
  const isOvertime = pomodoro.status === "overtime";
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
    // شمارش معکوس کاهشی تا صفر
    const remain = Math.max(0, pomodoro.target_seconds - pomodoro.elapsed_seconds);
    displayMinutes = Math.floor(remain / 60);
    displaySeconds = remain % 60;
  }

  const formattedTime = `${isNegative ? "-" : ""}${String(displayMinutes).padStart(2, "0")}:${String(displaySeconds).padStart(2, "0")}`;

  // مشخصات دایره و نوار پیشرفت (قطر ۵۶ پیکسل - شعاع ۲۲.۵)
  const radius = 22.5;
  const circumference = 2 * Math.PI * radius;
  let progressRatio = 0;

  if (isOvertime) {
    progressRatio = 1;
  } else if (pomodoro.target_seconds > 0) {
    progressRatio = Math.min(1, pomodoro.elapsed_seconds / pomodoro.target_seconds);
  }

  const strokeDashoffset = circumference * (1 - progressRatio);

  // رنگ‌بندی دقیق: کار = آبی | استراحت = سبز | اضافه‌کاری = کهربایی
  let strokeColor = "#3B82F6"; // کار و تمرکز: آبی کبالت
  if (isOvertime) {
    strokeColor = "#F59E0B"; // اضافه‌کاری منفی: کهربایی
  } else if (isBreak) {
    strokeColor = "#10B981"; // استراحت: سبز زمردی
  }

  const showMenu = isHovered || isPopoverOpen;

  return (
    <div
      dir="ltr"
      className="p-2 select-none flex flex-col items-start w-fit"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* کپسول یکپارچه ۵۶ پیکسلی بدون هیچ لبه یا بیرون‌زدگی */}
      <div
        data-tauri-drag-region
        onMouseDown={handleStartDrag}
        className={`h-[56px] bg-[#1C1C1F]/95 border border-white/10 rounded-full shadow-2xl flex items-center p-1 cursor-grab active:cursor-grabbing transition-all duration-300 ease-out ${
          showMenu ? "w-[235px] pr-2.5" : "w-[56px]"
        }`}
      >
        {/* ۱. دایره تایمر ۵۶ پیکسلی (شمارش معکوس + نوار پیشرفت دور دایره) */}
        <div className="relative w-[48px] h-[48px] shrink-0 flex items-center justify-center pointer-events-none">
          <svg className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none" viewBox="0 0 56 56">
            <circle
              cx="28"
              cy="28"
              r={radius}
              fill="none"
              stroke="rgba(255, 255, 255, 0.08)"
              strokeWidth="3.5"
            />
            <circle
              cx="28"
              cy="28"
              r={radius}
              fill="none"
              stroke={strokeColor}
              strokeWidth="3.5"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              className="transition-all duration-500"
            />
          </svg>

          <span
            className="font-mono text-[12px] font-bold tracking-tight tabular-nums"
            style={{ color: strokeColor }}
          >
            {formattedTime}
          </span>
        </div>

        {/* ۲. منوی دکمه‌ها درون کپسول با انیمیشن ورود روان */}
        <div
          data-tauri-drag-region="false"
          className={`flex items-center gap-1.5 ml-2 no-drag transition-all duration-300 ${
            showMenu ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-3 pointer-events-none"
          }`}
        >
          {/* شروع / توقف موقت */}
          <button
            type="button"
            onClick={handleTogglePlay}
            title={pomodoro.status === "running" || pomodoro.status === "overtime" ? "توقف موقت" : "شروع کار"}
            className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors shrink-0"
          >
            {pomodoro.status === "running" || pomodoro.status === "overtime" ? (
              <Pause size={12} />
            ) : (
              <Play size={12} className="ml-0.5 fill-current" />
            )}
          </button>

          {/* پایان و ذخیره تسک */}
          {(pomodoro.status !== "idle" || activeTask !== null) && (
            <button
              type="button"
              onClick={handleStopAndSave}
              title="پایان و ذخیره تسک"
              className="w-7 h-7 rounded-full bg-white/5 hover:bg-white/15 text-white/70 hover:text-white flex items-center justify-center transition-colors shrink-0"
            >
              <Square size={11} className="fill-current" />
            </button>
          )}

          {/* استراحت (سبز) */}
          <button
            type="button"
            onClick={handleBreak}
            title="شروع استراحت"
            className="w-7 h-7 rounded-full bg-white/5 hover:bg-white/15 text-white/70 hover:text-emerald-400 flex items-center justify-center transition-colors shrink-0"
          >
            <Coffee size={13} />
          </button>

          {/* ثبت مشخصات تسک */}
          <button
            type="button"
            onClick={handleTogglePopover}
            title="مشخصات تسک"
            className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors shrink-0 ${
              isPopoverOpen
                ? "bg-blue-600 text-white"
                : "bg-white/5 hover:bg-white/15 text-white/70 hover:text-white"
            }`}
          >
            <MoreHorizontal size={14} />
          </button>

          {/* داشبورد مدیریت */}
          <button
            type="button"
            onClick={handleOpenDashboard}
            title="باز کردن داشبورد مدیریت"
            className="w-7 h-7 rounded-full bg-white/5 hover:bg-white/15 text-white/70 hover:text-blue-400 flex items-center justify-center transition-colors shrink-0"
          >
            <LayoutDashboard size={13} />
          </button>
        </div>
      </div>

      {/* منوی بازشونده مشخصات تسک */}
      {isPopoverOpen && (
        <div className="mt-2 z-40">
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