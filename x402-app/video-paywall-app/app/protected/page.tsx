export default function VideoPage() {
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
      <div style={{ textAlign: "center", padding: 48, maxWidth: 800, width: "100%" }}>
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
          fontSize: 36,
          fontWeight: 800,
          marginBottom: 24,
          lineHeight: 1.2,
        }}>
          Enjoy your video
        </h1>

        <div style={{
          position: "relative",
          paddingBottom: "56.25%",
          height: 0,
          overflow: "hidden",
          borderRadius: 12,
          marginBottom: 24,
        }}>
          <iframe
            src="https://www.youtube.com/embed/hMLcKtVwF-A"
            title="YouTube video"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              border: "none",
            }}
          />
        </div>

        <p style={{ fontSize: 16, color: "#a1a1a1", lineHeight: 1.6 }}>
          You paid $1.00 USDC on Stellar to unlock this video.
          No accounts, no OAuth, no subscriptions &mdash; just x402.
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
