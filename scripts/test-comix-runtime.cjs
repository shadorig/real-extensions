"use strict";

const assert = require("node:assert/strict");
const { ComixTo } = require("../sources/ComixTo/source.js").Sources;

let responder;
let options;
let requested = [];

globalThis.App = {
  createSourceStateManager: () => ({ retrieve: async () => null, store: async () => {} }),
  createRequest: config => config,
  createRequestManager: config => {
    options = config;
    return {
      getDefaultUserAgent: async () => "Paperback test agent",
      schedule: async request => {
        const prepared = await config.interceptor.interceptRequest(request);
        requested.push(prepared.url);
        return config.interceptor.interceptResponse(await responder(prepared.url));
      }
    };
  }
};

async function testRateLimit() {
  requested = [];
  responder = async () => ({
    status: 429,
    data: '{"message":"Too many requests"}',
    headers: { "Retry-After": "120", "Content-Type": "application/json" }
  });
  const source = new ComixTo();
  assert.equal(options.requestsPerSecond, 1);
  await assert.rejects(source.fetchJson("https://comix.to/api/v1/tags/search?type=genre"), error => {
    assert.match(error.message, /rate limiting requests \(HTTP 429\)/);
    assert.match(error.message, /Retry-After: 120/);
    return true;
  });
  assert.equal(requested.length, 1, "429 must not trigger an immediate retry");
}

async function testUnsupportedSignerCache() {
  requested = [];
  responder = async url => {
    if (url === "https://comix.to/") {
      return { status: 200, data: '<script src="/dist/main-demo.js"></script>', headers: {} };
    }
    if (url.endsWith("/dist/main-demo.js")) {
      return { status: 200, data: 'import "./secure-demo.js";', headers: {} };
    }
    if (url.endsWith("/dist/secure-demo.js")) {
      return { status: 200, data: 'const storage = { get() {}, set() {}, clear() {} }; export { storage as n };', headers: {} };
    }
    throw Error("Unexpected URL: " + url);
  };
  const source = new ComixTo();
  const url = "https://comix.to/api/v1/manga?limit=1";
  await assert.rejects(source.fetchJson(url), /did not expose a usable request signer/);
  await assert.rejects(source.fetchJson(url), /did not expose a usable request signer/);
  assert.deepEqual(requested, [
    "https://comix.to/",
    "https://comix.to/dist/main-demo.js",
    "https://comix.to/dist/secure-demo.js"
  ], "a known incompatible bundle should not be fetched on every request");
  source.invalidateLiveProtocol();
  await assert.rejects(source.fetchJson(url), /did not expose a usable request signer/);
  assert.equal(requested.length, 6, "explicit refresh should clear failed protocol cache");
}

async function testProtocolRotation() {
  const source = new ComixTo();
  let bootstraps = 0;
  source.bootstrapLiveProtocol = async () => ({ generation: ++bootstraps });
  const first = await source.getLiveProtocol();
  assert.equal((await source.getLiveProtocol()).generation, first.generation);
  assert.equal(bootstraps, 1);
  source.cachedLiveProtocolExpiresAt = Date.now() - 1;
  assert.equal((await source.getLiveProtocol()).generation, 2);
}

(async () => {
  await testRateLimit();
  await testUnsupportedSignerCache();
  await testProtocolRotation();
  console.log("ComixTo runtime tests passed");
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
