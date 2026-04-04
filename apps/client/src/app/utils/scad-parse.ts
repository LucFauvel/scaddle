// ─── SCAD parameter + structure parser ────────────────────────────────────────
// Extracts top-level variable assignments (for the Properties panel) and
// module/function definitions (for the Structure panel) from OpenSCAD source.

export type ParamType = 'number' | 'string' | 'boolean' | 'vector' | 'other';

export interface ScadParam {
  name: string;
  rawValue: string;   // raw text as it appears in the source (no trailing ;)
  type: ParamType;
  line: number;       // 0-indexed line number in the source
}

export interface ScadSymbol {
  name: string;
  kind: 'module' | 'function';
  line: number;
}

function inferType(raw: string): ParamType {
  const t = raw.trim();
  if (t === 'true' || t === 'false') return 'boolean';
  if (/^".*"$/.test(t))             return 'string';
  if (/^\[/.test(t))                return 'vector';
  if (/^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(t)) return 'number';
  return 'other';
}

/**
 * Parses OpenSCAD source and returns top-level variable assignments and
 * module/function definitions.
 *
 * Only statements at brace-depth 0 are considered. Block and line comments
 * are stripped before analysis.
 */
export function parseScad(code: string): { params: ScadParam[]; symbols: ScadSymbol[] } {
  const params:  ScadParam[]  = [];
  const symbols: ScadSymbol[] = [];

  const lines = code.split('\n');
  let depth          = 0;
  let inBlockComment = false;

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];

    // ── Consume block-comment continuation ──────────────────────────────────
    if (inBlockComment) {
      const end = line.indexOf('*/');
      if (end === -1) continue;
      line = line.slice(end + 2);
      inBlockComment = false;
    }

    // ── Strip inline block comments and start of multi-line block comments ──
    let stripped = '';
    let j = 0;
    while (j < line.length) {
      if (line[j] === '/' && line[j + 1] === '*') {
        const end = line.indexOf('*/', j + 2);
        if (end !== -1) { j = end + 2; continue; }
        inBlockComment = true;
        break;
      }
      stripped += line[j++];
    }
    line = stripped;

    // ── Strip line comments ──────────────────────────────────────────────────
    const lc = line.indexOf('//');
    if (lc !== -1) line = line.slice(0, lc);
    line = line.trim();

    const startDepth = depth;

    // Count braces so we know depth for the NEXT line
    for (const ch of line) {
      if (ch === '{') depth++;
      else if (ch === '}') depth--;
    }

    if (startDepth !== 0) continue; // only process top-level statements

    // ── module / function definition ────────────────────────────────────────
    const symMatch = line.match(/^(module|function)\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/);
    if (symMatch) {
      symbols.push({ name: symMatch[2], kind: symMatch[1] as 'module' | 'function', line: i });
      continue;
    }

    // ── Variable assignment or module parameter: name = value[;,] ──────────
    // Handles both top-level `x = 10;` and module param lines `x = 10,`
    const varMatch = line.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*(.+)$/);
    if (varMatch) {
      const name = varMatch[1];
      if (name === 'module' || name === 'function' || name === 'use' || name === 'include') continue;
      // Greedy match captures everything; strip trailing semicolon or comma
      const rawValue = varMatch[2].trim().replace(/[;,]\s*$/, '').trim();
      params.push({ name, rawValue, type: inferType(rawValue), line: i });
    }
  }

  return { params, symbols };
}

/**
 * Replaces the value of a top-level variable assignment in `code`.
 * Leaves the rest of the line (including trailing comments) untouched.
 */
export function updateScadParam(code: string, name: string, newRaw: string): string {
  const lines = code.split('\n');
  const reSemicolon = new RegExp(`^(\\s*${name}\\s*=\\s*)(.+?)(\\s*;.*)$`);
  const reComma     = new RegExp(`^(\\s*${name}\\s*=\\s*)(.+?)(\\s*,.*)$`);
  const rePlain     = new RegExp(`^(\\s*${name}\\s*=\\s*)(.+?)\\s*$`);
  for (let i = 0; i < lines.length; i++) {
    if (reSemicolon.test(lines[i])) {
      lines[i] = lines[i].replace(reSemicolon, `$1${newRaw}$3`);
      break;
    }
    if (reComma.test(lines[i])) {
      lines[i] = lines[i].replace(reComma, `$1${newRaw}$3`);
      break;
    }
    if (rePlain.test(lines[i])) {
      lines[i] = lines[i].replace(rePlain, `$1${newRaw}`);
      break;
    }
  }
  return lines.join('\n');
}
