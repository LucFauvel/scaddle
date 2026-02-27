import { MeshTransform } from '../models/mesh-transform';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Formats a number to 3 decimal places, stripping trailing zeros. */
function fmt(n: number): string {
  return parseFloat(n.toFixed(3)).toString();
}

// Sentinel written above every injected transform block.
// Used to detect and strip a previously injected block before re-injecting.
const SENTINEL = '// __scaddle_transform__';

/** Removes a previously injected sentinel block from the end of the code. */
function stripSentinel(code: string): string {
  const idx = code.indexOf(SENTINEL);
  return idx === -1 ? code : code.slice(0, idx).trimEnd();
}

// ─── Statement splitter ───────────────────────────────────────────────────────

interface SplitResult {
  defs:  string[]; // module/function definitions, use/include, variable assignments
  calls: string[]; // top-level render calls (geometry, for loops, if blocks, etc.)
}

/**
 * Splits OpenSCAD source into definition blocks and render call blocks.
 *
 * Rules:
 *  - Module/function definitions, use<>, include<>, and variable assignments
 *    are "definitions" and must remain at the top level (cannot be wrapped in
 *    a transform block).
 *  - Everything else (geometry calls, for loops, if blocks, union/difference
 *    groups, etc.) is a "render call" and can be wrapped.
 *
 * The scanner tracks brace depth (ignoring braces inside strings and comments)
 * so nested structures are handled correctly.
 */
function splitStatements(code: string): SplitResult {
  const defs: string[]  = [];
  const calls: string[] = [];

  let i = 0;
  const n = code.length;

  while (i < n) {
    // Skip inter-statement whitespace
    while (i < n && /\s/.test(code[i])) i++;
    if (i >= n) break;

    const start           = i;
    let depth             = 0;
    let inLineComment     = false;
    let inBlockComment    = false;
    let inString          = false;
    let chunk: string | null = null;

    while (i < n) {
      const c    = code[i];
      const next = code[i + 1] ?? '';

      // ── Skip comments and strings (do not count braces inside them) ────────
      if (inLineComment)  { if (c === '\n') inLineComment  = false; i++; continue; }
      if (inBlockComment) {
        if (c === '*' && next === '/') { inBlockComment = false; i += 2; }
        else i++;
        continue;
      }
      if (inString) {
        if (c === '\\') { i += 2; continue; } // escape sequence
        if (c === '"')  inString = false;
        i++;
        continue;
      }
      if (c === '/' && next === '/')  { inLineComment  = true; i += 2; continue; }
      if (c === '/' && next === '*')  { inBlockComment = true; i += 2; continue; }
      if (c === '"')                  { inString = true;        i++;    continue; }

      // ── Depth tracking ──────────────────────────────────────────────────────
      if (c === '{') { depth++; i++; continue; }

      if (c === '}') {
        depth--;
        i++;
        if (depth === 0) {
          // Peek ahead: if next non-whitespace token is 'else', keep scanning
          // so that `if (...) { ... } else { ... }` is treated as one statement.
          let j = i;
          while (j < n && /[ \t\r\n]/.test(code[j])) j++;
          if (code.slice(j, j + 4) === 'else') { i = j; continue; }

          chunk = code.slice(start, i).trim();
          break;
        }
        continue;
      }

      // ── Semicolon at depth 0 ends a statement ──────────────────────────────
      if (c === ';' && depth === 0) {
        i++;
        chunk = code.slice(start, i).trim();
        break;
      }

      i++;
    }

    if (!chunk || !chunk.trim()) continue;

    // ── Classify the statement ──────────────────────────────────────────────
    // Strip a leading line-comment from the text used for classification only.
    const textForClassify = chunk.replace(/^(\/\/[^\n]*\n\s*)+/, '').trimStart();

    const isDefinition =
      /^module\s/.test(textForClassify)       ||
      /^function\s/.test(textForClassify)     ||
      /^use\s*</.test(textForClassify)        ||
      /^include\s*</.test(textForClassify)    ||
      /^[a-zA-Z_$][a-zA-Z0-9_$]*\s*=/.test(textForClassify); // variable assignment

    if (isDefinition) defs.push(chunk);
    else              calls.push(chunk);
  }

  return { defs, calls };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Injects OpenSCAD transform wrappers (translate/rotate/scale) around the
 * top-level render calls in `code`, replacing any previously injected block.
 *
 * Returns the original code unchanged if the transform is identity or there
 * are no renderable statements to wrap.
 */
export function applyTransformToScad(code: string, t: MeshTransform): string {
  const [tx, ty, tz] = t.translate;
  const [rx, ry, rz] = t.rotate;
  const [sx, sy, sz] = t.scale;

  // Check for identity transform (within floating-point noise)
  const EPSILON = 1e-4;
  const isIdentity =
    Math.abs(tx) < EPSILON && Math.abs(ty) < EPSILON && Math.abs(tz) < EPSILON &&
    Math.abs(rx) < EPSILON && Math.abs(ry) < EPSILON && Math.abs(rz) < EPSILON &&
    Math.abs(sx - 1) < EPSILON && Math.abs(sy - 1) < EPSILON && Math.abs(sz - 1) < EPSILON;

  // Strip any previously injected block, then re-split
  const stripped       = stripSentinel(code);
  const { defs, calls } = splitStatements(stripped);

  if (calls.length === 0) return code; // nothing to wrap

  if (isIdentity) {
    // Strip the sentinel block (resets any previous transform)
    return defs.length > 0 ? `${defs.join('\n\n')}\n\n${calls.join('\n\n')}` : calls.join('\n\n');
  }

  // Build only the non-identity transform steps
  const steps: string[] = [];
  if (Math.abs(tx) >= EPSILON || Math.abs(ty) >= EPSILON || Math.abs(tz) >= EPSILON)
    steps.push(`translate([${fmt(tx)}, ${fmt(ty)}, ${fmt(tz)}])`);
  if (Math.abs(rx) >= EPSILON || Math.abs(ry) >= EPSILON || Math.abs(rz) >= EPSILON)
    steps.push(`rotate([${fmt(rx)}, ${fmt(ry)}, ${fmt(rz)}])`);
  if (Math.abs(sx - 1) >= EPSILON || Math.abs(sy - 1) >= EPSILON || Math.abs(sz - 1) >= EPSILON)
    steps.push(`scale([${fmt(sx)}, ${fmt(sy)}, ${fmt(sz)}])`);

  // Indent and wrap render calls in a braced block
  const indented = calls.map(c => '  ' + c.replace(/\n/g, '\n  ')).join('\n\n');
  const block = [
    SENTINEL,
    `${steps.join('\n')} {`,
    indented,
    `}`,
  ].join('\n');

  return defs.length > 0 ? `${defs.join('\n\n')}\n\n${block}` : block;
}
