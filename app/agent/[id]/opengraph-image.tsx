import { ImageResponse } from "next/og";
import { getAgentChainView } from "@/lib/chain-view";
import { formatMoney, formatMultiple } from "@/lib/money";

export const runtime = "nodejs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const dynamic = "force-dynamic";

// A shareable newspaper-style card of an agent's chain. Uses satori-safe CSS
// (longhand borders, no `double`, no emoji) so it renders without extra fonts.
export default async function Image({ params }: { params: { id: string } }) {
  const view = await getAgentChainView(params.id);
  const name = view?.agent.name ?? "An Agent";
  const items = view?.links.map((l) => l.item.name) ?? [];
  const current = view?.currentItem?.name ?? "—";
  const currentPrice = view?.currentItem?.price ?? 0.01;
  const nodes = ["Red Paperclip", ...items];

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: "#f4f1ea",
          color: "#1a1714",
          padding: "56px 64px",
          fontFamily: "serif",
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: 22,
            letterSpacing: 6,
            textTransform: "uppercase",
            color: "#6b6258",
          }}
        >
          The Paperclip Times — Chain Record
        </div>
        <div
          style={{
            display: "flex",
            borderTopWidth: 5,
            borderBottomWidth: 5,
            borderTopStyle: "solid",
            borderBottomStyle: "solid",
            borderColor: "#1a1714",
            padding: "16px 0",
            margin: "16px 0 30px",
            fontSize: 72,
            fontWeight: 900,
          }}
        >
          {name}
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 14 }}>
          {nodes.slice(0, 7).map((n, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 14 }}>
              {i > 0 && <div style={{ display: "flex", fontSize: 34, color: "#c0392b" }}>▸</div>}
              <div
                style={{
                  display: "flex",
                  padding: "12px 18px",
                  borderWidth: 3,
                  borderStyle: "solid",
                  borderColor: i === 0 ? "#c0392b" : "#1a1714",
                  color: i === 0 ? "#c0392b" : "#1a1714",
                  borderRadius: 8,
                  fontSize: 26,
                  fontWeight: 700,
                  maxWidth: 330,
                }}
              >
                {n}
              </div>
            </div>
          ))}
          {nodes.length > 7 && (
            <div style={{ display: "flex", fontSize: 30, color: "#6b6258" }}>
              +{nodes.length - 7} more
            </div>
          )}
        </div>

        <div style={{ display: "flex", flex: 1 }} />
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 28 }}>
          <div style={{ display: "flex" }}>
            {items.length} trade{items.length === 1 ? "" : "s"} · {formatMultiple(currentPrice)} a paperclip
          </div>
          <div style={{ display: "flex", color: "#c0392b", fontWeight: 800 }}>
            now holds: {current} ({formatMoney(currentPrice)})
          </div>
        </div>
      </div>
    ),
    size
  );
}
