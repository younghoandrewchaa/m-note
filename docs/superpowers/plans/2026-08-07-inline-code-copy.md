# Inline Code Copy Button Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hovering an inline code span in the editor reveals a small floating copy button that puts the span's text on the clipboard in one click.

**Architecture:** Inline code is a Tiptap *mark*, not a node, so it cannot have a NodeView. Instead, a single React button (`position: fixed`) is rendered alongside the editor and moved to whichever inline `<code>` element the pointer is over, driven by `mouseover`/`mouseout` listeners on `editor.view.dom`. Nothing is inserted into the document and no ProseMirror decorations are used, so markdown output and caret behaviour are unaffected. All geometry and DOM-walking logic lives in pure helpers so it can be unit-tested.

**Tech Stack:** TypeScript, React 19, Tiptap 3 (`@tiptap/react`), SCSS (sass), Vitest 4.

Spec: `docs/superpowers/specs/2026-08-07-inline-code-copy-design.md`

## Global Constraints

- Path alias `@/` maps to `src/`. Use it in `src/components/**`; the existing tests in `src/__tests__/` use relative imports (`../lib/...`) — follow that in test files.
- Reuse the existing `copyCodeToClipboard` helper from `src/lib/copy-code.ts`. Do not write a second clipboard function.
- Reuse the existing `ClipboardCopyIcon` and `CheckIcon` from `src/components/tiptap-icons/`. Do not add new icon files.
- The button must never be inserted into the ProseMirror document, and no Tiptap extension may be registered. Markdown serialisation must be untouched.
- Code blocks already have their own copy button. Inline detection must exclude any `<code>` inside a `<pre>`.
- The button label and tooltip are exactly `Copy code`, matching the code-block button.
- The copied-state checkmark lasts exactly 2000ms, matching the code-block button.
- `BUTTON_SIZE` in TypeScript (22) and the `width`/`height` in SCSS (22px) must stay in sync.
- Tests run with `npm test` (`vitest run`). A single file runs with `npx vitest run src/__tests__/<name>.test.ts`.
- Commit after each task. Do not push.

---

### Task 1: `findInlineCodeElement` helper

Creates the shared helper module and the test file, and adds the `jsdom` test environment the repo does not yet have (existing tests are all environment-free; this helper walks real DOM nodes, so it needs one).

**Files:**
- Create: `src/lib/inline-code-copy.ts`
- Create: `src/__tests__/inline-code-copy.test.ts`
- Modify: `package.json` (add `jsdom` to `devDependencies`)

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `findInlineCodeElement(target: EventTarget | null): HTMLElement | null` — returns the nearest ancestor `<code>` of `target` (including `target` itself), or `null` when there is none or when that `<code>` sits inside a `<pre>`.

- [ ] **Step 1: Install the jsdom test environment**

```bash
npm install --save-dev jsdom
```

Vitest 4 has no config file in this repo, so the environment is selected per-file with a docblock comment (added in Step 2). No `vitest.config.ts` is needed.

- [ ] **Step 2: Write the failing test**

Create `src/__tests__/inline-code-copy.test.ts`:

```ts
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { findInlineCodeElement } from '../lib/inline-code-copy'

function render(html: string): HTMLElement {
  const container = document.createElement('div')
  container.innerHTML = html
  return container
}

describe('findInlineCodeElement', () => {
  it('returns the code element when the target is the element itself', () => {
    const container = render('<p>Run <code>npm start</code> now</p>')
    const code = container.querySelector('code')!
    expect(findInlineCodeElement(code)).toBe(code)
  })

  it('returns the ancestor code element when the target is nested inside it', () => {
    const container = render('<p>Run <code><span class="hl">npm</span> start</code></p>')
    const code = container.querySelector('code')!
    const span = container.querySelector('span.hl')!
    expect(findInlineCodeElement(span)).toBe(code)
  })

  it('returns null for a code element inside a pre (code blocks keep their own button)', () => {
    const container = render('<pre><code>const x = 1</code></pre>')
    const code = container.querySelector('code')!
    expect(findInlineCodeElement(code)).toBeNull()
  })

  it('returns null for a plain paragraph', () => {
    const container = render('<p>no code here</p>')
    const paragraph = container.querySelector('p')!
    expect(findInlineCodeElement(paragraph)).toBeNull()
  })

  it('returns null for a null target', () => {
    expect(findInlineCodeElement(null)).toBeNull()
  })
})
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run src/__tests__/inline-code-copy.test.ts`

Expected: FAIL — cannot resolve `../lib/inline-code-copy`.

- [ ] **Step 4: Write the minimal implementation**

Create `src/lib/inline-code-copy.ts`:

```ts
/**
 * Returns the inline `<code>` element at `target`, or null.
 *
 * A `<code>` inside a `<pre>` is a code block, which has its own copy button
 * in the code-block node view, so it is deliberately excluded here.
 */
export function findInlineCodeElement(target: EventTarget | null): HTMLElement | null {
  if (!(target instanceof Element)) return null
  const code = target.closest("code")
  if (!code) return null
  if (code.closest("pre")) return null
  return code as HTMLElement
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/__tests__/inline-code-copy.test.ts`

Expected: PASS — 5 tests.

- [ ] **Step 6: Run the whole suite to check nothing regressed**

Run: `npm test`

Expected: PASS — all existing test files still pass.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json src/lib/inline-code-copy.ts src/__tests__/inline-code-copy.test.ts
git commit -m "feat: add findInlineCodeElement helper for inline code copy"
```

---

### Task 2: `computeButtonPosition` helper

Pure geometry: where the floating button sits relative to the hovered span. No DOM involved, so this is testable with plain object literals.

**Files:**
- Modify: `src/lib/inline-code-copy.ts` (append)
- Modify: `src/__tests__/inline-code-copy.test.ts` (append)

**Interfaces:**
- Consumes: nothing from Task 1 at runtime — it shares the module only.
- Produces:
  - `interface PositionRect { top: number; right: number; bottom: number; left: number }`
  - `interface Viewport { width: number; height: number }`
  - `interface ButtonPosition { top: number; left: number }`
  - `const BUTTON_GAP: number` (4)
  - `computeButtonPosition(rect: PositionRect, buttonSize: number, viewport: Viewport): ButtonPosition` — viewport-coordinate `top`/`left` for a `position: fixed` square button of side `buttonSize`.

- [ ] **Step 1: Write the failing tests**

Append to `src/__tests__/inline-code-copy.test.ts` (and extend the import on line 3 to `import { findInlineCodeElement, computeButtonPosition } from '../lib/inline-code-copy'`):

```ts
describe('computeButtonPosition', () => {
  const viewport = { width: 1000, height: 800 }
  const size = 22

  it('places the button above the span and right-aligned to it', () => {
    const rect = { top: 100, right: 150, bottom: 120, left: 50 }
    expect(computeButtonPosition(rect, size, viewport)).toEqual({ top: 74, left: 128 })
  })

  it('flips below the span when there is no room above', () => {
    const rect = { top: 10, right: 150, bottom: 30, left: 50 }
    expect(computeButtonPosition(rect, size, viewport)).toEqual({ top: 34, left: 128 })
  })

  it('clamps the left edge when the span sits at the left margin', () => {
    const rect = { top: 100, right: 10, bottom: 120, left: 2 }
    expect(computeButtonPosition(rect, size, viewport)).toEqual({ top: 74, left: 0 })
  })

  it('clamps the right edge when the span overflows the viewport', () => {
    const rect = { top: 100, right: 1010, bottom: 120, left: 900 }
    expect(computeButtonPosition(rect, size, viewport)).toEqual({ top: 74, left: 978 })
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/__tests__/inline-code-copy.test.ts`

Expected: FAIL — `computeButtonPosition is not a function`.

- [ ] **Step 3: Write the minimal implementation**

Append to `src/lib/inline-code-copy.ts`:

```ts
export interface PositionRect {
  top: number
  right: number
  bottom: number
  left: number
}

export interface Viewport {
  width: number
  height: number
}

export interface ButtonPosition {
  top: number
  left: number
}

/** Gap in px between the code span and the floating button. */
export const BUTTON_GAP = 4

/**
 * Viewport coordinates for a `position: fixed` square copy button.
 *
 * The button is right-aligned to the span and sits above it, flipping below
 * when there is no room, and clamped so it never leaves the viewport.
 */
export function computeButtonPosition(
  rect: PositionRect,
  buttonSize: number,
  viewport: Viewport
): ButtonPosition {
  const maxLeft = Math.max(viewport.width - buttonSize, 0)
  const left = Math.min(Math.max(rect.right - buttonSize, 0), maxLeft)

  const above = rect.top - buttonSize - BUTTON_GAP
  const top = above >= 0 ? above : rect.bottom + BUTTON_GAP

  return { top, left }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/__tests__/inline-code-copy.test.ts`

Expected: PASS — 9 tests (5 from Task 1, 4 new).

- [ ] **Step 5: Commit**

```bash
git add src/lib/inline-code-copy.ts src/__tests__/inline-code-copy.test.ts
git commit -m "feat: add computeButtonPosition helper for inline code copy"
```

---

### Task 3: Hover overlay component and editor wiring

Builds the button itself and hooks it into the editor. There is no unit test here — the component is thin glue over the two helpers already covered, and the repo has no React testing library installed. It is verified by lint, the full test suite, and running the app.

**Files:**
- Create: `src/components/tiptap-ui/inline-code-copy/inline-code-copy-button.tsx`
- Create: `src/components/tiptap-ui/inline-code-copy/inline-code-copy-button.scss`
- Create: `src/components/tiptap-ui/inline-code-copy/index.ts`
- Modify: `src/components/tiptap-templates/simple/simple-editor.tsx` (add two imports near the other `tiptap-ui` / `.scss` imports, and one element after `<EditorContent>` around line 515)

**Interfaces:**
- Consumes: `findInlineCodeElement`, `computeButtonPosition`, and the `ButtonPosition` type from `@/lib/inline-code-copy`; `copyCodeToClipboard` from `@/lib/copy-code`; `ClipboardCopyIcon` and `CheckIcon` from `@/components/tiptap-icons/`.
- Produces: `<InlineCodeCopyButton editor={editor} />`, where `editor` is `Editor | null` from `useEditor`.

- [ ] **Step 1: Write the component**

Create `src/components/tiptap-ui/inline-code-copy/inline-code-copy-button.tsx`:

```tsx
import { useCallback, useEffect, useRef, useState } from "react"
import type { Editor } from "@tiptap/react"
import { ClipboardCopyIcon } from "@/components/tiptap-icons/clipboard-copy-icon"
import { CheckIcon } from "@/components/tiptap-icons/check-icon"
import { copyCodeToClipboard } from "@/lib/copy-code"
import {
  computeButtonPosition,
  findInlineCodeElement,
  type ButtonPosition,
} from "@/lib/inline-code-copy"

/** Must match the button's width/height in inline-code-copy-button.scss. */
const BUTTON_SIZE = 22
/** Grace period so the pointer can travel from the span to the button. */
const HIDE_DELAY_MS = 150
const COPIED_RESET_MS = 2000

export function InlineCodeCopyButton({ editor }: { editor: Editor | null }) {
  const [target, setTarget] = useState<HTMLElement | null>(null)
  const [position, setPosition] = useState<ButtonPosition | null>(null)
  const [copied, setCopied] = useState(false)
  const hideTimeout = useRef<ReturnType<typeof setTimeout>>(undefined)
  const copiedTimeout = useRef<ReturnType<typeof setTimeout>>(undefined)

  const hide = useCallback(() => {
    setTarget(null)
    setPosition(null)
    setCopied(false)
  }, [])

  const cancelHide = useCallback(() => {
    clearTimeout(hideTimeout.current)
  }, [])

  const hideSoon = useCallback(() => {
    clearTimeout(hideTimeout.current)
    hideTimeout.current = setTimeout(hide, HIDE_DELAY_MS)
  }, [hide])

  const show = useCallback((element: HTMLElement) => {
    clearTimeout(hideTimeout.current)
    // A wrapped span's bounding rect spans both lines; anchor to the first
    // line box so the button never floats over intervening text.
    const rect = element.getClientRects()[0] ?? element.getBoundingClientRect()
    setTarget(element)
    setPosition(
      computeButtonPosition(rect, BUTTON_SIZE, {
        width: window.innerWidth,
        height: window.innerHeight,
      })
    )
  }, [])

  useEffect(() => {
    if (!editor) return
    const dom = editor.view.dom

    function handleMouseOver(event: MouseEvent) {
      const element = findInlineCodeElement(event.target)
      if (!element) return
      show(element)
    }

    function handleMouseOut(event: MouseEvent) {
      if (!findInlineCodeElement(event.target)) return
      hideSoon()
    }

    dom.addEventListener("mouseover", handleMouseOver)
    dom.addEventListener("mouseout", handleMouseOut)
    return () => {
      dom.removeEventListener("mouseover", handleMouseOver)
      dom.removeEventListener("mouseout", handleMouseOut)
    }
  }, [editor, show, hideSoon])

  // While visible: hide on scroll (the fixed position would go stale), and
  // hide if the span was edited out of the document underneath us.
  useEffect(() => {
    if (!target) return
    if (!target.isConnected) {
      hide()
      return
    }
    window.addEventListener("scroll", hide, true)
    return () => window.removeEventListener("scroll", hide, true)
  }, [target, hide])

  useEffect(() => {
    return () => {
      clearTimeout(hideTimeout.current)
      clearTimeout(copiedTimeout.current)
    }
  }, [])

  async function handleCopy() {
    if (!target) return
    try {
      const success = await copyCodeToClipboard(target.textContent ?? "")
      if (!success) return
      setCopied(true)
      clearTimeout(copiedTimeout.current)
      copiedTimeout.current = setTimeout(() => setCopied(false), COPIED_RESET_MS)
    } catch (error) {
      console.error("Failed to copy inline code:", error)
    }
  }

  if (!target || !position) return null

  return (
    <button
      className="inline-code-copy-btn"
      style={{ top: position.top, left: position.left }}
      onMouseEnter={cancelHide}
      onMouseLeave={hideSoon}
      onMouseDown={(event) => event.preventDefault()}
      onClick={handleCopy}
      aria-label="Copy code"
      title="Copy code"
    >
      {copied ? (
        <CheckIcon className="inline-code-copy-icon" />
      ) : (
        <ClipboardCopyIcon className="inline-code-copy-icon" />
      )}
    </button>
  )
}
```

`onMouseDown` calls `preventDefault` so clicking the button does not move the
editor's caret or drop the user's selection.

- [ ] **Step 2: Write the stylesheet**

Create `src/components/tiptap-ui/inline-code-copy/inline-code-copy-button.scss`. This button renders outside `.tiptap.ProseMirror`, so the rule is not nested inside that selector:

```scss
.inline-code-copy-btn {
  position: fixed;
  z-index: 20;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  padding: 0;
  background-color: var(--tt-bg-color);
  color: var(--tt-gray-light-a-600);
  border: 1px solid var(--tt-gray-light-a-200);
  border-radius: var(--tt-radius-sm);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
  cursor: pointer;
  outline: none;
  transition: color 0.15s ease, border-color 0.15s ease;

  &:hover {
    color: var(--tt-brand-color-500);
    border-color: var(--tt-brand-color-400);
  }

  &:focus-visible {
    border-color: var(--tt-brand-color-400);
  }

  .dark & {
    background-color: var(--tt-gray-dark-a-100);
    color: var(--tt-gray-dark-a-600);
    border-color: var(--tt-gray-dark-a-200);
  }
}

.inline-code-copy-icon {
  width: 0.875rem;
  height: 0.875rem;
}
```

- [ ] **Step 3: Add the barrel export**

Create `src/components/tiptap-ui/inline-code-copy/index.ts`:

```ts
export { InlineCodeCopyButton } from "./inline-code-copy-button"
```

- [ ] **Step 4: Wire it into the editor**

In `src/components/tiptap-templates/simple/simple-editor.tsx`:

Add to the `tiptap-ui` import group (near the `SaveButton` import, around line 53):

```tsx
import { InlineCodeCopyButton } from "@/components/tiptap-ui/inline-code-copy"
```

Add to the `.scss` import group (near the `code-block-node.scss` import, around line 40):

```tsx
import "@/components/tiptap-ui/inline-code-copy/inline-code-copy-button.scss"
```

Then render it directly after `<EditorContent>` (around line 515), still inside `<EditorContext.Provider>`:

```tsx
        <EditorContent
          editor={editor}
          role="presentation"
          className="simple-editor-content"
        />

        <InlineCodeCopyButton editor={editor} />
      </EditorContext.Provider>
```

- [ ] **Step 5: Verify lint passes**

Run: `npm run lint`

Expected: PASS — no new errors. If ESLint flags the `react-hooks/exhaustive-deps` rule on either effect, add the missing dependency rather than suppressing the rule.

- [ ] **Step 6: Verify the full test suite passes**

Run: `npm test`

Expected: PASS — all files, including the 9 tests from Tasks 1 and 2.

- [ ] **Step 7: Verify in the running app**

Run: `npm start`

Check each of these by hand:
1. Type `` Run the `npm start` command. `` — the backticks become inline code.
2. Hover the code span: the button appears just above its right edge, not covering the text.
3. Click it: the icon becomes a checkmark for ~2s, and pasting elsewhere yields `npm start`.
4. Move the pointer from the span onto the button: the button stays (grace period works).
5. Move the pointer away entirely: the button disappears.
6. Hover a fenced code block: only the code block's own copy button shows — no floating inline button.
7. Scroll the document while the button is visible: it disappears rather than lingering in the wrong place.
8. Save the file and check the markdown on disk is unchanged apart from your edits — no stray markup from the button.

- [ ] **Step 8: Commit**

```bash
git add src/components/tiptap-ui/inline-code-copy src/components/tiptap-templates/simple/simple-editor.tsx
git commit -m "feat: add copy button to inline code on hover"
```
