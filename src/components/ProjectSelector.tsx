import React, { useState, useRef, useEffect } from "react";
import { ProjectNode } from "../types/models";
import { Search, ChevronDown, Check, X } from "lucide-react";

interface ProjectSelectorProps {
  projects: ProjectNode[];
  selectedMacroId: string | null;
  selectedSubId: string | null;
  onSelect: (macroId: string | null, subId: string | null) => void;
  className?: string;
}

export const ProjectSelector: React.FC<ProjectSelectorProps> = ({
  projects,
  selectedMacroId,
  selectedSubId,
  onSelect,
  className = "",
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // بستن لیست با کلیک بیرون از کامپوننت
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const activeProjects = projects.filter((p) => !p.archived);
  const macroProjects = activeProjects.filter((p) => !p.parent_id);

  // یافتن عنوان نمایشی فعلی
  let currentLabel = "بدون پروژه";
  let currentColor: string | null = null;

  if (selectedSubId) {
    const sub = activeProjects.find((p) => p.id === selectedSubId);
    const parent = sub?.parent_id ? activeProjects.find((p) => p.id === sub.parent_id) : null;
    if (sub && parent) {
      currentLabel = `${parent.name} › ${sub.name}`;
      currentColor = parent.color;
    } else if (sub) {
      currentLabel = sub.name;
    }
  } else if (selectedMacroId) {
    const macro = activeProjects.find((p) => p.id === selectedMacroId);
    if (macro) {
      currentLabel = macro.name;
      currentColor = macro.color;
    }
  }

  // فیلتر کردن درختی بر اساس عبارت جست‌وجو
  const q = searchQuery.trim().toLowerCase();

  return (
    <div ref={containerRef} dir="rtl" className={`relative w-full ${className}`}>
      {/* دکمه اصلی انتخاب */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full bg-[#141416] border border-white/10 hover:border-white/20 rounded-xl px-3 py-2 text-xs text-white flex items-center justify-between gap-2 transition-colors focus:outline-none focus:border-blue-500"
      >
        <span className="flex items-center gap-2 truncate">
          {currentColor ? (
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: currentColor }}
            />
          ) : (
            <span className="w-2 h-2 rounded-full bg-white/20 shrink-0" />
          )}
          <span className="truncate">{currentLabel}</span>
        </span>
        <ChevronDown size={14} className="text-white/40 shrink-0" />
      </button>

      {/* منوی بازشونده جست‌وجو و لیست سلسله‌مراتبی */}
      {isOpen && (
        <div className="absolute top-full right-0 mt-1.5 w-full min-w-[240px] max-h-64 bg-[#1C1C20] border border-white/10 rounded-xl shadow-2xl z-50 flex flex-col overflow-hidden">
          {/* فیلد جست‌وجو با فیلتر درجا */}
          <div className="p-2 border-b border-white/10 flex items-center gap-1.5 bg-[#141416]/60">
            <Search size={13} className="text-white/40 shrink-0 mr-1" />
            <input
              ref={inputRef}
              type="text"
              dir="auto"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="جست‌وجوی پروژه..."
              className="w-full bg-transparent text-xs text-white placeholder-white/30 focus:outline-none"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="text-white/40 hover:text-white"
              >
                <X size={12} />
              </button>
            )}
          </div>

          {/* لیست اسکرول‌شونده */}
          <div className="overflow-y-auto p-1 text-xs space-y-0.5 max-h-48">
            {/* گزینه بدون پروژه */}
            <div
              onClick={() => {
                onSelect(null, null);
                setIsOpen(false);
              }}
              className={`px-2.5 py-1.5 rounded-lg flex items-center justify-between cursor-pointer transition-colors ${
                !selectedMacroId && !selectedSubId
                  ? "bg-blue-600/20 text-blue-300 font-medium"
                  : "text-white/60 hover:bg-white/5 hover:text-white"
              }`}
            >
              <span>بدون پروژه</span>
              {!selectedMacroId && !selectedSubId && <Check size={13} />}
            </div>

            {macroProjects.map((macro) => {
              const subItems = activeProjects.filter((p) => p.parent_id === macro.id);

              // بررسی تطابق جست‌وجو
              const matchesMacro = macro.name.toLowerCase().includes(q);
              const matchingSubs = subItems.filter((s) => s.name.toLowerCase().includes(q));

              if (q && !matchesMacro && matchingSubs.length === 0) {
                return null;
              }

              const isMacroSelected = selectedMacroId === macro.id && !selectedSubId;

              return (
                <div key={macro.id} className="space-y-0.5">
                  {/* ردیف پروژه کلان با دایره شاخص */}
                  <div
                    onClick={() => {
                      onSelect(macro.id, null);
                      setIsOpen(false);
                    }}
                    className={`px-2.5 py-1.5 rounded-lg flex items-center justify-between cursor-pointer transition-colors ${
                      isMacroSelected
                        ? "bg-blue-600/20 text-blue-300 font-semibold"
                        : "text-white/90 hover:bg-white/5 font-medium"
                    }`}
                  >
                    <span className="flex items-center gap-2 truncate">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0 shadow-sm"
                        style={{ backgroundColor: macro.color }}
                      />
                      <span className="truncate">{macro.name}</span>
                    </span>
                    {isMacroSelected && <Check size={13} />}
                  </div>

                  {/* زیرپروژه‌ها با فرورفتگی مشخص زیر پروژه کلان */}
                  {subItems.map((sub) => {
                    if (q && !matchesMacro && !sub.name.toLowerCase().includes(q)) {
                      return null;
                    }

                    const isSubSelected = selectedSubId === sub.id;

                    return (
                      <div
                        key={sub.id}
                        onClick={() => {
                          onSelect(macro.id, sub.id);
                          setIsOpen(false);
                        }}
                        className={`mr-4 pr-3 border-r border-white/10 py-1.5 px-2 rounded-lg flex items-center justify-between cursor-pointer transition-colors text-[11px] ${
                          isSubSelected
                            ? "bg-blue-600/20 text-blue-300 font-medium"
                            : "text-white/60 hover:bg-white/5 hover:text-white"
                        }`}
                      >
                        <span className="truncate">↳ {sub.name}</span>
                        {isSubSelected && <Check size={12} />}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};