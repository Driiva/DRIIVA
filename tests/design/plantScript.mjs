/**
 * The planted violation. Proves the laws can fail: without this, a harness
 * that silently matched nothing would report all green forever. Extracted
 * verbatim from tests/design-laws.mjs.
 */

export const PLANT_SCRIPT = `(() => {
  const el = document.createElement("div");
  el.id = "planted-violation";
  el.textContent = "Planted capsule - retired purple - em dash \\u2014 here";
  el.style.cssText = [
    "position:fixed", "left:8px", "bottom:8px", "z-index:99999",
    "width:120px", "height:28px",
    "border-radius:9999px",
    "background:#8B5CF6",
    "color:#3B82F6",
    "font-size:9px",
  ].join(";");
  /*
   * Inside #root, because that is where the laws look.
   *
   * This appended to document.body, and when the laws were scoped to #root to
   * stop a Recharts scratch node failing law 6, the plant silently fell
   * outside the element set FOUR of the six laws examine. The plant check
   * still printed "the gate works", because law 4 reads body text and fired on
   * its own. A plant that only proves one law is alive is a plant that lets
   * the other five rot.
   */
  (document.getElementById("root") || document.body).appendChild(el);
  return true;
})()`;

/**
 * The laws the plant is BUILT to trip: a capsule radius on an oblong (1), the
 * retired purple as a background and the retired blue as a colour (2 and 3),
 * an em dash in its text (4), and 9px type (5).
 *
 * Checking these by name rather than counting any failure is the difference
 * between a plant that proves the gate works and one that proves something
 * somewhere failed. Law 6 is excluded: the plant carries no figure, so it
 * cannot speak to that law and pretending otherwise would be its own lie.
 */
export const PLANT_TARGET_LAWS = ['1', '2', '3', '4', '5'];
