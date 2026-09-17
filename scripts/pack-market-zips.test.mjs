/**
 * `pack-market-zips.mjs` 与它下面的 `lib/zip-lite.mjs` 的单元测试。
 *
 * 为什么要测一个「打包脚本」：写入器是承重的——它产出的字节就是客户端当作
 * **revision** 用的 sha256 的来源，也是它解压的全部输入。写坏一个 zip 不是「打包
 * 失败」，是每个客户端都装不上市场。而 `check:release` 的另外两道门禁都碰不到它
 * （`check:market` 只看目录树，`check:docs-sync` 只看文档）。
 *
 * 校验刻意**不靠本库自证**：解压用 `node:zlib` 的 `inflateRawSync`，结构与字段按
 * ZIP 规范直接解析字节。本库自己的 `crc32` 只跟已知常量比对（`hello` 的 CRC-32
 * 是 0x3610a686）。
 */
import { describe, expect, test } from "bun:test";
import { readFileSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { inflateRawSync } from "node:zlib";

import { caseCollisions } from "./pack-market-zips.mjs";
import { crc32, writeZipFile, writeZipFileSync } from "./lib/zip-lite.mjs";

const EOCD_SIG = 0x06054b50;
const CENTRAL_SIG = 0x02014b50;
const LOCAL_SIG = 0x04034b50;

/** 按 ZIP 规范解析归档字节（不使用本库的解析逻辑——它没有解析逻辑）。 */
function readZip(buf) {
  const eocd = buf.length - 22;
  expect(buf.readUInt32LE(eocd)).toBe(EOCD_SIG);
  const count = buf.readUInt16LE(eocd + 10);
  const cdSize = buf.readUInt32LE(eocd + 12);
  const cdOffset = buf.readUInt32LE(eocd + 16);
  // 中央目录必须紧贴 EOCD 之前：偏移与大小自洽。
  expect(cdOffset + cdSize).toBe(eocd);

  const entries = [];
  let at = cdOffset;
  for (let i = 0; i < count; i++) {
    expect(buf.readUInt32LE(at)).toBe(CENTRAL_SIG);
    const method = buf.readUInt16LE(at + 10);
    const dosTime = buf.readUInt16LE(at + 12);
    const dosDate = buf.readUInt16LE(at + 14);
    const crc = buf.readUInt32LE(at + 16);
    const compSize = buf.readUInt32LE(at + 20);
    const usize = buf.readUInt32LE(at + 24);
    const nameLen = buf.readUInt16LE(at + 28);
    const extraLen = buf.readUInt16LE(at + 30);
    const commentLen = buf.readUInt16LE(at + 32);
    const localOffset = buf.readUInt32LE(at + 42);
    const name = buf.subarray(at + 46, at + 46 + nameLen).toString("utf8");

    // 本地头的名字长度必须与中央目录一致，否则偏移算错、客户端解出垃圾。
    expect(buf.readUInt32LE(localOffset)).toBe(LOCAL_SIG);
    expect(buf.readUInt16LE(localOffset + 26)).toBe(nameLen);
    const localExtraLen = buf.readUInt16LE(localOffset + 28);
    const dataAt = localOffset + 30 + nameLen + localExtraLen;
    entries.push({
      name,
      method,
      dosTime,
      dosDate,
      crc,
      usize,
      raw: buf.subarray(dataAt, dataAt + compSize),
    });
    at += 46 + nameLen + extraLen + commentLen;
  }
  expect(at).toBe(cdOffset + cdSize);
  return entries;
}

async function withTempDir(fn) {
  const dir = mkdtempSync(path.join(tmpdir(), "zip-lite-test-"));
  try {
    // Must await: a `finally` around a *returned* promise would delete the
    // directory before an async body ever ran.
    return await fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const MTIME = new Date(Date.UTC(2020, 0, 1, 0, 0, 0));

describe("crc32", () => {
  test("matches known CRC-32 constants", () => {
    expect(crc32(Buffer.from("hello"))).toBe(0x3610a686);
    expect(crc32(Buffer.alloc(0))).toBe(0);
    // 增量调用必须等于一次性调用（写入器是边读边算的）。
    const once = crc32(Buffer.from("hello world"));
    const chunked = crc32(Buffer.from(" world"), crc32(Buffer.from("hello")));
    expect(chunked).toBe(once);
  });
});

describe("writeZipFile", () => {
  test("is byte-identical across runs, and its deflate payload inflates back", async () => {
    await withTempDir(async (dir) => {
      const src = path.join(dir, "a.txt");
      const body = "hello world\n".repeat(1000);
      writeFileSync(src, body);

      const first = path.join(dir, "one.zip");
      const second = path.join(dir, "two.zip");
      await writeZipFile(first, [{ name: "dir/a.txt", path: src }], { mtime: MTIME });
      await writeZipFile(second, [{ name: "dir/a.txt", path: src }], { mtime: MTIME });

      // 确定性：客户端把 sha256 当 revision，字节不同就等于「市场变了」。
      expect(readFileSync(first).equals(readFileSync(second))).toBe(true);

      const entries = readZip(readFileSync(first));
      expect(entries.length).toBe(1);
      const [entry] = entries;
      expect(entry.name).toBe("dir/a.txt");
      expect(entry.method).toBe(8); // deflate
      expect(entry.crc).toBe(crc32(Buffer.from(body)));
      expect(entry.usize).toBe(Buffer.byteLength(body));
      // 独立复核：用 zlib 解压，内容必须原样回来。
      expect(inflateRawSync(entry.raw).toString("utf8")).toBe(body);
    });
  });

  test("writes the caller's fixed mtime (that is what makes it deterministic)", async () => {
    await withTempDir(async (dir) => {
      const src = path.join(dir, "a.txt");
      writeFileSync(src, "x");
      const a = path.join(dir, "a.zip");
      const b = path.join(dir, "b.zip");
      await writeZipFile(a, [{ name: "a.txt", path: src }], { mtime: MTIME });
      await writeZipFile(b, [{ name: "a.txt", path: src }], {
        mtime: new Date(Date.UTC(2021, 5, 15, 12, 30, 0)),
      });
      const [ea] = readZip(readFileSync(a));
      const [eb] = readZip(readFileSync(b));
      expect([ea.dosDate, ea.dosTime]).not.toEqual([eb.dosDate, eb.dosTime]);
    });
  });

  test("keeps the market root layout across many entries", async () => {
    await withTempDir(async (dir) => {
      const names = [
        ".codebuddy-plugin/marketplace.json",
        "plugins/demo/.codebuddy-plugin/plugin.json",
        "plugins/demo/agents/demo.md",
      ];
      const entries = names.map((name, index) => {
        const file = path.join(dir, `f${index}`);
        writeFileSync(file, `body ${name}`);
        return { name, path: file };
      });
      const zip = path.join(dir, "market.zip");
      const result = await writeZipFile(zip, entries, { mtime: MTIME });
      expect(result.entries).toBe(3);
      const read = readZip(readFileSync(zip));
      expect(read.map((e) => e.name)).toEqual(names);
      for (const [index, entry] of read.entries()) {
        expect(inflateRawSync(entry.raw).toString("utf8")).toBe(`body ${names[index]}`);
      }
    });
  });

  test("refuses an entry name with a backslash instead of writing a broken archive", async () => {
    await withTempDir(async (dir) => {
      const src = path.join(dir, "a.txt");
      writeFileSync(src, "x");
      await expect(
        writeZipFile(path.join(dir, "bad.zip"), [{ name: "a\\b.txt", path: src }], { mtime: MTIME }),
      ).rejects.toThrow(/反斜杠/);
    });
  });
});

describe("writeZipFileSync", () => {
  test("stores (no compression) and round-trips", async () => {
    await withTempDir((dir) => {
      const zip = path.join(dir, "s.zip");
      writeZipFileSync(zip, [
        { name: "a.txt", data: Buffer.from("hi") },
        { name: "b/c.txt", data: Buffer.from("there") },
      ], { mtime: MTIME });
      const entries = readZip(readFileSync(zip));
      expect(entries.map((e) => e.name)).toEqual(["a.txt", "b/c.txt"]);
      for (const entry of entries) expect(entry.method).toBe(0); // stored
      expect(entries[0].raw.toString("utf8")).toBe("hi");
      expect(entries[1].raw.toString("utf8")).toBe("there");
    });
  });
});

describe("caseCollisions", () => {
  test("accepts names that differ by more than case", () => {
    expect(caseCollisions(["Icons/a.svg", "icons/b.svg", "readme.md"])).toEqual([]);
    // 完全相同的名字不是「碰撞」：同一条路径，由清单的重复登记规则去管。
    expect(caseCollisions(["a.txt", "a.txt"])).toEqual([]);
  });

  test("reports two names a Windows client could not both unpack", () => {
    expect(caseCollisions(["Icons/a.svg", "icons/A.svg"])).toEqual([
      ["Icons/a.svg", "icons/A.svg"],
    ]);
    expect(caseCollisions(["a", "A"])).toEqual([["a", "A"]]);
  });
});
