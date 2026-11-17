# Copy as HTML implementation plan

**Goal:** Copy the whole note as literal HTML source or formatted content from a menu beside Copy as Markdown.

**Architecture:** Add a self-contained menu to YEditor's existing toolbar. Use the editor's document serializers, not its rendered editing UI. Write source with `clipboard.writeText`; write formatted content as one clipboard item containing HTML and readable plain text.

**Agreed design:** HTML fragments preserve semantic formatting without app styles. Mermaid and frontmatter remain code blocks. Images retain their URLs and alt text. Success closes the menu and shows a check for two seconds; failure displays a short message and permits retry.

**Files:** Add `components/tiptap-ui/copy-html-dropdown-menu/copy-html-dropdown-menu.tsx` under `packages/yeditor/src`; integrate in `yeditor.tsx`; extend `__tests__/yeditor.test.tsx`.

## Execution

- [x] Add integration tests for menu position, whole-document source, rich HTML plus plain fallback, special content, empty notes, failure/retry, and success feedback.
- [x] Run the tests and confirm they fail because the action is missing.
- [x] Implement the menu with existing dropdown/button/icon primitives, asynchronous clipboard writes, error handling, and timer cleanup.
- [x] Verify focused tests, full suite, package build, lint, and diff checks. Review clipboard payloads for source escaping and editor UI leakage.

**Verification:** 288 tests passed across 37 files. YEditor production build and distribution checks passed. Lint finished with zero errors and 71 warnings in existing code. Review identified outside-dismissal focus stealing; a regression test reproduced it and now passes with Radix's default focus restoration. Clipboard writes were verified through the browser API boundary in jsdom; cross-application paste was not manually tested.

## Review focus

- Selection must not restrict the copied document.
- HTML must escape literal markup inside code and preserve table/list/link/image structure.
- Formatted copy must carry HTML and readable text in the same clipboard item.
- Unsupported or rejected clipboard writes must not show success and must permit retry.
- Keyboard activation, focus return, rapid repeat actions, and unmounting must not leave stale feedback or timers.
