import { mkdir, writeFile, access } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

const MAX_BYTES = 10 * 1024 * 1024;

function bad(error: string) {
  return NextResponse.json({ error }, { status: 400 });
}

async function exists(p: string) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return bad("Expected multipart/form-data");
  }
  const building = String(form.get("building") ?? "").replace(
    /[^A-Za-z0-9_-]/g,
    "",
  );
  if (!building) return bad("Missing building");
  const files = form
    .getAll("file")
    .filter((f): f is File => typeof f !== "string");
  if (files.length === 0) return bad("No file provided");

  const checked: { base: string; buf: Buffer }[] = [];
  for (const f of files) {
    if (f.type !== "application/pdf") return bad(`${f.name}: not a PDF`);
    if (f.size > MAX_BYTES) return bad(`${f.name}: larger than 10 MB`);
    const buf = Buffer.from(await f.arrayBuffer());
    if (buf.subarray(0, 5).toString("latin1") !== "%PDF-")
      return bad(`${f.name}: not a valid PDF`);
    const base =
      path
        .basename(f.name)
        .replace(/\.pdf$/i, "")
        .replace(/[^A-Za-z0-9._-]+/g, "_")
        .replace(/^\.+/, "")
        .slice(0, 100) || "document";
    checked.push({ base, buf });
  }

  const dir = path.join(process.cwd(), "data", "docs", building);
  await mkdir(dir, { recursive: true });
  const saved: { name: string; link: string }[] = [];
  for (const { base, buf } of checked) {
    let name = `${base}.pdf`;
    for (let i = 1; await exists(path.join(dir, name)); i++) {
      name = `${base}-${i}.pdf`;
    }
    await writeFile(path.join(dir, name), buf);
    saved.push({
      name,
      link: `/api/docs/${building}/${encodeURIComponent(name)}`,
    });
  }
  return NextResponse.json({ saved });
}
