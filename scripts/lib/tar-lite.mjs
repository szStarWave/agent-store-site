/**
 * 极简 tar 读取/解包库（仅覆盖专家 bundle 需要的形态）。
 *
 * Why not the system tar: Windows 自带 bsdtar 在中文文件名上会因代码页问题失败
 * （`Invalid empty pathname`），导致解包中断且残留半成品目录。这里直接按 tar 块解析，
 * 文件名按 UTF-8 还原，跨平台一致。
 *
 * 支持：ustar 前缀、PAX 扩展头（x/g）、GNU longname（L/longlink K）、普通文件、目录、软链。
 * 不支持：稀疏文件、设备节点（会跳过并记入 skipped）。
 */
import { gunzipSync } from "node:zlib";
import { mkdirSync, writeFileSync, rmSync, symlinkSync } from "node:fs";
import { dirname, join, normalize, resolve, relative, isAbsolute } from "node:path";

const BLOCK = 512;

function cstr(buf, start, len) {
  const slice = buf.subarray(start, start + len);
  const end = slice.indexOf(0);
  return slice.subarray(0, end === -1 ? slice.length : end).toString("utf8");
}

function octal(buf, start, len) {
  const s = cstr(buf, start, len).trim().replace(/\0/g, "");
  if (!s) return 0;
  const n = parseInt(s, 8);
  return Number.isFinite(n) ? n : 0;
}

function parsePax(buf) {
  const out = {};
  let i = 0;
  while (i < buf.length) {
    let sp = buf.indexOf(0x20, i);
    if (sp === -1) break;
    const len = parseInt(buf.subarray(i, sp).toString("ascii"), 10);
    if (!Number.isFinite(len) || len <= 0) break;
    const record = buf.subarray(sp + 1, i + len).toString("utf8").replace(/\n$/, "");
    const eq = record.indexOf("=");
    if (eq > 0) out[record.slice(0, eq)] = record.slice(eq + 1);
    i += len;
  }
  return out;
}

/** 返回 [{ name, size, type, dataStart, dataEnd, linkname }]，name 已去掉开头的 "./"。 */
export function listEntries(tarBuf) {
  const entries = [];
  let off = 0;
  let pendingPath = null;
  let pendingLink = null;
  while (off + BLOCK <= tarBuf.length) {
    const header = tarBuf.subarray(off, off + BLOCK);
    if (header.every((b) => b === 0)) break;
    const rawName = cstr(header, 0, 100);
    const type = String.fromCharCode(header[156] || 0x30);
    const size = octal(header, 124, 12);
    const prefix = cstr(header, 345, 155);
    const linkname = cstr(header, 157, 100);
    const dataStart = off + BLOCK;
    const dataEnd = dataStart + size;
    const next = dataStart + Math.ceil(size / BLOCK) * BLOCK;

    if (type === "x" || type === "g") {
      const pax = parsePax(tarBuf.subarray(dataStart, dataEnd));
      if (pax.path) pendingPath = pax.path;
      if (pax.linkpath) pendingLink = pax.linkpath;
      off = next;
      continue;
    }
    if (type === "L" || type === "K") {
      const val = tarBuf.subarray(dataStart, dataEnd).toString("utf8").replace(/\0+$/, "").replace(/\n$/, "");
      if (type === "L") pendingPath = val;
      else pendingLink = val;
      off = next;
      continue;
    }

    let name = pendingPath ?? (prefix ? `${prefix}/${rawName}` : rawName);
    name = name.replace(/^\.\//, "").replace(/\/+$/, "");
    const entry = {
      name,
      size,
      type,
      dataStart,
      dataEnd,
      linkname: pendingLink ?? linkname,
    };
    entries.push(entry);
    pendingPath = null;
    pendingLink = null;
    off = next;
  }
  return entries;
}

/** 把 tar 条目还原到 destDir；返回统计与失败清单。 */
export function extractEntries(tarBuf, entries, destDir) {
  const result = { files: 0, dirs: 0, symlinks: 0, skipped: [], errors: [] };
  const root = resolve(destDir);
  rmSync(root, { recursive: true, force: true });
  mkdirSync(root, { recursive: true });
  for (const e of entries) {
    if (!e.name) continue;
    const target = resolve(root, e.name);
    const rel = relative(root, target);
    if (rel.startsWith("..") || isAbsolute(rel)) {
      result.errors.push({ name: e.name, reason: "path escapes dest" });
      continue;
    }
    try {
      if (e.type === "5") {
        mkdirSync(target, { recursive: true });
        result.dirs++;
      } else if (e.type === "0" || e.type === "\0" || e.type === "7") {
        mkdirSync(dirname(target), { recursive: true });
        writeFileSync(target, tarBuf.subarray(e.dataStart, e.dataEnd));
        result.files++;
      } else if (e.type === "2") {
        mkdirSync(dirname(target), { recursive: true });
        try {
          symlinkSync(e.linkname, target);
          result.symlinks++;
        } catch {
          result.skipped.push({ name: e.name, reason: `symlink -> ${e.linkname}` });
        }
      } else {
        result.skipped.push({ name: e.name, reason: `type ${e.type}` });
      }
    } catch (err) {
      result.errors.push({ name: e.name, reason: err.message });
    }
  }
  return result;
}

export function readEntry(tarBuf, entries, wanted) {
  const want = wanted.replace(/^\.\//, "");
  const e = entries.find((x) => x.name === want);
  if (!e) return null;
  return tarBuf.subarray(e.dataStart, e.dataEnd);
}

export function gunzip(buf) {
  return gunzipSync(buf);
}
