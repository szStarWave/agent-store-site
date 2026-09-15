import { describe, expect, test } from "bun:test";

import {
  checkManifestDuplicates,
  checkMarkets,
  checkSnapshot,
  compareListing,
  readSnapshot,
} from "./check-market.mjs";

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

describe("this repository's markets", () => {
  test("snapshot and tree agree, with no duplicate entries", async () => {
    const snapshot = readSnapshot();
    const results = await checkMarkets(snapshot);

    expect(results.map((result) => result.market)).toEqual(["experts", "skills", "connectors"]);
    expect(results.flatMap((result) => result.findings)).toEqual([]);
    expect([snapshot.experts.length, snapshot.skills.length, snapshot.connectors.length]).toEqual([
      13, 268, 228,
    ]);
  });
});
