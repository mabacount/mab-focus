import React, { useState, useEffect } from "react";
import { TaskLogRecord, ProjectNode } from "../types/models";
import { getAllProjects, getAllTaskLogs } from "../services/ipc";
import { exportTasksToExcel } from "../services/exporter";
import { ActivityLogTable } from "./ActivityLogTable";
import { UntitledInbox } from "./UntitledInbox";
import { ProjectStudio } from "./ProjectStudio";
import { SettingsPanel } from "./SettingsPanel";
import {
  Clock,
  Inbox,
  Layers,
  Settings,
  Download,
  RefreshCw,
} from "lucide-react";

export const DashboardApp: React.FC = () => {
  const [activeTab, setActiveTab] = useState<
    "activity" | "inbox" | "projects" | "settings"
  >("activity");

  const [tasks, setTasks] = useState<TaskLogRecord[]>([]);
  const [projects, setProjects] = useState<ProjectNode[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    setHasError(false);
    try {
      const [fetchedTasks, fetchedProjects] = await Promise.all([
        getAllTaskLogs().catch(() => []),
        getAllProjects().catch(() => []),
      ]);
      setTasks(fetchedTasks || []);
      setProjects(fetchedProjects || []);
    } catch {
      setHasError(true);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const untitledCount = tasks.filter((t) => t.is_untitled_draft).length;

  return (
    <div dir="rtl" className="flex flex-col h-screen w-screen bg-[#141416] text-white select-none">
      <header className="h-16 border-b border-white/10 px-6 flex items-center justify-between shrink-0 bg-[#1C1C20]/50 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center font-bold text-sm shadow-lg shadow-blue-500/20">
            M
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-tight">Mab-Focus</h1>
            <p className="text-[10px] text-white/40">میز کار و تایم‌شیت کارکرد کارفرما</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => exportTasksToExcel(tasks, projects)}
            className="bg-white/5 hover:bg-white/10 text-white/80 hover:text-white text-xs px-3 py-2 rounded-xl border border-white/10 flex items-center gap-1.5 transition-colors"
          >
            <Download size={13} />
            <span>خروجی اکسل کارکرد</span>
          </button>

          <button
            onClick={loadData}
            title="به‌روزرسانی داده‌ها"
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-colors"
          >
            <RefreshCw size={14} className={isLoading ? "animate-spin" : ""} />
          </button>
        </div>
      </header>

      <div className="border-b border-white/10 px-6 flex items-center gap-2 shrink-0 bg-[#141416]">
        {[
          { id: "activity", label: "تایم‌شیت و فعالیت‌ها", icon: Clock },
          {
            id: "inbox",
            label: "کارتابل تسک‌های بدون عنوان",
            icon: Inbox,
            badge: untitledCount > 0 ? untitledCount : null,
          },
          { id: "projects", label: "استودیو پروژه‌ها", icon: Layers },
          { id: "settings", label: "تنظیمات", icon: Settings },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`flex items-center gap-2 py-3 px-3 text-xs font-medium border-b-2 transition-colors relative ${
                isActive
                  ? "border-blue-500 text-white"
                  : "border-transparent text-white/40 hover:text-white/70"
              }`}
            >
              <Icon size={14} />
              <span>{tab.label}</span>
              {tab.badge && (
                <span className="bg-amber-500 text-black font-bold text-[10px] px-1.5 py-0.2 rounded-full">
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <main className="flex-1 overflow-y-auto p-6">
        {hasError && (
          <div className="mb-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-200">
            داده‌های محلی در حال مقداردهی هستند؛ لطفاً دکمه رفرش را بزنید.
          </div>
        )}
        {activeTab === "activity" && (
          <ActivityLogTable tasks={tasks} projects={projects} onRefresh={loadData} />
        )}
        {activeTab === "inbox" && (
          <UntitledInbox tasks={tasks} projects={projects} onRefresh={loadData} />
        )}
        {activeTab === "projects" && (
          <ProjectStudio projects={projects} onRefresh={loadData} />
        )}
        {activeTab === "settings" && <SettingsPanel />}
      </main>
    </div>
  );
};