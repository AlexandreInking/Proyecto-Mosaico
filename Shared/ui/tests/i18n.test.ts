import { describe, expect, it } from 'vitest'
import { translateText } from '../src/i18n.js'

describe('i18n', () => {
  it('translates shared labels in all supported locales', () => {
    expect(translateText('Conectado', 'en')).toBe('Connected')
    expect(translateText('Connected', 'es')).toBe('Conectado')
    expect(translateText('Lápiz', 'ru')).toBe('Карандаш')
  })
})
