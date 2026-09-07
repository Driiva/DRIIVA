/**
 * The fabrication shapes this harness looks for. Extracted verbatim from
 * tests/fabrication-laws.mjs.
 */
import { extractContentDeclarations } from './extract.mjs';

/**
 * The shapes. Each is deliberately broad: a false positive costs one allowlist
 * line, a false negative costs a regulatory incident.
 */
export const LAWS = [
  {
    /*
     * This law was a list of spellings, and a paraphrase walked past it.
     *
     * It matched `FCA-authorised`, `FCA-regulated`, `FCA-supervised`. Eight
     * files said "our insurance product is pending FCA authorisation" and not
     * one of them tripped it, because "authorisation" is not "authorised".
     * The regex never fired, so the reconciliation of 10 Aug looked like it
     * held for sixteen days while four screens had already been reverted and
     * four more had never been in scope.
     *
     * Adding `pending FCA` to the list would fix those eight and miss the
     * ninth. "Awaiting FCA sign-off", "our FCA application", "FCA approval in
     * progress" are all the same claim wearing different words, and a guard
     * that enumerates the failures it has already seen only ever catches the
     * failure it has already seen.
     *
     * So this matches the SHAPE instead: the letters FCA within a short span
     * of any word that asserts a position in front of it, in either order.
     * That deliberately fires on the TRUE sentences too, including the agreed
     * one, and every one of them is signed off by name in ALLOWED with the
     * reason it is true. A false positive costs one allowlist line. A false
     * negative costs a regulatory incident, and just did.
     */
    id: 'regulatory-claim',
    title: 'Claims about regulated status, underwriting or capacity',
    pattern: new RegExp(
      [
        // FCA, then a status word close behind it.
        String.raw`\bFCA\b[^.\n]{0,40}?\b(authoris\w+|approv\w+|regulat\w+|supervis\w+|registr\w+|licen[cs]\w+|permission\w*|sandbox|application|sign[- ]off)\b`,
        // A status word, then FCA close behind it. Catches "pending FCA
        // authorisation" from the other end, and "applied to the FCA".
        String.raw`\b(pending|awaiting|await\w+|applied|applying|application|submitted|in review|under review|approved|authoris\w+|registered|licen[cs]\w+)\b[^.\n]{0,40}?\bFCA\b`,
        // The claims that never mention the FCA by name.
        String.raw`authorised and regulated`,
        String.raw`we are authorised`,
        String.raw`regulated by the Financial Conduct`,
        String.raw`PRA[- ]regulated`,
        String.raw`underwritten by`,
        String.raw`capacity partner`,
        String.raw`reinsur\w*`,
        String.raw`registration number`,
      ].join('|'),
      'gi',
    ),
  },
  {
    id: 'invented-scale',
    title: 'Claims about how many people already use this',
    pattern:
      /thousands of (drivers|members|users|people)|hundreds of (drivers|members|users)|join \d[\d,]* |trusted by|\d[\d,]* (drivers|members|users) (already|have|are)|top \d+% of drivers/gi,
  },
  {
    id: 'settled-money',
    title: 'Claims that money has moved or will move',
    pattern:
      /refunds? (tracked|paid|processing|processed)|paid (out )?(within|in) \d+ (days|weeks)|claims? (is|are) paid|you (will|'ll) (get|receive) £|already (paid|refunded)/gi,
  },
  {
    id: 'placeholder-identity',
    title: 'Placeholder people, contacts and addresses that can reach a user',
    pattern:
      /Test Driver|John Doe|Jane Doe|lorem ipsum|example\.com|test@[a-z]|\b0800 ?\d{3} ?\d{4}\b|DRV\d{6}/gi,
  },
  {
    /*
     * WAVE H taught this one. Three separate places asserted a state nobody
     * had checked, all with the same shape: a value we did not have, replaced
     * by a plausible one. `status: 'active'` written whatever the insurer
     * said. `policy_number || DRV-${Date.now()}`. A safety factor defaulting
     * to 1.0 and rendering as "100%". A name falling back to "Driver Unknown"
     * on an insurance record.
     *
     * The tell is a fallback operator supplying a CONFIDENT value for
     * something only an external system can answer. A null or an empty state
     * is fine; a confident stand-in is the bug.
     */
    id: 'invented-fallback',
    title: 'A confident stand-in for something only an insurer or a person can tell us',
    pattern:
      /(\|\||\?\?)\s*['"`](active|confirmed|approved|bound|Unknown|Test Driver)['"`]|(\|\||\?\?)\s*`?DRV-|(\|\||\?\?)\s*1\.0\s*[,;)]/g,
  },
  {
    id: 'money-literal',
    title: 'A pounds figure written into a rendered surface',
    // Components and stylesheets only: a literal in a .ts helper is usually
    // maths, a literal in a component or a content string is a number
    // somebody reads.
    pattern: /£\s?\d[\d,]*(\.\d+)?\s?[kKmM]?/g,
    filesOnly: /\.(tsx|css)$/,
  },
  {
    id: 'stylesheet-copy',
    title: 'A stylesheet printing words or figures onto the page',
    // Any readable string in a `content` declaration. Not every hit is a lie:
    // a responsive column label is legitimate. But a stylesheet is the one
    // place copy can be written with no component, no prop and no data source
    // behind it, so it does not get to state anything unacknowledged.
    filesOnly: /\.css$/,
    extract: extractContentDeclarations,
  },
  {
    id: 'stylesheet-image-copy',
    title: 'Text baked into an inline SVG background image',
    // A data URI is a rendering surface that reads as a URL. Words inside one
    // are invisible to every text search anybody thinks to run.
    filesOnly: /\.css$/,
    pattern: /url\(\s*["']?data:image\/svg\+xml[^)]*?(?:<text|%3Ctext)[^)]*\)/gi,
  },
];

