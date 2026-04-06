"use client";

import { useState, useEffect } from "react";
import { Sidebar } from "@/components/sidebar";
import { ChatView } from "@/components/chat-view";

export default function HomePage() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  // Apply theme to <html> element
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  function toggleTheme() {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  }

  return (
    <div className="app-layout">
      <Sidebar theme={theme} onToggleTheme={toggleTheme} />
      <ChatView />
    </div>
  );
}
