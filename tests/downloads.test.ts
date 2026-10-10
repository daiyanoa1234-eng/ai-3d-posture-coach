import { it, expect } from "vitest";
import { summarizeDownloads } from "../src/analysis/downloads";
it("reports all same-origin downloads and duplicate requests without exposing query strings", () => {
  const r = summarizeDownloads(
    [
      {
        name: "https://demo.example/app/?bench=1",
        encodedBodySize: 100,
        decodedBodySize: 200,
        transferSize: 400,
      },
      {
        name: "https://demo.example/app/model.task",
        encodedBodySize: 2000,
        decodedBodySize: 2000,
        transferSize: 2300,
      },
      {
        name: "https://demo.example/app/model.task?cache=warm",
        encodedBodySize: 2000,
        decodedBodySize: 2000,
        transferSize: 0,
      },
      {
        name: "https://other.example/ignored",
        encodedBodySize: 5000,
        decodedBodySize: 5000,
        transferSize: 5000,
      },
    ],
    "https://demo.example",
    "/app/",
  );
  expect(r.observedTransferBytes).toBe(2700);
  expect(r.files).toHaveLength(2);
  expect(r.files[1]).toMatchObject({
    file: "model.task",
    requests: 2,
    zeroTransferRequests: 1,
  });
  expect(JSON.stringify(r)).not.toContain("bench=");
  expect(JSON.stringify(r)).not.toContain("cache=");
});
