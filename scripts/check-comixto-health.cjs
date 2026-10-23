#!/usr/bin/env node

"use strict";

const fs = require("node:fs");
const path = require("node:path");

const SITE = "https://comix.to";
const TIMEOUT_MS = 12000;
const SAMPLE_LIMIT = 65536;
const ASSET_SAMPLE_LIMIT = 1024 * 1024;
const REQUEST_GAP_MS = 2000;
const USER_AGENT = "real-extensions-health-check/1.0 (+https://github.com/shadorig/real-extensions)";

// Keep probes public, unauthenticated, and independent of manga signing and media.
// This metadata path is used by ComixTo.fetchTagOptions in sources/ComixTo/source.js.
const PROBES = [
  { id: "homepage", path: "/", accept: "text/html", expected: "html" },
  { id: "tag_metadata", path: "/api/v1/tags/search?type=tag&limit=1", accept: "application/json", expected: "tag_json" }
];

function publicAssetPath(pathname, type) {
  const prefix = "\\/(?:assets\\/build\\/[A-Za-z0-9_-]+\\/)?dist\\/";
  const name = type === "main" ? "main" : "secure";
  const pattern = new RegExp("^" + prefix + name + "-[A-Za-z0-9_-]+\\.js$");
  return typeof pathname === "string" && pattern.test(pathname) ? pathname : null;
}

function findMainAsset(html) {
  const match = String(html || "").match(/<script\b[^>]*\bsrc=["']([^"']*\/dist\/main-[A-Za-z0-9_-]+\.js)["'][^>]*>/i);
  if (!match) return null;
  try {
    const url = new URL(match[1], SITE + "/");
    return url.origin === SITE ? publicAssetPath(url.pathname, "main") : null;
  } catch {
    return null;
  }
}

function findSecureAsset(code, mainPath) {
  const match = String(code || "").match(/(?:\.\/)?(secure-[A-Za-z0-9_-]+\.js)/);
  if (!match) return null;
  try {
    const url = new URL(match[1], SITE + mainPath);
    return url.origin === SITE ? publicAssetPath(url.pathname, "secure") : null;
  } catch {
    return null;
  }
}

// Static text inspection only. No downloaded JavaScript is executed or invoked.
function inspectSecureExports(code) {
  const match = String(code || "").match(/export\s*\{([^}]*)\}\s*;?\s*$/);
  if (!match) return { category: "signer_contract_drift", detail: "No trailing named export block found", bindings: [] };
  const bindings = match[1].split(",").map((part) => part.trim().match(/^([A-Za-z_$][\w$]*)(?:\s+as\s+[A-Za-z_$][\w$]*)?$/)).filter(Boolean).map((part) => part[1]);
  if (bindings.length === 0) {
    return { category: "signer_contract_drift", detail: "No named bindings found in secure module exports", bindings: [] };
  }
  const types = bindings.map((name) => {
    const escaped = name.replace(/[$]/g, "\\$&");
    const declaration = new RegExp("(?:^|[;,])\\s*(?:(?:const|let|var)\\s+)?" + escaped + "\\s*=\\s*", "g");
    const functionDeclaration = new RegExp("\\b(?:async\\s+)?function\\s+" + escaped + "\\s*\\(", "g");
    let lastPosition = -1;
    let lastType = "unknown";
    for (const found of code.matchAll(declaration)) {
      const rhs = code.slice(found.index + found[0].length, found.index + found[0].length + 120);
      const type = /^\(\s*\(/.test(rhs) ? "unknown" :
        /^(?:async\s+)?(?:function\b|\([^)]*\)\s*=>|[A-Za-z_$][\w$]*\s*=>)/.test(rhs)
        ? "function"
        : rhs.startsWith("{") ? "object" : "unknown";
      if (found.index > lastPosition) {
        lastPosition = found.index;
        lastType = type;
      }
    }
    for (const found of code.matchAll(functionDeclaration)) {
      if (found.index > lastPosition) {
        lastPosition = found.index;
        lastType = "function";
      }
    }
    // A later IIFE assignment overrides an unrelated minified function with
    // the same short symbol name. Do not infer the IIFE's return type.
    if (lastPosition >= 0) return lastType;
    return "unknown";
  });
  const recognizedFunctions = types.filter((type) => type === "function").length;
  // ComixTo's current runtime expects an exported function that registers an
  // axios-style request interceptor. Function exports alone can be storage APIs.
  const hasInterceptorShape = /\binterceptors\b/.test(code) &&
    /\brequest\b/.test(code) && /\buse\b/.test(code);
  const hasRecognizableSigner = recognizedFunctions > 0 && hasInterceptorShape;
  return {
    category: hasRecognizableSigner ? "ok" : "signer_contract_drift",
    detail: hasRecognizableSigner
      ? "Exported function and request-interceptor references are visible; runtime compatibility remains unverified"
      : "No exported request-interceptor contract is statically recognizable; verify source signer compatibility",
    bindings: bindings.map((name, index) => ({ name, staticType: types[index] }))
  };
}

function cleanHeader(value) {
  return String(value || "").replace(/[^a-zA-Z0-9 .;/+_:-]/g, "").slice(0, 100);
}

function looksLikeChallenge(body) {
  const text = String(body || "").toLowerCase();
  return /<html|<!doctype html/.test(text) &&
    /(cloudflare|cf-chl|cf_chl|cf-ray|cdn-cgi|captcha)/.test(text) &&
    /(just a moment|attention required|checking your browser|verify you are human|challenge-platform|captcha|cf_chl_opt)/.test(text);
}

function validateTagPayload(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return "Expected a JSON object";
  }
  if (payload.status !== "ok") {
    return "Expected status=ok";
  }
  if (!Array.isArray(payload.result) || payload.result.length === 0) {
    return "Expected a nonempty result array";
  }
  const valid = payload.result.every((item) =>
    item && typeof item === "object" && !Array.isArray(item) &&
    (typeof item.id === "string" || typeof item.id === "number") &&
    String(item.id).trim().length > 0 &&
    typeof item.label === "string" && item.label.trim().length > 0
  );
  return valid ? null : "Tag entries no longer include readable id and label";
}

function classifyResponse(probe, response, body) {
  const contentType = cleanHeader(response.headers.get("content-type"));
  const challenged = response.headers.get("cf-mitigated") === "challenge" || looksLikeChallenge(body);
  if (response.status === 429) return { category: "rate_limited", detail: "HTTP 429: pause checks and review rate limits" };
  if (response.status === 403) return { category: "forbidden", detail: "HTTP 403: access restricted to this runner" };
  if (challenged) return { category: "blocked", detail: "Challenge or block page detected" };
  if (!response.ok) return { category: "http_error", detail: "Unexpected HTTP " + response.status };
  if (new URL(response.url || SITE + probe.path).origin !== SITE) {
    return { category: "redirect", detail: "Response redirected to another origin" };
  }

  if (probe.expected === "html") {
    if (!contentType.toLowerCase().includes("text/html")) {
      return { category: "content_type_drift", detail: "Homepage no longer advertises HTML" };
    }
    if (!/<html|<!doctype html/i.test(body)) {
      return { category: "html_drift", detail: "Homepage response has no HTML document shell" };
    }
    return { category: "ok", detail: "Public homepage HTML available" };
  }

  if (probe.expected === "javascript") {
    if (/<html|<!doctype html/i.test(body.slice(0, 4096))) {
      return { category: "html_response", detail: "Expected JavaScript asset but received HTML" };
    }
    if (!/(?:javascript|ecmascript)/i.test(contentType)) {
      return { category: "content_type_drift", detail: "Public bundle no longer advertises JavaScript" };
    }
    return { category: "ok", detail: "Public script asset available" };
  }

  if (/<html|<!doctype html/i.test(body)) {
    return { category: "html_response", detail: "Expected JSON but received HTML" };
  }
  if (!/\bapplication\/(?:[a-z0-9.+-]*\+)?json\b/i.test(contentType)) {
    return { category: "content_type_drift", detail: "API no longer advertises JSON" };
  }
  let payload;
  try {
    payload = JSON.parse(body);
  } catch {
    return { category: "invalid_json", detail: "API response could not be parsed as JSON" };
  }
  const schemaError = validateTagPayload(payload);
  return schemaError
    ? { category: "schema_drift", detail: schemaError }
    : { category: "ok", detail: "Tag metadata schema available" };
}

async function readSample(response, limit = SAMPLE_LIMIT) {
  if (!response.body) return { body: "", bytesRead: 0 };
  const reader = response.body.getReader();
  const chunks = [];
  let bytesRead = 0;
  try {
    while (bytesRead < limit) {
      const next = await reader.read();
      if (next.done) break;
      const bytes = next.value.subarray(0, limit - bytesRead);
      chunks.push(Buffer.from(bytes));
      bytesRead += bytes.length;
      if (bytes.length < next.value.length || bytesRead === limit) {
        await reader.cancel();
        break;
      }
    }
  } finally {
    reader.releaseLock();
  }
  return { body: Buffer.concat(chunks).toString("utf8"), bytesRead, reachedLimit: bytesRead === limit };
}

async function checkProbe(probe, fetchFn = fetch) {
  const started = Date.now();
  const entry = {
    id: probe.id,
    endpoint: probe.path,
    httpStatus: null,
    contentType: null,
    durationMs: null,
    bytesSampled: 0,
    retryAfterSeconds: null,
    category: "unknown",
    detail: "No result"
  };
  try {
    const response = await fetchFn(SITE + probe.path, {
      method: "GET",
      headers: { accept: probe.accept, "user-agent": USER_AGENT },
      signal: AbortSignal.timeout(TIMEOUT_MS)
    });
    entry.httpStatus = response.status;
    entry.contentType = cleanHeader(response.headers.get("content-type"));
    const retryAfter = Number(response.headers.get("retry-after"));
    if (Number.isFinite(retryAfter) && retryAfter > 0 && retryAfter <= 86400) {
      entry.retryAfterSeconds = retryAfter;
    }
    const sample = await readSample(response, probe.expected === "javascript" ? ASSET_SAMPLE_LIMIT : SAMPLE_LIMIT);
    entry.bytesSampled = sample.bytesRead;
    Object.assign(entry, classifyResponse(probe, response, sample.body));
    Object.defineProperty(entry, "sampleBody", { value: sample.body, enumerable: false });
    Object.defineProperty(entry, "reachedLimit", { value: sample.reachedLimit, enumerable: false });
  } catch (error) {
    const isTimeout = error && (error.name === "TimeoutError" || error.name === "AbortError");
    entry.category = isTimeout ? "timeout" : "network_error";
    entry.detail = isTimeout ? "Request timed out after 12 seconds" : "Request failed at the network layer";
    entry.errorType = cleanHeader(error && error.name || "Error");
  }
  entry.durationMs = Date.now() - started;
  return entry;
}

function runUrl(env = process.env) {
  if (!/^\d+$/.test(env.GITHUB_RUN_ID || "") ||
    !/^[\w.-]+\/[\w.-]+$/.test(env.GITHUB_REPOSITORY || "")) return null;
  return "https://github.com/" + env.GITHUB_REPOSITORY + "/actions/runs/" + env.GITHUB_RUN_ID;
}

function formatReport(report) {
  const lines = [
    "# ComixTo public health check",
    "",
    "**Result:** " + (report.status === "healthy" ? "Healthy" : "Failure"),
    "**Checked at:** " + report.checkedAt,
    "**Scope:** Public homepage, tag metadata, and JavaScript export shape. No chapters, images, credentials, or bypass.",
    ""
  ];
  if (report.runUrl) lines.push("**Actions run:** " + report.runUrl, "");
  lines.push(
    "| Probe | Result | HTTP | Content type | Time | Detail |",
    "| --- | --- | --- | --- | ---: | --- |"
  );
  for (const item of report.checks) {
    lines.push(
      "| \`" + item.endpoint + "\` | \`" + item.category + "\` | " +
      (item.httpStatus ?? "n/a") + " | " + (item.contentType || "n/a") + " | " +
      item.durationMs + " ms | " + item.detail + " |"
    );
  }
  if (report.assets && (report.assets.mainBundle || report.assets.secureBundle)) {
    lines.push(
      "",
      "**Observed main bundle:** " + (report.assets.mainBundle || "n/a"),
      "**Observed secure bundle:** " + (report.assets.secureBundle || "n/a"),
      "**Secure exports (static):** " +
        (report.assets.exportedBindings.length
          ? report.assets.exportedBindings.map((item) => item.name + " (" + item.staticType + ")").join(", ")
          : "unavailable")
    );
  }
  if (report.stoppedEarly) {
    lines.push("", "**Stopped early:** Further requests skipped after access restriction or block.");
  }
  if (report.status === "failure") {
    lines.push(
      "",
      "## Next steps",
      "",
      "Check the category and HTTP status against the linked run artifact (\`report.json\`). " +
      "For 403, 429, or challenges, verify manually whether this is specific to GitHub's hosted runner before changing the extension. " +
      "For schema drift, compare the public tag metadata contract with \`fetchTagOptions\` in \`sources/ComixTo/source.js\`. " +
      "For signer contract drift, compare current public module exports with \`createLiveProtocolFromBundle\`. " +
      "Static inspection cannot confirm that the Paperback runtime will execute successfully.",
      "",
      "The check deliberately avoids chapter content, signing requests, and any access-control workarounds."
    );
  }
  return lines.join("\n") + "\n";
}

async function run(options = {}) {
  const checks = [];
  const probes = options.probes || PROBES;
  let requests = 0;
  let stopped = false;
  const assets = { mainBundle: null, secureBundle: null, exportedBindings: [] };
  async function probeOnce(probe) {
    if (requests > 0 && !options.skipDelay) {
      await new Promise((resolve) => setTimeout(resolve, REQUEST_GAP_MS));
    }
    requests += 1;
    const result = await checkProbe(probe, options.fetchFn || fetch);
    checks.push(result);
    if (["rate_limited", "forbidden", "blocked"].includes(result.category)) stopped = true;
    return result;
  }
  const outcomes = [];
  for (const probe of probes) {
    if (stopped) break;
    outcomes.push(await probeOnce(probe));
  }

  if (!stopped && options.inspectAssets !== false && probes === PROBES) {
    const homepage = outcomes.find((entry) => entry.id === "homepage");
    if (homepage && homepage.category === "ok") {
      assets.mainBundle = findMainAsset(homepage.sampleBody);
      if (!assets.mainBundle) {
        checks.push({
          id: "asset_discovery", endpoint: "/dist/main-*.js",
          category: "asset_discovery_drift", detail: "Homepage no longer references a public main bundle",
          httpStatus: null, contentType: null, durationMs: 0, bytesSampled: 0, retryAfterSeconds: null
        });
      } else {
        const main = await probeOnce({
          id: "main_bundle", path: assets.mainBundle, accept: "application/javascript", expected: "javascript"
        });
        if (!stopped && main.category === "ok") {
          assets.secureBundle = findSecureAsset(main.sampleBody, assets.mainBundle);
          if (!assets.secureBundle) {
            checks.push({
              id: "asset_discovery", endpoint: "/dist/secure-*.js",
              category: "asset_discovery_drift", detail: "Main script no longer references a secure bundle",
              httpStatus: null, contentType: null, durationMs: 0, bytesSampled: 0, retryAfterSeconds: null
            });
          } else {
            const secure = await probeOnce({
              id: "secure_bundle", path: assets.secureBundle, accept: "application/javascript", expected: "javascript"
            });
            if (secure.category === "ok") {
              const signature = inspectSecureExports(secure.sampleBody);
              secure.category = secure.reachedLimit ? "asset_sample_limit" : signature.category;
              secure.detail = secure.reachedLimit
                ? "Secure bundle exceeded the 1 MiB inspection limit"
                : signature.detail;
              assets.exportedBindings = signature.bindings;
            }
          }
        }
      }
    }
  }
  const report = {
    schemaVersion: 1,
    source: "ComixTo",
    checkedAt: new Date().toISOString(),
    status: checks.every((entry) => entry.category === "ok") ? "healthy" : "failure",
    runUrl: runUrl(),
    checks,
    assets,
    stoppedEarly: stopped
  };
  return report;
}

async function main() {
  const index = process.argv.indexOf("--output-dir");
  const outputDir = index >= 0 ? process.argv[index + 1] : path.join(".local", "comixto-health");
  if (!outputDir) throw new Error("Missing value for --output-dir");
  const report = await run();
  fs.mkdirSync(outputDir, { recursive: true });
  const summary = formatReport(report);
  fs.writeFileSync(path.join(outputDir, "report.json"), JSON.stringify(report, null, 2) + "\n");
  fs.writeFileSync(path.join(outputDir, "report.md"), summary);
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);
  for (const check of report.checks) {
    console.log(check.id + ": " + check.category + " (HTTP " + (check.httpStatus ?? "n/a") + ", " + check.durationMs + " ms)");
  }
  console.log("ComixTo health: " + report.status + ". Report: " + path.resolve(outputDir));
  if (report.status !== "healthy") process.exitCode = 1;
}

if (require.main === module) {
  main().catch((error) => {
    console.error("ComixTo diagnostic failed: " + (error && error.message || "unknown error"));
    process.exitCode = 1;
  });
}

module.exports = {
  PROBES, classifyResponse, validateTagPayload, checkProbe, formatReport, run,
  findMainAsset, findSecureAsset, inspectSecureExports
};
