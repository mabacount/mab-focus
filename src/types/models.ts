// ساختار پروژه‌های درختی و قوانین محاسبه استراحت
export interface ProjectNode {
  id: string;
  name: string;
  parent_id: string | null;
  count_short_breaks_as_work: boolean;
  count_long_breaks_as_work: boolean;
  color: string;
  archived: boolean;
}

// ساختار تگ‌های فاز اجرایی
export interface PhaseTag {
  id: string;
  name: string;
  category: "phase" | "status";
  archived: boolean;
}

// رکورد تایم‌شیت تسک‌ها به همراه تاریخچه ممیزی ویرایش
export interface TaskLogRecord {
  id: string;
  title: string;
  is_untitled_draft: boolean;
  macro_project_id: string | null;
  sub_project_id: string | null;
  tag_ids_json: string;
  start_time: string;
  end_time: string | null;
  duration_seconds: number;
  overtime_seconds: number;
  pomodoro_set_index: number;
  // فیلدهای ممیزی ویرایش
  is_edited: boolean;
  original_start_time: string | null;
  original_end_time: string | null;
  original_duration_seconds: number | null;
  edited_at: string | null;
  edit_note: string | null;
  // وضعیت همگام‌سازی
  sync_status: "pending" | "synced" | "failed" | "disabled";
  calendar_event_id: string | null;
}

// وضعیت زنده پومودورو
export interface PomodoroState {
  mode: "focus" | "short_break" | "long_break";
  status: "idle" | "running" | "paused" | "overtime";
  elapsed_seconds: number;
  target_seconds: number;
  completed_sets_in_cycle: number;
}

// وضعیت برشی تسک فعال
export interface ActiveTaskSlice {
  log_id: string;
  started_at: string;
  elapsed_task_seconds: number;
  overtime_seconds: number;
}

// بسته‌داده تیک تایمر هر ثانیه
export interface TimerTickPayload {
  pomodoro: PomodoroState;
  task: ActiveTaskSlice | null;
}