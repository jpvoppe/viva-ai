import { ImageResponse } from "next/og";

export const alt = "VIVA AI — o assistente inteligente para a vida cotidiana";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Imagem de compartilhamento em redes sociais, gerada no build. */
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          background: "linear-gradient(135deg, #15131c 0%, #1f1740 55%, #15234f 100%)",
          color: "#ffffff",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: 72,
              background: "radial-gradient(circle at 35% 30%, #c9b5ff 0%, #7a45ff 35%, #3b2bd9 75%, #1b1470 100%)",
            }}
          />
          <div style={{ fontSize: 52, fontWeight: 700, letterSpacing: -2 }}>viva</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ fontSize: 84, fontWeight: 700, lineHeight: 1, letterSpacing: -3, maxWidth: 940 }}>
            O que vamos resolver hoje?
          </div>
          <div style={{ fontSize: 34, color: "rgba(255,255,255,0.75)" }}>
            O assistente inteligente para a vida cotidiana
          </div>
        </div>
      </div>
    ),
    size,
  );
}
