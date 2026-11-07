import { NodeViewContent, NodeViewWrapper, type ReactNodeViewProps } from "@tiptap/react"

export function FrontmatterNode(_props: ReactNodeViewProps) {
  return (
    <NodeViewWrapper className="frontmatter-block">
      <span className="frontmatter-block__label" contentEditable={false}>
        frontmatter
      </span>
      <pre>
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        <NodeViewContent as={"code" as any} />
      </pre>
    </NodeViewWrapper>
  )
}
