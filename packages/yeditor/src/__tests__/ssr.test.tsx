// @vitest-environment node
import { renderToString } from "react-dom/server"
import { expect, it } from "vitest"

it("imports and server-renders without touching window", async () => {
  const { YEditor } = await import("../index")
  expect(typeof window).toBe("undefined")
  expect(() => renderToString(<YEditor initialValue="# Hi" />)).not.toThrow()
})
