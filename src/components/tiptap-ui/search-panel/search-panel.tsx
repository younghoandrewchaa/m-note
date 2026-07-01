import { useRef, useEffect, type KeyboardEvent } from "react"
import { useHotkeys } from "react-hotkeys-hook"
import type { Editor } from "@tiptap/core"
import { useSearch } from "./use-search"
import { Card, CardBody, CardItemGroup } from "@/components/tiptap-ui-primitive/card/card"
import { Input } from "@/components/tiptap-ui-primitive/input/input"
import { Button } from "@/components/tiptap-ui-primitive/button/button"
import { ChevronUpIcon } from "@/components/tiptap-icons/chevron-up-icon"
import { ChevronDownIcon } from "@/components/tiptap-icons/chevron-down-icon"
import { CloseIcon } from "@/components/tiptap-icons/close-icon"
import "./search-panel.scss"

export interface SearchPanelProps {
  editor?: Editor | null
}

export const SearchPanel: React.FC<SearchPanelProps> = ({ editor }) => {
  const {
    isOpen,
    setIsOpen,
    searchTerm,
    setSearchTerm,
    currentIndex,
    totalMatches,
    goToNext,
    goToPrevious,
    closeSearch,
  } = useSearch({ editor })

  const inputRef = useRef<HTMLInputElement>(null)

  // Cmd+F to toggle panel
  useHotkeys(
    "mod+f",
    (e) => {
      e.preventDefault()
      if (isOpen) {
        // If already open, select all text in input
        inputRef.current?.select()
      } else {
        setIsOpen(true)
      }
    },
    { enableOnFormTags: true, enableOnContentEditable: true },
    [isOpen]
  )

  // Auto-focus input when panel opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isOpen])

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault()
      if (event.shiftKey) {
        goToPrevious()
      } else {
        goToNext()
      }
    } else if (event.key === "Escape") {
      event.preventDefault()
      closeSearch()
    }
  }

  if (!isOpen) return null

  const matchCountText =
    totalMatches > 0 ? `${currentIndex + 1} of ${totalMatches}` : "No results"

  return (
    <div className="search-panel">
      <Card>
        <CardBody>
          <CardItemGroup orientation="horizontal">
            <Input
              ref={inputRef}
              type="text"
              placeholder="Find..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={handleKeyDown}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              className="search-panel-input"
            />
            <span className="search-panel-count">{matchCountText}</span>
            <Button
              type="button"
              variant="ghost"
              onClick={goToPrevious}
              disabled={totalMatches === 0}
              title="Previous match (Shift+Enter)"
              tabIndex={-1}
            >
              <ChevronUpIcon className="tiptap-button-icon" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={goToNext}
              disabled={totalMatches === 0}
              title="Next match (Enter)"
              tabIndex={-1}
            >
              <ChevronDownIcon className="tiptap-button-icon" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={closeSearch}
              title="Close (Escape)"
              tabIndex={-1}
            >
              <CloseIcon className="tiptap-button-icon" />
            </Button>
          </CardItemGroup>
        </CardBody>
      </Card>
    </div>
  )
}
