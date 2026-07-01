import { Extension } from "@tiptap/core"
import { Plugin, PluginKey } from "@tiptap/pm/state"
import { Decoration, DecorationSet } from "@tiptap/pm/view"

export interface SearchResult {
  from: number
  to: number
}

export interface SearchStorage {
  searchTerm: string
  results: SearchResult[]
  currentIndex: number
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    search: {
      setSearchTerm: (term: string) => ReturnType
      nextMatch: () => ReturnType
      previousMatch: () => ReturnType
      clearSearch: () => ReturnType
    }
  }
}

const searchPluginKey = new PluginKey("search")

export const Search = Extension.create<Record<string, never>, SearchStorage>({
  name: "search",

  addStorage() {
    return {
      searchTerm: "",
      results: [],
      currentIndex: 0,
    }
  },

  addCommands() {
    return {
      setSearchTerm:
        (term: string) =>
        ({ state, dispatch }) => {
          this.storage.searchTerm = term
          this.storage.currentIndex = 0

          // Find all matches
          const results: SearchResult[] = []
          if (term && term.trim()) {
            const lowerTerm = term.toLowerCase()
            state.doc.descendants((node, pos) => {
              if (node.isText && node.text) {
                const lowerText = node.text.toLowerCase()
                let index = 0
                while (index < lowerText.length) {
                  const foundIndex = lowerText.indexOf(lowerTerm, index)
                  if (foundIndex === -1) break
                  results.push({
                    from: pos + foundIndex,
                    to: pos + foundIndex + term.length,
                  })
                  index = foundIndex + 1
                }
              }
            })
          }
          this.storage.results = results

          // Trigger decoration update by dispatching a transaction
          if (dispatch) {
            const tr = state.tr.setMeta(searchPluginKey, { updated: true })
            dispatch(tr)
          }

          return true
        },

      nextMatch:
        () =>
        ({ editor }) => {
          const { results, currentIndex } = this.storage
          if (results.length === 0) return false

          const nextIndex = (currentIndex + 1) % results.length
          this.storage.currentIndex = nextIndex

          const match = results[nextIndex]
          if (match) {
            editor
              .chain()
              .setTextSelection({ from: match.from, to: match.to })
              .scrollIntoView()
              .run()
          }

          return true
        },

      previousMatch:
        () =>
        ({ editor }) => {
          const { results, currentIndex } = this.storage
          if (results.length === 0) return false

          const prevIndex =
            currentIndex === 0 ? results.length - 1 : currentIndex - 1
          this.storage.currentIndex = prevIndex

          const match = results[prevIndex]
          if (match) {
            editor
              .chain()
              .setTextSelection({ from: match.from, to: match.to })
              .scrollIntoView()
              .run()
          }

          return true
        },

      clearSearch:
        () =>
        ({ state, dispatch }) => {
          this.storage.searchTerm = ""
          this.storage.results = []
          this.storage.currentIndex = 0

          // Trigger decoration update
          if (dispatch) {
            const tr = state.tr.setMeta(searchPluginKey, { updated: true })
            dispatch(tr)
          }

          return true
        },
    }
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: searchPluginKey,
        props: {
          decorations: (state) => {
            const { searchTerm, results, currentIndex } = this.storage

            if (!searchTerm || !results.length) {
              return DecorationSet.empty
            }

            const decorations = results.map((result, index) => {
              const className =
                index === currentIndex ? "search-result-current" : "search-result"
              return Decoration.inline(result.from, result.to, {
                class: className,
              })
            })

            return DecorationSet.create(state.doc, decorations)
          },
        },
      }),
    ]
  },
})
