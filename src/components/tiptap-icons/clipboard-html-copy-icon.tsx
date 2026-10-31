import { memo } from "react"

type SvgProps = React.ComponentPropsWithoutRef<"svg">

export const ClipboardHtmlCopyIcon = memo(({ className, ...props }: SvgProps) => {
  return (
    <svg
      width="24"
      height="24"
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <rect width="8" height="4" x="8" y="2" rx="1" ry="1" />
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <path d="M9 13l-2 2l2 2" />
      <path d="M15 13l2 2l-2 2" />
      <path d="M13 12l-2 6" />
    </svg>
  )
})

ClipboardHtmlCopyIcon.displayName = "ClipboardHtmlCopyIcon"
