// @ts-check
/**
 * Markers of dev-only code. Source maps keep original file paths, so a dev
 * module bundled by mistake shows up by path even when its code is minified.
 */
const FORBIDDEN_FILES = [/(^|\/)sandbox\.html$/];
const FORBIDDEN_CONTENT = [
  { pattern: /src\/dev\//, label: 'src/dev/ module' },
  { pattern: /src\/game\/core\/testing\//, label: 'scripted test bot module' },
  { pattern: /render sandbox/i, label: 'sandbox page' },
];

/**
 * @param {{ file: string, content: string }[]} files Paths relative to dist/.
 * @returns {string[]} Human-readable findings (empty when clean).
 */
export function findDevOnlyCode(files) {
  /** @type {string[]} */
  const findings = [];
  for (const { file, content } of files) {
    if (FORBIDDEN_FILES.some((re) => re.test(file))) findings.push(`${file}: dev-only page`);
    for (const { pattern, label } of FORBIDDEN_CONTENT) {
      if (pattern.test(content)) findings.push(`${file}: contains ${label}`);
    }
  }
  return findings;
}
