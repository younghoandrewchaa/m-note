// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MermaidPreview } from '../components/tiptap-node/code-block-node/mermaid-preview'

let root: Root
let host: HTMLDivElement
beforeEach(() => {
  vi.useFakeTimers()
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(600)
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
})
afterEach(() => {
  act(() => root.unmount())
  host.remove()
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})
function show(source: string) {
  act(() => root.render(<MermaidPreview source={source} />))
  act(() => vi.advanceTimersByTime(150))
}

describe('Mermaid preview', () => {
  it('renders real diagrams and updates only after the debounce', () => {
    show('flowchart LR\n A[First] --> B')
    expect(host.querySelector('svg')).not.toBeNull()
    act(() => root.render(<MermaidPreview source={'sequenceDiagram\n Alice->>Bob: Hello'} />))
    expect(host.textContent).toContain('First')
    act(() => vi.advanceTimersByTime(150))
    expect(host.textContent).toContain('Alice')
    expect(host.textContent).not.toContain('First')
  })
  it('shows an empty prompt and clears an old preview', () => {
    show('flowchart LR\n A --> B')
    show('   ')
    expect(host.querySelector('svg')).toBeNull()
    expect(host.textContent).toContain('Enter Mermaid syntax')
  })
  it('marks invalid diagrams and recovers without interpreting source as HTML', () => {
    show('flowchart LR\n A --> B')
    show('<img src=x onerror=alert(1)>')
    expect(host.querySelector('.pele-error')).not.toBeNull()
    expect(host.querySelector('img')).toBeNull()
    show('flowchart LR\n C[Recovered] --> D')
    expect(host.textContent).toContain('Recovered')
    expect(host.querySelector('.pele-error')).toBeNull()
  })
  it('does not activate links or images supplied by a document', () => {
    show('flowchart LR\n A[Safe] --> B\n click A "https://example.com"')
    expect(host.querySelector('svg')).not.toBeNull()
    expect(host.querySelector('a, image, script, foreignObject, [onclick]')).toBeNull()
  })
  it.each([
    'flowchart LR\n A["<img src=x onerror=alert(1)>"] --> B',
    'flowchart LR\n A@{ img: "https://example.com/image.png", label: "Picture", h: 60 }',
  ])('renders untrusted labels and image declarations without active markup: %s', (source) => {
    show(source)
    expect(host.querySelector('svg')).not.toBeNull()
    expect(host.querySelector('img, image, script, foreignObject, [onerror]')).toBeNull()
    expect(host.querySelector('[href], [src]')).toBeNull()
  })
  it('reports over-limit source without throwing', () => {
    show('flowchart LR\n' + 'A'.repeat(50001))
    expect(host.querySelector('.pele-error')).not.toBeNull()
    expect(host.querySelector('svg')).toBeNull()
  })
  it('keeps multiple preview instances independent', () => {
    act(() => root.render(<><MermaidPreview source={'flowchart LR\n A[One] --> B'} /><MermaidPreview source={'flowchart LR\n A[Two] --> B'} /></>))
    act(() => vi.advanceTimersByTime(150))
    expect(host.querySelectorAll('svg')).toHaveLength(2)
    expect(host.textContent).toContain('One')
    expect(host.textContent).toContain('Two')
  })
  it('disconnects observers and cancels pending renders on removal', () => {
    const disconnect = vi.fn()
    vi.stubGlobal('ResizeObserver', class { observe = vi.fn(); disconnect = disconnect })
    show('flowchart LR\n A --> B')
    act(() => root.render(<MermaidPreview source={'flowchart LR\n C --> D'} />))
    act(() => root.render(null))
    act(() => vi.runAllTimers())
    expect(disconnect).toHaveBeenCalled()
    expect(host.innerHTML).toBe('')
  })
})
