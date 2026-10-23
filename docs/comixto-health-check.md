# ComixTo scheduled health check

The [ComixTo public health workflow](../.github/workflows/comixto-health.yml) runs once a day at 06:17 UTC and supports manual **Run workflow** dispatch in GitHub Actions. Each run makes up to four sequential, public GET requests with a two-second pause:

1. \`https://comix.to/\` to confirm that homepage HTML is publicly available.
2. \`https://comix.to/api/v1/tags/search?type=tag&limit=1\` to check a live API endpoint already used by ComixTo and validate its small JSON tag metadata payload.
3. The \`/dist/main-*.js\` URL referenced by the homepage, to record the public bundle filename.
4. The \`/dist/secure-*.js\` URL referenced by the main script, to record its filename and a conservative static inspection of its module exports.

No chapter URLs, chapter images, account state, content payloads, proxy services, signature routines, authentication, or challenge solving are used. Downloaded JavaScript is inspected as text and never executed. HTTP body samples are capped at 64 KiB for the homepage and metadata, or 1 MiB for public scripts, in memory. Body text is never recorded in logs, reports, or issues. Each request times out after 12 seconds, with no retries. After any 429, 403, or explicit challenge, the checker stops making requests immediately. These checks are indicative of public reachability and of recognizable static bundle exports, not an end-to-end Paperback runtime test.

On failure, the workflow uploads \`comixto-health-diagnostics\` containing:

- \`report.json\` with timestamp, probe identifiers, HTTP statuses, content types, elapsed times, and failure classifications.
- \`report.md\` with a readable summary and suggested next diagnostic steps.

It also creates an issue titled **ComixTo scheduled health check failure** or updates the existing open issue with the latest findings and run link. Healthy checks automatically close an open incident. The workflow requests only \`contents: read\` and \`issues: write\` GitHub token permissions and serializes its runs to prevent duplicate issues. GitHub Actions must allow issue writes for notifications to succeed.

Categories include \`rate_limited\` (429), \`forbidden\` (403), \`blocked\` (challenge page), \`html_response\` (API returns HTML), \`schema_drift\` (JSON contract changed), \`signer_contract_drift\` (no exported request-interceptor contract statically recognizable), \`asset_discovery_drift\` (public scripts moved), \`invalid_json\`, \`content_type_drift\`, \`http_error\`, \`timeout\`, and \`network_error\`. The static export heuristic can produce false alarms when minified code changes representation or installs an interceptor indirectly. A successful export scan does not prove source signing works. A 403, 429, or challenge may affect GitHub runners differently from the Paperback client. Verify that distinction before changing production code.

To run locally from the repository root with Node 20 or later:

\`\`\`sh
node scripts/check-comixto-health.cjs
node --test scripts/check-comixto-health.test.cjs
\`\`\`

Reports from the local command go to ignored \`.local/comixto-health/\`. Exit status 0 means all applicable probes passed, and status 1 means at least one failed. To add another safe probe, add its public endpoint and expected contract in \`PROBES\` within \`scripts/check-comixto-health.cjs\`, with an accompanying schema validator and classification test. Keep checks infrequent and metadata-only.
