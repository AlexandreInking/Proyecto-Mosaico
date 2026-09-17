import { describe, expect, it } from 'vitest'
import { translateText } from '../src/i18n.js'

describe('i18n', () => {
  it('translates shared labels in all supported locales', () => {
    expect(translateText('Conectado', 'en')).toBe('Connected')
    expect(translateText('Connected', 'es')).toBe('Conectado')
    expect(translateText('Lápiz', 'ru')).toBe('Карандаш')
    expect(translateText('Editor', 'ru')).toBe('Редактор')
    expect(translateText('Selected asset', 'es')).toBe('Asset seleccionado')
    expect(translateText('File size', 'ru')).toBe('Размер файла')
    expect(translateText('Language', 'fr')).toBe('Langue')
    expect(translateText('Language', 'it')).toBe('Lingua')
    expect(translateText('Lápiz', 'fr')).toBe('Crayon')
    expect(translateText('Lápiz', 'it')).toBe('Matita')
    expect(translateText('Módulos principales', 'fr')).toBe('Modules principaux')
    expect(translateText('Módulos principales', 'it')).toBe('Moduli principali')
  })

  it('leaves generated non-UI text untouched', () => {
    const generated = 'x'.repeat(10_000)
    expect(translateText(generated, 'ru')).toBe(generated)
    expect(translateText('Custom user value', 'ru')).toBe('Custom user value')
  })

  it('translates pipeline parameters and node labels consistently', () => {
    expect(translateText('Ancho', 'en')).toBe('Width')
    expect(translateText('Seed', 'ru')).toBe('Семя')
    expect(translateText('Cellular Noise', 'es')).toBe('Ruido celular')
    expect(translateText('Rugosidad', 'ru')).toBe('Шероховатость')
  })
})
