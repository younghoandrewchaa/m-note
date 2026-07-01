import { useCallback, useEffect, useState } from "react"
import type { Editor } from "@tiptap/core"

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
      if (editor.storage.search) {
        setTotalMatches(editor.storage.search.results.length)
        setCurrentIndex(editor.storage.search.currentIndex)
      }
    }, 150)

    return () => clearTimeout(timeoutId)
  }, [editor, searchTerm])

  // Subscribe to editor transactions to update match count/index
  useEffect(() => {
    if (!editor) return

    const updateHandler = () => {
      if (editor.storage.search && isOpen) {
        setTotalMatches(editor.storage.search.results.length)
        setCurrentIndex(editor.storage.search.currentIndex)
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
    if (editor.storage.search) {
      setCurrentIndex(editor.storage.search.currentIndex)
    }
  }, [editor])

  const goToPrevious = useCallback(() => {
    if (!editor) return
    editor.commands.previousMatch()

    // Update state immediately
    if (editor.storage.search) {
      setCurrentIndex(editor.storage.search.currentIndex)
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
