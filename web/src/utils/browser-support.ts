/**
 * Runtime feature probes for browsers below the build target.
 *
 * These exist for syntax that cannot be downleveled by the bundler, so the only
 * option is to avoid loading the code that uses it.
 */

// Written so the minifier cannot drop the probe. Constructing a RegExp and
// discarding it looks side-effect-free, so `new RegExp("(?<=a)b")` on its own
// gets removed and the check silently collapses to `true` — this is exactly how
// marked's bundled lookbehind detection ends up broken. Keeping the pattern in a
// variable and consuming the `test()` result keeps the call alive.
const LOOKBEHIND_PATTERN = "(?<=a)b";

/**
 * Safari gained lookbehind assertions in 16.4 (iOS 16.4), the same release that
 * added class static blocks. A lookbehind probe therefore also answers "would a
 * chunk containing static blocks parse here?", which is what actually decides
 * whether mermaid can be loaded.
 */
export const supportsLookbehind: boolean = (() => {
  try {
    return new RegExp(LOOKBEHIND_PATTERN).test("ab");
  } catch {
    return false;
  }
})();
