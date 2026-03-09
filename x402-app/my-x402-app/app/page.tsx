export default function Home() {
  return (
    <main style={{
      background: "#0a0a0a",
      color: "#fafafa",
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "system-ui",
    }}>
      <div style={{ textAlign: "center", padding: 48 }}>
        <h1 style={{ fontSize: 36, fontWeight: 700, marginBottom: 16 }}>
          x402 TADA Demo
        </h1>
        <p style={{ color: "#a1a1a1", marginBottom: 40, maxWidth: 480 }}>
          This demo gates a page behind a $0.01 USDC micropayment on Stellar
          testnet using the x402 protocol.
        </p>
        <a
          href="/protected"
          style={{
            display: "inline-block",
            background: "#5746af",
            color: "white",
            padding: "14px 32px",
            borderRadius: 8,
            textDecoration: "none",
            fontWeight: 600,
          }}
        >
          Unlock the TADA page ($0.01 USDC)
        </a>
        <p style={{ marginTop: 24, fontSize: 13, color: "#525252" }}>
          Requires a Stellar wallet (e.g. Freighter) with testnet USDC
        </p>
      </div>
    </main>
  );
}
