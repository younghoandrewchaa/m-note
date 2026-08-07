# Inline code copy button — design

Date: 2026-08-07

## Problem

The editor renders text wrapped in backticks as inline code. To copy an inline
code span, the user must select it by hand — fiddly for short spans such as
`x`, and easy to get wrong at the boundaries. Code *blocks* already have a copy
button; inline code has nothing.

## Goal

Hovering an inline code span reveals a small copy button. One click puts the
span's text on the clipboard.

## Constraints

Inline code is a Tiptap *mark* (`Code`, from StarterKit), not a node, so it
cannot have a NodeView the way `CodeBlock` does. Whatever we add must also
leave the document untouched, so markdown serialisation is unaffected.

## Approach

A React hover overlay driven by DOM events. A single button, `position: fixed`
in viewport coordinates, is rendered next to the editor and moved to whichever
inline code span the pointer is over. Nothing is inserted into the document and no ProseMirror
decorations are involved, so neither the markdown output nor caret behaviour
changes.

Two approaches were rejected:

- **ProseMirror widget decorations.** More idiomatic, but widgets inside inline
  content disturb caret movement and selection, and a hover-only variant means
  recomputing decorations as the mouse moves.
- **CSS `::after` icon with a delegated click handler.** Least code, but a
  pseudo-element is not a focusable button, cannot carry an `aria-label`,
  shifts text as it appears, and cannot show a "copied" state.

## Structure

| File | Purpose |
|---|---|
| `src/lib/inline-code-copy.ts` | Pure helpers — no React, no listeners |
| `src/components/tiptap-ui/inline-code-copy/inline-code-copy-button.tsx` | The hover overlay component |
| `src/components/tiptap-ui/inline-code-copy/inline-code-copy-button.scss` | Co-located styles |
| `src/__tests__/inline-code-copy.test.ts` | Tests for the helpers |

`simple-editor.tsx` gains one line — `<InlineCodeCopyButton editor={editor} />`
inside the editor container. No extension is registered and no other file
changes.

### Helpers (`src/lib/inline-code-copy.ts`)

- `findInlineCodeElement(target: EventTarget | null): HTMLElement | null`
  Walks up from an event target to the nearest `<code>`. Returns `null` when
  there is none, or when that `<code>` is inside a `<pre>` — code blocks keep
  their own button.

- `computeButtonPosition(rect, button, viewport): { top: number; left: number }`
  Right-aligns the button to the span and places it 4px above. Clamps into the
  viewport horizontally and flips below the span when there is no room above.

Both are pure functions over plain geometry and DOM nodes, so they are directly
unit-testable.

### Component (`inline-code-copy-button.tsx`)

Attaches `mouseover` and `mouseout` to `editor.view.dom`. Entering an inline
code span stores the element and shows the button. Leaving hides it after a
~150ms grace period, so the pointer can travel from the span to the button;
hovering the button cancels the pending hide.

Clicking calls the existing `copyCodeToClipboard(el.textContent)` from
`src/lib/copy-code.ts` and swaps `ClipboardCopyIcon` for `CheckIcon` for two
seconds — the same feedback, icons, and `aria-label="Copy code"` as the
code-block button.

## Interaction details

**Wrapped spans.** A `<code>` wrapping across two lines has a bounding rect
covering both. The button anchors to `getClientRects()[0]`, the first line box,
so it sits above the start of the span rather than over intervening text.

**Scrolling.** While the button is visible, a `scroll` listener on the editor's
scroll container hides it. Repositioning during scroll would add a hot listener
for a state the user leaves immediately.

**Editing while hovering.** If the user deletes the code span, the stored
element leaves the DOM. The component checks `isConnected` before positioning
and hides the button otherwise.

## Error handling

`copyCodeToClipboard` rejects when clipboard permission is denied. The click
handler wraps it in `try`/`catch`, logs the failure, and leaves the icon in its
copy state — never a false "copied" checkmark. Empty inline code already
returns `false` from the helper and likewise shows no feedback.

## Testing

`src/__tests__/inline-code-copy.test.ts`, jsdom, matching the existing suite's
style:

`findInlineCodeElement`
- returns the `<code>` when the target is the element itself
- returns the ancestor `<code>` when the target is nested inside it
- returns `null` for a `<code>` inside a `<pre>`
- returns `null` for a plain paragraph
- returns `null` for `null`

`computeButtonPosition`
- places the button above the span and right-aligned in the normal case
- flips below when the span sits at the top of the viewport
- clamps the left edge when the span sits at the viewport's left margin

The clipboard write itself is already covered by `code-block-copy.test.ts`,
which exercises the same shared helper.
