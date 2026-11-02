import React, { useState, useEffect, useRef } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { getAllWebviewWindows } from "@tauri-apps/api/webviewWindow";
import {
  PomodoroState,
  ActiveTaskSlice,
  TimerTickPayload,
  ProjectNode,
} from "../types/models";
import {
  startInstantWork,
  startBreak,
  pauseTimer,
  resumeTimer,
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
  Coffee,
  Edit3,
  LayoutDashboard,
  Maximize2,
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
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const [dockPosture, setDockPosture] = useState<"normal" | "docked-left" | "docked-right">("normal");
  const [isHoveredWhileDocked, setIsHoveredWhileDocked] = useState(false);

  const appWindow = useRef(getCurrentWindow()).current;

  // دریافت لیست پروژه‌ها جهت پیشنهاد در منوی بازشونده
  useEffect(() => {
    getAllProjects().then(setProjects).catch(() => {});
  }, []);

  // گوش دادن به تیک‌های یک ثانیه‌ای ارسالی از هسته Rust
  useEffect(() => {
    let unlistenTick: (() => void) | undefined;
    let unlistenOvertime: (() => void) | undefined;
    let unlistenNudge: (() => void) | undefined;

    onTimerTick((payload: TimerTickPayload) => {
      setPomodoro(payload.pomodoro);
      setActiveTask(payload.task);
    }).then((fn) => (unlistenTick = fn));

    onOvertimeStarted(() => {
      soundFx.playOvertimeBell();
    }).then((fn) => (unlistenOvertime = fn));

    onOvertimeNudge(() => {
      soundFx.playNudgePing();
    }).then((fn) => (unlistenNudge = fn));

    return () => {
      if (unlistenTick) unlistenTick();
      if (unlistenOvertime) unlistenOvertime();
      if (unlistenNudge) unlistenNudge();
    };
  }, []);

  // تشخیص موقعیت لبه مانیتور برای چسبیدن خودکار (Docking)
  useEffect(() => {
    let unlistenMoved: (() => void) | undefined;

    appWindow.onMoved(({ payload: position }) => {
      // اگر ویجت به کمتر از ۱۵ پیکسل از لبه چپ مانیتور نزدیک شود
      if (position.x <= 15) {
        setDockPosture("docked-left");
      } else {
        setDockPosture("normal");
      }
    }).then((fn) => (unlistenMoved = fn));

    return () => {
      if (unlistenMoved) unlistenMoved();
    };
  }, [appWindow]);

  // عملیات شروع فوری
  const handleStartPlay = async () => {
    soundFx.playClickStart();
    if (pomodoro.status === "paused") {
      await resumeTimer();
    } else {
      const logId = await startInstantWork();
      setActiveTask({
        log_id: logId,
        started_at: new Date().toISOString(),
        elapsed_task_seconds: 0,
        overtime_seconds: 0,
      });
      // باز شدن منوی مشخصات تسک هم‌زمان با شروع
      setIsPopoverOpen(true);
    }
  };

  // عملیات توقف موقت
  const handlePause = async () => {
    soundFx.playClickStart();
    await pauseTimer();
  };

  // شروع استراحت
  const handleBreak = async () => {
    soundFx.playClickStart();
    await startBreak();
  };

  // باز کردن یا فوکوس روی پنجره داشبورد اصلی
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

  // محاسبات نمایش زمان و درصد نوار دایره‌ای
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

  // محیط دایره با شعاع ۵۰
  const radius = 50;
  const circumference = 2 * Math.PI * radius;
  let progressRatio = 0;

  if (isOvertime) {
    progressRatio = 1;
  } else if (pomodoro.target_seconds > 0) {
    progressRatio = Math.min(1, pomodoro.elapsed_seconds / pomodoro.target_seconds);
  }

  const strokeDashoffset = circumference - progressRatio * circumference;

  // تعیین رنگ نوار بر اساس وضعیت
  let ringStrokeColor = "#3B82F6"; // تمرکز عادی (آبی)
  if (isOvertime) {
    ringStrokeColor = "#F59E0B"; // اضافه‌کاری منفی (کهربایی)
  } else if (isBreak) {
    ringStrokeColor = "#10B981"; // استراحت (سبز)
  }

  // وضعیت نوار باریک چسبیده به لبه مانیتور
  if (dockPosture === "docked-left" && !isHoveredWhileDocked) {
    return (
      <div
        onMouseEnter={() => setIsHoveredWhileDocked(true)}
        className="fixed top-12 left-0 w-3.5 h-36 bg-[#141416]/90 border-r border-y border-white/10 rounded-r-xl flex flex-col justify-end p-0.5 cursor-pointer shadow-lg transition-all z-50 overflow-hidden"
      >
        <div
          className="w-full rounded-full transition-all duration-500"
          style={{
            height: `${Math.round(progressRatio * 100)}%`,
            backgroundColor: ringStrokeColor,
          }}
        />
      </div>
    );
  }

  return (
    <div
      onMouseLeave={() => {
        if (dockPosture === "docked-left") {
          setIsHoveredWhileDocked(false);
        }
      }}
      className="p-3 w-fit select-none flex flex-col items-center relative"
    >
      {/* دایره اصلی ویجت همراه با ناحیه جابه‌جایی در ویندوز */}
      <div
        data-tauri-drag-region
        className="w-44 h-44 rounded-full bg-[#141416]/95 border border-white/10 shadow-2xl relative flex flex-col items-center justify-center tauri-drag"
      >
        {/* حلقه پیشرفت SVG */}
        <svg
          className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none"
          viewBox="0 0 120 120"
        >
          {/* خط خاکستری پس‌زمینه */}
          <circle
            cx="60"
            cy="60"
            r={radius}
            fill="none"
            stroke="rgba(255, 255, 255, 0.05)"
            strokeWidth="5"
          />
          {/* حلقه پیشرفت زمان فعال */}
          <circle
            cx="60"
            cy="60"
            r={radius}
            fill="none"
            stroke={ringStrokeColor}
            strokeWidth="5"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            className="transition-all duration-300"
          />
        </svg>

        {/* برچسب حالت اجرایی */}
        <span className="text-[10px] font-medium tracking-wide uppercase text-white/50 mb-0.5 z-10">
          {isOvertime
            ? "اضافه‌کاری"
            : isBreak
            ? "استراحت"
            : `ست ${pomodoro.completed_sets_in_cycle + 1} از ۴`}
        </span>

        {/* زمان‌سنج با ارقام JetBrains Mono بدون لرزش */}
        <span
          className={`font-mono text-3xl font-bold tabular-nums tracking-tight z-10 ${
            isOvertime
              ? "text-amber-400"
              : isBreak
              ? "text-emerald-400"
              : "text-white"
          }`}
        >
          {formattedTime}
        </span>

        {/* دکمه‌های کنترلی درون دایره */}
        <div className="flex items-center gap-2 mt-2 z-20 no-drag">
          {pomodoro.status === "running" || pomodoro.status === "overtime" ? (
            <button
              onClick={handlePause}
              title="توقف موقت"
              className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
            >
              <Pause size={13} />
            </button>
          ) : (
            <button
              onClick={handleStartPlay}
              title="شروع کار"
              className="p-1.5 rounded-full bg-blue-600 hover:bg-blue-500 text-white transition-colors"
            >
              <Play size={13} />
            </button>
          )}

          <button
            onClick={handleBreak}
            title="شروع استراحت"
            className="p-1.5 rounded-full bg-white/5 hover:bg-white/15 text-white/70 hover:text-white transition-colors"
          >
            <Coffee size={13} />
          </button>

          <button
            onClick={() => setIsPopoverOpen(!isPopoverOpen)}
            title="ویرایش مشخصات تسک جاری"
            className={`p-1.5 rounded-full transition-colors ${
              isPopoverOpen
                ? "bg-blue-600 text-white"
                : "bg-white/5 hover:bg-white/15 text-white/70 hover:text-white"
            }`}
          >
            <Edit3 size={13} />
          </button>

          <button
            onClick={handleOpenDashboard}
            title="باز کردن داشبورد مدیریت"
            className="p-1.5 rounded-full bg-white/5 hover:bg-white/15 text-white/70 hover:text-white transition-colors"
          >
            <LayoutDashboard size={13} />
          </button>
        </div>
      </div>

      {/* منوی بازشونده سریع مشخصات تسک در پایین دایره */}
      {isPopoverOpen && (
        <div className="mt-2 no-drag">
          <QuickTaskPopover
            activeLogId={activeTask?.log_id || null}
            projects={projects}
            onClose={() => setIsPopoverOpen(false)}
            onTaskSwitched={(newLogId) => {
              if (activeTask) {
                setActiveTask({
                  ...activeTask,
                  log_id: newLogId,
                  elapsed_task_seconds: 0,
                  overtime_seconds: 0,
                });
              }
            }}
          />
        </div>
      )}
    </div>
  );
};