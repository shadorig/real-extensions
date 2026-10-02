#!/usr/bin/env node

"use strict";

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const sourcesRoot = path.join(root, "sources");
const versioningPath = path.join(sourcesRoot, "versioning.json");

function fail(message) {
  console.error(message);
  process.exitCode = 1;
}

function readVersioning() {
  try {
    return JSON.parse(fs.readFileSync(versioningPath, "utf8"));
  } catch (error) {
    fail(`ERROR unable to read ${path.relative(root, versioningPath)}: ${error.message}`);
    return { sources: [] };
  }
}

function readSourceVersion(sourceId) {
  const sourcePath = path.join(sourcesRoot, sourceId, "source.js");
  const relative = path.relative(root, sourcePath).replace(/\\/g, "/");

  if (!fs.existsSync(sourcePath)) {
    fail(`ERROR ${sourceId}: ${relative} does not exist.`);
    return undefined;
  }

  try {
    const sourceText = fs.readFileSync(sourcePath, "utf8");
    const infoName = escapeRegExp(`${sourceId}Info`);
    const infoBlockMatch = sourceText.match(new RegExp(`\\b(?:(?:var|let|const)\\s+)?${infoName}\\s*=\\s*\\{[\\s\\S]*?\\n\\s*\\};`));

    if (!infoBlockMatch) {
      fail(`ERROR ${sourceId}: unable to find ${sourceId}Info object in ${relative}.`);
      return undefined;
    }

    const versionMatch = infoBlockMatch[0].match(/\bversion\s*:\s*["']([^"']+)["']/);
    if (!versionMatch) {
      fail(`ERROR ${sourceId}: unable to find version field in ${sourceId}Info.`);
      return undefined;
    }

    return versionMatch[1];
  } catch (error) {
    fail(`ERROR ${sourceId}: unable to read ${relative}: ${error.message}`);
    return undefined;
  }
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const versioning = readVersioning();
const entries = Array.isArray(versioning.sources) ? versioning.sources : [];

if (entries.length === 0) {
  fail("ERROR sources/versioning.json has no sources array entries.");
}

for (const entry of entries) {
  if (!entry || !entry.id) {
    fail("ERROR sources/versioning.json contains a source entry without an id.");
    continue;
  }

  const sourceVersion = readSourceVersion(entry.id);
  const manifestVersion = entry.version;

  if (sourceVersion !== manifestVersion) {
    fail(`${entry.id}: source.js=${sourceVersion || "<missing>"} versioning.json=${manifestVersion || "<missing>"}`);
    continue;
  }

  console.log(`${entry.id}: ${sourceVersion}`);
}

if (process.exitCode) {
  console.error("Version sync check failed.");
} else {
  console.log(`Version sync check passed for ${entries.length} sources.`);
}
