// Shared contract between the matcher API and the UI. Client-safe (types only).

export type Status = "explained" | "partial" | "not_found";

export type TicketEvidence = {
  id: string;
  title: string;
  date: string;
  category: string;
  contractor: string | null;
  costGbp: number | null;
  status: string;
};

export type EmailEvidenceLite = {
  id: string;
  from: string;
  date: string;
  subject: string;
  amountsGbp: number[];
  invoiceNumbers: string[];
  attachments: string[]; // filenames
  /** Where the invoice came from: an email in Gmail or a PDF document */
  source?: "gmail" | "pdf";
  link: string;
};

export type PaymentEvidence = {
  date: string;
  amountGbp: number; // positive = money out
  payee: string;
  source: "truelayer" | "csv";
  account?: string;
};

export type DocEvidenceLite = {
  id: string;
  name: string;
  kind: "lease" | "insurance" | "management_agreement" | "other";
  link: string;
  /** One-line AI summary of what the document says (if AI is configured) */
  summary?: string;
};

/** One costed piece of work traced as far as evidence allows: ticket → invoice email → bank payment. */
export type EvidenceChain = {
  amountGbp: number;
  ticket?: TicketEvidence;
  email?: EmailEvidenceLite;
  payment?: PaymentEvidence;
};

export type ExplainedLine = {
  category: string;
  label: string; // human readable category
  prevGbp: number | null;
  currGbp: number;
  changeGbp: number | null;
  changePct: number | null;
  explainedGbp: number;
  coveragePct: number; // 0-100
  status: Status;
  chains: EvidenceChain[];
  /** Tickets in scope that carry no cost (shown, but don't add coverage) */
  uncostedTickets: TicketEvidence[];
  docs: DocEvidenceLite[];
};

export type ExplainResult = {
  building: { id: string; name: string; address: string; postcode: string };
  years: { prev: string | null; curr: string };
  totals: { prevGbp: number | null; currGbp: number };
  lines: ExplainedLine[];
  sources: {
    cortile: true;
    gmail: boolean;
    bank: "truelayer" | "csv" | "none";
    drive: boolean;
  };
  warnings: string[];
};

export type BuildingOption = { id: string; name: string; postcode: string };
