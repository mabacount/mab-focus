import { invoke } from "@tauri-apps/api/core";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import { ProjectNode, TaskLogRecord, TimerTickPayload } from "../types/models";

export async function getTimerState(): Promise<TimerTickPayload> {
  return await invoke<TimerTickPayload>("get_timer_state");
}

export async function startInstantWork(): Promise<string> {
  return await invoke<string>("start_instant_work");
}

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

export async function startBreak(): Promise<void> {
  await invoke("start_break");
}

export async function pauseTimer(): Promise<void> {
  await invoke("pause_timer");
}

export async function resumeTimer(): Promise<void> {
  await invoke("resume_timer");
}

export async function stopAndResetTimer(): Promise<void> {
  await invoke("stop_and_reset_timer");
}

export async function openDashboardWindow(): Promise<void> {
  await invoke("open_dashboard_window");
}

export async function getAllProjects(): Promise<ProjectNode[]> {
  return await invoke<ProjectNode[]>("get_all_projects");
}

export async function updateProjectPolicy(
  id: string,
  countShortBreaksAsWork: boolean,
  countLongBreaksAsWork: boolean
): Promise<void> {
  await invoke("update_project_policy", {
    id,
    countShortBreaksAsWork,
    countLongBreaksAsWork,
  });
}

export async function getAllTaskLogs(): Promise<TaskLogRecord[]> {
  return await invoke<TaskLogRecord[]>("get_all_task_logs");
}

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

export async function deleteTaskLog(id: string): Promise<void> {
  await invoke("delete_task_log", { id });
}

export async function getAllSettings(): Promise<Record<string, string>> {
  return await invoke<Record<string, string>>("get_all_settings");
}

export async function saveAppSetting(key: string, value: string): Promise<void> {
  await invoke("save_app_setting", { key, value });
}

export async function onTimerTick(
  callback: (payload: TimerTickPayload) => void
): Promise<UnlistenFn> {
  return await listen<TimerTickPayload>("timer-tick", (event) => {
    callback(event.payload);
  });
}

export async function onTasksChanged(
  callback: () => void
): Promise<UnlistenFn> {
  return await listen("tasks-changed", () => {
    callback();
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