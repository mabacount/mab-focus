use rusqlite::{params, Connection, Result};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ProjectRecord {
    pub id: String,
    pub name: String,
    pub parent_id: Option<String>,
    pub count_short_breaks_as_work: bool,
    pub count_long_breaks_as_work: bool,
    pub color: String,
    pub archived: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PhaseTagRecord {
    pub id: String,
    pub name: String,
    pub category: String,
    pub archived: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TaskLogRecord {
    pub id: String,
    pub title: String,
    pub is_untitled_draft: bool,
    pub macro_project_id: Option<String>,
    pub sub_project_id: Option<String>,
    pub tag_ids_json: String,
    pub start_time: String,
    pub end_time: Option<String>,
    pub duration_seconds: i64,
    pub overtime_seconds: i64,
    pub pomodoro_set_index: i32,
    pub is_edited: bool,
    pub original_start_time: Option<String>,
    pub original_end_time: Option<String>,
    pub original_duration_seconds: Option<i64>,
    pub edited_at: Option<String>,
    pub edit_note: Option<String>,
    pub sync_status: String,
    pub calendar_event_id: Option<String>,
}

pub fn get_db_path() -> PathBuf {
    let mut path = dirs::data_dir().unwrap_or_else(|| PathBuf::from("."));
    path.push("MabFocus");
    fs::create_dir_all(&path).ok();
    path.push("mabfocus.db");
    path
}

pub fn get_connection() -> Result<Connection> {
    let path = get_db_path();
    Connection::open(path)
}

pub fn init_db() -> Result<()> {
    let conn = get_connection()?;

    conn.execute_batch(
        "
        CREATE TABLE IF NOT EXISTS projects (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            parent_id TEXT NULL,
            count_short_breaks_as_work INTEGER NOT NULL DEFAULT 0,
            count_long_breaks_as_work INTEGER NOT NULL DEFAULT 0,
            color TEXT NOT NULL DEFAULT '#3B82F6',
            archived INTEGER NOT NULL DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS phase_tags (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            category TEXT NOT NULL DEFAULT 'phase',
            archived INTEGER NOT NULL DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS task_logs (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL DEFAULT 'تسک بدون عنوان',
            is_untitled_draft INTEGER NOT NULL DEFAULT 1,
            macro_project_id TEXT NULL,
            sub_project_id TEXT NULL,
            tag_ids_json TEXT NOT NULL DEFAULT '[]',
            start_time TEXT NOT NULL,
            end_time TEXT NULL,
            duration_seconds INTEGER NOT NULL DEFAULT 0,
            overtime_seconds INTEGER NOT NULL DEFAULT 0,
            pomodoro_set_index INTEGER NOT NULL DEFAULT 1,
            is_edited INTEGER NOT NULL DEFAULT 0,
            original_start_time TEXT NULL,
            original_end_time TEXT NULL,
            original_duration_seconds INTEGER NULL,
            edited_at TEXT NULL,
            edit_note TEXT NULL,
            sync_status TEXT NOT NULL DEFAULT 'pending',
            calendar_event_id TEXT NULL
        );

        CREATE TABLE IF NOT EXISTS app_settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );
        "
    )?;

    Ok(())
}

pub fn update_task_log_logic(
    conn: &Connection,
    id: &str,
    new_title: &str,
    new_macro_id: Option<String>,
    new_sub_id: Option<String>,
    new_tags_json: &str,
    new_start_time: &str,
    new_end_time: Option<String>,
    new_duration_seconds: i64,
    edit_note: Option<String>,
) -> Result<()> {
    let mut stmt = conn.prepare("SELECT * FROM task_logs WHERE id = ?1")?;
    let old_record = stmt.query_row(params![id], |row| {
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
    })?;

    let time_has_changed = old_record.start_time != new_start_time
        || old_record.end_time != new_end_time
        || old_record.duration_seconds != new_duration_seconds;

    let mut is_edited = old_record.is_edited;
    let mut orig_start = old_record.original_start_time;
    let mut orig_end = old_record.original_end_time;
    let mut orig_dur = old_record.original_duration_seconds;
    let mut edited_at = old_record.edited_at;

    if time_has_changed {
        is_edited = true;
        if !old_record.is_edited {
            orig_start = Some(old_record.start_time);
            orig_end = old_record.end_time;
            orig_dur = Some(old_record.duration_seconds);
        }
        edited_at = Some(chrono::Utc::now().to_rfc3339());
    }

    let is_still_untitled = if !new_title.trim().is_empty() && new_title != "تسک بدون عنوان" {
        0
    } else {
        if old_record.is_untitled_draft { 1 } else { 0 }
    };

    conn.execute(
        "UPDATE task_logs SET 
            title = ?1,
            is_untitled_draft = ?2,
            macro_project_id = ?3,
            sub_project_id = ?4,
            tag_ids_json = ?5,
            start_time = ?6,
            end_time = ?7,
            duration_seconds = ?8,
            is_edited = ?9,
            original_start_time = ?10,
            original_end_time = ?11,
            original_duration_seconds = ?12,
            edited_at = ?13,
            edit_note = ?14
         WHERE id = ?15",
        params![
            new_title,
            is_still_untitled,
            new_macro_id,
            new_sub_id,
            new_tags_json,
            new_start_time,
            new_end_time,
            new_duration_seconds,
            if is_edited { 1 } else { 0 },
            orig_start,
            orig_end,
            orig_dur,
            edited_at,
            edit_note,
            id
        ],
    )?;

    Ok(())
}