import type { Editor } from '@tiptap/core'
const activity = new WeakMap<Editor, { pending: number; frozen: boolean }>()
function stateFor(editor: Editor) {
  let state = activity.get(editor)
  if (!state) {
    state = { pending: 0, frozen: false }
    activity.set(editor, state)
  }
  return state
}
// Track the entire operation, including the transaction after an awaited upload/read.
export async function runEditorTask<T>(
  editor: Editor,
  task: () => Promise<T>,
): Promise<T> {
  const state = stateFor(editor)
  if (state.frozen)
    throw new Error('The app is preparing to restart. Please retry afterwards.')
  state.pending += 1
  try {
    return await task()
  } finally {
    state.pending -= 1
  }
}
export function setEditorUpdateFrozen(editor: Editor, frozen: boolean): void {
  const state = stateFor(editor)
  if (frozen && state.pending > 0)
    throw new Error(
      'Wait for file loading, saving and image uploads to finish, then retry installation.',
    )
  state.frozen = frozen
  editor.setEditable(!frozen, false)
}
export function isEditorUpdateFrozen(editor: Editor): boolean {
  return stateFor(editor).frozen
}
