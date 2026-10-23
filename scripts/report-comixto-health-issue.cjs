"use strict";

const fs = require("node:fs");
const path = require("node:path");

const TITLE = "ComixTo scheduled health check failure";
const MARKER = "<!-- real-extensions:comixto-health-check -->";

function findActiveIssue(issues) {
  return issues.find((item) =>
    !item.pull_request &&
    (item.title === TITLE || String(item.body || "").includes(MARKER))
  );
}

function readReport(directory) {
  try {
    const content = fs.readFileSync(path.join(directory, "report.json"), "utf8");
    const report = JSON.parse(content);
    return report && Array.isArray(report.checks) ? report : null;
  } catch {
    return null;
  }
}

async function updateIssue({ github, context, core, env = process.env }) {
  const { owner, repo } = context.repo;
  const report = readReport(env.COMIXTO_REPORT_DIR || path.join(".local", "comixto-health"));
  const failed = env.COMIXTO_PROBE_OUTCOME === "failure" || !report || report.status === "failure";
  const issues = await github.paginate(github.rest.issues.listForRepo, {
    owner, repo, state: "open", per_page: 100
  });
  const existing = findActiveIssue(issues);
  const runLink = context.runId
    ? "https://github.com/" + owner + "/" + repo + "/actions/runs/" + context.runId
    : "See the GitHub Actions workflow history.";

  if (!failed) {
    if (!existing) {
      core.info("ComixTo healthy; no active incident issue.");
      return;
    }
    await github.rest.issues.update({
      owner, repo, issue_number: existing.number,
      state: "closed", state_reason: "completed",
      body: MARKER + "\n\nComixTo public health check recovered on " + report.checkedAt +
        ".\n\nVerified by: " + runLink
    });
    core.info("Closed recovered ComixTo incident #" + existing.number);
    return;
  }

  let body = MARKER + "\n\n";
  if (report) {
    // Report contains only fixed public endpoint names and bounded diagnostics.
    const { formatReport } = require("./check-comixto-health.cjs");
    if (report.status === "healthy") {
      body += "**Checker failure:** Probe results were healthy, but the check step failed after probing. " +
        "Inspect the runner log for a diagnostic or filesystem failure.\n\n";
    }
    body += formatReport(report);
  } else {
    body += "## Diagnostic did not finish\n\nThe health probe did not write a readable JSON report. " +
      "Inspect the Node check step and runner logs.\n\n";
  }
  body += "\n**Latest workflow run:** " + runLink +
    "\n\n**Artifact:** \`comixto-health-diagnostics\` on failed runs.\n";

  if (existing) {
    await github.rest.issues.update({
      owner, repo, issue_number: existing.number, body
    });
    core.info("Updated active ComixTo incident #" + existing.number);
  } else {
    const created = await github.rest.issues.create({ owner, repo, title: TITLE, body });
    core.info("Opened ComixTo incident #" + created.data.number);
  }
}

module.exports = updateIssue;
module.exports.findActiveIssue = findActiveIssue;
module.exports.readReport = readReport;
