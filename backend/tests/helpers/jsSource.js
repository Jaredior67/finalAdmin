/* Small source-inspection helpers for the static regression tests.
 *
 * The tests that use these exist because Vite does not catch an undeclared
 * identifier: an unknown name is treated as a global reference and Rollup warns
 * rather than fails. The build passes, the page renders, and the ReferenceError
 * only fires when someone clicks. So these checks have to be textual.
 *
 * Hand-rolled rather than a parser, because there is no JSX parser in the
 * dependency tree and adding one to assert "is this variable declared" is not a
 * trade worth making. Each helper errs toward over-collecting, since a name it
 * wrongly believes is declared produces a missed failure rather than a false
 * alarm. */

/** Remove comments, so a phrase quoted in prose is not read as code. */
export function stripComments(src) {
  let out = '';
  let i = 0;
  let state = 'code';

  while (i < src.length) {
    const two = src.slice(i, i + 2);
    const ch = src[i];

    if (state === 'code') {
      if (two === '//') { state = 'line'; i += 2; continue; }
      if (two === '/*') { state = 'block'; i += 2; continue; }
      // Keep string literals intact so a brace inside one does not confuse the
      // brace matcher in functionBody().
      if (ch === "'" || ch === '"' || ch === '`') {
        const quote = ch;
        out += ch; i += 1;
        while (i < src.length) {
          if (src[i] === '\\') { out += src.slice(i, i + 2); i += 2; continue; }
          out += src[i];
          if (src[i] === quote) { i += 1; break; }
          i += 1;
        }
        continue;
      }
      out += ch; i += 1; continue;
    }

    if (state === 'line') {
      if (ch === '\n') { out += ch; state = 'code'; }
      i += 1; continue;
    }

    // block comment
    if (two === '*/') { state = 'code'; i += 2; continue; }
    if (ch === '\n') out += ch; // keep line numbers readable
    i += 1;
  }

  return out;
}

/** Every identifier this file binds in a declaration or parameter list. */
export function declaredNames(src) {
  const names = new Set();
  const clean = stripComments(src);

  const add = (text) => {
    for (const m of text.matchAll(/[A-Za-z_$][\w$]*/g)) names.add(m[0]);
  };

  // const/let/var, including every destructured name. Taking the text up to the
  // first `=` covers `const [a, setA] = …`, `const { a, setA } = …` and
  // `const x = …` without needing to know which of the three it is.
  for (const m of clean.matchAll(/\b(?:const|let|var)\s+([^=;]+)=/g)) add(m[1]);

  // function / arrow / method parameters, and `catch (e)`.
  for (const m of clean.matchAll(/[(]([^)]*)[)]\s*(?:=>|\{)/g)) add(m[1]);

  // Import bindings, including `as` renames and default imports.
  for (const m of clean.matchAll(/\bimport\s+([^;]+?)\s+from\b/g)) add(m[1]);

  // Class members and object-literal method shorthand.
  for (const m of clean.matchAll(/\b(?:class|function)\s+([A-Za-z_$][\w$]*)/g)) names.add(m[1]);

  return names;
}

/**
 * The body of a top-level `const name = (…) => { … }` or `function name (…) { … }`.
 *
 * Brace-matched rather than cut at the first blank line: these functions have
 * blank lines in the middle, and a naive cut silently truncates the test so it
 * passes against a fragment.
 */
export function functionBody(src, name) {
  const clean = stripComments(src);

  const arrow = new RegExp(`\\b(?:const|let|var)\\s+${name}\\s*=\\s*(?:async\\s*)?\\([^)]*\\)\\s*=>\\s*\\{`);
  const fn = new RegExp(`\\bfunction\\s+${name}\\s*\\([^)]*\\)\\s*\\{`);

  const match = clean.match(arrow) || clean.match(fn);
  if (!match) return null;

  const open = match.index + match[0].length - 1;
  let depth = 0;
  for (let i = open; i < clean.length; i += 1) {
    if (clean[i] === '{') depth += 1;
    else if (clean[i] === '}') {
      depth -= 1;
      if (depth === 0) return clean.slice(open + 1, i);
    }
  }
  return null;
}
