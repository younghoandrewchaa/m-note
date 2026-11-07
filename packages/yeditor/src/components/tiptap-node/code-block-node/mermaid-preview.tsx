import { useEffect, useRef } from 'react'
import { mount } from 'pele'
import './mermaid-preview.scss'

export function MermaidPreview({ source }: { source: string }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const diagramRef = useRef<ReturnType<typeof mount> | null>(null)
  const empty = !source.trim()

  useEffect(() => () => {
    diagramRef.current?.destroy()
    diagramRef.current = null
  }, [])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    if (empty) {
      diagramRef.current?.destroy()
      diagramRef.current = null
      container.replaceChildren()
      return
    }
    // Pele renders its own error message and dims any stale diagram.
    const timer = setTimeout(() => {
      if (diagramRef.current) {
        diagramRef.current.update(source)
      } else {
        diagramRef.current = mount(container, source, {
          links: false,
          images: false,
          autoDirection: false,
          zoom: false,
        })
      }
    }, 150)
    return () => clearTimeout(timer)
  }, [source, empty])

  return (
    <div className="mermaid-preview" contentEditable={false} aria-label="Mermaid diagram preview">
      {empty && <p className="mermaid-preview-message">Enter Mermaid syntax to preview a diagram.</p>}
      <div ref={containerRef} className="mermaid-preview-canvas" />
    </div>
  )
}
