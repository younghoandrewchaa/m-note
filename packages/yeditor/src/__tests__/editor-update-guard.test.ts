// @vitest-environment jsdom
import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { expect, it, vi } from 'vitest'
import { runEditorTask, setEditorUpdateFrozen } from '../lib/editor-update-guard'
it('freezes and restores without marking clean content dirty', () => {
  const update = vi.fn()
  const editor = new Editor({
    extensions: [StarterKit],
    content: '<p>Note</p>',
    onUpdate: update,
  })
  setEditorUpdateFrozen(editor, true)
  expect(editor.isEditable).toBe(false)
  setEditorUpdateFrozen(editor, false)
  expect(editor.isEditable).toBe(true)
  expect(update).not.toHaveBeenCalled()
  editor.destroy()
})
it('refuses to freeze while an asynchronous document mutation is pending', async () => {
  const editor = new Editor({
    extensions: [StarterKit],
    content: '<p>Note</p>',
  })
  let finish!: () => void
  const task = runEditorTask(editor, async () => {
    await new Promise<void>((r) => {
      finish = r
    })
    editor.commands.insertContent('Image completed')
  })
  expect(() => setEditorUpdateFrozen(editor, true)).toThrow('finish')
  finish()
  await task
  expect(editor.getText()).toContain('Image completed')
  expect(() => setEditorUpdateFrozen(editor, true)).not.toThrow()
  await expect(runEditorTask(editor, async () => undefined)).rejects.toThrow(
    'restart',
  )
  setEditorUpdateFrozen(editor, false)
  editor.destroy()
})
