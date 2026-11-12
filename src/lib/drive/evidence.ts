import "server-only";

export type DocEvidence = {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
  link: string;
  kind: "lease" | "insurance" | "management_agreement" | "other";
};

function classify(name: string): DocEvidence["kind"] {
  const n = name.toLowerCase();
  if (/management\s*agreement|mgmt|management agmt/.test(n))
    return "management_agreement";
  if (/insurance|schedule|policy|broker/.test(n)) return "insurance";
  if (/lease/.test(n)) return "lease";
  return "other";
}

export async function searchDriveDocs(
  accessToken: string,
  buildingName: string,
): Promise<DocEvidence[]> {
  const esc = buildingName.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
  const params = new URLSearchParams({
    q: `(fullText contains '${esc}' or name contains '${esc}') and trashed=false`,
    fields: "files(id,name,mimeType,modifiedTime,webViewLink)",
    pageSize: "25",
    supportsAllDrives: "true",
    includeItemsFromAllDrives: "true",
  });
  try {
    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files?${params}`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
      },
    );
    if (!res.ok) {
      console.warn(`[drive] search returned ${res.status}`);
      return [];
    }
    const data = (await res.json()) as {
      files?: {
        id: string;
        name: string;
        mimeType: string;
        modifiedTime: string;
        webViewLink?: string;
      }[];
    };
    return (data.files ?? []).map((f) => ({
      id: f.id,
      name: f.name,
      mimeType: f.mimeType,
      modifiedTime: f.modifiedTime,
      link: f.webViewLink ?? `https://drive.google.com/file/d/${f.id}/view`,
      kind: classify(f.name),
    }));
  } catch (e) {
    console.warn("[drive] search failed", e instanceof Error ? e.message : "");
    return [];
  }
}
