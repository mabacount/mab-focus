import React, { useState, useEffect } from "react";
import { ProjectNode } from "../types/models";
import { updateActiveTaskMetadata, switchTaskMidPomodoro } from "../services/ipc";
import { soundFx } from "../services/audio";
import { Check, ArrowRightLeft, X, Tag, Folder } from "lucide-react";

interface QuickTaskPopoverProps {
  activeLogId: string | null;
  initialTitle?: string;
  projects: ProjectNode[];
  onClose: () => void;
  onTaskSwitched?: (newLogId: string) => void;
}

const DEFAULT_PHASE_TAGS = [
  "برنامه‌ریزی اولیه",
  "اجرا",
  "نظارت و پیگیری",
  "اختتامیه",
];

export const QuickTaskPopover: React.FC<QuickTaskPopoverProps> = ({
  activeLogId,
  initialTitle = "",
  projects,
  onClose,
  onTaskSwitched,
}) => {
  const [title, setTitle] = useState(initialTitle);
  const [macroProjectId, setMacroProjectId] = useState<string>("");
  const [subProjectId, setSubProjectId] = useState<string>("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // فیلتر کردن پروژه‌های کلان (بدون والد) و فعال
  const macroProjects = projects.filter((p) => !p.parent_id && !p.archived);

  // فیلتر کردن زیرپروژه‌های وابسته به پروژه کلان انتخابی
  const subProjects = projects.filter(
    (p) => p.parent_id === macroProjectId && !p.archived
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const toggleTag = (tagName: string) => {
    if (selectedTags.includes(tagName)) {
      setSelectedTags(selectedTags.filter((t) => t !== tagName));
    } else {
      setSelectedTags([...selectedTags, tagName]);
    }
  };

  const handleSaveCurrent = async () => {
    if (!activeLogId) return;
    setIsSubmitting(true);
    try {
      await updateActiveTaskMetadata(
        activeLogId,
        title.trim() || "تسک بدون عنوان",
        macroProjectId || null,
        subProjectId || null,
        selectedTags
      );
      soundFx.playClickStart();
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSwitchNextTask = async () => {
    setIsSubmitting(true);
    try {
      const nextLogId = await switchTaskMidPomodoro(
        title.trim() || "تسک بدون عنوان",
        macroProjectId || null,
        subProjectId || null,
        selectedTags
      );
      soundFx.playClickStart();
      if (onTaskSwitched) {
        onTaskSwitched(nextLogId);
      }
      // خالی کردن فرم برای تسک جدید
      setTitle("");
      setSelectedTags([]);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      dir="rtl"
      className="w-72 bg-[#1C1C20]/95 backdrop-blur-md border border-white/10 rounded-2xl p-4 shadow-2xl text-white text-xs space-y-3 z-50 select-none"
    >
      <div className="flex items-center justify-between border-b border-white/10 pb-2">
        <span className="font-semibold text-white/90">مشخصات تسک جاری</span>
        <button
          onClick={onClose}
          className="text-white/40 hover:text-white transition-colors"
        >
          <X size={14} />
        </button>
      </div>

      <div>
        <label className="block text-[11px] text-white/60 mb-1">
          در حال انجام چه کاری هستید؟
        </label>
        <input
          type="text"
          dir="auto"
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="عنوان تسک (اختیاری)..."
          className="w-full bg-[#141416] border border-white/10 rounded-lg px-2.5 py-1.5 text-white placeholder-white/30 text-xs focus:outline-none focus:border-blue-500 transition-colors"
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-[10px] text-white/60 mb-1 flex items-center gap-1">
            <Folder size={11} /> پروژه کلان
          </label>
          <select
            value={macroProjectId}
            onChange={(e) => {
              setMacroProjectId(e.target.value);
              setSubProjectId("");
            }}
            className="w-full bg-[#141416] border border-white/10 rounded-lg px-2 py-1.5 text-white text-[11px] focus:outline-none focus:border-blue-500"
          >
            <option value="">بدون پروژه</option>
            {macroProjects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[10px] text-white/60 mb-1">زیرپروژه</label>
          <select
            value={subProjectId}
            disabled={!macroProjectId || subProjects.length === 0}
            onChange={(e) => setSubProjectId(e.target.value)}
            className="w-full bg-[#141416] border border-white/10 rounded-lg px-2 py-1.5 text-white text-[11px] focus:outline-none focus:border-blue-500 disabled:opacity-40"
          >
            <option value="">—</option>
            {subProjects.map((sp) => (
              <option key={sp.id} value={sp.id}>
                {sp.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-[10px] text-white/60 mb-1.5 flex items-center gap-1">
          <Tag size={11} /> فاز اجرایی
        </label>
        <div className="flex flex-wrap gap-1.5">
          {DEFAULT_PHASE_TAGS.map((tag) => {
            const isSelected = selectedTags.includes(tag);
            return (
              <button
                key={tag}
                type="button"
                onClick={() => toggleTag(tag)}
                className={`px-2 py-1 rounded-md text-[10px] transition-colors border ${
                  isSelected
                    ? "bg-blue-600/30 border-blue-500 text-blue-300 font-medium"
                    : "bg-white/5 border-white/5 text-white/60 hover:bg-white/10"
                }`}
              >
                {tag}
              </button>
            );
          })}
        </div>
      </div>

      <div className="pt-2 border-t border-white/10 flex flex-col gap-1.5">
        <button
          disabled={isSubmitting || !activeLogId}
          onClick={handleSaveCurrent}
          className="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium py-1.5 rounded-lg text-xs flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
        >
          <Check size={13} />
          <span>ثبت مشخصات تسک</span>
        </button>

        <button
          disabled={isSubmitting}
          onClick={handleSwitchNextTask}
          className="w-full bg-white/5 hover:bg-white/10 text-white/80 py-1.5 rounded-lg text-[11px] flex items-center justify-center gap-1.5 border border-white/10 transition-colors"
        >
          <ArrowRightLeft size={12} />
          <span>تکمیل و شروع تسک بعدی</span>
        </button>
      </div>
    </div>
  );
};