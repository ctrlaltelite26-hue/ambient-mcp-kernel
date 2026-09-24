import { redirect } from "next/navigation";

import { LoginForm } from "@/components/LoginForm";
import { isAuthenticated } from "@/lib/auth";

export default async function LoginPage() {
  if (await isAuthenticated()) redirect("/");

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "1.5rem",
      }}
    >
      <header style={{ maxWidth: 720, margin: "0 auto", width: "100%" }}>
        <div className="brand" style={{ fontSize: "1.5rem" }}>
          Chaperone
        </div>
      </header>

      <section
        style={{
          width: "min(440px, 100%)",
          margin: "2rem auto",
          textAlign: "center",
        }}
        className="fade-in"
      >
        <h1 className="brand" style={{ fontSize: "clamp(2.4rem, 6vw, 3.2rem)", margin: "0 0 0.5rem" }}>
          Chaperone
        </h1>
        <p className="muted" style={{ margin: "0 0 1.75rem", fontSize: "1.05rem" }}>
          Household consent for ambient ordering.
        </p>
        <div className="paper-shell" style={{ padding: "1.5rem", textAlign: "left" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: "1.25rem",
              paddingBottom: "0.85rem",
              borderBottom: "1px solid var(--line)",
            }}
          >
            <span
              className="muted"
              style={{ fontSize: "0.72rem", letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 600 }}
            >
              Judge access
            </span>
            <span className="muted" style={{ fontSize: "0.75rem" }}>
              sim-host
            </span>
          </div>
          <LoginForm />
          <p className="muted" style={{ margin: "1.25rem 0 0", fontSize: "0.78rem", textAlign: "center", lineHeight: 1.5 }}>
            Use credentials from README · demo family: Maya (adult), Leo (child), Guest
          </p>
        </div>
      </section>

      <footer style={{ textAlign: "center", paddingBottom: "0.5rem" }}>
        <p className="muted" style={{ margin: 0, fontSize: "0.78rem" }}>
          Simulated Alexa+ host · Amazon Developer Hackathon
        </p>
      </footer>
    </main>
  );
}
