import { invoke } from "@tauri-apps/api/core";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import { ProjectNode, TaskLogRecord, TimerTickPayload } from "../types/models";

// ۱. شروع فوری کار بدون معطلی
export async function startInstantWork(): Promise<string> {
  return await invoke<string>("start_instant_work");
}

// ۲. به‌روزرسانی عنوان و متادیتای تسک در حال اجرا
export async function updateActiveTaskMetadata(
  logId: string,
  title: string,
  macroProjectId: string | null,
  subProjectId: string | null,
  tagIds: string[]
): Promise<void> {
  await invoke("update_active_task_metadata", {
    logId,
    title,
    macroProjectId,
    subProjectId,
    tagIdsJson: JSON.stringify(tagIds),
  });
}

// ۳. تعویض تسک در میانه پومودورو
export async function switchTaskMidPomodoro(
  newTitle: string,
  macroProjectId: string | null,
  subProjectId: string | null,
  tagIds: string[]
): Promise<string> {
  return await invoke<string>("switch_task_mid_pomodoro", {
    newTitle,
    macroProjectId,
    subProjectId,
    tagIdsJson: JSON.stringify(tagIds),
  });
}

// ۴. شروع استراحت کوتاه یا طولانی
export async function startBreak(): Promise<void> {
  await invoke("start_break");
}

// ۵. توقف موقت و ادامه تایمر
export async function pauseTimer(): Promise<void> {
  await invoke("pause_timer");
}

export async function resumeTimer(): Promise<void> {
  await invoke("resume_timer");
}

// ۶. دریافت داده‌ها برای داشبورد
export async function getAllProjects(): Promise<ProjectNode[]> {
  return await invoke<ProjectNode[]>("get_all_projects");
}

export async function getAllTaskLogs(): Promise<TaskLogRecord[]> {
  return await invoke<TaskLogRecord[]>("get_all_task_logs");
}

// ۷. ثبت ویرایش زمان در داشبورد همراه با اعمال قوانین ممیزی
export async function updateTaskLog(params: {
  id: string;
  title: string;
  macroId: string | null;
  subId: string | null;
  tagIds: string[];
  startTime: string;
  endTime: string | null;
  durationSeconds: number;
  editNote: string | null;
}): Promise<void> {
  await invoke("update_task_log", {
    id: params.id,
    title: params.title,
    macroId: params.macroId,
    subId: params.subId,
    tagsJson: JSON.stringify(params.tagIds),
    startTime: params.startTime,
    endTime: params.endTime,
    durationSeconds: params.durationSeconds,
    editNote: params.editNote,
  });
}

// ۸. گوش دادن به رویدادهای زنده تایمر ارسالی از Rust
export async function onTimerTick(
  callback: (payload: TimerTickPayload) => void
): Promise<UnlistenFn> {
  return await listen<TimerTickPayload>("timer-tick", (event) => {
    callback(event.payload);
  });
}

export async function onOvertimeStarted(
  callback: () => void
): Promise<UnlistenFn> {
  return await listen("pomodoro-overtime-started", () => {
    callback();
  });
}

export async function onOvertimeNudge(
  callback: () => void
): Promise<UnlistenFn> {
  return await listen("pomodoro-overtime-nudge", () => {
    callback();
  });
}