# Driiva web surfaces scored against checklist.design

Harvested 10 August 2026 by driving checklist.design over CDP on the running
Chrome. It is a client-rendered SPA, so a plain fetch returns an empty shell and
every earlier attempt to "read the checklists" would have read nothing.

The site carries 112 checklists. Sixteen apply to Driiva's web surfaces and were
pulled in full; the raw harvest is reproducible with
`node checklist.mjs https://www.checklist.design/<path>`.

| checklist | items | source |
|---|---|---|
| Button | 5 | /design-system/button |
| Input Field | 6 | /design-system/input-field |
| Loading | 5 | /design-system/loading |
| Skeleton | 5 | /design-system/skeleton |
| Card | 5 | /design-system/card |
| Modal | 6 | /design-system/modal |
| Badge | 3 | /design-system/badge |
| Toast | 6 | /design-system/toast |
| Accessibility | 8 | /design-system/accessibility |
| Typography | 8 | /design-system/typography |
| Empty State | 6 | /web-app/empty-state |
| Onboarding | 7 | /mobile/onboarding |
| Tab Bar Navigation | 7 | /mobile/tab-bar-navigation |
| 404 | 5 | /website/404 |
| Showing input error | 4 | /flows/showing-input-error |
| Submitting a form | 6 | /flows/submitting-a-form |

There is no checklist named "navigation", "error states" or "cards and modals"
as a single list. Tab Bar Navigation, Modal and Card are the nearest real ones
and are what was used. Nothing below is invented: an item that does not exist on
the site does not appear here.

This is a source audit. Where a check depends on rendered behaviour that source
cannot settle, it is marked unverified rather than guessed.

---

## 404

Scored against /website/404. **5 of 5** after this pass, **0 of 5** before it.

| item | before | after | evidence |
|---|---|---|---|
| Logo | fail | pass | `client/src/pages/not-found.tsx:28` renders the wordmark |
| Title | fail | pass | was "404 Page Not Found" in gray-900 on gray-50, inside a dark app |
| Description | fail | pass | was "Did you forget to add the page to the router?", a line written to the developer and shipped to drivers |
| Links to other pages | fail | pass | dashboard and support, `not-found.tsx:53` and `:66` |
| Brand flair | fail | partial | wordmark and ground only. An illustration is deliberately declined: restraint is the brand |

The larger finding sat one level up. The page was not routed at all. The
catch-all in `client/src/App.tsx` was `<Route>{() => <Redirect to="/" />}</Route>`,
so a dead or mistyped link bounced silently to the landing page and read as
being signed out. The 404 is now the catch-all.

## Empty State

Scored against /web-app/empty-state. **5 of 6.**

| item | verdict | evidence |
|---|---|---|
| Illustration or icon | pass | `client/src/components/ui/EmptyState.tsx:31` takes a Lucide icon, never an emoji |
| Clear heading | pass | callers pass specific headings, for example leaderboard.tsx:488 |
| Supporting description | pass | `EmptyState.tsx:49` |
| Primary action | pass | optional `action` slot, `EmptyState.tsx:55` |
| Zero state vs no-results | pass | leaderboard.tsx:489 distinguishes the friends scope from the global board |
| Error state variant | **fail** | there is no error variant. A failed read renders the same "nothing here yet" as a genuinely empty collection, which is exactly the case the checklist calls out: the user is told they have no trips when the truth is the request failed |

The error variant is the one clear-cut gap left in this component and is not
fixed in this pass, because the fix belongs with whoever owns the read paths.

## Loading

Scored against /design-system/loading. **4 of 5.**

| item | verdict | evidence |
|---|---|---|
| Visual indicator | pass | `ArcTracer`, `client/src/components/motion/Instrument.tsx` |
| Text | **partial** | the app-level waits now name what is loading ("Loading GPS data", "Verifying admin access"), but most call sites still show a bare indicator |
| Time | pass | skeletons for data reads, tracer for actions |
| Accessibility | pass | `ArcTracer` carries `role="status"` and a label; it was previously a bare div |
| Visuals | n/a | an illustration during loading is against the brand here |

Fixed in this pass: three loaders were hand-rolled in blue, purple and emerald.
Emerald on this palette means an earned score, so spending it on "still
loading" broke the colour rule. All three are now the one tracer.

## Skeleton

Scored against /design-system/skeleton. **5 of 5.**

Shape matches content (`EmptyState.tsx` SkeletonStat and SkeletonRow are sized
to the real thing so the page does not reflow), the sweep is low contrast, it is
`aria-hidden` with `aria-busy` on the list, and reduced motion drops the
animation. One defect was found and fixed: the bars carried an 8px radius on an
8px-tall box, which is a capsule.

## Button

Scored against /design-system/button. **4 of 5.**

| item | verdict | evidence |
|---|---|---|
| Base style | pass | `client/src/components/ui/button.tsx:8` |
| Shape | pass | radius from `--radius`, no capsules |
| Variants | pass | six variants, `button.tsx:11` |
| Copy | **partial** | mostly specific, but generic labels survive in places |
| States | pass | hover, `focus-visible:ring-2`, and disabled all defined |

## Input Field and input errors

Scored against /design-system/input-field and /flows/showing-input-error.
**Unverified on the error flow.**

`client/src/components/ui/input.tsx:11` has focus and disabled states. Whether
validation fires on blur rather than on every keystroke, and whether the error
clears on refocus, is a react-hook-form configuration question per form and
cannot be settled from the component. Not scored rather than guessed.

## Toast

Scored against /design-system/toast. **5 of 6.**

Copy, usage, variants, placement and dismissal all hold. One real defect:
`client/src/hooks/use-toast.ts:9` sets `TOAST_REMOVE_DELAY = 1000000`, which is
the shadcn template default and means a dismissed toast sits in state for
sixteen minutes. Radix auto-closes the visible toast at its own duration, so
this is not visible to a driver; it is a leak, not a bug in the UI, and is
listed here rather than silently fixed because it sits in shared state.

## Typography

Scored against /design-system/typography. **7 of 8**, up from 3 of 8.

The ladder now carries size, leading and tracking per step, tabular figures are
on every readout, three weights are declared instead of five, and a measure is
available. See the I4 commit for the detail. The remaining gap is that a
documented type specimen page does not exist.

## Accessibility

Scored against /design-system/accessibility. **4 of 8, and this is the weakest
area.**

| item | verdict | note |
|---|---|---|
| Target conformance level | **fail** | no stated WCAG target anywhere in the repo |
| Colour contrast standards | unverified | needs a measured pass, not a source read |
| Focus indicator design | pass | `focus-visible` rings on button and input |
| Keyboard navigation | partial | `Readout.tsx` handles Enter and Space; not audited app-wide |
| ARIA pattern library | partial | Radix supplies it for the primitives it owns |
| Reduced motion | pass | every motion primitive honours it, and it is now under test in `tests/unit/motion-primitives.test.tsx` |
| Screen reader labels | partial | the loading indicator and the text reveals are labelled; not audited app-wide |
| Testing and tooling | **fail** | the budget names axe on four routes; no axe run exists |

Naming this plainly: accessibility is the area where Driiva is furthest from
the bar, and nothing in this pass closes it beyond reduced motion and the two
labels. An axe run on dashboard, leaderboard, trips and rewards is the next
thing worth doing and it is not done.

## Card, Badge, Modal, Tab Bar, Onboarding

Not individually scored. Card and Badge are covered in effect by the design-law
run, which now reaches the real pages; Modal, Tab Bar and Onboarding need
rendered-behaviour checks (focus trap, escape to dismiss, safe-area insets,
skip and resume) that a source read cannot settle honestly.

---

## Prioritised, still open

1. `client/src/components/ui/EmptyState.tsx` needs an error variant, and the
   five callers need to pass it. Telling a driver they have no trips when the
   read failed is the single most misleading state in the app.
2. No axe run exists. The budget asks for zero serious or critical on four
   routes and that number has never been measured.
3. No stated WCAG target. Pick AA, write it down, then the rest of the
   accessibility checklist becomes checkable rather than a matter of opinion.
4. `client/src/hooks/use-toast.ts:9` carries the template's 1000000ms removal
   delay.
5. Title Case survives on several headings ("Recent Trips", "Driving Score")
   where the design system asks for sentence case.

## What was fixed in this pass

- The 404 page and its routing, from 0 of 5 to 5 of 5.
- The skeleton capsule radius.
- Three off-brand loaders, and the missing `role="status"` on the indicator.
- Secondary type below the 13px floor, and non-tabular distance readouts.
- The Demo Mode capsule, pasted into four files in a colour reserved for an
  earned score.
- Six em dashes standing in for "no value yet" on rewards.
- The design-law harness itself, which had been reporting green on four routes
  it never reached.
