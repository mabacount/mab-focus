import React, { useState } from "react";
import { TaskLogRecord, ProjectNode } from "../types/models";
import { updateTaskLog } from "../services/ipc";
import { ProjectSelector } from "../components/ProjectSelector";
import { Edit3, AlertTriangle, X, Check } from "lucide-react";

interface ActivityLogTableProps {
  tasks: TaskLogRecord[];
  projects: ProjectNode[];
  onRefresh: () => void;
}

export const ActivityLogTable: React.FC<ActivityLogTableProps> = ({
  tasks,
  projects,
  onRefresh,
}) => {
  const [editingTask, setEditingTask] = useState<TaskLogRecord | null>(null);

  const [editTitle, setEditTitle] = useState("");
  const [editMacroId, setEditMacroId] = useState<string | null>(null);
  const [editSubId, setEditSubId] = useState<string | null>(null);
  const [editStartTime, setEditStartTime] = useState("");
  const [editEndTime, setEditEndTime] = useState("");
  const [editDurationMinutes, setEditDurationMinutes] = useState<number>(0);
  const [editNote, setEditNote] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const projectMap = new Map<string, ProjectNode>();
  projects.forEach((p) => projectMap.set(p.id, p));

  const openEditModal = (task: TaskLogRecord) => {
    setEditingTask(task);
    setEditTitle(task.title);
    setEditMacroId(task.macro_project_id);
    setEditSubId(task.sub_project_id);
    setEditStartTime(task.start_time);
    setEditEndTime(task.end_time || "");
    setEditDurationMinutes(Math.round(task.duration_seconds / 60));
    setEditNote(task.edit_note || "");
  };

  const closeEditModal = () => setEditingTask(null);

  const hasTimeChanged = editingTask
    ? editStartTime !== editingTask.start_time ||
      editEndTime !== (editingTask.end_time || "") ||
      editDurationMinutes !== Math.round(editingTask.duration_seconds / 60)
    : false;

  const handleSaveModal = async () => {
    if (!editingTask) return;
    setIsSaving(true);
    try {
      let parsedTags: string[] = [];
      try {
        parsedTags = JSON.parse(editingTask.tag_ids_json);
      } catch {
        parsedTags = [];
      }

      await updateTaskLog({
        id: editingTask.id,
        title: editTitle.trim() || "تسک بدون عنوان",
        macroId: editMacroId,
        subId: editSubId,
        tagIds: parsedTags,
        startTime: editStartTime,
        endTime: editEndTime || null,
        durationSeconds: Math.round(editDurationMinutes * 60),
        editNote: editNote.trim() || null,
      });

      closeEditModal();
      onRefresh();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-[#1C1C20] border border-white/10 rounded-2xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-right text-xs text-white/80">
          <thead className="bg-[#141416]/50 border-b border-white/10 text-[11px] text-white/40">
            <tr>
              <th className="py-3 px-4">عنوان تسک</th>
              <th className="py-3 px-4">پروژه و فاز</th>
              <th className="py-3 px-4">بازه زمانی</th>
              <th className="py-3 px-4">مدت نهایی</th>
              <th className="py-3 px-4">وضعیت ممیزی</th>
              <th className="py-3 px-4 text-center">عملیات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {tasks.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-white/40">
                  هنوز هیچ رکوردی در سیستم ثبت نشده است.
                </td>
              </tr>
            ) : (
              tasks.map((task) => {
                const macroNode = task.macro_project_id ? projectMap.get(task.macro_project_id) : null;
                const subNode = task.sub_project_id ? projectMap.get(task.sub_project_id) : null;

                const durationMins = (task.duration_seconds / 60).toFixed(1);

                return (
                  <tr key={task.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-3.5 px-4 font-medium text-white max-w-xs truncate">
                      {task.is_untitled_draft ? (
                        <span className="text-amber-400/90 italic">[نیازمند تکمیل] {task.title}</span>
                      ) : (
                        task.title
                      )}
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-1.5 text-white/70">
                        {macroNode && (
                          <span
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ backgroundColor: macroNode.color }}
                          />
                        )}
                        <span>{macroNode?.name || "بدون پروژه"}</span>
                        {subNode && (
                          <>
                            <span className="text-white/30">›</span>
                            <span className="text-white/50">{subNode.name}</span>
                          </>
                        )}
                      </div>
                    </td>

                    <td className="py-3.5 px-4 font-mono text-[11px] text-white/60">
                      {task.start_time.substring(11, 16)} —{" "}
                      {task.end_time ? task.end_time.substring(11, 16) : "در حال اجرا"}
                    </td>

                    <td className="py-3.5 px-4 font-mono text-white">
                      {durationMins} دقیقه
                      {task.overtime_seconds > 0 && (
                        <span className="text-[10px] text-amber-400 block">
                          (+{(task.overtime_seconds / 60).toFixed(0)} دقیقه اضافه‌کاری)
                        </span>
                      )}
                    </td>

                    <td className="py-3.5 px-4">
                      {task.is_edited ? (
                        <span className="bg-purple-500/20 text-purple-300 border border-purple-500/30 text-[10px] px-2 py-0.5 rounded-md font-medium">
                          [Edited / ویرایش‌شده]
                        </span>
                      ) : (
                        <span className="text-white/30 text-[11px]">اصلی (تایمر)</span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-center">
                      <button
                        onClick={() => openEditModal(task)}
                        className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-colors"
                        title="ویرایش مشخصات یا زمان"
                      >
                        <Edit3 size={13} />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {editingTask && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div
            dir="rtl"
            className="bg-[#1C1C20] border border-white/10 rounded-2xl w-full max-w-lg p-6 space-y-4 shadow-2xl text-white text-xs select-none"
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <span className="text-sm font-semibold">ویرایش سابقه کارکرد</span>
              <button onClick={closeEditModal} className="text-white/40 hover:text-white transition-colors">
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[11px] text-white/60 mb-1">عنوان تسک</label>
                <input
                  type="text"
                  dir="auto"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full bg-[#141416] border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-[11px] text-white/60 mb-1">پروژه و زیرپروژه</label>
                <ProjectSelector
                  projects={projects}
                  selectedMacroId={editMacroId}
                  selectedSubId={editSubId}
                  onSelect={(mId, sId) => {
                    setEditMacroId(mId);
                    setEditSubId(sId);
                  }}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-white/60 mb-1">زمان شروع (ISO)</label>
                  <input
                    type="text"
                    value={editStartTime}
                    onChange={(e) => setEditStartTime(e.target.value)}
                    className="w-full bg-[#141416] border border-white/10 rounded-xl px-3 py-2 font-mono text-[11px] text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] text-white/60 mb-1">زمان پایان (ISO)</label>
                  <input
                    type="text"
                    value={editEndTime}
                    onChange={(e) => setEditEndTime(e.target.value)}
                    className="w-full bg-[#141416] border border-white/10 rounded-xl px-3 py-2 font-mono text-[11px] text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] text-white/60 mb-1">مدت نهایی کارکرد (دقیقه)</label>
                <input
                  type="number"
                  value={editDurationMinutes}
                  onChange={(e) => setEditDurationMinutes(Number(e.target.value))}
                  className="w-full bg-[#141416] border border-white/10 rounded-xl px-3 py-2 font-mono text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-[11px] text-white/60 mb-1">علت ویرایش زمان</label>
                <input
                  type="text"
                  dir="auto"
                  placeholder="مثال: فراموشی توقف تایمر هنگام ترک میز..."
                  value={editNote}
                  onChange={(e) => setEditNote(e.target.value)}
                  className="w-full bg-[#141416] border border-white/10 rounded-xl px-3 py-2 text-white placeholder-white/30 focus:outline-none focus:border-blue-500"
                />
              </div>

              {hasTimeChanged && (
                <div className="bg-purple-500/15 border border-purple-500/30 rounded-xl p-3 flex items-start gap-2.5 text-purple-200">
                  <AlertTriangle size={16} className="text-purple-400 shrink-0 mt-0.5" />
                  <div className="text-[11px] leading-relaxed">
                    <span className="font-semibold">توجه:</span> با تغییر مقادیر زمانی، برچسب دائمی <span className="font-mono">[Edited]</span> روی این رکورد درج خواهد شد.
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/10">
              <button
                type="button"
                onClick={closeEditModal}
                className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 transition-colors"
              >
                انصراف
              </button>
              <button
                type="button"
                disabled={isSaving}
                onClick={handleSaveModal}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium flex items-center gap-1.5 transition-colors disabled:opacity-50"
              >
                <Check size={14} />
                <span>ذخیره تغییرات</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};