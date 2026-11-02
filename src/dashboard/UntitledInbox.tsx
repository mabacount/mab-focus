import React, { useState } from "react";
import { TaskLogRecord, ProjectNode } from "../types/models";
import { updateTaskLog } from "../services/ipc";
import { Check, Folder, Tag, AlertCircle, Clock } from "lucide-react";

interface UntitledInboxProps {
  tasks: TaskLogRecord[];
  projects: ProjectNode[];
  onRefresh: () => void;
}

const DEFAULT_PHASE_TAGS = [
  "برنامه‌ریزی اولیه",
  "اجرا",
  "نظارت و پیگیری",
  "اختتامیه",
];

export const UntitledInbox: React.FC<UntitledInboxProps> = ({
  tasks,
  projects,
  onRefresh,
}) => {
  // فیلتر کردن رکوردهایی که نیازمند تکمیل اطلاعات هستند
  const draftTasks = tasks.filter((t) => t.is_untitled_draft);

  const [titles, setTitles] = useState<Record<string, string>>({});
  const [macroIds, setMacroIds] = useState<Record<string, string>>({});
  const [subIds, setSubIds] = useState<Record<string, string>>({});
  const [tagsMap, setTagsMap] = useState<Record<string, string[]>>({});
  const [submittingId, setSubmittingId] = useState<string | null>(null);

  const macroProjects = projects.filter((p) => !p.parent_id && !p.archived);

  const handleTitleChange = (id: string, value: string) => {
    setTitles((prev) => ({ ...prev, [id]: value }));
  };

  const handleMacroChange = (id: string, value: string) => {
    setMacroIds((prev) => ({ ...prev, [id]: value }));
    setSubIds((prev) => ({ ...prev, [id]: "" }));
  };

  const handleSubChange = (id: string, value: string) => {
    setSubIds((prev) => ({ ...prev, [id]: value }));
  };

  const toggleTag = (taskId: string, tagName: string) => {
    const currentTags = tagsMap[taskId] || [];
    if (currentTags.includes(tagName)) {
      setTagsMap((prev) => ({
        ...prev,
        [taskId]: currentTags.filter((t) => t !== tagName),
      }));
    } else {
      setTagsMap((prev) => ({
        ...prev,
        [taskId]: [...currentTags, tagName],
      }));
    }
  };

  const handleSaveDraft = async (task: TaskLogRecord) => {
    const title = titles[task.id]?.trim() || task.title;
    const macroId = macroIds[task.id] || task.macro_project_id;
    const subId = subIds[task.id] || task.sub_project_id;
    const assignedTags = tagsMap[task.id] || [];

    setSubmittingId(task.id);
    try {
      // ارسال داده به بک‌اند بدون تغییر در زمان‌های شروع و پایان
      await updateTaskLog({
        id: task.id,
        title: title === "تسک بدون عنوان" ? "تسک بدون عنوان" : title,
        macroId: macroId || null,
        subId: subId || null,
        tagIds: assignedTags,
        startTime: task.start_time,
        endTime: task.end_time,
        durationSeconds: task.duration_seconds,
        editNote: task.edit_note,
      });
      onRefresh();
    } finally {
      setSubmittingId(null);
    }
  };

  if (draftTasks.length === 0) {
    return (
      <div className="bg-[#1C1C20] border border-white/10 rounded-2xl p-12 text-center flex flex-col items-center justify-center">
        <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-3">
          <Check size={24} />
        </div>
        <h3 className="text-base font-semibold text-white">کارتابل تکمیل است</h3>
        <p className="text-xs text-white/50 mt-1 max-w-sm">
          هیچ تسک بدون عنوانی در سیستم وجود ندارد. تمامی زمان‌های ثبت‌شده دارای مشخصات و پروژه هستند.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 flex items-center gap-3">
        <AlertCircle size={20} className="text-amber-400 shrink-0" />
        <div className="text-xs text-amber-200/90 leading-relaxed">
          <span className="font-semibold">{draftTasks.length} رکورد نیازمند تکمیل اطلاعات است.</span>{" "}
          تکمیل عنوان، پروژه و تگ‌های این تسک‌ها بدون تغییر دادن زمان کارکرد، تگ ویرایش‌شده روی سوابق ثبت نخواهد کرد.
        </div>
      </div>

      <div className="space-y-3">
        {draftTasks.map((task) => {
          const selectedMacro = macroIds[task.id] ?? (task.macro_project_id || "");
          const availableSubProjects = projects.filter(
            (p) => p.parent_id === selectedMacro && !p.archived
          );
          const currentTags = tagsMap[task.id] ?? [];
          const durationMins = Math.round(task.duration_seconds / 60);

          return (
            <div
              key={task.id}
              className="bg-[#1C1C20] border border-white/10 rounded-2xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 transition-all hover:border-white/20"
            >
              <div className="flex-1 w-full space-y-3">
                <div className="flex items-center gap-2 text-[11px] text-white/40">
                  <Clock size={12} />
                  <span>
                    {task.start_time.substring(11, 16)} تا{" "}
                    {task.end_time ? task.end_time.substring(11, 16) : "در حال انجام"}
                  </span>
                  <span>•</span>
                  <span className="text-white/70 font-mono">{durationMins} دقیقه</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <input
                      type="text"
                      dir="auto"
                      placeholder="عنوان کار انجام شده..."
                      value={titles[task.id] ?? ""}
                      onChange={(e) => handleTitleChange(task.id, e.target.value)}
                      className="w-full bg-[#141416] border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-white/30 focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <select
                      value={selectedMacro}
                      onChange={(e) => handleMacroChange(task.id, e.target.value)}
                      className="w-full bg-[#141416] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                    >
                      <option value="">انتخاب پروژه کلان...</option>
                      {macroProjects.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <select
                      disabled={!selectedMacro || availableSubProjects.length === 0}
                      value={subIds[task.id] ?? (task.sub_project_id || "")}
                      onChange={(e) => handleSubChange(task.id, e.target.value)}
                      className="w-full bg-[#141416] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500 disabled:opacity-40"
                    >
                      <option value="">انتخاب زیرپروژه (اختیاری)...</option>
                      {availableSubProjects.map((sp) => (
                        <option key={sp.id} value={sp.id}>
                          {sp.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <span className="text-[10px] text-white/40 ml-1">فاز:</span>
                  {DEFAULT_PHASE_TAGS.map((tag) => {
                    const isSelected = currentTags.includes(tag);
                    return (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => toggleTag(task.id, tag)}
                        className={`px-2 py-0.5 rounded-lg text-[10px] transition-colors border ${
                          isSelected
                            ? "bg-blue-600/30 border-blue-500 text-blue-300 font-medium"
                            : "bg-white/5 border-white/5 text-white/50 hover:bg-white/10"
                        }`}
                      >
                        {tag}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="shrink-0 w-full md:w-auto flex justify-end">
                <button
                  disabled={submittingId === task.id}
                  onClick={() => handleSaveDraft(task)}
                  className="w-full md:w-auto bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium px-4 py-2.5 rounded-xl flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                >
                  <Check size={14} />
                  <span>ثبت و تأیید مشخصات</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};