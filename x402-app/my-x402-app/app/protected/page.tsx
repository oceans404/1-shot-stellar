export default function TadaPage() {
  return (
    <div style={{
      fontFamily: "system-ui, -apple-system, sans-serif",
      background: "#0a0a0a",
      color: "#fafafa",
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      margin: 0,
    }}>
      <div style={{ textAlign: "center", padding: 48 }}>
        <div style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          background: "rgba(48, 164, 108, 0.15)",
          color: "#30a46c",
          padding: "6px 16px",
          borderRadius: 9999,
          fontSize: 14,
          fontWeight: 600,
          border: "1px solid rgba(48, 164, 108, 0.3)",
          marginBottom: 32,
        }}>
          <span style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: "#30a46c",
            display: "inline-block",
          }} />
          Payment Verified
        </div>

        <h1 style={{
          fontSize: 120,
          fontWeight: 800,
          letterSpacing: -4,
          background: "linear-gradient(135deg, #7c66dc, #5746af, #30a46c)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          marginBottom: 24,
          lineHeight: 1,
        }}>
          TADA!
        </h1>

        <p style={{ fontSize: 18, color: "#a1a1a1", maxWidth: 500, lineHeight: 1.6 }}>
          You paid $0.01 USDC on Stellar to unlock this page.
          This content was gated behind an x402 paywall &mdash; no accounts,
          no OAuth, no subscriptions.
        </p>
      </div>

      <div style={{ position: "fixed", bottom: 24, fontSize: 13, color: "#525252" }}>
        Powered by{" "}
        <a href="https://www.x402.org/" target="_blank" rel="noopener noreferrer"
          style={{ color: "#7c66dc", textDecoration: "none" }}>x402</a>
        {" "}on{" "}
        <a href="https://stellar.org/" target="_blank" rel="noopener noreferrer"
          style={{ color: "#7c66dc", textDecoration: "none" }}>Stellar</a>
      </div>
    </div>
  );
}
