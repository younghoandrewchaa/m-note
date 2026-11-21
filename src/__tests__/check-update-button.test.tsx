import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import { CheckUpdateButton } from '../desktop-toolbar/check-update-button/check-update-button'

it.each(['up-to-date', 'ready'] as const)(
  'keeps the same update action visible when %s',
  (updateStatus) => {
    const idleButton = renderToStaticMarkup(<CheckUpdateButton updateStatus="idle" />)
    const checkedButton = renderToStaticMarkup(<CheckUpdateButton updateStatus={updateStatus} />)

    expect(checkedButton).toBe(idleButton)
  },
)
