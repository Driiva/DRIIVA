/**
 * Source readers the laws share: a line locator, a CSS string decoder, and the
 * `content:` declaration walker one law uses instead of a regex. Extracted
 * verbatim from tests/fabrication-laws.mjs.
 */


export function lineOf(source, index) {
  return source.slice(0, index).split('\n').length;
}

/**
 * Resolve CSS escapes so a decorative glyph is not mistaken for copy.
 * `\2014` is an em dash, not the number 2014, and there are a lot more
 * pseudo-element bullets in a stylesheet than there are sentences.
 */
export function decodeCssString(raw) {
  return raw
    .replace(/\\([0-9a-fA-F]{1,6})\s?/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/\\(.)/g, '$1');
}

/**
 * Pull every `content` declaration out of a stylesheet.
 *
 * Anchored on a property boundary on purpose: `justify-content` and
 * `align-content` are the two commonest declarations in this codebase and a
 * bare /content:/ matches the tail of both, which would bury the real hits
 * under 28 false ones and get the law switched off within a week.
 */
export function extractContentDeclarations(source) {
  const out = [];
  const decl = /(^|[;{}\s])content\s*:\s*([^;}]+)/g;
  for (const m of source.matchAll(decl)) {
    const value = m[2];
    const valueAt = m.index + m[0].length - value.length;

    // attr() renders whatever an attribute holds, which is copy arriving on
    // screen by a route none of the source laws are reading.
    for (const a of value.matchAll(/attr\(\s*([^)]+?)\s*\)/g)) {
      out.push({ index: valueAt + a.index, text: `attr(${a[1]})` });
    }

    for (const s of value.matchAll(/(['"])((?:\\.|(?!\1).)*)\1/g)) {
      const decoded = decodeCssString(s[2]);
      // Two or more consecutive letters, or two or more consecutive digits.
      // A lone glyph, a separator, an empty string or a single counter suffix
      // is furniture; words and figures are the page talking to someone.
      if (!/\p{L}{2,}|\d{2,}/u.test(decoded)) continue;
      out.push({ index: valueAt + s.index, text: decoded });
    }
  }
  return out;
}
