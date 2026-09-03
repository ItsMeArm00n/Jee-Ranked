import katex from "katex";
import DOMPurify from "dompurify";

export function wrapBareLatex(text: string): string {
  if (text.includes("$")) return text;
  return `$${text}$`;
}

/**
 * Pre-process question text that has inconsistent/broken LaTeX delimiters
 * from the JEE import pipeline. Handles:
 *  - HTML/CSS artifacts (.tg table styles)
 *  - Orphaned $$ (closing without opening)
 *  - Bare \operatorname, \mathrm, \left, \frac, ^{}, _{} outside $ delimiters
 */
function cleanImportedText(text: string): string {
  let s = text;

  // Strip leftover HTML table CSS from scraping (e.g. ".tg .tg-c3ow{...}")
  s = s.replace(/\.tg\s+[^}]*\}/g, "");
  // Strip any remaining HTML tags
  s = s.replace(/<[^>]+>/g, "");

  // Normalise newlines
  s = s.replace(/\r?\n/g, " ");

  // ── Fix orphaned $$ ──────────────────────────────────────────────
  // Many imported questions have $$ at the END of a LaTeX expression
  // with no matching opening $$ (e.g. \operatorname{Re}(z)=0$$).
  // Strategy: find all $$ positions, pair them up. An unpaired trailing
  // $$ gets demoted to a single $.
  const ddPos: number[] = [];
  let idx = 0;
  while (idx < s.length) {
    if (s[idx] === "$" && s[idx + 1] === "$") {
      ddPos.push(idx);
      idx += 2;
    } else {
      idx++;
    }
  }
  if (ddPos.length % 2 !== 0) {
    // Last $$ is orphaned — convert to $
    const last = ddPos[ddPos.length - 1]!;
    s = s.slice(0, last) + "$" + s.slice(last + 2);
  }

  return s;
}

/**
 * Wrap bare LaTeX commands that appear outside any $…$ / $$…$$ delimiters.
 * Detects commands like \operatorname{…}, \mathrm{…}, \left(…\right),
 * \frac{…}{…}, ^{…}, _{…} that have no surrounding $.
 */
function wrapBareLatexCommands(text: string): string {
  // First, identify which character positions are inside $ delimiters
  const inside = new Set<number>();
  {
    let i = 0;
    while (i < text.length) {
      if (text[i] === "$" && text[i + 1] === "$") {
        // Display-math block — skip to closing $$
        const close = text.indexOf("$$", i + 2);
        if (close === -1) break;
        for (let j = i; j <= close + 1; j++) inside.add(j);
        i = close + 2;
      } else if (text[i] === "$") {
        // Inline-math block — skip to closing $
        const close = text.indexOf("$", i + 1);
        if (close === -1) break;
        for (let j = i; j <= close; j++) inside.add(j);
        i = close + 1;
      } else {
        i++;
      }
    }
  }

  // Find bare LaTeX command sequences outside math delimiters and wrap them.
  // We look for \cmd{…} patterns (with brace matching) and also ^{…} / _{…}.
  const LATEX_CMD =
    /\\(?:operatorname|mathrm|mathbb|mathcal|text|over|left|right|frac|sqrt|sum|prod|int|lim|sin|cos|tan|log|ln|exp|det|adj|mod|max|min|infty|partial|nabla|alpha|beta|gamma|delta|epsilon|theta|lambda|sigma|omega|phi|psi|chi|rho|tau|pi|mu|nu|xi|zeta|eta|kappa|veta|upsilon|ell|in|subset|supset|cup|cap|emptyset|forall|exists|nexists|therefore|because|neq|leq|geq|approx|equiv|sim|simeq|propto|perp|parallel|angle|triangle|circ|cdot|times|div|pm|mp|ast|star|dagger|vee|wedge|oplus|otimes|leqslant|geqslant|ll|gg|rightarrow|leftarrow|leftrightarrow|Rightarrow|Leftarrow|Leftrightarrow|uparrow|downarrow|to|mapsto|implies|iff|land|lor|lnot|neg)\s*\{/;
  const BARESUPER = /(?<![\\$a-zA-Z{}])\^{/;
  const BARESUB = /(?<![\\$a-zA-Z{}])_{/;

  // We need a brace-matching wrapper. Rather than full parsing, we find
  // the start of a bare command and then grab the balanced braces.
  let result = "";
  let i = 0;
  while (i < text.length) {
    if (inside.has(i)) {
      result += text[i];
      i++;
      continue;
    }

    // Check for bare \command{...}
    const cmdMatch = text.slice(i).match(LATEX_CMD);
    if (cmdMatch && cmdMatch.index === 0) {
      // Find the opening { and match balanced braces
      const braceStart = i + cmdMatch[0].length - 1; // position of {
      const balanced = grabBalanced(text, braceStart);
      if (balanced !== null) {
        result += "$" + text.slice(i, braceStart) + balanced + "$";
        i = braceStart + balanced.length;
        continue;
      }
    }

    // Check for bare ^{...}
    const supMatch = text.slice(i).match(BARESUPER);
    if (supMatch && supMatch.index === 0) {
      const braceStart = i + supMatch[0].length - 1;
      const balanced = grabBalanced(text, braceStart);
      if (balanced !== null) {
        result += "$" + text.slice(i, braceStart) + balanced + "$";
        i = braceStart + balanced.length;
        continue;
      }
    }

    // Check for bare _{...}
    const subMatch = text.slice(i).match(BARESUB);
    if (subMatch && subMatch.index === 0) {
      const braceStart = i + subMatch[0].length - 1;
      const balanced = grabBalanced(text, braceStart);
      if (balanced !== null) {
        result += "$" + text.slice(i, braceStart) + balanced + "$";
        i = braceStart + balanced.length;
        continue;
      }
    }

    result += text[i];
    i++;
  }

  return result;
}

/** Starting at `pos` (which should be '{'), return the balanced {...} substring or null. */
function grabBalanced(text: string, pos: number): string | null {
  if (text[pos] !== "{") return null;
  let depth = 0;
  let j = pos;
  while (j < text.length) {
    if (text[j] === "{") depth++;
    else if (text[j] === "}") {
      depth--;
      if (depth === 0) return text.slice(pos, j + 1);
    }
    j++;
  }
  return null; // unmatched
}

function renderMath(text: string): string {
  // Render $$...$$ as display math
  let out = text.replace(/\$\$(.*?)\$\$/gs, (_m, tex: string) => {
    try {
      return katex.renderToString(tex, { displayMode: true, throwOnError: false });
    } catch {
      return tex;
    }
  });
  // Render $...$ as inline math
  out = out.replace(/\$(.*?)\$/g, (_m, tex: string) => {
    try {
      return katex.renderToString(tex, { displayMode: false, throwOnError: false });
    } catch {
      return tex;
    }
  });
  return out;
}

export function renderLatex(text: string): string {
  const cleaned = cleanImportedText(text);
  const wrapped = wrapBareLatexCommands(cleaned);
  const html = renderMath(wrapped);
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      "span",
      "div",
      "p",
      "br",
      "b",
      "i",
      "em",
      "strong",
      "u",
      "s",
      "sub",
      "sup",
      "svg",
      "math",
      "semantics",
      "annotation",
      "mrow",
      "mi",
      "mo",
      "mn",
      "ms",
      "mfrac",
      "msqrt",
      "mroot",
      "msup",
      "msub",
      "msubsup",
      "munder",
      "mover",
      "munderover",
      "mtext",
      "mpadded",
      "mphantom",
      "mglyph",
      "mstyle",
      "mtable",
      "mtr",
      "mtd",
      "mlabeledtr",
      "none",
      "enclose",
      "a",
      "img",
      "table",
      "thead",
      "tbody",
      "tr",
      "th",
      "td",
    ],
    ALLOWED_ATTR: [
      "class",
      "style",
      "id",
      "title",
      "aria-hidden",
      "mathvariant",
      "stretchy",
      "fence",
      "separator",
      "accent",
      "accentunder",
      "symmetric",
      "movablelimits",
      "linethickness",
      "minlabelspacing",
      "depth",
      "height",
      "width",
      "lspace",
      "rspace",
      "voffset",
      "href",
    ],
    ALLOW_DATA_ATTR: false,
  });
}
