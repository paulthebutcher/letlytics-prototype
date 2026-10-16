import { ImageResponse } from "next/og";

export const alt = "Letlytics — Find potential. Test the numbers.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: "#203c33",
          color: "#fafbf8",
          padding: "62px 76px",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: 19,
            color: "#cce1ad",
          }}
        >
          <span style={{ letterSpacing: 4 }}>BUY-TO-LET, WITH PERSPECTIVE</span>
          <span>PROPERTY ANALYSIS</span>
        </div>
        <div
          style={{
            display: "flex",
            flex: 1,
            flexDirection: "column",
            justifyContent: "center",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 23 }}>
            <svg
              width="104"
              height="104"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#cce1ad"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 16v5M16 14v7M20 10v11m2-18-8.646 8.646a.5.5 0 0 1-.708 0L9.354 8.354a.5.5 0 0 0-.707 0L2 15M4 18v3M8 14v7" />
            </svg>
            <div
              style={{
                display: "flex",
                fontSize: 112,
                fontWeight: 700,
                letterSpacing: -6,
              }}
            >
              letlytics<span style={{ color: "#cce1ad" }}>.</span>
            </div>
          </div>
          <div
            style={{
              display: "flex",
              marginTop: 30,
              fontSize: 42,
              letterSpacing: -1,
              color: "#e2eadb",
            }}
          >
            Find potential. Test the numbers.
          </div>
        </div>
        <div
          style={{
            display: "flex",
            borderTop: "1px solid #547060",
            paddingTop: 22,
            justifyContent: "space-between",
            fontSize: 21,
            color: "#c4d0c3",
          }}
        >
          <span>Discover. Analyse. Compare.</span>
          <span style={{ color: "#cce1ad" }}>Clarity before commitment.</span>
        </div>
      </div>
    ),
    size,
  );
}
