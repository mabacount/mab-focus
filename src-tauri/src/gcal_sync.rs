use crate::db::{get_connection, TaskLogRecord};
use rusqlite::params;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct GoogleCalendarEventPayload {
    pub id: Option<String>,
    pub summary: String,
    pub description: String,
    pub start_time: String,
    pub end_time: String,
    pub is_edited: bool,
}

/// خواندن تنظیمات همگام‌سازی از پایگاه داده
pub fn get_sync_setting(key: &str) -> Option<String> {
    let conn = get_connection().ok()?;
    let mut stmt = conn
        .prepare("SELECT value FROM app_settings WHERE key = ?1")
        .ok()?;
    stmt.query_row(params![key], |row| row.get::<_, String>(0))
        .ok()
}

/// ذخیره یا به‌روزرسانی تنظیمات همگام‌سازی
pub fn set_sync_setting(key: &str, value: &str) -> Result<(), String> {
    let conn = get_connection().map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT INTO app_settings (key, value) VALUES (?1, ?2)
         ON CONFLICT(key) DO UPDATE SET value = ?2",
        params![key, value],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

/// تولید پی‌لود استاندارد رویداد تقویم مطابق قوانین ممیزی
pub fn format_calendar_event(task: &TaskLogRecord) -> GoogleCalendarEventPayload {
    let mut summary = if task.is_untitled_draft {
        "[نیازمند تکمیل اطلاعات] تسک بدون عنوان".to_string()
    } else {
        task.title.clone()
    };

    // طبق قانون تقویم گوگل: در صورت ویرایش زمان، برچسب [Edited] به ابتدای عنوان اضافه می‌شود
    if task.is_edited {
        summary = format!("[Edited] {}", summary);
    }

    let end_time = task
        .end_time
        .clone()
        .unwrap_or_else(|| chrono::Utc::now().to_rfc3339());

    let mut description_lines = Vec::new();
    description_lines.push(format!("شناسه تسک در Mab-Focus: {}", task.id));
    description_lines.push(format!("مدت زمان نهایی: {} دقیقه", task.duration_seconds / 60));

    if task.overtime_seconds > 0 {
        description_lines.push(format!(
            "اضافه‌کاری منفی: {} دقیقه",
            task.overtime_seconds / 60
        ));
    }

    if task.is_edited {
        let orig_dur = task.original_duration_seconds.unwrap_or(0) / 60;
        description_lines.push(format!(
            "وضعیت ممیزی: ویرایش‌شده دستی (مدت اولیه تایمر: {} دقیقه)",
            orig_dur
        ));
        if let Some(note) = &task.edit_note {
            description_lines.push(format!("علت اصلاح زمان: {}", note));
        }
    }

    GoogleCalendarEventPayload {
        id: task.calendar_event_id.clone(),
        summary,
        description: description_lines.join("\n"),
        start_time: task.start_time.clone(),
        end_time,
        is_edited: task.is_edited,
    }
}

/// پردازش صف رکوردهای منتظر همگام‌سازی (Pending Sync Queue)
pub fn process_offline_sync_queue() -> Result<Vec<GoogleCalendarEventPayload>, String> {
    let conn = get_connection().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT * FROM task_logs WHERE sync_status = 'pending' AND end_time IS NOT NULL")
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

    let mut payloads = Vec::new();
    for task_res in rows.flatten() {
        payloads.push(format_calendar_event(&task_res));
    }

    Ok(payloads)
}

/// ثبت وضعیت موفقیت‌آمیز همگام‌سازی یک تسک با شناسه رویداد تقویم گوگل
pub fn mark_task_synced(task_id: &str, calendar_event_id: &str) -> Result<(), String> {
    let conn = get_connection().map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE task_logs SET sync_status = 'synced', calendar_event_id = ?1 WHERE id = ?2",
        params![calendar_event_id, task_id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}