"use client";

import { useRef, useState } from "react";
import { Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function UploadDocs({
  buildingId,
  onUploaded,
}: {
  buildingId: string;
  onUploaded: () => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function upload(list: FileList | File[] | null) {
    const files = Array.from(list ?? []);
    if (files.length === 0) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("building", buildingId);
      files.forEach((f) => fd.append("file", f));
      const res = await fetch("/api/docs/upload", { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      const n = data.saved?.length ?? files.length;
      toast.success(`Uploaded ${n} document(s) — re-matching evidence…`);
      onUploaded();
    } catch (e) {
      toast.error(`Upload failed: ${(e as Error).message}`);
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <>
      <input
        ref={input}
        type="file"
        accept="application/pdf"
        multiple
        hidden
        onChange={(e) => void upload(e.target.files)}
      />
      <Button
        variant="outline"
        size="sm"
        disabled={busy}
        onClick={() => input.current?.click()}
        title="PDFs are read by AI, then matched to tickets and payments in code."
      >
        {busy ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Upload className="size-4" />
        )}
        {busy ? "Uploading…" : "Upload invoice PDF"}
      </Button>
    </>
  );
}
