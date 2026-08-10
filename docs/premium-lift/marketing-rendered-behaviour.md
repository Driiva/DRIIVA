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

Ordered by what it costs the person on the other end. Items 1 to 5 and 7 were
fixed in `ad097c8`; each is kept here with what it was, because the finding is
the record and a document that deletes its own findings cannot be audited. The
status line under each says where it stands.

### 1. A corrected email is still told it is wrong

**Fixed in ad097c8.** Editing the field now retracts the rejection, and a test
covers it that was checked against the pre-fix code.

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

**Fixed in ad097c8.** `aria-invalid` is set while the error stands and
`aria-describedby` resolves to the status region carrying the message.

`aria-invalid` is `null` on the input before and after a failed submit, and there
is no `aria-describedby` tying the field to the message. The polite live region
announces the message once when it appears. A reader who tabs back to the field
afterwards is told "Email address, edit text" with no indication that it is in an
error state or what the error was.

The fix is small and entirely in the two components: set `aria-invalid` while
`status === 'error'`, give the status region an `id`, and point
`aria-describedby` at it.

### 3. Focus is not moved to the field that failed

**Fixed in ad097c8.** Focus moves to the input on a failed submit, in both forms.

After an invalid submit, `document.activeElement` is `BODY`. The Submitting a
form checklist asks for focus to land on the first field with an error. A
keyboard or screen-reader user has to find their own way back to it.

### 4. No skip link

**Fixed in ad097c8.** Added as the first element in the tab order, held off-screen
with a transform rather than `display:none`, which would have removed it from
the tab order and defeated the point.

`skipLink: false`. With a fixed nav and thirteen sections, a keyboard user has no
way past the header, and the tab order runs through every FAQ control before it
reaches anything else. This is the single cheapest accessibility win here.

### 5. Focus indication is mostly the browser's, not the site's

**Fixed in ad097c8.** One ring, defined once in brand amber with a dark outer
ring so it holds at both ends of the wash. This got more urgent, not less,
after the background became the canonical wash: the browser default is a blue
ring that sits around 3:1 on the indigo end and disappears into the amber.

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

**Open, and deliberately.** See the reasoning below; it needs a decision
recorded, not a change made.

Typing an invalid address and blurring the field produced no message. Only submit
does. This is a softer finding than the others and there is a real argument for
submit-only, since blur-time errors interrupt people who are still mid-thought.
Recording it because the checklist asks for blur and someone will otherwise score
it again from scratch: it is a decision, not an oversight, and should be written
down as one either way.

### 7. The 404 route keeps the homepage title

**Open.** Not fixed: the title is set by `useRouteMeta`, which is a routing
concern rather than a form one, and bundling it into an accessibility commit
would have hidden it.

Navigating to `/definitely-not-a-page` renders `h1` "Not found.", but
`document.title` is still
"Driiva - car insurance for young UK drivers, no black box". The 404 checklist
wants the page to identify itself, and the title is what a reader with fifteen
tabs open, and every crawler, actually reads.

---

## Not verified

Still two, and they are the same two. Chrome on 9222 was down again for the whole
of the follow-up attempt, with no process running at all, and this pass does not
launch a browser to get around that.

- **The rest of the 404.** Title and `h1` were captured on the original run. Link
  count and whether the wordmark serves on that route were not.

- **Reduced motion on the reveals, in the browser.** Partly closed, and the split
  matters. There are two independent mechanisms that make a `.reveal-init`
  element visible under reduced motion, and only one of them is now covered:

  - The **JS path**, where `useReveal` and the hero timeline assign the resting
    style directly, is now under test (`Hero.test.tsx`, "leaves nothing hidden
    when reduced motion is on"). That test is worth more than the probe run it
    replaces, because it runs on every commit rather than once.
  - The **CSS path**, the `.reveal-init` override inside
    `@media (prefers-reduced-motion: reduce)`, is what catches any element the JS
    never reaches, which is every element whose section has not intersected. It
    is **not** covered. jsdom applies no stylesheet, so a jsdom test would report
    those elements as `opacity: 0` and manufacture a bug that does not exist.
    Reading the file says it resolves: the override sits at line 2235, after the
    base rule at 2217, at equal specificity, so it wins. That is a source fact,
    which is the kind of evidence this document exists to avoid relying on.

  So: the half that can be proven without a browser is proven and locked down.
  The half that cannot is still open, and one clean probe run closes it.

Neither is scored. An unverified check recorded as a pass is worse than no check,
and a jsdom test standing in for a browser one would be worse than either.

---

## Prioritised

Items 1 to 5 are done (`ad097c8`). What is left:

1. Close the CSS half of the reduced-motion reveal check with one browser run.
   It is the only open item that could mean content is invisible to somebody.
2. Give the 404 its own title (defect 7).
3. Write down the submit-only validation decision (defect 6), whichever way it
   goes, so it is not re-scored from scratch next time.
4. Extract the shared waitlist form. `Hero.tsx` and `FinalCTA.tsx` are
   near-identical, they have drifted before, and the accessibility fix had to be
   written twice into two files that must stay in step. Not a checklist item,
   but it is the reason a checklist item would get half-applied next time.

Nothing in the original list was a regression from the premium-lift work. Items
1, 2, 3, 6 and 7 predated it, item 4 had always been absent, and item 5 was
unchanged by it except that the canonical wash made the browser default ring
materially worse than it had been on the old, dimmer ground.
