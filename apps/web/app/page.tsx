import { Sidebar } from "@/components/sidebar";
import { ChatView } from "@/components/chat-view";

export default function HomePage() {
  return (
    <div className="app-layout">
      <Sidebar />
      <ChatView />
    </div>
  );
}
