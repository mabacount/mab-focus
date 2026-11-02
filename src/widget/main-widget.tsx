import React from "react";
import ReactDOM from "react-dom/client";
import { FloatingWidget } from "./FloatingWidget";
import "../index.css";

const rootElement = document.getElementById("root");

if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <FloatingWidget />
    </React.StrictMode>
  );
}