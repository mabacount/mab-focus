use crate::db::{get_connection, TaskLogRecord};
use crate::txt_logger::sync_txt_file;
use chrono::Utc;
use rusqlite::params;
use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;
use tauri::{AppHandle, Emitter};
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PomodoroState {
    pub mode: String,
    pub status: String,
    pub elapsed_seconds: i64,
    pub target_seconds: i64,
    pub completed_sets_in_cycle: i32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ActiveTaskSlice {
    pub log_id: String,
    pub started_at: String,
    pub elapsed_task_seconds: i64,
    pub overtime_seconds: i64,
}

#[derive(Clone)]
pub struct AppTimerState {
    pub pomodoro: Arc<Mutex<PomodoroState>>,
    pub active_task: Arc<Mutex<Option<ActiveTaskSlice>>>,
}

impl AppTimerState {
    pub fn new() -> Self {
        Self {
            pomodoro: Arc::new(Mutex::new(PomodoroState {
                mode: "focus".to_string(),
                status: "idle".to_string(),
                elapsed_seconds: 0,
                target_seconds: 1500,
                completed_sets_in_cycle: 0,
            })),
            active_task: Arc::new(Mutex::new(None)),
        }
    }
}

pub fn spawn_timer_engine(app: AppHandle, state: AppTimerState) {
    thread::spawn(move || {
        let mut overtime_nudge_counter: i64 = 0;

        loop {
            thread::sleep(Duration::from_millis(1000));

            // پردازش وضعیت و آزادسازی فوری قفل‌ها جهت جلوگیری از کرش و بن‌بست
            let (should_emit, sync_payload, start_overtime, nudge_overtime) = {
                let mut pomodoro = state.pomodoro.lock().unwrap();
                let mut active_task = state.active_task.lock().unwrap();

                let mut emit_tick = false;
                let mut is_start_ot = false;
                let mut is_nudge_ot = false;

                if pomodoro.status == "running" || pomodoro.status == "overtime" {
                    pomodoro.elapsed_seconds += 1;
                    emit_tick = true;

                    if let Some(task) = active_task.as_mut() {
                        task.elapsed_task_seconds += 1;
                        if pomodoro.status == "overtime" {
                            task.overtime_seconds += 1;
                        }
                    }

                    if pomodoro.status == "running" && pomodoro.elapsed_seconds >= pomodoro.target_seconds {
                        pomodoro.status = "overtime".to_string();
                        overtime_nudge_counter = 0;
                        is_start_ot = true;
                    } else if pomodoro.status == "overtime" {
                        overtime_nudge_counter += 1;
                        if overtime_nudge_counter >= 300 {
                            overtime_nudge_counter = 0;
                            is_nudge_ot = true;
                        }
                    }
                }

                let payload = serde_json::json!({
                    "pomodoro": *pomodoro,
                    "task": *active_task
                });

                (emit_tick, payload, is_start_ot, is_nudge_ot)
            };

            // ارسال رویدادها خارج از محدوده قفل
            if should_emit {
                app.emit("timer-tick", sync_payload).ok();
            }
            if start_overtime {
                app.emit("pomodoro-overtime-started", ()).ok();
            }
            if nudge_overtime {
                app.emit("pomodoro-overtime-nudge", ()).ok();
            }
        }
    });
}

#[tauri::command]
pub fn start_instant_work(
    state: tauri::State<AppTimerState>,
) -> Result<String, String> {
    let new_log_id = Uuid::new_v4().to_string();
    let now_iso = Utc::now().to_rfc3339();

    {
        let conn = get_connection().map_err(|e| e.to_string())?;
        conn.execute(
            "INSERT INTO task_logs (id, title, is_untitled_draft, start_time, duration_seconds) 
             VALUES (?1, 'تسک بدون عنوان', 1, ?2, 0)",
            params![new_log_id, now_iso],
        ).map_err(|e| e.to_string())?;
    }

    {
        let mut pomodoro = state.pomodoro.lock().unwrap();
        let mut active_task = state.active_task.lock().unwrap();

        pomodoro.mode = "focus".to_string();
        pomodoro.status = "running".to_string();
        pomodoro.elapsed_seconds = 0;
        pomodoro.target_seconds = 1500;

        *active_task = Some(ActiveTaskSlice {
            log_id: new_log_id.clone(),
            started_at: now_iso,
            elapsed_task_seconds: 0,
            overtime_seconds: 0,
        });
    }

    sync_txt_file();
    Ok(new_log_id)
}

#[tauri::command]
pub fn update_active_task_metadata(
    log_id: String,
    title: String,
    macro_project_id: Option<String>,
    sub_project_id: Option<String>,
    tag_ids_json: String,
) -> Result<(), String> {
    let conn = get_connection().map_err(|e| e.to_string())?;
    let is_draft = if title.trim().is_empty() || title == "تسک بدون عنوان" { 1 } else { 0 };

    conn.execute(
        "UPDATE task_logs SET 
            title = ?1,
            macro_project_id = ?2,
            sub_project_id = ?3,
            tag_ids_json = ?4,
            is_untitled_draft = ?5
         WHERE id = ?6",
        params![title, macro_project_id, sub_project_id, tag_ids_json, is_draft, log_id],
    ).map_err(|e| e.to_string())?;

    sync_txt_file();
    Ok(())
}

#[tauri::command]
pub fn switch_task_mid_pomodoro(
    state: tauri::State<AppTimerState>,
    new_title: String,
    macro_project_id: Option<String>,
    sub_project_id: Option<String>,
    tag_ids_json: String,
) -> Result<String, String> {
    let now_iso = Utc::now().to_rfc3339();
    let next_log_id = Uuid::new_v4().to_string();

    {
        let mut active_task = state.active_task.lock().unwrap();
        let conn = get_connection().map_err(|e| e.to_string())?;

        if let Some(current) = active_task.as_ref() {
            conn.execute(
                "UPDATE task_logs SET end_time = ?1, duration_seconds = ?2, overtime_seconds = ?3 WHERE id = ?4",
                params![now_iso, current.elapsed_task_seconds, current.overtime_seconds, current.log_id],
            ).map_err(|e| e.to_string())?;
        }

        let is_draft = if new_title.trim().is_empty() || new_title == "تسک بدون عنوان" { 1 } else { 0 };
        conn.execute(
            "INSERT INTO task_logs (id, title, is_untitled_draft, macro_project_id, sub_project_id, tag_ids_json, start_time, duration_seconds)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 0)",
            params![next_log_id, new_title, is_draft, macro_project_id, sub_project_id, tag_ids_json, now_iso],
        ).map_err(|e| e.to_string())?;

        *active_task = Some(ActiveTaskSlice {
            log_id: next_log_id.clone(),
            started_at: now_iso,
            elapsed_task_seconds: 0,
            overtime_seconds: 0,
        });
    }

    sync_txt_file();
    Ok(next_log_id)
}

#[tauri::command]
pub fn start_break(state: tauri::State<AppTimerState>) -> Result<(), String> {
    let now_iso = Utc::now().to_rfc3339();

    {
        let mut pomodoro = state.pomodoro.lock().unwrap();
        let mut active_task = state.active_task.lock().unwrap();
        let conn = get_connection().map_err(|e| e.to_string())?;

        let mut count_as_work = false;
        if let Some(task) = active_task.as_ref() {
            let mut stmt = conn.prepare("SELECT macro_project_id FROM task_logs WHERE id = ?1").map_err(|e| e.to_string())?;
            let macro_id: Option<String> = stmt.query_row(params![task.log_id], |row| row.get(0)).unwrap_or(None);

            if let Some(m_id) = macro_id {
                let mut p_stmt = conn.prepare("SELECT count_short_breaks_as_work FROM projects WHERE id = ?1").map_err(|e| e.to_string())?;
                count_as_work = p_stmt.query_row(params![m_id], |row| row.get::<_, i32>(0)).unwrap_or(0) == 1;
            }

            if !count_as_work {
                conn.execute(
                    "UPDATE task_logs SET end_time = ?1, duration_seconds = ?2, overtime_seconds = ?3 WHERE id = ?4",
                    params![now_iso, task.elapsed_task_seconds, task.overtime_seconds, task.log_id],
                ).map_err(|e| e.to_string())?;
                *active_task = None;
            }
        }

        pomodoro.completed_sets_in_cycle += 1;
        if pomodoro.completed_sets_in_cycle >= 4 {
            pomodoro.mode = "long_break".to_string();
            pomodoro.target_seconds = 3600;
            pomodoro.completed_sets_in_cycle = 0;
        } else {
            pomodoro.mode = "short_break".to_string();
            pomodoro.target_seconds = 300;
        }

        pomodoro.status = "running".to_string();
        pomodoro.elapsed_seconds = 0;
    }

    sync_txt_file();
    Ok(())
}

#[tauri::command]
pub fn pause_timer(state: tauri::State<AppTimerState>) -> Result<(), String> {
    let mut pomodoro = state.pomodoro.lock().unwrap();
    if pomodoro.status == "running" || pomodoro.status == "overtime" {
        pomodoro.status = "paused".to_string();
    }
    Ok(())
}

#[tauri::command]
pub fn resume_timer(state: tauri::State<AppTimerState>) -> Result<(), String> {
    let mut pomodoro = state.pomodoro.lock().unwrap();
    if pomodoro.status == "paused" {
        pomodoro.status = "running".to_string();
    }
    Ok(())
}