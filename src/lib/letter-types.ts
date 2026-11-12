// Contract for the "Service charge letter" feature. Client-safe (types only).
import type { Status } from "./explain-types";

export type UnitOption = {
  unitId: string;
  unitNumber: string;
  sharePct: number; // service_charge_share_pct for this unit
  leaseholderName: string | null;
};

export type LetterLine = {
  category: string;
  label: string;
  prevGbp: number | null;
  currGbp: number;
  changeGbp: number | null;
  changePct: number | null;
  status: Status;
  coveragePct: number;
  /** Plain-English explanation (AI-drafted from found evidence, user-editable) */
  explanation: string;
  /** Short evidence citations, e.g. "Invoice INV-632674 (Swift Lift Engineering, 23 Feb 2026, £1,977.82) — paid 9 Mar 2026" */
  evidenceRefs: string[];
  /** Whether to include this line in the letter (user decision in review step) */
  include: boolean;
};

export type LetterDraft = {
  buildingId: string;
  buildingName: string;
  buildingAddress: string;
  years: { prev: string | null; curr: string };
  totals: { prevGbp: number | null; currGbp: number };
  /** Cover paragraph (AI-drafted, user-editable) */
  intro: string;
  lines: LetterLine[];
  generatedBy: string; // model name, or "template"
};

/** POST /api/letters/pdf body. Server re-derives all money from Cortile; only text + include flags come from the client. */
export type LetterPdfRequest = {
  buildingId: string;
  unitId: string | null; // null = whole-building statement
  recipientName: string | null;
  intro: string;
  lines: { category: string; include: boolean; explanation: string }[];
};
