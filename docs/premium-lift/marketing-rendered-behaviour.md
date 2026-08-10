# apps/marketing scored on rendered behaviour

Harvested 10 August 2026 by driving the running site over CDP, not by reading
source. It is the companion to `checklist-design-audit.md` and deliberately not
part of it: that document scores `client/`, the signed-in app, and the two are
different surfaces with different checklists in scope.

Everything below is a check that **source cannot settle**. Whether a component
declares `role="status"` is a source question and was already answerable. When
validation fires, what a screen reader is actually told, whether an error clears
once the reader fixes it, whether Enter opens the accordion: those need the page
running and a keyboard driven at it.

Ten of the sixteen harvested checklists apply to a marketing site with one form,
one accordion, a sticky bar and five legal routes. Modal, Skeleton, Empty State,
Toast, Tab Bar Navigation and Onboarding have no counterpart on this surface and
are not scored rather than scored generously.

Probe: `/Users/joa/.claude/jobs/f63a9e0e/tmp/behaviour.mjs`. Re-run with the dev
server up and Chrome listening on 9222:

```
cd apps/marketing && npx vite --port 5271 --strictPort &
node behaviour.mjs http://localhost:5271
```

---

## What holds

**Document and landmarks.** `lang="en-GB"`, exactly one `h1`, no skipped heading
levels anywhere in the page, `main` / `nav` / `footer` all present, the `nav`
carries an `aria-label`, and all nine images have an `alt` attribute. This is the
part of the accessibility checklist the site passes cleanly.

**The form's markup is right.** The email field has an accessible name
("Email address"), `type="email"`, `autocomplete="email"`, `inputmode="email"`.
The submit control is a real `<button type="submit">`. The form sets `noValidate`
so the browser's own bubble does not fight the site's copy, which is the correct
choice and the reason the messages read in Driiva's voice rather than Chrome's.
The status region has `role="status"` and `aria-live="polite"`.

**Validation does not fire per keystroke.** Typing `not-an-email` character by
character produced an empty status region throughout. The Input Field checklist
asks for exactly this and a great many sites fail it; this one does not.

**The accordion is a native disclosure and answers a keyboard.** Five
`<summary>` controls, focusable, and Enter opens the first one (`open: true`,
answer 90px tall) and Enter again closes it. Because it is `<details>`/`<summary>`
rather than a div with a click handler, the expanded state is communicated by the
element itself and no `aria-expanded` bookkeeping is needed. Worth stating
plainly since it looks like a gap if you go looking for the ARIA attribute.

Note for whoever re-runs the probe: a bare `keyDown`/`keyUp` pair does **not**
trigger `<summary>`'s default action, and measuring `tabIndex` on the `<details>`
wrapper rather than the `<summary>` reports a working accordion as broken. Both
of those produced a false failure on the first pass here. The probe now uses a
`rawKeyDown`/`char`/`keyUp` sequence and targets the `summary`.

---

## What does not

Ordered by what it costs the person on the other end.

### 1. A corrected email is still told it is wrong

The clearest defect on the surface. Submit `not-an-email`, get "That email
doesn't look right. Give it another go.", then correct the field, and the error
is still sitting there: `statusStillShowing: true` with the original text. It
clears only on the next submit.

The Showing input error checklist asks for the error to clear when the input is
corrected, and the reason is exactly this case: the reader has already done what
was asked and the page has not noticed. `Hero.tsx` and `FinalCTA.tsx` both hold
`message` in state and only rewrite it inside `handleSubmit`, so nothing clears
it on change.

### 2. The field never tells assistive tech it is invalid

`aria-invalid` is `null` on the input before and after a failed submit, and there
is no `aria-describedby` tying the field to the message. The polite live region
announces the message once when it appears. A reader who tabs back to the field
afterwards is told "Email address, edit text" with no indication that it is in an
error state or what the error was.

The fix is small and entirely in the two components: set `aria-invalid` while
`status === 'error'`, give the status region an `id`, and point
`aria-describedby` at it.

### 3. Focus is not moved to the field that failed

After an invalid submit, `document.activeElement` is `BODY`. The Submitting a
form checklist asks for focus to land on the first field with an error. A
keyboard or screen-reader user has to find their own way back to it.

### 4. No skip link

`skipLink: false`. With a fixed nav and thirteen sections, a keyboard user has no
way past the header, and the tab order runs through every FAQ control before it
reaches anything else. This is the single cheapest accessibility win here.

### 5. Focus indication is mostly the browser's, not the site's

Four focus rules exist in roughly 2,100 lines of `global.css`:
`.nav-link:focus-visible`, `.nav-link:focus-visible::after`,
`.waitlist-form:focus-within` and `.footer-social:focus-visible`. Everything else
falls back to Chrome's default ring, which the probe measured as
`outline: auto 1px rgb(0, 95, 204)` on the submit button, the footer links and
every `summary`.

That is not nothing, and it is better than `outline: none`. But it is a blue ring
sitting on an amber-to-indigo ground, it is inconsistent with the two controls
that do have a designed ring, and it changes appearance between browsers on a
page where everything else is specified to the pixel. The email input itself
computes `outline-style: none` when focused and delegates its indication to
`:focus-within` on the wrapper, which works visually but means the control is not
the thing that shows focus.

### 6. Validation waits for submit, including on blur

Typing an invalid address and blurring the field produced no message. Only submit
does. This is a softer finding than the others and there is a real argument for
submit-only, since blur-time errors interrupt people who are still mid-thought.
Recording it because the checklist asks for blur and someone will otherwise score
it again from scratch: it is a decision, not an oversight, and should be written
down as one either way.

### 7. The 404 route keeps the homepage title

Navigating to `/definitely-not-a-page` renders `h1` "Not found.", but
`document.title` is still
"Driiva - car insurance for young UK drivers, no black box". The 404 checklist
wants the page to identify itself, and the title is what a reader with fifteen
tabs open, and every crawler, actually reads.

---

## Not verified

Two checks did not complete. The browser on 9222 went down mid-run, twice, while
another agent was restarting it, and relaunching a browser is not something this
pass will do on its own.

- **The rest of the 404.** Title and `h1` were captured. Link count and whether
  the wordmark serves on that route were not.
- **Reduced motion on the reveals.** The shader is confirmed static under
  `prefers-reduced-motion: reduce`, measured separately over five composited
  frames. What is not confirmed is that every `.reveal-init` element resolves to
  visible rather than staying at `opacity: 0`. `global.css` carries the rule that
  should do it, but a rule existing is a source fact, which is the kind of
  evidence this document exists to avoid relying on. The probe's last block
  measures it; it needs one clean run.

Neither is scored. An unverified check recorded as a pass is worse than no check.

---

## Prioritised

1. Clear the form error when the input changes (defect 1). A reader who has
   already fixed the problem is being told they have not.
2. `aria-invalid` plus `aria-describedby` on both forms, and move focus to the
   failed field (defects 2 and 3). Three small changes, same two files.
3. Add a skip link (defect 4).
4. Decide the focus-ring question once and apply it globally (defect 5), rather
   than leaving four controls styled and the rest on the browser default.
5. Give the 404 its own title (defect 7).
6. Write down the submit-only validation decision (defect 6), whichever way it
   goes.

Nothing here is a regression from the premium-lift work. Items 1, 2, 3, 6 and 7
predate it; item 4 has always been absent; item 5 is unchanged except that the
nav link ring is new and is one of the two that now exists.
