import { describe, expect, it } from 'vitest'
import startCase from '../src/utils/startCase'

describe('startCase', () => {
  it('converts hyphen and underscore delimiters to spaces and capitalizes words', () => {
    expect(startCase('hello-world_test-case')).toBe('Hello World Test Case')
  })

  it('splits camelCase segments and capitalizes the results', () => {
    expect(startCase('someHTTPValue')).toBe('Some HTTPValue')
    expect(startCase('generateAliasForDomain')).toBe(
      'Generate Alias For Domain'
    )
  })

  it('normalizes whitespace and trims surrounding spaces', () => {
    expect(startCase('   already   start  case   ')).toBe('Already Start Case')
  })
})
