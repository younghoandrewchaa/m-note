import { memo } from "react"

type SvgProps = React.ComponentPropsWithoutRef<"svg">

export const FilePathIcon = memo(({ className, ...props }: SvgProps) => {
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
      <path d="M3 3v14a2 2 0 0 0 2 2h4M3 7h6" />
      <path d="M9 5a2 2 0 0 1 2-2h3l2 2h3a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2h-8a2 2 0 0 1-2-2Z" />
      <path d="M9 16a2 2 0 0 1 2-2h3l2 2h3a2 2 0 0 1 2 2v1a2 2 0 0 1-2 2h-8a2 2 0 0 1-2-2Z" />
    </svg>
  )
})

FilePathIcon.displayName = "FilePathIcon"
