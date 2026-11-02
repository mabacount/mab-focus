import React from "react";
import ReactDOM from "react-dom/client";
import { DashboardApp } from "./DashboardApp";
import "../index.css";

const rootElement = document.getElementById("root");

if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <DashboardApp />
    </React.StrictMode>
  );
}