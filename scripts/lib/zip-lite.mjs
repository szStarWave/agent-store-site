/**
 * 极简 zip 写入库（仅覆盖市场归档需要的形态）。
 *
 * 为何不用系统 zip / Compress-Archive：与 `tar-lite.mjs` 同一个理由——跨平台一致、
 * 不依赖外部命令。这里还多一条硬要求：市场归档必须是**确定性**的（条目按名排序、
 * mtime 固定、压缩参数固定），否则同一棵树两次打包得到不同字节，而客户端把整包的
 * **sha256 当作 revision** 用——不确定就等于每次刷新都判定「变了」。
 *
 * 与 `release.mjs` 的 `zipSingle` 的关系：那个是单条目（安装包里只有一个 exe），
 * 整包在内存里拼即可；市场归档有一万多个条目、压缩后近 300 MiB，所以这里**流式**
 * 写盘。两处都实现 zip 容器格式，是刻意不合并的：`release.mjs` 在发布关键路径上，
 * 为了共用而改它的风险高于这一段格式代码的重复。**改 zip 容器语义时两处都要看。**
 *
 * 不支持 ZIP64：条目数超过 65535、或任一大小/偏移越过 4 GiB 时**直接抛错**。
 * 写不出就报错，远好过写出一个结构上就坏掉的归档让客户端解压失败。
 */
import { createDeflateRaw } from "node:zlib";
import { createReadStream, createWriteStream, writeFileSync } from "node:fs";
import { once } from "node:events";

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

/** 增量 CRC-32：传入上一段的结果即可连续计算。 */
export function crc32(buf, seed = 0) {
  let crc = seed ^ 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = CRC_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function dosDateTime(d) {
  const time = ((d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1)) & 0xffff;
  const date = (((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()) & 0xffff;
  return { time, date };
}

/** deflate 一个文件，同时算出 CRC 与未压缩长度（不解压即可写本地头）。 */
async function deflateFile(path, level) {
  const chunks = [];
  let crc = 0;
  let usize = 0;
  const dfl = createDeflateRaw({ level });
  const finished = new Promise((res, rej) => {
    dfl.on("data", (c) => chunks.push(c));
    dfl.on("end", res);
    dfl.on("error", rej);
  });
  for await (const chunk of createReadStream(path)) {
    crc = crc32(chunk, crc);
    usize += chunk.length;
    if (!dfl.write(chunk)) await new Promise((r) => dfl.once("drain", r));
  }
  dfl.end();
  await finished;
  return { data: Buffer.concat(chunks), crc, usize };
}

/**
 * 把 `entries`（`{ name, path }`，name 为 POSIX 相对路径）写成一个 zip。
 *
 * `mtime` 由调用方固定（确定性），`level` 固定不变。返回写入的条目数与字节数。
 */
export async function writeZipFile(zipPath, entries, { mtime, level = 6 } = {}) {
  const when = mtime ?? new Date(Date.UTC(2020, 0, 1, 0, 0, 0));
  const { time, date } = dosDateTime(when);
  if (entries.length > 0xffff) {
    throw new Error(`zip 条目数 ${entries.length} 超过 65535，需要 ZIP64（本库刻意不支持）`);
  }

  const out = createWriteStream(zipPath);
  const central = [];
  let offset = 0;

  const write = async (buf) => {
    offset += buf.length;
    if (!out.write(buf)) await once(out, "drain");
  };

  for (const entry of entries) {
    const name = Buffer.from(entry.name, "utf8");
    if (name.includes(0x5c)) throw new Error(`条目名含反斜杠，应为 POSIX 相对路径：${entry.name}`);
    const { data, crc, usize } = await deflateFile(entry.path, level);
    if (offset + 30 + name.length + data.length > 0xffffffff) {
      throw new Error("zip 偏移越过 4 GiB，需要 ZIP64（本库刻意不支持）");
    }

    const lfh = Buffer.alloc(30);
    lfh.writeUInt32LE(0x04034b50, 0);
    lfh.writeUInt16LE(20, 4); // 需要的版本
    lfh.writeUInt16LE(0x0800, 6); // 标志位：UTF-8 条目名
    lfh.writeUInt16LE(8, 8); // deflate 压缩
    lfh.writeUInt16LE(time, 10);
    lfh.writeUInt16LE(date, 12);
    lfh.writeUInt32LE(crc, 14);
    lfh.writeUInt32LE(data.length, 18);
    lfh.writeUInt32LE(usize, 22);
    lfh.writeUInt16LE(name.length, 26);
    lfh.writeUInt16LE(0, 28);

    const cd = Buffer.alloc(46);
    cd.writeUInt32LE(0x02014b50, 0);
    cd.writeUInt16LE(20, 4); // 创建者版本
    cd.writeUInt16LE(20, 6); // 需要的版本
    cd.writeUInt16LE(0x0800, 8);
    cd.writeUInt16LE(8, 10);
    cd.writeUInt16LE(time, 12);
    cd.writeUInt16LE(date, 14);
    cd.writeUInt32LE(crc, 16);
    cd.writeUInt32LE(data.length, 20);
    cd.writeUInt32LE(usize, 24);
    cd.writeUInt16LE(name.length, 28);
    cd.writeUInt32LE(offset, 42); // 本地文件头的相对偏移
    central.push(Buffer.concat([cd, name]));

    const localOffset = offset;
    await write(lfh);
    await write(name);
    await write(data);
    if (offset - localOffset !== 30 + name.length + data.length) {
      throw new Error(`条目 ${entry.name} 写入长度与头部声明不一致`);
    }
  }

  const centralBuf = Buffer.concat(central);
  const centralOffset = offset;
  await write(centralBuf);

  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(entries.length, 8); // 本磁盘上的条目数
  eocd.writeUInt16LE(entries.length, 10); // 条目总数
  eocd.writeUInt32LE(centralBuf.length, 12);
  eocd.writeUInt32LE(centralOffset, 16);
  await write(eocd);

  out.end();
  await once(out, "finish");
  return { entries: entries.length, bytes: offset };
}

/** 小体量（自检/夹具）用：直接给内容，不经过文件系统。 */
export function writeZipFileSync(zipPath, entries, { mtime } = {}) {
  const when = mtime ?? new Date(Date.UTC(2020, 0, 1, 0, 0, 0));
  const { time, date } = dosDateTime(when);
  if (entries.length > 0xffff) throw new Error("条目数超过 65535，需要 ZIP64（不支持）");
  const local = [];
  const central = [];
  let offset = 0;
  for (const entry of entries) {
    const name = Buffer.from(entry.name, "utf8");
    const data = entry.data;
    const crc = crc32(data);
    const lfh = Buffer.alloc(30);
    lfh.writeUInt32LE(0x04034b50, 0);
    lfh.writeUInt16LE(20, 4);
    lfh.writeUInt16LE(0x0800, 6);
    lfh.writeUInt16LE(0, 8); // stored：自检夹具不需要压缩
    lfh.writeUInt16LE(time, 10);
    lfh.writeUInt16LE(date, 12);
    lfh.writeUInt32LE(crc, 14);
    lfh.writeUInt32LE(data.length, 18);
    lfh.writeUInt32LE(data.length, 22);
    lfh.writeUInt16LE(name.length, 26);
    lfh.writeUInt16LE(0, 28);
    local.push(lfh, name, data);

    const cd = Buffer.alloc(46);
    cd.writeUInt32LE(0x02014b50, 0);
    cd.writeUInt16LE(20, 4);
    cd.writeUInt16LE(20, 6);
    cd.writeUInt16LE(0x0800, 8);
    cd.writeUInt16LE(0, 10);
    cd.writeUInt16LE(time, 12);
    cd.writeUInt16LE(date, 14);
    cd.writeUInt32LE(crc, 16);
    cd.writeUInt32LE(data.length, 20);
    cd.writeUInt32LE(data.length, 24);
    cd.writeUInt16LE(name.length, 28);
    cd.writeUInt32LE(offset, 42);
    central.push(cd, name);
    offset += 30 + name.length + data.length;
  }
  const centralBuf = Buffer.concat(central);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralBuf.length, 12);
  eocd.writeUInt32LE(offset, 16);
  writeFileSync(zipPath, Buffer.concat([...local, centralBuf, eocd]));
}
