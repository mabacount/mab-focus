import * as XLSX from "xlsx";
import { ProjectNode, TaskLogRecord } from "../types/models";

export function exportTasksToExcel(
  tasks: TaskLogRecord[],
  projects: ProjectNode[]
) {
  const projectMap = new Map<string, ProjectNode>();
  projects.forEach((p) => projectMap.set(p.id, p));

  const rows = tasks.map((t, index) => {
    const macroProject = t.macro_project_id
      ? projectMap.get(t.macro_project_id)?.name || "نامشخص"
      : "بدون پروژه";

    const subProject = t.sub_project_id
      ? projectMap.get(t.sub_project_id)?.name || "—"
      : "—";

    let tagsStr = "—";
    try {
      const parsedTags = JSON.parse(t.tag_ids_json);
      if (Array.isArray(parsedTags) && parsedTags.length > 0) {
        tagsStr = parsedTags.join("، ");
      }
    } catch {
      tagsStr = t.tag_ids_json;
    }

    const durationMinutes = (t.duration_seconds / 60).toFixed(1);
    const overtimeMinutes = (t.overtime_seconds / 60).toFixed(1);
    const origDurationMinutes = t.original_duration_seconds != null
      ? (t.original_duration_seconds / 60).toFixed(1)
      : "—";

    const dateOnly = t.start_time.length >= 10 ? t.start_time.substring(0, 10) : t.start_time;
    const startTimeOnly = t.start_time.length >= 19 ? t.start_time.substring(11, 19) : t.start_time;
    const endTimeOnly = t.end_time
      ? t.end_time.length >= 19
        ? t.end_time.substring(11, 19)
        : t.end_time
      : "در حال اجرا";

    return {
      "ردیف": index + 1,
      "تاریخ": dateOnly,
      "عنوان تسک": t.title,
      "پروژه کلان": macroProject,
      "پروژه زیرمجموعه": subProject,
      "فاز کاری / تگ‌ها": tagsStr,
      "ساعت شروع": startTimeOnly,
      "ساعت پایان": endTimeOnly,
      "مدت نهایی (دقیقه)": durationMinutes,
      "اضافه‌کاری منفی (دقیقه)": overtimeMinutes,
      "وضعیت ممیزی زمان": t.is_edited ? "ویرایش‌شده [Edited]" : "ثبت اصلی (Original)",
      "مدت اولیه قبل از ویرایش (دقیقه)": origDurationMinutes,
      "توضیحات ویرایش": t.edit_note || "—",
    };
  });

  const worksheet = XLSX.utils.json_to_sheet(rows);

  // تنظیم عرض ستون‌ها برای خوانایی مطلوب
  worksheet["!cols"] = [
    { wch: 6 },  // ردیف
    { wch: 12 }, // تاریخ
    { wch: 32 }, // عنوان تسک
    { wch: 18 }, // پروژه کلان
    { wch: 18 }, // پروژه زیرمجموعه
    { wch: 20 }, // تگ‌ها
    { wch: 12 }, // ساعت شروع
    { wch: 12 }, // ساعت پایان
    { wch: 18 }, // مدت نهایی
    { wch: 22 }, // اضافه‌کاری منفی
    { wch: 24 }, // وضعیت ممیزی
    { wch: 28 }, // مدت اولیه
    { wch: 35 }, // توضیحات ویرایش
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "گزارش کارکرد Mab-Focus");

  const todayStr = new Date().toISOString().substring(0, 10);
  XLSX.writeFile(workbook, `MabFocus_Timesheet_${todayStr}.xlsx`);
}