import { useCallback, useEffect, useState } from "react"
import type { Editor } from "@tiptap/core"
import type { SearchStorage } from "@/components/tiptap-extension/search-extension"

export interface UseSearchConfig {
  editor?: Editor | null
}

export interface UseSearchReturn {
  isOpen: boolean
  setIsOpen: (open: boolean) => void
  searchTerm: string
  setSearchTerm: (term: string) => void
  currentIndex: number
  totalMatches: number
  goToNext: () => void
  goToPrevious: () => void
  closeSearch: () => void
}

function getSearchStorage(editor: Editor): SearchStorage | null {
  const storage = editor.storage as Editor["storage"] & { search?: SearchStorage }
  return storage.search ?? null
}

export function useSearch(config: UseSearchConfig): UseSearchReturn {
  const { editor } = config
  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [totalMatches, setTotalMatches] = useState(0)
  const [currentIndex, setCurrentIndex] = useState(0)

  // Update search term in editor with debounce
  useEffect(() => {
    if (!editor) return

    const timeoutId = setTimeout(() => {
      editor.commands.setSearchTerm(searchTerm)

      // Read results from storage
      const searchStorage = getSearchStorage(editor)
      if (searchStorage) {
        setTotalMatches(searchStorage.results.length)
        setCurrentIndex(searchStorage.currentIndex)
      }
    }, 150)

    return () => clearTimeout(timeoutId)
  }, [editor, searchTerm])

  // Subscribe to editor transactions to update match count/index
  useEffect(() => {
    if (!editor) return

    const updateHandler = () => {
      const searchStorage = getSearchStorage(editor)
      if (searchStorage && isOpen) {
        setTotalMatches(searchStorage.results.length)
        setCurrentIndex(searchStorage.currentIndex)
      }
    }

    editor.on("transaction", updateHandler)
    return () => {
      editor.off("transaction", updateHandler)
    }
  }, [editor, isOpen])

  const goToNext = useCallback(() => {
    if (!editor) return
    editor.commands.nextMatch()

    // Update state immediately
    const searchStorage = getSearchStorage(editor)
    if (searchStorage) {
      setCurrentIndex(searchStorage.currentIndex)
    }
  }, [editor])

  const goToPrevious = useCallback(() => {
    if (!editor) return
    editor.commands.previousMatch()

    // Update state immediately
    const searchStorage = getSearchStorage(editor)
    if (searchStorage) {
      setCurrentIndex(searchStorage.currentIndex)
    }
  }, [editor])

  const closeSearch = useCallback(() => {
    if (!editor) return
    editor.commands.clearSearch()
    setIsOpen(false)
    setSearchTerm("")
    setTotalMatches(0)
    setCurrentIndex(0)

    // Return focus to editor
    editor.commands.focus()
  }, [editor])

  return {
    isOpen,
    setIsOpen,
    searchTerm,
    setSearchTerm,
    currentIndex,
    totalMatches,
    goToNext,
    goToPrevious,
    closeSearch,
  }
}
