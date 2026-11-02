use crate::db::{get_connection, get_setting_i64};
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
    pub mode: String,              // "focus" | "short_break" | "long_break"
    pub status: String,            // "idle" | "running" | "paused" | "overtime"
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
        let focus_secs = get_setting_i64("focus_minutes", 25) * 60;
        Self {
            pomodoro: Arc::new(Mutex::new(PomodoroState {
                mode: "focus".to_string(),
                status: "idle".to_string(),
                elapsed_seconds: 0,
                target_seconds: focus_secs,
                completed_sets_in_cycle: 0,
            })),
            active_task: Arc::new(Mutex::new(None)),
        }
    }
}

/// ارسال فوری وضعیت فعلی به تمام پنجره‌ها بدون نگه‌داشتن قفل حافظه
pub fn broadcast_state_now(app: &AppHandle, state: &AppTimerState) {
    let payload = {
        let pomo = state.pomodoro.lock().unwrap_or_else(|e| e.into_inner());
        let task = state.active_task.lock().unwrap_or_else(|e| e.into_inner());
        serde_json::json!({
            "pomodoro": *pomo,
            "task": *task
        })
    };
    let _ = app.emit("timer-tick", payload);
}

pub fn spawn_timer_engine(app: AppHandle, state: AppTimerState) {
    thread::spawn(move || {
        let mut overtime_nudge_counter: i64 = 0;

        loop {
            thread::sleep(Duration::from_millis(1000));

            let (should_emit, sync_payload, start_overtime, nudge_overtime) = {
                let mut pomodoro = state.pomodoro.lock().unwrap_or_else(|e| e.into_inner());
                let mut active_task = state.active_task.lock().unwrap_or_else(|e| e.into_inner());

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

            if should_emit {
                let _ = app.emit("timer-tick", sync_payload);
            }
            if start_overtime {
                let _ = app.emit("pomodoro-overtime-started", ());
            }
            if nudge_overtime {
                let _ = app.emit("pomodoro-overtime-nudge", ());
            }
        }
    });
}

#[tauri::command]
pub fn get_timer_state(state: tauri::State<AppTimerState>) -> Result<serde_json::Value, String> {
    let pomo = state.pomodoro.lock().unwrap_or_else(|e| e.into_inner());
    let task = state.active_task.lock().unwrap_or_else(|e| e.into_inner());
    Ok(serde_json::json!({
        "pomodoro": *pomo,
        "task": *task
    }))
}

#[tauri::command]
pub fn start_instant_work(
    app: AppHandle,
    state: tauri::State<AppTimerState>,
) -> Result<String, String> {
    let new_log_id = Uuid::new_v4().to_string();
    let now_iso = Utc::now().to_rfc3339();
    let focus_secs = get_setting_i64("focus_minutes", 25) * 60;

    if let Ok(conn) = get_connection() {
        let _ = conn.execute(
            "INSERT INTO task_logs (id, title, is_untitled_draft, start_time, duration_seconds) 
             VALUES (?1, 'تسک بدون عنوان', 1, ?2, 0)",
            params![new_log_id, now_iso],
        );
    }

    {
        let mut pomodoro = state.pomodoro.lock().unwrap_or_else(|e| e.into_inner());
        let mut active_task = state.active_task.lock().unwrap_or_else(|e| e.into_inner());

        pomodoro.mode = "focus".to_string();
        pomodoro.status = "running".to_string();
        pomodoro.elapsed_seconds = 0;
        pomodoro.target_seconds = focus_secs;

        *active_task = Some(ActiveTaskSlice {
            log_id: new_log_id.clone(),
            started_at: now_iso,
            elapsed_task_seconds: 0,
            overtime_seconds: 0,
        });
    }

    sync_txt_file();
    broadcast_state_now(&app, &state);
    let _ = app.emit("tasks-changed", ());
    Ok(new_log_id)
}

#[tauri::command]
pub fn update_active_task_metadata(
    app: AppHandle,
    log_id: String,
    title: String,
    macro_project_id: Option<String>,
    sub_project_id: Option<String>,
    tag_ids_json: String,
) -> Result<(), String> {
    let conn = get_connection().map_err(|e| e.to_string())?;
    let clean_title = if title.trim().is_empty() {
        "تسک بدون عنوان"
    } else {
        title.trim()
    };
    let is_draft = if clean_title == "تسک بدون عنوان" { 1 } else { 0 };

    conn.execute(
        "UPDATE task_logs SET 
            title = ?1,
            macro_project_id = ?2,
            sub_project_id = ?3,
            tag_ids_json = ?4,
            is_untitled_draft = ?5
         WHERE id = ?6",
        params![clean_title, macro_project_id, sub_project_id, tag_ids_json, is_draft, log_id],
    )
    .map_err(|e| e.to_string())?;

    sync_txt_file();
    let _ = app.emit("tasks-changed", ());
    Ok(())
}

#[tauri::command]
pub fn switch_task_mid_pomodoro(
    app: AppHandle,
    state: tauri::State<AppTimerState>,
    new_title: String,
    macro_project_id: Option<String>,
    sub_project_id: Option<String>,
    tag_ids_json: String,
) -> Result<String, String> {
    let now_iso = Utc::now().to_rfc3339();
    let next_log_id = Uuid::new_v4().to_string();
    let clean_title = if new_title.trim().is_empty() {
        "تسک بدون عنوان"
    } else {
        new_title.trim()
    };

    {
        let mut active_task = state.active_task.lock().unwrap_or_else(|e| e.into_inner());
        if let Ok(conn) = get_connection() {
            if let Some(current) = active_task.as_ref() {
                let _ = conn.execute(
                    "UPDATE task_logs SET end_time = ?1, duration_seconds = ?2, overtime_seconds = ?3 WHERE id = ?4",
                    params![now_iso, current.elapsed_task_seconds, current.overtime_seconds, current.log_id],
                );
            }

            let is_draft = if clean_title == "تسک بدون عنوان" { 1 } else { 0 };
            let _ = conn.execute(
                "INSERT INTO task_logs (id, title, is_untitled_draft, macro_project_id, sub_project_id, tag_ids_json, start_time, duration_seconds)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 0)",
                params![next_log_id, clean_title, is_draft, macro_project_id, sub_project_id, tag_ids_json, now_iso],
            );
        }

        *active_task = Some(ActiveTaskSlice {
            log_id: next_log_id.clone(),
            started_at: now_iso,
            elapsed_task_seconds: 0,
            overtime_seconds: 0,
        });
    }

    sync_txt_file();
    broadcast_state_now(&app, &state);
    let _ = app.emit("tasks-changed", ());
    Ok(next_log_id)
}

#[tauri::command]
pub fn start_break(
    app: AppHandle,
    state: tauri::State<AppTimerState>,
) -> Result<(), String> {
    let now_iso = Utc::now().to_rfc3339();
    let short_break_secs = get_setting_i64("short_break_minutes", 5) * 60;
    let long_break_secs = get_setting_i64("long_break_minutes", 60) * 60;

    {
        let mut pomodoro = state.pomodoro.lock().unwrap_or_else(|e| e.into_inner());
        let mut active_task = state.active_task.lock().unwrap_or_else(|e| e.into_inner());

        let next_sets = pomodoro.completed_sets_in_cycle + 1;
        let is_long_break = next_sets >= 4;

        if let Ok(conn) = get_connection() {
            if let Some(task) = active_task.as_ref() {
                let mut count_as_work = false;
                if let Ok(mut stmt) = conn.prepare("SELECT macro_project_id FROM task_logs WHERE id = ?1") {
                    let macro_id: Option<String> = stmt.query_row(params![task.log_id], |row| row.get(0)).unwrap_or(None);
                    if let Some(m_id) = macro_id {
                        let col = if is_long_break {
                            "count_long_breaks_as_work"
                        } else {
                            "count_short_breaks_as_work"
                        };
                        let query = format!("SELECT {} FROM projects WHERE id = ?1", col);
                        if let Ok(mut p_stmt) = conn.prepare(&query) {
                            count_as_work = p_stmt.query_row(params![m_id], |row| row.get::<_, i32>(0)).unwrap_or(0) == 1;
                        }
                    }
                }

                if !count_as_work {
                    let _ = conn.execute(
                        "UPDATE task_logs SET end_time = ?1, duration_seconds = ?2, overtime_seconds = ?3 WHERE id = ?4",
                        params![now_iso, task.elapsed_task_seconds, task.overtime_seconds, task.log_id],
                    );
                    *active_task = None;
                }
            }
        }

        if is_long_break {
            pomodoro.mode = "long_break".to_string();
            pomodoro.target_seconds = long_break_secs;
            pomodoro.completed_sets_in_cycle = 0;
        } else {
            pomodoro.mode = "short_break".to_string();
            pomodoro.target_seconds = short_break_secs;
            pomodoro.completed_sets_in_cycle = next_sets;
        }

        pomodoro.status = "running".to_string();
        pomodoro.elapsed_seconds = 0;
    }

    sync_txt_file();
    broadcast_state_now(&app, &state);
    let _ = app.emit("tasks-changed", ());
    Ok(())
}

#[tauri::command]
pub fn pause_timer(app: AppHandle, state: tauri::State<AppTimerState>) -> Result<(), String> {
    {
        let mut pomodoro = state.pomodoro.lock().unwrap_or_else(|e| e.into_inner());
        if pomodoro.status == "running" || pomodoro.status == "overtime" {
            pomodoro.status = "paused".to_string();
        }
    }
    broadcast_state_now(&app, &state);
    Ok(())
}

#[tauri::command]
pub fn resume_timer(app: AppHandle, state: tauri::State<AppTimerState>) -> Result<(), String> {
    {
        let mut pomodoro = state.pomodoro.lock().unwrap_or_else(|e| e.into_inner());
        if pomodoro.status == "paused" {
            if pomodoro.elapsed_seconds >= pomodoro.target_seconds {
                pomodoro.status = "overtime".to_string();
            } else {
                pomodoro.status = "running".to_string();
            }
        }
    }
    broadcast_state_now(&app, &state);
    Ok(())
}

#[tauri::command]
pub fn stop_and_reset_timer(app: AppHandle, state: tauri::State<AppTimerState>) -> Result<(), String> {
    let now_iso = Utc::now().to_rfc3339();
    let focus_secs = get_setting_i64("focus_minutes", 25) * 60;

    {
        let mut pomodoro = state.pomodoro.lock().unwrap_or_else(|e| e.into_inner());
        let mut active_task = state.active_task.lock().unwrap_or_else(|e| e.into_inner());

        if let Some(task) = active_task.as_ref() {
            if let Ok(conn) = get_connection() {
                let _ = conn.execute(
                    "UPDATE task_logs SET end_time = ?1, duration_seconds = ?2, overtime_seconds = ?3 WHERE id = ?4",
                    params![now_iso, task.elapsed_task_seconds, task.overtime_seconds, task.log_id],
                );
            }
        }

        *active_task = None;
        pomodoro.mode = "focus".to_string();
        pomodoro.status = "idle".to_string();
        pomodoro.elapsed_seconds = 0;
        pomodoro.target_seconds = focus_secs;
    }

    sync_txt_file();
    broadcast_state_now(&app, &state);
    let _ = app.emit("tasks-changed", ());
    Ok(())
}