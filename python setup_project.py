import os

# نام دایرکتوری اصلی پروژه
BASE_DIR = "mab-focus"

# ساختار درختی پوشه‌ها مطابق سند پروژه
DIRECTORIES = [
    os.path.join(BASE_DIR, "src", "types"),
    os.path.join(BASE_DIR, "src", "services"),
    os.path.join(BASE_DIR, "src", "widget"),
    os.path.join(BASE_DIR, "src", "dashboard"),
    os.path.join(BASE_DIR, "src-tauri", "src"),
    os.path.join(BASE_DIR, "src-tauri", "icons"),
]

# تمام فایل‌هایی که باید در پروژه پیاده‌سازی شوند
FILES = [
    # ریشه فرانت‌اند
    os.path.join(BASE_DIR, "package.json"),
    os.path.join(BASE_DIR, "tsconfig.json"),
    os.path.join(BASE_DIR, "vite.config.ts"),
    os.path.join(BASE_DIR, "tailwind.config.js"),
    os.path.join(BASE_DIR, "index.html"),
    os.path.join(BASE_DIR, "widget.html"),
    
    # تایپ‌ها و سرویس‌ها
    os.path.join(BASE_DIR, "src", "types", "models.ts"),
    os.path.join(BASE_DIR, "src", "services", "ipc.ts"),
    os.path.join(BASE_DIR, "src", "services", "audio.ts"),
    os.path.join(BASE_DIR, "src", "services", "exporter.ts"),
    
    # کامپوننت‌های ویجت شناور
    os.path.join(BASE_DIR, "src", "widget", "main-widget.tsx"),
    os.path.join(BASE_DIR, "src", "widget", "FloatingWidget.tsx"),
    os.path.join(BASE_DIR, "src", "widget", "QuickTaskPopover.tsx"),
    
    # کامپوننت‌های داشبورد اصلی
    os.path.join(BASE_DIR, "src", "dashboard", "main-dashboard.tsx"),
    os.path.join(BASE_DIR, "src", "dashboard", "DashboardApp.tsx"),
    os.path.join(BASE_DIR, "src", "dashboard", "ActivityLogTable.tsx"),
    os.path.join(BASE_DIR, "src", "dashboard", "UntitledInbox.tsx"),
    os.path.join(BASE_DIR, "src", "dashboard", "ProjectStudio.tsx"),
    os.path.join(BASE_DIR, "src", "dashboard", "SettingsPanel.tsx"),
    
    # بک‌اند Rust و ویندوز
    os.path.join(BASE_DIR, "src-tauri", "Cargo.toml"),
    os.path.join(BASE_DIR, "src-tauri", "tauri.conf.json"),
    os.path.join(BASE_DIR, "src-tauri", "src", "main.rs"),
    os.path.join(BASE_DIR, "src-tauri", "src", "db.rs"),
    os.path.join(BASE_DIR, "src-tauri", "src", "timer.rs"),
    os.path.join(BASE_DIR, "src-tauri", "src", "txt_logger.rs"),
    os.path.join(BASE_DIR, "src-tauri", "src", "gcal_sync.rs"),
]

def create_mab_focus_scaffold():
    print("⏳ در حال ساخت ساختار پوشه‌ها و فایل‌های پروژه Mab-Focus...")
    
    for directory in DIRECTORIES:
        os.makedirs(directory, exist_ok=True)
        print(f"✓ پوشه ایجاد شد: {directory}")

    for file_path in FILES:
        if not os.path.exists(file_path):
            with open(file_path, "w", encoding="utf-8") as f:
                pass  # ایجاد فایل خالی
            print(f"  + فایل ایجاد شد: {file_path}")

    print("\n✅ تمام پوشه‌ها و فایل‌های اولیه پروژه با نام Mab-Focus با موفقیت ساخته شدند.")

if __name__ == "__main__":
    create_mab_focus_scaffold()