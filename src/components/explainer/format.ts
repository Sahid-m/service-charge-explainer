export const gbp = (n: number | null | undefined) =>
  n == null
    ? "–"
    : new Intl.NumberFormat("en-GB", {
        style: "currency",
        currency: "GBP",
        maximumFractionDigits: 2,
      }).format(n);

export const fmtDate = (d: string | null | undefined) => {
  if (!d) return "–";
  const dt = new Date(d);
  return isNaN(dt.getTime())
    ? d
    : dt.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
};

export const gbp0 = (n: number | null | undefined) =>
  n == null
    ? "–"
    : new Intl.NumberFormat("en-GB", {
        style: "currency",
        currency: "GBP",
        maximumFractionDigits: 0,
      }).format(n);

export const pct = (n: number | null | undefined) =>
  n == null ? "–" : `${n > 0 ? "+" : ""}${n.toFixed(1)}%`;

export const fyLabel = (d: string | null | undefined) => {
  if (!d) return "Last year";
  const dt = new Date(d);
  return isNaN(dt.getTime())
    ? d
    : `FY to ${dt.toLocaleDateString("en-GB", { month: "short", year: "numeric" })}`;
};
