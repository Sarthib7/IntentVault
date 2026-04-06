import { InvestigationWorkspace } from "@/components/investigation-workspace";

export default function HomePage() {
  return (
    <main className="page-shell">
      <aside className="sidebar">
        <div className="badge">MVP</div>
        <h1>IntentVault</h1>
        <p className="lede">
          Privacy-first Solana decision workflows. Public market signals stay
          public. Your intent and constraints stay inside the private inference
          boundary.
        </p>
        <section className="panel">
          <h2>Active Template</h2>
          <div className="template-card">
            <strong>Investigate Token (Private)</strong>
            <p>
              Collect public evidence, normalize it, and shape a private
              decision card without storing private notes on the server.
            </p>
          </div>
        </section>
        <section className="panel">
          <h2>Guardrails</h2>
          <ul className="plain-list">
            <li>No wallet signing</li>
            <li>No server-side history</li>
            <li>No autonomous execution</li>
            <li>SolRouter only via adapter</li>
          </ul>
        </section>
      </aside>
      <section className="workspace">
        <InvestigationWorkspace />
      </section>
    </main>
  );
}

