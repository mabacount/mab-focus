#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod db;
mod gcal_sync;
mod timer;
mod txt_logger;

use db::{
    get_connection, init_db, read_all_settings_map, update_task_log_logic, ProjectRecord,
    TaskLogRecord,
};
use gcal_sync::{
    get_sync_setting, process_offline_sync_queue, set_sync_setting, GoogleCalendarEventPayload,
};
use rusqlite::params;
use std::collections::HashMap;
use tauri::{AppHandle, Emitter, Manager};
use timer::{
    broadcast_state_now, get_timer_state, pause_timer, resume_timer, spawn_timer_engine,
    start_break, start_instant_work, stop_and_reset_timer, switch_task_mid_pomodoro,
    update_active_task_metadata, AppTimerState,
};
use txt_logger::sync_txt_file;
use uuid::Uuid;

#[tauri::command]
fn open_dashboard_window(app: AppHandle) -> Result<(), String> {
    if let Some(win) = app.get_webview_window("main") {
        let _ = win.unminimize();
        let _ = win.show();
        let _ = win.set_focus();
    }
    Ok(())
}

#[tauri::command]
fn create_project(
    name: String,
    parent_id: Option<String>,
    count_short_breaks_as_work: bool,
    count_long_breaks_as_work: bool,
    color: String,
) -> Result<String, String> {
    let conn = get_connection().map_err(|e| e.to_string())?;
    let new_id = Uuid::new_v4().to_string();

    conn.execute(
        "INSERT INTO projects (id, name, parent_id, count_short_breaks_as_work, count_long_breaks_as_work, color, archived)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, 0)",
        params![
            new_id,
            name.trim(),
            parent_id,
            if count_short_breaks_as_work { 1 } else { 0 },
            if count_long_breaks_as_work { 1 } else { 0 },
            color
        ],
    )
    .map_err(|e| e.to_string())?;

    Ok(new_id)
}

#[tauri::command]
fn update_project_policy(
    id: String,
    count_short_breaks_as_work: bool,
    count_long_breaks_as_work: bool,
) -> Result<(), String> {
    let conn = get_connection().map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE projects SET count_short_breaks_as_work = ?1, count_long_breaks_as_work = ?2 WHERE id = ?3",
        params![
            if count_short_breaks_as_work { 1 } else { 0 },
            if count_long_breaks_as_work { 1 } else { 0 },
            id
        ],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn get_all_projects() -> Result<Vec<ProjectRecord>, String> {
    let conn = get_connection().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT id, name, parent_id, count_short_breaks_as_work, count_long_breaks_as_work, color, archived FROM projects")
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([], |row| {
            Ok(ProjectRecord {
                id: row.get(0)?,
                name: row.get(1)?,
                parent_id: row.get(2)?,
                count_short_breaks_as_work: row.get::<_, i32>(3)? == 1,
                count_long_breaks_as_work: row.get::<_, i32>(4)? == 1,
                color: row.get(5)?,
                archived: row.get::<_, i32>(6)? == 1,
            })
        })
        .map_err(|e| e.to_string())?;

    Ok(rows.flatten().collect())
}

#[tauri::command]
fn get_all_task_logs() -> Result<Vec<TaskLogRecord>, String> {
    let conn = get_connection().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT * FROM task_logs ORDER BY start_time DESC")
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([], |row| {
            Ok(TaskLogRecord {
                id: row.get(0)?,
                title: row.get(1)?,
                is_untitled_draft: row.get::<_, i32>(2)? == 1,
                macro_project_id: row.get(3)?,
                sub_project_id: row.get(4)?,
                tag_ids_json: row.get(5)?,
                start_time: row.get(6)?,
                end_time: row.get(7)?,
                duration_seconds: row.get(8)?,
                overtime_seconds: row.get(9)?,
                pomodoro_set_index: row.get(10)?,
                is_edited: row.get::<_, i32>(11)? == 1,
                original_start_time: row.get(12)?,
                original_end_time: row.get(13)?,
                original_duration_seconds: row.get(14)?,
                edited_at: row.get(15)?,
                edit_note: row.get(16)?,
                sync_status: row.get(17)?,
                calendar_event_id: row.get(18)?,
            })
        })
        .map_err(|e| e.to_string())?;

    Ok(rows.flatten().collect())
}

#[tauri::command]
fn update_task_log(
    app: AppHandle,
    id: String,
    title: String,
    macro_id: Option<String>,
    sub_id: Option<String>,
    tags_json: String,
    start_time: String,
    end_time: Option<String>,
    duration_seconds: i64,
    edit_note: Option<String>,
) -> Result<(), String> {
    let conn = get_connection().map_err(|e| e.to_string())?;
    update_task_log_logic(
        &conn,
        &id,
        &title,
        macro_id,
        sub_id,
        &tags_json,
        &start_time,
        end_time,
        duration_seconds,
        edit_note,
    )
    .map_err(|e| e.to_string())?;

    sync_txt_file();
    let _ = app.emit("tasks-changed", ());
    Ok(())
}

#[tauri::command]
fn delete_task_log(app: AppHandle, id: String) -> Result<(), String> {
    let conn = get_connection().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM task_logs WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    sync_txt_file();
    let _ = app.emit("tasks-changed", ());
    Ok(())
}

#[tauri::command]
fn get_calendar_sync_queue() -> Result<Vec<GoogleCalendarEventPayload>, String> {
    process_offline_sync_queue()
}

#[tauri::command]
fn save_app_setting(
    app: AppHandle,
    state: tauri::State<AppTimerState>,
    key: String,
    value: String,
) -> Result<(), String> {
    set_sync_setting(&key, &value)?;

    // اگر تایمر در حالت آماده به کار (idle) است، زمان هدف جدید بلافاصله اعمال شود
    if key == "focus_minutes" {
        if let Ok(mins) = value.trim().parse::<i64>() {
            if mins > 0 {
                let mut pomo = state.pomodoro.lock().unwrap_or_else(|e| e.into_inner());
                if pomo.status == "idle" && pomo.mode == "focus" {
                    pomo.target_seconds = mins * 60;
                }
            }
        }
        broadcast_state_now(&app, &state);
    }

    sync_txt_file();
    Ok(())
}

#[tauri::command]
fn read_app_setting(key: String) -> Result<Option<String>, String> {
    Ok(get_sync_setting(&key))
}

#[tauri::command]
fn get_all_settings() -> Result<HashMap<String, String>, String> {
    Ok(read_all_settings_map())
}

fn main() {
    let _ = init_db();

    let timer_state = AppTimerState::new();

    tauri::Builder::default()
        .manage(timer_state.clone())
        .setup(move |app| {
            spawn_timer_engine(app.handle().clone(), timer_state);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_timer_state,
            start_instant_work,
            update_active_task_metadata,
            switch_task_mid_pomodoro,
            start_break,
            pause_timer,
            resume_timer,
            stop_and_reset_timer,
            open_dashboard_window,
            create_project,
            update_project_policy,
            get_all_projects,
            get_all_task_logs,
            update_task_log,
            delete_task_log,
            get_calendar_sync_queue,
            save_app_setting,
            read_app_setting,
            get_all_settings
        ])
        .run(tauri::generate_context!())
        .expect("error while running Mab-Focus application");
}