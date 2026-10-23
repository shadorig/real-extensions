"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const check = require("./check-comixto-health.cjs");
const updateIssue = require("./report-comixto-health-issue.cjs");

const probe = check.PROBES[1];
const goodBody = JSON.stringify({
  status: "ok",
  result: [{ id: 1, label: "Action", slug: "action" }]
});

function response(body, status = 200, type = "application/json", extra = {}) {
  return new Response(body, {
    status,
    headers: { "content-type": type, ...extra }
  });
}

test("recognizes healthy homepage HTML and valid tag metadata", () => {
  const homepage = check.classifyResponse(check.PROBES[0],
    response("<!doctype html><html><body>Home</body></html>", 200, "text/html"), "<html>Home</html>");
  assert.equal(homepage.category, "ok");
  assert.equal(check.classifyResponse(probe, response(goodBody), goodBody).category, "ok");
});

test("classifies throttling and denied access before parsing response content", () => {
  assert.equal(check.classifyResponse(probe, response("", 429), "").category, "rate_limited");
  assert.equal(check.classifyResponse(probe, response("", 403), "").category, "forbidden");
});

test("classifies blocking HTML, unexpected HTML and schema drift", () => {
  const block = "<html><title>Just a moment</title><p>Cloudflare checking your browser</p></html>";
  assert.equal(check.classifyResponse(probe, response(block, 200, "text/html"), block).category, "blocked");
  const html = "<html><body>Temporarily unavailable</body></html>";
  assert.equal(check.classifyResponse(probe, response(html, 200, "text/html"), html).category, "html_response");
  assert.equal(check.classifyResponse(probe, response(JSON.stringify({ status: "ok", result: {} })),
    '{"status":"ok","result":{}}').category, "schema_drift");
});

test("rejects malformed JSON, missing tag attributes and wrong content type", () => {
  assert.equal(check.classifyResponse(probe, response("{"), "{").category, "invalid_json");
  assert.equal(check.validateTagPayload({ status: "ok", result: [{ id: 5 }] }),
    "Tag entries no longer include readable id and label");
  assert.equal(check.classifyResponse(probe, response(goodBody, 200, "text/plain"), goodBody).category,
    "content_type_drift");
});

test("probe keeps diagnostic metadata without response body", async () => {
  const result = await check.checkProbe(probe, async () => response(goodBody));
  assert.equal(result.category, "ok");
  assert.equal(result.httpStatus, 200);
  assert.equal(typeof result.bytesSampled, "number");
  assert.equal(JSON.stringify(result).includes("Action"), false);
});

test("stops after 429 without contacting any subsequent endpoint", async () => {
  let requested = 0;
  const report = await check.run({
    skipDelay: true,
    fetchFn: async () => {
      requested += 1;
      return response("Throttled", 429, "text/plain");
    }
  });
  assert.equal(requested, 1);
  assert.equal(report.stoppedEarly, true);
  assert.equal(report.status, "failure");
  assert.equal(report.checks[0].category, "rate_limited");
});

test("discovers public bundle filenames and records a static signer contract warning", async () => {
  const homepage = '<html><script src="/assets/build/123abc/dist/main-123abc.js"></script></html>';
  const mainCode = 'import("./secure-456xyz.js");';
  const secureCode = 'const c={get(){},set(){}};const b={remove(){},clear(){}};export{c as n,b as t}';
  const fetched = [];
  const report = await check.run({
    skipDelay: true,
    fetchFn: async (url) => {
      fetched.push(url);
      if (url.endsWith("/")) return response(homepage, 200, "text/html");
      if (url.includes("tags/search")) return response(goodBody);
      if (url.includes("main-123abc.js")) return response(mainCode, 200, "application/javascript");
      return response(secureCode, 200, "application/javascript");
    }
  });
  assert.equal(fetched.length, 4);
  assert.equal(report.status, "failure");
  assert.equal(report.assets.mainBundle, "/assets/build/123abc/dist/main-123abc.js");
  assert.equal(report.assets.secureBundle, "/assets/build/123abc/dist/secure-456xyz.js");
  assert.deepEqual(report.assets.exportedBindings, [
    { name: "c", staticType: "object" },
    { name: "b", staticType: "object" }
  ]);
  assert.equal(report.checks.at(-1).category, "signer_contract_drift");
  assert.equal(JSON.stringify(report).includes("get()"), false);
});

test("recognizes a statically visible function export without executing it", () => {
  const outcome = check.inspectSecureExports('function Bf(client){client.interceptors.request.use(()=>{});throw Error("must not run")};export{Bf as signer}');
  assert.equal(outcome.category, "ok");
  assert.deepEqual(outcome.bindings, [{ name: "Bf", staticType: "function" }]);
  assert.equal(check.inspectSecureExports('function Bf(){return {get(){},set(){}}};export{Bf as storage}').category,
    "signer_contract_drift");
});

test("minified IIFE storage exports do not inherit unrelated function declarations", () => {
  const obfuscated = 'function b(client){client.interceptors.request.use(()=>{})}' +
    'function c(client){client.interceptors.request.use(()=>{})}' +
    ';var b=(()=>({get(){},set(){}}))(),c=(()=>({remove(){},clear(){}}))();export{c as n,b as t}';
  const scan = check.inspectSecureExports(obfuscated);
  assert.equal(scan.category, "signer_contract_drift");
  assert.deepEqual(scan.bindings, [
    { name: "c", staticType: "unknown" },
    { name: "b", staticType: "unknown" }
  ]);
});

test("issue reporter updates existing incident and closes on recovery", async () => {
  const directory = path.join(__dirname, "..", ".local");
  fs.mkdirSync(directory, { recursive: true });
  const output = fs.mkdtempSync(path.join(directory, "comixto-issue-test-"));
  const existing = { title: "ComixTo scheduled health check failure", number: 5, body: "" };
  const operations = [];
  const github = {
    paginate: async () => [existing],
    rest: {
      issues: {
        listForRepo: () => {},
        update: async (args) => { operations.push(args); }
      }
    }
  };
  const context = { repo: { owner: "sample", repo: "extensions" }, runId: 123 };
  const core = { info: () => {} };
  try {
    const report = {
      schemaVersion: 1, checkedAt: "2026-10-23T00:00:00.000Z",
      status: "failure", runUrl: null,
      checks: [{
        endpoint: probe.path, category: "rate_limited", httpStatus: 429,
        contentType: "application/json", durationMs: 10, detail: "HTTP 429"
      }]
    };
    fs.writeFileSync(path.join(output, "report.json"), JSON.stringify(report));
    await updateIssue({ github, context, core, env: { COMIXTO_REPORT_DIR: output, COMIXTO_PROBE_OUTCOME: "failure" } });
    assert.equal(operations.length, 1);
    assert.equal(operations[0].issue_number, 5);
    assert.match(operations[0].body, /rate_limited/);
    report.status = "healthy";
    fs.writeFileSync(path.join(output, "report.json"), JSON.stringify(report));
    await updateIssue({ github, context, core, env: { COMIXTO_REPORT_DIR: output, COMIXTO_PROBE_OUTCOME: "success" } });
    assert.equal(operations[1].state, "closed");
  } finally {
    fs.rmSync(output, { recursive: true, force: true });
  }
});

test("issue reporter creates only if no current incident exists", async () => {
  const created = [];
  const github = {
    paginate: async () => [],
    rest: {
      issues: {
        listForRepo: () => {},
        create: async (args) => { created.push(args); return { data: { number: 7 } }; }
      }
    }
  };
  await updateIssue({
    github,
    context: { repo: { owner: "sample", repo: "extensions" }, runId: 1 },
    core: { info: () => {} },
    env: { COMIXTO_REPORT_DIR: "/does-not-exist", COMIXTO_PROBE_OUTCOME: "failure" }
  });
  assert.equal(created.length, 1);
  assert.match(created[0].body, /Diagnostic did not finish/);
});
