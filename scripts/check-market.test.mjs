import { describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  checkManifestDuplicates,
  checkMarkets,
  checkSnapshot,
  compareDeliverable,
  compareIgnoreRules,
  compareListing,
  readSnapshot,
} from "./check-market.mjs";
import { listFiles } from "./sync-market-tree.mjs";

const rules = (findings) => findings.map((finding) => finding.rule);

describe("checkManifestDuplicates", () => {
  test("accepts a manifest whose identities are unique", () => {
    const entries = [
      { id: "a", name: "甲", source: "a" },
      { id: "b", name: "乙", source: "b" },
    ];
    expect(checkManifestDuplicates("connectors", entries)).toEqual([]);
  });

  test("rejects a source registered twice, pointing at both indexes", () => {
    const findings = checkManifestDuplicates("connectors", [
      { id: "a", source: "a" },
      { id: "b", source: "x" },
      { id: "c", source: "x" },
    ]);
    expect(rules(findings)).toEqual(["manifest.duplicate"]);
    expect(findings[0].message).toContain('source "x" 2×');
    expect(findings[0].message).toContain("entries[1], entries[2]");
  });

  test("falls back to name when a connector declares no id", () => {
    expect(rules(checkManifestDuplicates("connectors", [{ name: "丙" }, { name: "丙" }]))).toEqual([
      "manifest.duplicate",
    ]);
  });

  test("rejects a duplicated skill name even when the sources differ", () => {
    const findings = checkManifestDuplicates("skills", [
      { name: "同名", source: "a" },
      { name: "同名", source: "b" },
    ]);
    expect(rules(findings)).toEqual(["manifest.duplicate"]);
    expect(findings[0].message).toContain('name "同名" 2×');
  });

  test("ignores entries with no identity at all", () => {
    expect(checkManifestDuplicates("connectors", [{}, {}])).toEqual([]);
  });
});

describe("checkSnapshot", () => {
  const base = { base: "source", fileExists: () => true };

  test("accepts a snapshot that matches its manifest", () => {
    const findings = checkSnapshot("connectors", {
      ...base,
      manifestEntries: [{ id: "a", source: "a" }],
      snapshotEntries: [{ id: "a", name: "甲", avatar: "source/connectors/icons/a.png" }],
    });
    expect(findings).toEqual([]);
  });

  test("reports a count mismatch — one artifact committed without the other", () => {
    const findings = checkSnapshot("connectors", {
      ...base,
      manifestEntries: [{ id: "a" }, { id: "b" }],
      snapshotEntries: [{ id: "a" }],
    });
    // Two facts, both worth reporting: the totals disagree, and "b" is the one lost.
    expect(rules(findings)).toEqual(["snapshot.count", "snapshot.entry"]);
    expect(findings[0].message).toContain("manifest has 2 entr(ies), content/market.json has 1");
    expect(findings[1].message).toContain('missing "b"');
  });

  test("reports an entry the snapshot lost and one it invented", () => {
    const findings = checkSnapshot("skills", {
      ...base,
      manifestEntries: [{ source: "kept" }, { source: "lost" }],
      snapshotEntries: [{ source: "kept" }, { source: "extra" }],
    });
    expect(rules(findings)).toEqual(["snapshot.entry", "snapshot.entry"]);
    expect(findings[0].message).toContain('missing "lost"');
    expect(findings[1].message).toContain('has "extra" which the manifest does not list');
  });

  test("reports an avatar path with no file behind it", () => {
    const findings = checkSnapshot("connectors", {
      base: "source",
      fileExists: (rel) => rel !== "connectors/icons/gone.png",
      manifestEntries: [{ id: "gone" }],
      snapshotEntries: [{ id: "gone", name: "走失", avatar: "source/connectors/icons/gone.png" }],
    });
    expect(rules(findings)).toEqual(["snapshot.avatar-missing"]);
    expect(findings[0].message).toContain("(走失)");
    expect(findings[0].message).toContain("connectors/icons/gone.png");
  });

  test("only checks the count for experts, whose snapshot names come from the plugin", () => {
    const findings = checkSnapshot("experts", {
      ...base,
      manifestEntries: [{ name: "senior-developer", source: "./plugins/senior-developer" }],
      snapshotEntries: [{ name: "高级开发工程师", avatar: null }],
    });
    expect(findings).toEqual([]);
  });

  test("flags an unexpected base instead of every avatar path", () => {
    const findings = checkSnapshot("skills", {
      base: "icons",
      fileExists: () => false,
      manifestEntries: [],
      snapshotEntries: [],
    });
    expect(rules(findings)).toEqual(["snapshot.base"]);
  });
});

describe("compareListing", () => {
  test("accepts a listing that covers the tree exactly", () => {
    expect(compareListing("skills", ["a.md", "b/c.png"], ["a.md", "b/c.png"])).toEqual([]);
  });

  test("reports files the listing misses", () => {
    expect(rules(compareListing("skills", ["a.md"], ["a.md", "b.md"]))).toEqual(["listing.missing"]);
  });

  test("reports entries the tree does not have", () => {
    expect(rules(compareListing("skills", ["a.md", "b.md"], ["a.md"]))).toEqual(["listing.phantom"]);
  });

  test("reports a listing that lists itself", () => {
    expect(rules(compareListing("skills", ["a.md", "_files.txt"], ["a.md"]))).toContain("listing.self");
  });

  test("reports a line that survived a merge twice", () => {
    expect(rules(compareListing("skills", ["a.md", "a.md"], ["a.md"]))).toEqual(["listing.duplicate"]);
  });

  test("reports an illegal path", () => {
    const findings = compareListing("skills", ["a.md", "../outside.md"], ["a.md"]);
    expect(rules(findings)).toContain("listing.illegal");
  });
});

describe("compareDeliverable", () => {
  test("accepts a listing whose paths git delivers", () => {
    expect(compareDeliverable("experts", ["plugins/a/x.md"], new Set())).toEqual([]);
  });

  test("reports an advertised path git would refuse to add", () => {
    const findings = compareDeliverable(
      "experts",
      ["plugins/a/ok.md", "plugins/a/.codebuddy/agents/p.md"],
      new Set(["market-source/experts/plugins/a/.codebuddy/agents/p.md"]),
    );
    expect(rules(findings)).toEqual(["listing.undeliverable"]);
    expect(findings[0].message).toContain("plugins/a/.codebuddy/agents/p.md");
  });

  test("ignores a refusal in another market", () => {
    const ignored = new Set(["market-source/skills/skills/s/.codebuddy/agents/p.md"]);
    expect(compareDeliverable("experts", ["plugins/a/x.md"], ignored)).toEqual([]);
  });
});

describe("compareIgnoreRules", () => {
  const probe = "market-source/experts/plugins/_probe/build/out.js";

  test("accepts probes no ignore rule matches", () => {
    expect(compareIgnoreRules("experts", [probe], new Map())).toEqual([]);
  });

  test("reports a rule that catches payload inside the tree", () => {
    const findings = compareIgnoreRules("experts", [probe], new Map([[probe, ".gitignore:5:build/"]]));
    expect(rules(findings)).toEqual(["ignore.market-tree"]);
    expect(findings[0].message).toContain("plugins/_probe/build/out.js");
    expect(findings[0].message).toContain(".gitignore:5:build/");
  });

  test("mentions how many further probes the same rule caught", () => {
    const tmp = "market-source/experts/plugins/_probe/tmp/a.txt";
    const findings = compareIgnoreRules(
      "experts",
      [probe, tmp],
      new Map([
        [probe, ".gitignore:5:build/"],
        [tmp, ".gitignore:9:tmp/"],
      ]),
    );
    expect(findings[0].message).toContain("(+1 more)");
  });
});

describe("this repository's markets", () => {
  test("snapshot and tree agree, with no duplicate entries", async () => {
    const snapshot = readSnapshot();
    const results = await checkMarkets(snapshot);

    expect(results.map((result) => result.market)).toEqual(["experts", "skills", "connectors"]);
    expect(results.flatMap((result) => result.findings)).toEqual([]);
    expect([snapshot.experts.length, snapshot.skills.length, snapshot.connectors.length]).toEqual([
      381, 268, 228,
    ]);
  });

  // Rule 6 (`listing.undeliverable`) is the one rule that shells out to git, so
  // it runs from the CLI, not from `checkMarkets` above. Its comparison is
  // covered by `compareDeliverable`; what is left to pin here is the exclusion
  // rule that keeps junk out of the listing in the first place.
});

describe("listFiles", () => {
  const fixture = async (files) => {
    const dir = await mkdtemp(path.join(tmpdir(), "market-fixture-"));
    for (const rel of files) {
      await mkdir(path.dirname(path.join(dir, rel)), { recursive: true });
      await writeFile(path.join(dir, rel), "");
    }
    return dir;
  };

  test("skips the junk names git refuses to deliver, at any depth", async () => {
    const dir = await fixture([
      "plugins/a/.DS_Store",
      "plugins/a/avatars/.DS_Store",
      "plugins/a/Thumbs.db",
      "plugins/a/README.md",
    ]);
    try {
      expect(await listFiles(dir)).toEqual(["plugins/a/README.md"]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test("keeps a `.codebuddy/` directory inside a market tree", async () => {
    // The name is only special at the repository root (`.gitignore` anchors it
    // there): the skills market ships `…/skills/<skill>/.codebuddy/` payload.
    const dir = await fixture(["plugins/a/skills/s/.codebuddy/agents/one.md"]);
    try {
      expect(await listFiles(dir)).toEqual(["plugins/a/skills/s/.codebuddy/agents/one.md"]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
