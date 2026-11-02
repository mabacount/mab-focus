use crate::db::{get_connection, TaskLogRecord};
use dirs::document_dir;
use rusqlite::Connection;
use std::fs::{File, OpenOptions};
use std::io::Write;
use std::path::PathBuf;

pub fn get_txt_path(conn: &Connection) -> PathBuf {
    let mut stmt = conn.prepare("SELECT value FROM app_settings WHERE key = 'txt_log_path'").ok();
    if let Some(mut s) = stmt {
        if let Ok(path_str) = s.query_row([], |row| row.get::<_, String>(0)) {
            return PathBuf::from(path_str);
        }
    }

    let mut doc_path = document_dir().unwrap_or_else(|| PathBuf::from("."));
    doc_path.push("MabFocus_WorkLog.txt");
    doc_path
}

fn format_duration(seconds: i64) -> String {
    let mins = seconds / 60;
    let secs = seconds % 60;
    format!("{}m {:02}s", mins, secs)
}

pub fn sync_txt_file() {
    let conn = match get_connection() {
        Ok(c) => c,
        Err(_) => return,
    };

    let file_path = get_txt_path(&conn);
    let mut stmt = match conn.prepare("SELECT * FROM task_logs ORDER BY start_time ASC") {
        Ok(s) => s,
        Err(_) => return,
    };

    let logs = stmt.query_map([], |row| {
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
    });

    let mut lines = Vec::new();
    if let Ok(entries) = logs {
        for entry in entries.flatten() {
            let start = if entry.start_time.len() >= 19 { &entry.start_time[0..19] } else { &entry.start_time };
            let end = entry.end_time.as_deref().unwrap_or("در حال اجرا");
            let end_clean = if end.len() >= 19 { &end[0..19] } else { end };
            let dur_str = format_duration(entry.duration_seconds);

            if entry.is_untitled_draft {
                lines.push(format!(
                    "[{} - {} | {}] [نیازمند تکمیل اطلاعات] {}",
                    start, end_clean, dur_str, entry.title
                ));
            } else if entry.is_edited {
                let orig_dur = format_duration(entry.original_duration_seconds.unwrap_or(0));
                let note = entry.edit_note.unwrap_or_else(|| "بدون توضیح".to_string());
                lines.push(format!(
                    "[{} - {} | {}] [EDITED / ویرایش‌شده - زمان اولیه: {}] {} ({})",
                    start, end_clean, dur_str, orig_dur, entry.title, note
                ));
            } else {
                lines.push(format!(
                    "[{} - {} | {}] {}",
                    start, end_clean, dur_str, entry.title
                ));
            }
        }
    }

    if let Ok(mut file) = File::create(file_path) {
        for line in lines {
            writeln!(file, "{}", line).ok();
        }
    }
}