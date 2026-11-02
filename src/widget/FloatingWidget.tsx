import React, { useState, useEffect } from "react";
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

  // همگام‌سازی اولیه و گوش دادن به رویدادها
  useEffect(() => {
    getTimerState()
      .then((payload) => {
        if (payload) {
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
      setPomodoro(payload.pomodoro);
      setActiveTask(payload.task);
    }).then((fn) => (unlistenTick = fn));

    onOvertimeStarted(() => soundFx.playOvertimeBell()).then((fn) => (unlistenOt = fn));
    onOvertimeNudge(() => soundFx.playNudgePing()).then((fn) => (unlistenNudge = fn));

    // پولینگ منظم هر ۱ ثانیه به عنوان پشتیبان تا هیچ لرزش یا توقفی رخ ندهد
    const interval = setInterval(() => {
      getTimerState().then((payload) => {
        if (payload) {
          setPomodoro(payload.pomodoro);
          setActiveTask(payload.task);
        }
      }).catch(() => {});
    }, 1000);

    return () => {
      clearInterval(interval);
      if (unlistenTick) unlistenTick();
      if (unlistenOt) unlistenOt();
      if (unlistenNudge) unlistenNudge();
    };
  }, []);

  // هندلر جابه‌جایی مطمئن پنجره در ویندوز
  const handleStartDrag = (e: React.MouseEvent) => {
    if (e.button === 0) {
      getCurrentWindow().startDragging().catch(() => {});
    }
  };

  const handleTogglePlay = async (e: React.MouseEvent) => {
    e.stopPropagation();
    soundFx.playClickStart();

    if (pomodoro.status === "running" || pomodoro.status === "overtime") {
      setPomodoro((p) => ({ ...p, status: "paused" }));
      await pauseTimer();
    } else if (pomodoro.status === "paused") {
      setPomodoro((p) => ({ ...p, status: "running" }));
      await resumeTimer();
    } else {
      setPomodoro((p) => ({ ...p, status: "running", elapsed_seconds: 0 }));
      const logId = await startInstantWork();
      setActiveTask({
        log_id: logId,
        started_at: new Date().toISOString(),
        elapsed_task_seconds: 0,
        overtime_seconds: 0,
      });
      getAllProjects().then(setProjects).catch(() => {});
      setIsPopoverOpen(true);
    }
  };

  const handleStopAndSave = async (e: React.MouseEvent) => {
    e.stopPropagation();
    soundFx.playClickStart();
    setPomodoro((p) => ({ ...p, status: "idle", elapsed_seconds: 0 }));
    setActiveTask(null);
    await stopAndResetTimer();
    setIsPopoverOpen(false);
  };

  const handleBreak = async (e: React.MouseEvent) => {
    e.stopPropagation();
    soundFx.playClickStart();
    setPomodoro((p) => ({ ...p, status: "running", elapsed_seconds: 0, mode: "short_break" }));
    await startBreak();
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

  // محاسبات نمایش زمان
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
    const remain = Math.max(0, pomodoro.target_seconds - pomodoro.elapsed_seconds);
    displayMinutes = Math.floor(remain / 60);
    displaySeconds = remain % 60;
  }

  const formattedTime = `${isNegative ? "-" : ""}${String(displayMinutes).padStart(2, "0")}:${String(displaySeconds).padStart(2, "0")}`;

  // شعاع حلقه متناسب با سایز ۶۴ پیکسل (۲۵٪ کوچک‌تر)
  const radius = 26;
  const circumference = 2 * Math.PI * radius;
  let progressRatio = 0;

  if (isOvertime) {
    progressRatio = 1;
  } else if (pomodoro.target_seconds > 0) {
    progressRatio = Math.min(1, pomodoro.elapsed_seconds / pomodoro.target_seconds);
  }

  const strokeDashoffset = circumference - progressRatio * circumference;

  let strokeColor = "#10B981"; // سبز
  if (isOvertime) strokeColor = "#F59E0B"; // کهربایی
  else if (isBreak) strokeColor = "#3B82F6"; // آبی

  const showMenu = isHovered || isPopoverOpen;

  return (
    <div
      dir="ltr"
      className="p-1.5 select-none flex flex-col items-start w-fit overflow-visible"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* کپسول پیوسته و یکپارچه بدون هیچ بیرون‌زدگی */}
      <div
        data-tauri-drag-region
        onMouseDown={handleStartDrag}
        className={`h-[64px] bg-[#18181B]/95 border border-white/10 rounded-full shadow-2xl flex items-center p-1 cursor-grab active:cursor-grabbing transition-all duration-300 ease-out ${
          showMenu ? "w-[245px] pr-2.5" : "w-[64px]"
        }`}
      >
        {/* ۱. دایره تایمر (قطر ۶۴ پیکسل، ۲۵٪ کوچک‌تر و کاملاً تراز) */}
        <div className="relative w-[56px] h-[56px] shrink-0 flex items-center justify-center pointer-events-none">
          <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 64 64">
            <circle
              cx="32"
              cy="32"
              r={radius}
              fill="none"
              stroke="rgba(255, 255, 255, 0.08)"
              strokeWidth="3.2"
            />
            <circle
              cx="32"
              cy="32"
              r={radius}
              fill="none"
              stroke={strokeColor}
              strokeWidth="3.5"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              className="transition-all duration-300"
            />
          </svg>

          <span
            className="font-mono text-[13px] font-bold tracking-tight tabular-nums"
            style={{ color: strokeColor }}
          >
            {formattedTime}
          </span>
        </div>

        {/* ۲. دکمه‌ها درون کپسول که با انیمیشن نرم ظاهر می‌شوند */}
        <div
          data-tauri-drag-region="false"
          className={`flex items-center gap-1.5 ml-2 no-drag transition-all duration-300 ${
            showMenu ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-4 pointer-events-none"
          }`}
        >
          {/* دکمه شروع / مکث */}
          <button
            type="button"
            onClick={handleTogglePlay}
            title={
              pomodoro.status === "running" || pomodoro.status === "overtime"
                ? "توقف موقت"
                : "شروع کار"
            }
            className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors shrink-0"
          >
            {pomodoro.status === "running" || pomodoro.status === "overtime" ? (
              <Pause size={12} />
            ) : (
              <Play size={12} className="ml-0.5 fill-current" />
            )}
          </button>

          {/* دکمه توقف کامل */}
          {(pomodoro.status !== "idle" || activeTask !== null) && (
            <button
              type="button"
              onClick={handleStopAndSave}
              title="پایان و ثبت تسک"
              className="w-7 h-7 rounded-full bg-white/5 hover:bg-white/15 text-white/70 hover:text-white flex items-center justify-center transition-colors shrink-0"
            >
              <Square size={11} className="fill-current" />
            </button>
          )}

          {/* دکمه استراحت */}
          <button
            type="button"
            onClick={handleBreak}
            title="شروع استراحت"
            className="w-7 h-7 rounded-full bg-white/5 hover:bg-white/15 text-white/70 hover:text-emerald-400 flex items-center justify-center transition-colors shrink-0"
          >
            <Coffee size={13} />
          </button>

          {/* دکمه سه نقطه برای باز کردن پاپ‌اور تسک */}
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

          {/* دکمه داشبورد */}
          <button
            type="button"
            onClick={handleOpenDashboard}
            title="باز کردن داشبورد مدیریت"
            className="w-7 h-7 rounded-full bg-white/5 hover:bg-white/15 text-white/70 hover:text-blue-400 flex items-center justify-center transition-colors shrink-0"
          >
            <LayoutDashboard size={12} />
          </button>
        </div>
      </div>

      {/* منوی بازشونده تسک */}
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