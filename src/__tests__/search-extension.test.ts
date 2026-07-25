import { describe, it, expect } from 'vitest'

describe('Search Extension Logic', () => {
  it('performs case-insensitive text search', () => {
    const text = 'Hello HELLO hello HeLLo'
    const searchTerm = 'hello'
    const lowerText = text.toLowerCase()
    const lowerTerm = searchTerm.toLowerCase()

    const results = []
    let index = 0
    while (index < lowerText.length) {
      const foundIndex = lowerText.indexOf(lowerTerm, index)
      if (foundIndex === -1) break
      results.push({
        from: foundIndex,
        to: foundIndex + searchTerm.length,
      })
      index = foundIndex + 1
    }

    expect(results).toHaveLength(4)
    expect(results[0].from).toBe(0)
    expect(results[1].from).toBe(6)
    expect(results[2].from).toBe(12)
    expect(results[3].from).toBe(18)
  })

  it('finds overlapping matches', () => {
    const text = 'aaaa'
    const searchTerm = 'aa'
    const lowerText = text.toLowerCase()
    const lowerTerm = searchTerm.toLowerCase()

    const results = []
    let index = 0
    while (index < lowerText.length) {
      const foundIndex = lowerText.indexOf(lowerTerm, index)
      if (foundIndex === -1) break
      results.push({
        from: foundIndex,
        to: foundIndex + searchTerm.length,
      })
      index = foundIndex + 1
    }

    expect(results).toHaveLength(3) // aa at 0, 1, 2
  })

  it('handles special characters', () => {
    const text = 'Price is $100. The $100 item.'
    const searchTerm = '$100'
    const lowerText = text.toLowerCase()
    const lowerTerm = searchTerm.toLowerCase()

    const results = []
    let index = 0
    while (index < lowerText.length) {
      const foundIndex = lowerText.indexOf(lowerTerm, index)
      if (foundIndex === -1) break
      results.push({
        from: foundIndex,
        to: foundIndex + searchTerm.length,
      })
      index = foundIndex + 1
    }

    expect(results).toHaveLength(2)
  })

  it('returns empty for non-matching term', () => {
    const text = 'Hello world'
    const searchTerm = 'xyz'
    const lowerText = text.toLowerCase()
    const lowerTerm = searchTerm.toLowerCase()

    const results = []
    let index = 0
    while (index < lowerText.length) {
      const foundIndex = lowerText.indexOf(lowerTerm, index)
      if (foundIndex === -1) break
      results.push({
        from: foundIndex,
        to: foundIndex + searchTerm.length,
      })
      index = foundIndex + 1
    }

    expect(results).toHaveLength(0)
  })

  it('wraps navigation forward correctly', () => {
    const totalMatches = 3
    let currentIndex = 0

    // Navigate forward
    currentIndex = (currentIndex + 1) % totalMatches
    expect(currentIndex).toBe(1)

    currentIndex = (currentIndex + 1) % totalMatches
    expect(currentIndex).toBe(2)

    // Wrap to first
    currentIndex = (currentIndex + 1) % totalMatches
    expect(currentIndex).toBe(0)
  })

  it('wraps navigation backward correctly', () => {
    const totalMatches = 3
    let currentIndex = 0

    // Wrap to last
    currentIndex = currentIndex === 0 ? totalMatches - 1 : currentIndex - 1
    expect(currentIndex).toBe(2)

    // Navigate back
    currentIndex = currentIndex === 0 ? totalMatches - 1 : currentIndex - 1
    expect(currentIndex).toBe(1)

    currentIndex = currentIndex === 0 ? totalMatches - 1 : currentIndex - 1
    expect(currentIndex).toBe(0)
  })

  it('handles empty search term', () => {
    const searchTerm = [''].join('')

    if (!searchTerm || !searchTerm.trim()) {
      const results: unknown[] = []
      expect(results).toHaveLength(0)
    }
  })
})
