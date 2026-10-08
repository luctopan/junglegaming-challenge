// @ts-check
/**
 * Markers of dev-only code. Source maps keep original file paths, so a dev
 * module bundled by mistake shows up by path even when its code is minified.
 * `in` limits a marker to some files: source maps also embed the full source
 * of shipped modules, including branches the minifier removed from the JS.
 */
const FORBIDDEN_FILES = [/(^|\/)sandbox\.html$/];
/** @type {{ pattern: RegExp, label: string, in?: RegExp }[]} */
const FORBIDDEN_CONTENT = [
  { pattern: /src\/dev\//, label: 'src/dev/ module' },
  { pattern: /src\/game\/core\/testing\//, label: 'scripted test bot module' },
  { pattern: /render sandbox/i, label: 'sandbox page' },
  // URL balance overrides (`?cfg.*`) exist on the dev server only.
  { pattern: /src\/config\/configOverrides/, label: 'dev config override module' },
  {
    pattern: /\[dev config\]|Balance overrides active/,
    label: 'dev config override code',
    in: /\.(js|mjs|html)$/,
  },
];

/**
 * Phase 4 fed the Captain's Log from temporary in-memory fixtures (with a
 * `?records=` override). Phase 5 replaced them with the API layer over MSW,
 * so any leftover of the temporary source now fails the build.
 */
export const TEMPORARY_RECORDS_REMOVED = true;

/** @type {{ pattern: RegExp, label: string, in?: RegExp }[]} */
const TEMPORARY_RECORDS = [
  {
    pattern: /src\/ui\/records\/temporaryRecords/,
    label: 'temporary records source (Phase 4)',
  },
];

/**
 * @param {{ file: string, content: string }[]} files Paths relative to dist/.
 * @param {{ temporaryRecordsRemoved?: boolean }} [options]
 * @returns {string[]} Human-readable findings (empty when clean).
 */
export function findDevOnlyCode(
  files,
  { temporaryRecordsRemoved = TEMPORARY_RECORDS_REMOVED } = {},
) {
  const markers = temporaryRecordsRemoved
    ? [...FORBIDDEN_CONTENT, ...TEMPORARY_RECORDS]
    : FORBIDDEN_CONTENT;
  /** @type {string[]} */
  const findings = [];
  for (const { file, content } of files) {
    if (FORBIDDEN_FILES.some((re) => re.test(file))) findings.push(`${file}: dev-only page`);
    for (const { pattern, label, in: scope } of markers) {
      if ((scope === undefined || scope.test(file)) && pattern.test(content)) {
        findings.push(`${file}: contains ${label}`);
      }
    }
  }
  return findings;
}
