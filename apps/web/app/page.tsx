"use client";

import { useEffect } from "react";
import { Sidebar } from "@/components/sidebar";
import { ChatView } from "@/components/chat-view";

export default function HomePage() {
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", "dark");
  }, []);

  return (
    <div className="app-layout">
      <Sidebar />
      <ChatView />
    </div>
  );
}
