import { test } from "bun:test";
import assert from "node:assert/strict";
import { pickEspnLogo } from "./espn.server.ts";

test("prefers the logo string when ESPN sends one", () => {
  assert.equal(
    pickEspnLogo({ abbreviation: "HOU", logo: "https://cdn/hou.png" }),
    "https://cdn/hou.png",
  );
});

test("reads logos[] default href from a summary header team", () => {
  assert.equal(
    pickEspnLogo({
      abbreviation: "LV",
      logos: [
        { href: "https://cdn/dark.png", rel: ["full", "dark"] },
        { href: "https://cdn/lv.png", rel: ["full", "default"] },
      ],
    }),
    "https://cdn/lv.png",
  );
});

test("falls back to the ESPN CDN slug when the payload has neither", () => {
  assert.equal(
    pickEspnLogo({ abbreviation: "WSH" }),
    "https://a.espncdn.com/i/teamlogos/nfl/500/wsh.png",
  );
});
