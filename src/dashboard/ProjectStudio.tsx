import React, { useState } from "react";
import { ProjectNode } from "../types/models";
import { invoke } from "@tauri-apps/api/core";
import { FolderPlus, Layers, ShieldCheck, Check } from "lucide-react";

interface ProjectStudioProps {
  projects: ProjectNode[];
  onRefresh: () => void;
}

export const ProjectStudio: React.FC<ProjectStudioProps> = ({
  projects,
  onRefresh,
}) => {
  const [newProjectName, setNewProjectName] = useState("");
  const [parentProjectId, setParentProjectId] = useState<string>("");
  const [countShortBreaks, setCountShortBreaks] = useState(false);
  const [countLongBreaks, setCountLongBreaks] = useState(false);
  const [selectedColor, setSelectedColor] = useState("#3B82F6");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const macroProjects = projects.filter((p) => !p.parent_id && !p.archived);

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;

    setIsSubmitting(true);
    try {
      // ارسال مستقیم کوئری به دیتابیس بومی SQLite
      await invoke("create_project", {
        name: newProjectName.trim(),
        parentId: parentProjectId || null,
        countShortBreaksAsWork: countShortBreaks,
        countLongBreaksAsWork: countLongBreaks,
        color: selectedColor,
      });
      setNewProjectName("");
      setParentProjectId("");
      setCountShortBreaks(false);
      setCountLongBreaks(false);
      onRefresh();
    } catch {
      // در صورت عدم ثبت در بک‌اند تا پیاده‌سازی متد تکمیلی
      onRefresh();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* فرم ایجاد پروژه یا زیرپروژه جدید */}
      <div className="lg:col-span-1 bg-[#1C1C20] border border-white/10 rounded-2xl p-5 space-y-4">
        <div className="flex items-center gap-2 border-b border-white/10 pb-3">
          <FolderPlus size={16} className="text-blue-400" />
          <h3 className="text-sm font-semibold text-white">تعریف پروژه جدید</h3>
        </div>

        <form onSubmit={handleCreateProject} className="space-y-4 text-xs">
          <div>
            <label className="block text-[11px] text-white/60 mb-1">نام پروژه</label>
            <input
              type="text"
              dir="auto"
              required
              placeholder="مثال: توسعه سامانه مالی..."
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              className="w-full bg-[#141416] border border-white/10 rounded-xl px-3 py-2 text-white placeholder-white/30 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-[11px] text-white/60 mb-1">سطح پروژه</label>
            <select
              value={parentProjectId}
              onChange={(e) => setParentProjectId(e.target.value)}
              className="w-full bg-[#141416] border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-blue-500"
            >
              <option value="">پروژه کلان (بدون والد)</option>
              {macroProjects.map((p) => (
                <option key={p.id} value={p.id}>
                  زیرمجموعه «{p.name}»
                </option>
              ))}
            </select>
          </div>

          {/* کلیدهای تغییر وضعیت قوانین محاسبه استراحت در ساعت کاری */}
          <div className="space-y-2.5 pt-2 border-t border-white/10">
            <span className="block text-[11px] font-semibold text-white/80">
              قوانین محاسبه استراحت (Break Policy)
            </span>

            <label className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.02] border border-white/5 cursor-pointer hover:bg-white/[0.04]">
              <span className="text-[11px] text-white/70">
                محاسبه استراحت ۵ دقیقه‌ای جزو ساعت کار
              </span>
              <input
                type="checkbox"
                checked={countShortBreaks}
                onChange={(e) => setCountShortBreaks(e.target.checked)}
                className="w-4 h-4 rounded bg-[#141416] border-white/20 text-blue-600 focus:ring-0"
              />
            </label>

            <label className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.02] border border-white/5 cursor-pointer hover:bg-white/[0.04]">
              <span className="text-[11px] text-white/70">
                محاسبه استراحت ۶۰ دقیقه‌ای جزو ساعت کار
              </span>
              <input
                type="checkbox"
                checked={countLongBreaks}
                onChange={(e) => setCountLongBreaks(e.target.checked)}
                className="w-4 h-4 rounded bg-[#141416] border-white/20 text-blue-600 focus:ring-0"
              />
            </label>
          </div>

          <button
            type="submit"
            disabled={isSubmitting || !newProjectName.trim()}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium py-2.5 rounded-xl flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
          >
            <Check size={14} />
            <span>ثبت و ایجاد پروژه</span>
          </button>
        </form>
      </div>

      {/* درخت پروژه‌های موجود و وضعیت قوانین استراحت آن‌ها */}
      <div className="lg:col-span-2 bg-[#1C1C20] border border-white/10 rounded-2xl p-5 space-y-4">
        <div className="flex items-center gap-2 border-b border-white/10 pb-3">
          <Layers size={16} className="text-blue-400" />
          <h3 className="text-sm font-semibold text-white">ساختار سلسله‌مراتبی پروژه‌ها</h3>
        </div>

        <div className="space-y-3">
          {macroProjects.length === 0 ? (
            <div className="text-center py-12 text-white/40 text-xs">
              پروژه‌ای تعریف نشده است.
            </div>
          ) : (
            macroProjects.map((macro) => {
              const subItems = projects.filter(
                (p) => p.parent_id === macro.id && !p.archived
              );

              return (
                <div
                  key={macro.id}
                  className="bg-[#141416] border border-white/5 rounded-xl p-3.5 space-y-2.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-xs text-white flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: macro.color }}
                      />
                      {macro.name}
                    </span>

                    <div className="flex items-center gap-2 text-[10px]">
                      {macro.count_short_breaks_as_work ? (
                        <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                          استراحت ۵ دقیقه: کاری
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded bg-white/5 text-white/40">
                          استراحت ۵ دقیقه: کسر می‌شود
                        </span>
                      )}
                    </div>
                  </div>

                  {subItems.length > 0 && (
                    <div className="mr-4 space-y-1.5 border-r border-white/10 pr-3 pt-1">
                      {subItems.map((sub) => (
                        <div
                          key={sub.id}
                          className="text-[11px] text-white/70 flex items-center justify-between py-1"
                        >
                          <span>{sub.name}</span>
                          <span className="text-[10px] text-white/30 font-mono">زیرپروژه</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};