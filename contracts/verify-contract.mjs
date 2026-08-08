import { readFile, readdir, lstat } from 'node:fs/promises';
import { resolve, extname, relative } from 'node:path';

const contractRoot = resolve(import.meta.dirname);
const repository = resolve(process.argv[2] || '.');
const language = process.argv[3] || 'javascript';
const schema = JSON.parse(await readFile(resolve(contractRoot, 'diagnostic-envelope-v2.schema.json'), 'utf8'));
const monitorSchema = JSON.parse(await readFile(resolve(contractRoot, 'monitor-event-v1.schema.json'), 'utf8'));
const cases = JSON.parse(await readFile(resolve(contractRoot, 'conformance-cases-v2.json'), 'utf8'));

const expected = [
  'redaction', 'fingerprinting', 'exception_chains', 'request_response_context',
  'offline_queue', 'payload_limit', 'sdk_identity', 'monitor_helpers',
  'monitor_credential_isolation', 'monitor_retry_policy', 'monitor_evidence_safety',
  'monitor_epoch_timestamps'
];
if (schema.properties?.schema_version?.const !== 2) throw new Error('contract schema_version must be 2');
if (!monitorSchema.$defs?.heartbeat || !monitorSchema.$defs?.assertion || !monitorSchema.$defs?.workflow) {
  throw new Error('monitor contract must define heartbeat, assertion, and workflow events');
}
if (JSON.stringify(cases.required_capabilities) !== JSON.stringify(expected)) throw new Error('contract capabilities changed without a revision');
if (cases.redaction.expected.authorization !== '[REDACTED]' || cases.max_payload_bytes > 1024 * 1024) throw new Error('unsafe redaction or payload policy');

const extensions = new Set(['.ts', '.js', '.py', '.go', '.rs', '.java', '.php', '.dart']);
const ignored = new Set([
  'node_modules', 'vendor', 'target', 'dist', 'build', '.git', '.dart_tool', '.venv',
  '.mypy_cache', '.pytest_cache', '.ruff_cache', '.idea', '.gradle', 'contracts'
]);
let sourceCorpus = '';
let testCorpus = '';
async function collect(directory) {
  for (const entry of await readdir(directory)) {
    if (ignored.has(entry) || entry.startsWith('.venv') || entry === '__pycache__') continue;
    const path = resolve(directory, entry);
    const info = await lstat(path);
    if (info.isSymbolicLink()) continue;
    if (info.isDirectory()) await collect(path);
    else if (extensions.has(extname(path))) {
      const contents = await readFile(path, 'utf8');
      const repositoryPath = relative(repository, path);
      const isTestFile = /(^|[/\\])(__tests__|tests?|specs?)([/\\])|(?:_test|test|spec)\.[^.]+$/i.test(repositoryPath);
      const containsInlineTests = /#\[cfg\(test\)\]|@Test\b|\btest\s*\(/.test(contents);
      if (isTestFile || containsInlineTests) {
        testCorpus += `\n${contents}`;
      }
      if (!isTestFile) sourceCorpus += `\n${contents}`;
    }
  }
}
await collect(repository);
const sourceProbes = {
  redaction: /redact|saniti/i,
  fingerprinting: /fingerprint/i,
  exception_chains: /cause.?chain|causes|previous|inner.?exception/i,
  request_response_context: /(?=[\s\S]*request)(?=[\s\S]*response)/i,
  offline_queue: /offline.?queue|queue/i,
  payload_limit: /(?=[\s\S]*(?:524_?288|512\s*\*\s*1024))(?=[\s\S]*payload)/i,
  sdk_identity: /sdk.{0,40}(version|name)|(version|name).{0,40}sdk/is,
  monitor_helpers: /(?=[\s\S]*heartbeat)(?=[\s\S]*assert(?:_|)outcome)(?=[\s\S]*workflow)/i,
  monitor_credential_isolation: /(?=[\s\S]*heartbeat)(?=[\s\S]*x-oluso-signature)/i,
  monitor_retry_policy: /(?=[\s\S]*(?:408|425))(?=[\s\S]*429)(?=[\s\S]*(?:retry|retries))/i,
  monitor_evidence_safety: /(?=[\s\S]*monitor)(?=[\s\S]*(?:redact|saniti))(?=[\s\S]*(?:bound|truncat|max.?depth))/i,
  monitor_epoch_timestamps: /(?=[\s\S]*timestamp)(?=[\s\S]*(?:milli|Date\.now|UnixMilli|microtime))/i
};
const behaviorProbes = {
  redaction: /(?=[\s\S]*authorization)(?=[\s\S]*\[REDACTED\])/i,
  fingerprinting: /fingerprint/i,
  exception_chains: /cause.?chain|causes|previous|inner.?exception/i,
  request_response_context: /(?=[\s\S]*request)(?=[\s\S]*response)/i,
  offline_queue: /offline.?queue|queue/i,
  payload_limit: /(?=[\s\S]*(?:524_?288|512\s*(?:\*\s*1024|KiB)))(?=[\s\S]*payload)/i,
  sdk_identity: /(?=[\s\S]*sdk)(?=[\s\S]*version)(?=[\s\S]*(?:language|name))/i,
  monitor_helpers: /(?=[\s\S]*heartbeat)(?=[\s\S]*assert)(?=[\s\S]*workflow)/i,
  monitor_credential_isolation: /(?=[\s\S]*heartbeat)(?=[\s\S]*(?:signature|credential|header))/i,
  monitor_retry_policy: /(?=[\s\S]*(?:retry|retries))(?=[\s\S]*(?:400|permanent|transient))/i,
  monitor_evidence_safety: /(?=[\s\S]*monitor)(?=[\s\S]*(?:REDACTED|redact|saniti))/i,
  monitor_epoch_timestamps: /(?=[\s\S]*timestamp)(?=[\s\S]*(?:int|number|u64|long|epoch|milli))/i
};
const missingImplementation = Object.entries(sourceProbes)
  .filter(([, pattern]) => !pattern.test(sourceCorpus))
  .map(([name]) => name);
const missingBehaviorTests = Object.entries(behaviorProbes)
  .filter(([, pattern]) => !pattern.test(testCorpus))
  .map(([name]) => name);
if (missingImplementation.length || missingBehaviorTests.length) {
  const details = [];
  if (missingImplementation.length) details.push(`implementation: ${missingImplementation.join(', ')}`);
  if (missingBehaviorTests.length) details.push(`behavior tests: ${missingBehaviorTests.join(', ')}`);
  throw new Error(`${language} SDK is missing contract evidence (${details.join('; ')})`);
}
console.log(`Oluso diagnostic contract ${cases.revision}: ${language} repository conforms (${expected.length} capabilities).`);
