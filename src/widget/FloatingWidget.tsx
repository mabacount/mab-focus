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

    onOvertimeStarted(() => {
      soundFx.playOvertimeBell();
    }).then((fn) => (unlistenOt = fn));

    onOvertimeNudge(() => {
      soundFx.playNudgePing();
    }).then((fn) => (unlistenNudge = fn));

    return () => {
      if (unlistenTick) unlistenTick();
      if (unlistenOt) unlistenOt();
      if (unlistenNudge) unlistenNudge();
    };
  }, []);

  // امکان جابه‌جایی پنجره با گرفتن موس روی دایره اصلی
  const handleCircleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0) {
      getCurrentWindow().startDragging().catch(() => {});
    }
  };

  const handleTogglePlay = async (e: React.MouseEvent) => {
    e.stopPropagation();
    soundFx.playClickStart();
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
      getAllProjects().then(setProjects).catch(() => {});
      setIsPopoverOpen(true);
    }
  };

  const handleStopAndSave = async (e: React.MouseEvent) => {
    e.stopPropagation();
    soundFx.playClickStart();
    await stopAndResetTimer();
    setIsPopoverOpen(false);
  };

  const handleBreak = async (e: React.MouseEvent) => {
    e.stopPropagation();
    soundFx.playClickStart();
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

  // محاسبه زمان نمایشی
  const isOvertime = pomodoro.status === "overtime";
  const isBreak =
    pomodoro.mode === "short_break" || pomodoro.mode === "long_break";

  let displayMinutes = 0;
  let displaySeconds = 0;
  let isNegative = false;

  if (isOvertime) {
    isNegative = true;
    const over = pomodoro.elapsed_seconds - pomodoro.target_seconds;
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

  // مشخصات حلقه پیشرفت دایره 88 پیکسلی
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  let progressRatio = 0;

  if (isOvertime) {
    progressRatio = 1;
  } else if (pomodoro.target_seconds > 0) {
    progressRatio = Math.min(
      1,
      pomodoro.elapsed_seconds / pomodoro.target_seconds
    );
  }

  const strokeDashoffset = circumference - progressRatio * circumference;

  let strokeColor = "#10B981"; // سبز زمردی مطابق تصویر مرجع
  if (isOvertime) strokeColor = "#F59E0B";
  else if (isBreak) strokeColor = "#3B82F6";

  const showMenu = isHovered || isPopoverOpen;

  return (
    <div
      dir="ltr"
      className="p-2 select-none flex flex-col items-start w-fit"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* ردیف افقی: دایره ثابت در سمت چپ + نوار کشویی با ارتفاع ۵۰٪ در سمت راست */}
      <div className="relative flex items-center h-[88px]">
        {/* ۱. دایره مرکزی ۸۸×۸۸ پیکسل (کاملاً ثابت در مکان خود) */}
        <div
          onMouseDown={handleCircleMouseDown}
          title="برای جابه‌جایی بکشید"
          className="relative z-20 w-[88px] h-[88px] rounded-full bg-[#1C1C1F] border-[3px] border-[#27272B] shadow-2xl flex items-center justify-center cursor-grab active:cursor-grabbing shrink-0"
        >
          <svg
            className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none"
            viewBox="0 0 88 88"
          >
            {/* پس‌زمینه مسیر حلقه */}
            <circle
              cx="44"
              cy="44"
              r={radius}
              fill="none"
              stroke="rgba(255, 255, 255, 0.06)"
              strokeWidth="4.5"
            />
            {/* حلقه پیشرفت فعال */}
            <circle
              cx="44"
              cy="44"
              r={radius}
              fill="none"
              stroke={strokeColor}
              strokeWidth="4.5"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              className="transition-all duration-500"
            />
          </svg>

          <span
            className="font-mono text-[18px] font-bold tracking-tight tabular-nums pointer-events-none"
            style={{ color: strokeColor }}
          >
            {formattedTime}
          </span>
        </div>

        {/* ۲. نوار کناری با ارتفاع ۴۴ پیکسل (۵۰٪ دایره) که از زیر دایره به بیرون می‌لغزد */}
        <div className="relative z-10 overflow-hidden py-2 -ml-5 pl-5 pr-2">
          <div
            className={`h-[44px] bg-[#222226]/95 border border-white/10 rounded-r-full pl-6 pr-3 flex items-center gap-2 shadow-xl transition-all duration-300 ease-out origin-left ${
              showMenu
                ? "translate-x-0 opacity-100"
                : "-translate-x-full opacity-0 pointer-events-none"
            }`}
          >
            {/* دکمه شروع / مکث */}
            <button
              type="button"
              onClick={handleTogglePlay}
              title={
                pomodoro.status === "running" || pomodoro.status === "overtime"
                  ? "توقف موقت"
                  : "شروع فوری"
              }
              className="w-7 h-7 rounded-lg hover:bg-white/10 text-white/80 hover:text-white flex items-center justify-center transition-colors"
            >
              {pomodoro.status === "running" ||
              pomodoro.status === "overtime" ? (
                <Pause size={15} />
              ) : (
                <Play size={15} className=" fill-current" />
              )}
            </button>

            {/* دکمه مربعی توقف کامل و ثبت (مشابه تصویر مرجع) */}
            {(pomodoro.status !== "idle" || activeTask !== null) && (
              <button
                type="button"
                onClick={handleStopAndSave}
                title="پایان و ذخیره تسک"
                className="w-7 h-7 rounded-lg hover:bg-white/10 text-white/70 hover:text-white flex items-center justify-center transition-colors"
              >
                <Square size={13} className="fill-current" />
              </button>
            )}

            {/* دکمه استراحت */}
            <button
              type="button"
              onClick={handleBreak}
              title="شروع استراحت"
              className="w-7 h-7 rounded-lg hover:bg-white/10 text-white/70 hover:text-emerald-400 flex items-center justify-center transition-colors"
            >
              <Coffee size={15} />
            </button>

            {/* دکمه سه نقطه (...) برای باز کردن فرم مشخصات تسک */}
            <button
              type="button"
              onClick={handleTogglePopover}
              title="ثبت عنوان و پروژه تسک"
              className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
                isPopoverOpen
                  ? "bg-emerald-500/20 text-emerald-400"
                  : "hover:bg-white/10 text-white/70 hover:text-white"
              }`}
            >
              <MoreHorizontal size={16} />
            </button>

            {/* دکمه باز کردن پنجره داشبورد اصلی */}
            <button
              type="button"
              onClick={handleOpenDashboard}
              title="باز کردن داشبورد"
              className="w-7 h-7 rounded-lg hover:bg-white/10 text-white/70 hover:text-blue-400 flex items-center justify-center transition-colors"
            >
              <LayoutDashboard size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* منوی بازشونده ثبت عنوان، پروژه و فاز تسک در زیر دایره */}
      {isPopoverOpen && (
        <div className="mt-2 z-30">
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