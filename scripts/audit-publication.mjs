import { execFileSync } from "node:child_process";
import { writeFile } from "node:fs/promises";
const git = (...args) => execFileSync("git", args);
const objects = git("rev-list", "--objects", "--all")
  .toString()
  .trim()
  .split("\n");
const checks = {
  privateKey: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  githubToken:
    /\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/,
  awsAccessKey: /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/,
  googleApiKey: /\bAIza[A-Za-z0-9_-]{30,}\b/,
  openAiKey: /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/,
  credentialUrl: /https?:\/\/[^\s/]+:[^\s/@]+@/,
  localUserPath: /\/Users\/[^\s/]+\//,
  mobileNumber: /\b0(?:70|80|90)[- ]?\d{4}[- ]?\d{4}\b/,
};
const findings = [];
let blobs = 0;
for (const item of objects) {
  const [oid, ...pathParts] = item.split(" "),
    path = pathParts.join(" ");
  if (git("cat-file", "-t", oid).toString().trim() !== "blob") continue;
  blobs++;
  const data = git("cat-file", "blob", oid),
    text = data.toString();
  for (const [check, pattern] of Object.entries(checks))
    if (pattern.test(text)) findings.push({ path, check });
  if (
    /\.(?:png|jpe?g|webp|gif|mp4|mov|webm|heic|pdf|docx|xlsx)$/i.test(path) ||
    data.subarray(0, 4).equals(Buffer.from([137, 80, 78, 71])) ||
    data.subarray(0, 3).equals(Buffer.from([255, 216, 255])) ||
    data.subarray(4, 8).toString() === "ftyp"
  )
    findings.push({ path, check: "mediaFile" });
}
const identities = git("log", "--all", "--format=%an%x09%ae%x09%cn%x09%ce")
  .toString()
  .trim()
  .split("\n");
const anonymous = identities.every(
  (line) =>
    line ===
    "Posture Coach Contributors\tnoreply@users.noreply.github.com\tPosture Coach Contributors\tnoreply@users.noreply.github.com",
);
if (!anonymous) findings.push({ check: "nonAnonymousCommitIdentity" });
const report = {
  date: "2026-10-11",
  reachableCommits: identities.length,
  historicalBlobs: blobs,
  anonymousCommitIdentities: anonymous,
  findings,
  manualReview:
    "Source and documentation reviewed: no participant identities, patient data, private contact details, captured images or videos. Public dependency attribution and the approved GitHub account remain. Pattern scanning is supplementary to manual review.",
};
console.log(JSON.stringify(report, null, 2));
if (process.argv.includes("--write"))
  await writeFile(
    "PUBLICATION-AUDIT.json",
    JSON.stringify(report, null, 2) + "\n",
  );
if (findings.length) process.exitCode = 1;
