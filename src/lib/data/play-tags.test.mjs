import { test } from "bun:test";
import assert from "node:assert/strict";
import { playMentionsTracked, tagPlayText, trackedForGame } from "./play-tags.ts";

const player = (id, first, last, team, position = "WR") => ({
  player_id: id,
  full_name: `${first} ${last}`,
  first_name: first,
  last_name: last,
  position,
  team,
});

const t = (p, side = "mine") => ({ player: p, side, slot: "WR", club: "Club", points: 1, stats: null });

const collins = t(player("1", "Nico", "Collins", "HOU"));
const stroud = t(player("2", "C.J.", "Stroud", "HOU", "QB"));
const smith = t(player("3", "Geno", "Smith", "LV", "QB"), "opp");
const stBrown = t(player("4", "Amon-Ra", "St. Brown", "DET"));

test("tags ESPN initial.last mentions", () => {
  const segs = tagPlayText("(Shotgun) C.Stroud pass short right to N.Collins to LV 38 for 11 yards.", [
    collins,
    stroud,
  ]);
  const players = segs.filter((s) => s.kind === "player").map((s) => s.tracked.player.player_id);
  assert.deepEqual(players, ["2", "1"]);
  assert.equal(segs.map((s) => s.text).join(""), "(Shotgun) C.Stroud pass short right to N.Collins to LV 38 for 11 yards.");
});

test("tags full names in scoring summaries", () => {
  const segs = tagPlayText("Nico Collins 20 Yd pass from C.J. Stroud (Ka'imi Fairbairn Kick)", [collins, stroud]);
  assert.equal(segs.filter((s) => s.kind === "player").length, 2);
});

test("last name alone is not a hit", () => {
  assert.equal(playMentionsTracked("T.Smith up the middle for 3 yards.", [smith]), false);
  assert.equal(playMentionsTracked("G.Smith pass incomplete.", [smith]), true);
});

test("dotted and hyphenated surnames", () => {
  assert.equal(playMentionsTracked("A.St. Brown to DET 40 for 9 yards.", [stBrown]), true);
  assert.equal(playMentionsTracked("A.St.Brown to DET 40.", [stBrown]), true);
});

test("no tracked players → one plain run", () => {
  assert.deepEqual(tagPlayText("x", []), [{ kind: "text", text: "x", start: 0 }]);
});

test("trackedForGame picks both sides' starters in this game, mine first", () => {
  const pair = {
    matchupId: 1,
    home: {
      rosterId: 7,
      teamName: "Me",
      manager: "me",
      avatar: null,
      points: 10,
      starters: [
        { slot: "QB", playerId: "2", player: stroud.player, points: 14.4, game: null },
        { slot: "WR", playerId: "9", player: player("9", "Puka", "Nacua", "LAR"), points: 3, game: null },
      ],
    },
    away: {
      rosterId: 8,
      teamName: "Dave",
      manager: "dave",
      avatar: null,
      points: 3,
      starters: [{ slot: "QB", playerId: "3", player: smith.player, points: 3.1, game: null }],
    },
  };
  const game = { home: { abbr: "HOU" }, away: { abbr: "LV" } };
  const out = trackedForGame(pair, 7, game, { 2: { pass_yd: 186 } });
  assert.deepEqual(
    out.map((x) => [x.player.player_id, x.side, x.club]),
    [
      ["2", "mine", "Me"],
      ["3", "opp", "Dave"],
    ],
  );
  assert.deepEqual(out[0].stats, { pass_yd: 186 });
  assert.deepEqual(trackedForGame(pair, 99, game, null), []);
});
