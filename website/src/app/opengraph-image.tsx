import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { ImageResponse } from "next/og";

export const alt =
  "PURE Osaka - Premium nightlife in Shinsaibashi, Osaka";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default async function OpenGraphImage() {
  const [logoData, migraFont, universFont] = await Promise.all([
    readFile(join(process.cwd(), "public/pure/purelogo.png"), "base64"),
    readFile(join(process.cwd(), "public/the-cross/Migra-Regular.ttf")),
    readFile(join(process.cwd(), "public/the-cross/UniversLTPro55Roman.ttf")),
  ]);

  return new ImageResponse(
    (
      <div
        style={{
          position: "relative",
          display: "flex",
          width: "100%",
          height: "100%",
          overflow: "hidden",
          color: "#f8f3e7",
          background:
            "linear-gradient(135deg, #07080b 0%, #121017 58%, #270b17 100%)",
          fontFamily: "Univers",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: -210,
            right: -140,
            display: "flex",
            width: 720,
            height: 720,
            border: "1px solid rgba(242, 160, 187, 0.24)",
            borderRadius: "50%",
            boxShadow: "0 0 130px rgba(207, 38, 91, 0.22)",
          }}
        />
        <div
          style={{
            position: "absolute",
            right: 44,
            bottom: -340,
            display: "flex",
            color: "rgba(248, 243, 231, 0.035)",
            fontFamily: "Migra",
            fontSize: 390,
            letterSpacing: "-0.08em",
          }}
        >
          PURE
        </div>

        <div
          style={{
            position: "relative",
            display: "flex",
            width: "100%",
            height: "100%",
            flexDirection: "column",
            justifyContent: "space-between",
            padding: "54px 66px 58px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              color: "#f2a0bb",
              fontSize: 19,
              fontWeight: 700,
              letterSpacing: "0.28em",
              textTransform: "uppercase",
            }}
          >
            Shinsaibashi, Osaka / Since 2004
          </div>

          <div style={{ display: "flex", flexDirection: "column" }}>
            <img
              src={`data:image/png;base64,${logoData}`}
              alt=""
              width={224}
              height={224}
              style={{
                width: 224,
                height: 224,
                margin: "0 0 -8px -44px",
                objectFit: "contain",
              }}
            />
            <div
              style={{
                display: "flex",
                maxWidth: 760,
                fontFamily: "Migra",
                fontSize: 58,
                lineHeight: 1.02,
                letterSpacing: "-0.02em",
              }}
            >
              Premium Nightlife in Osaka
            </div>
            <div
              style={{
                display: "flex",
                marginTop: 22,
                color: "rgba(248, 243, 231, 0.74)",
                fontSize: 20,
                letterSpacing: "0.12em",
              }}
            >
              HIPHOP · LATIN · REGGAETON
            </div>
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        {
          name: "Migra",
          data: migraFont,
          style: "normal",
          weight: 400,
        },
        {
          name: "Univers",
          data: universFont,
          style: "normal",
          weight: 400,
        },
      ],
    },
  );
}
