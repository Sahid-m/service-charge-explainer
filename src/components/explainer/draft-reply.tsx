"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Copy, Sparkles, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function useDraftReply() {
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [usedLLM, setUsedLLM] = useState(false);

  async function generate(buildingId: string) {
    setLoading(true);
    try {
      const res = await fetch("/api/draft-reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ building: buildingId }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const j = (await res.json()) as { draft: string; usedLLM: boolean };
      setDraft(j.draft);
      setUsedLLM(j.usedLLM);
      setOpen(true);
    } catch (e) {
      toast.error(`Could not draft reply: ${(e as Error).message}`);
    } finally {
      setLoading(false);
    }
  }
  return { loading, open, setOpen, draft, usedLLM, generate };
}

export function DraftReplyDialog({
  state,
  buildingName,
}: {
  state: ReturnType<typeof useDraftReply>;
  buildingName: string;
}) {
  const { open, setOpen, draft, usedLLM } = state;
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <div className="flex flex-wrap items-center gap-2">
            <DialogTitle>Draft reply to owner</DialogTitle>
            {usedLLM ? (
              <Badge className="gap-1">
                <Sparkles className="size-3" /> Written by GPT
              </Badge>
            ) : (
              <Badge variant="secondary" className="gap-1">
                <FileText className="size-3" /> Template — no AI key configured
              </Badge>
            )}
          </div>
          <DialogDescription>
            A plain-English answer for a leaseholder at {buildingName}. It cites
            only the evidence we found. Review before sending.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-auto rounded-lg border bg-muted/30 p-5 text-[15px] leading-relaxed whitespace-pre-wrap">
          {draft}
        </div>
        <DialogFooter>
          <Button
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(draft);
                toast.success("Reply copied to clipboard");
              } catch {
                toast.error("Copy failed");
              }
            }}
          >
            <Copy className="size-4" /> Copy reply
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
