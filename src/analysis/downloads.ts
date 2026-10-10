export interface DownloadEntry {
  name: string;
  encodedBodySize: number;
  decodedBodySize: number;
  transferSize: number;
}
export function summarizeDownloads(
  entries: DownloadEntry[],
  origin: string,
  basePath: string,
) {
  const files = new Map<
    string,
    {
      file: string;
      requests: number;
      encodedBodyBytes: number;
      decodedBodyBytes: number;
      transferBytes: number;
      zeroTransferRequests: number;
    }
  >();
  for (const entry of entries) {
    const url = new URL(entry.name, origin);
    if (url.origin !== origin || !url.pathname.startsWith(basePath)) continue;
    const file = url.pathname.slice(basePath.length) || "index.html";
    const row = files.get(file) ?? {
      file,
      requests: 0,
      encodedBodyBytes: 0,
      decodedBodyBytes: 0,
      transferBytes: 0,
      zeroTransferRequests: 0,
    };
    row.requests++;
    row.encodedBodyBytes += entry.encodedBodySize;
    row.decodedBodyBytes += entry.decodedBodySize;
    row.transferBytes += entry.transferSize;
    if (entry.transferSize === 0) row.zeroTransferRequests++;
    files.set(file, row);
  }
  const list = [...files.values()].sort((a, b) => a.file.localeCompare(b.file));
  return {
    files: list,
    observedEncodedBodyBytes: list.reduce((s, f) => s + f.encodedBodyBytes, 0),
    observedDecodedBodyBytes: list.reduce((s, f) => s + f.decodedBodyBytes, 0),
    observedTransferBytes: list.reduce((s, f) => s + f.transferBytes, 0),
    scope:
      "Page navigation + resource timing since this navigation. Service Worker internal precache/update fetches are not fully observable here. Zero transfer may indicate HTTP/SW cache or unavailable browser timing. Network inspector is authoritative for full wire traffic.",
  };
}
export function currentDownloadReport() {
  const entries = [
    ...performance.getEntriesByType("navigation"),
    ...performance.getEntriesByType("resource"),
  ].filter(
    (entry): entry is PerformanceResourceTiming =>
      "encodedBodySize" in entry && "transferSize" in entry,
  ) as PerformanceResourceTiming[];
  return summarizeDownloads(entries, location.origin, import.meta.env.BASE_URL);
}
