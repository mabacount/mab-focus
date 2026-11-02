/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./widget.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        obsidian: {
          900: "#141416",
          800: "#1C1C20",
          700: "#27272D",
          border: "rgba(255, 255, 255, 0.08)",
        },
        focus: {
          blue: "#3B82F6",
          glow: "rgba(59, 130, 246, 0.25)",
        },
        overtime: {
          amber: "#F59E0B",
          glow: "rgba(245, 158, 11, 0.25)",
        },
        break: {
          green: "#10B981",
          glow: "rgba(16, 185, 129, 0.25)",
        },
        audit: {
          purple: "#8B5CF6",
        },
      },
      fontFamily: {
        sans: ["Plus Jakarta Sans", "Vazirmatn", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
    },
  },
  plugins: [],
};