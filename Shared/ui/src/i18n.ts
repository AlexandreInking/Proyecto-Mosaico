import { useEffect, useState } from 'react'

export type Locale = 'en' | 'es' | 'ru'

export const localeNames: Record<Locale, string> = { en: 'English', es: 'Español', ru: 'Русский' }
const storageKey = 'mosaico-locale'

const en: Record<string, string> = {
  'Mosaico': 'Mosaico', 'Asset Pipeline AI': 'Asset Pipeline AI', 'Idioma': 'Language', 'assets': 'assets', 'jobs': 'jobs', 'errores agrupados': 'grouped errors', 'Actualización de Mosaico disponible': 'Mosaico update available', '¿Instalar ahora?': 'Install now?', 'Actualizador Mosaico no disponible': 'Mosaico updater unavailable', 'Conectado': 'Connected', 'Sin conexión': 'Offline',
  'Módulos principales': 'Main modules', 'Pixel Art': 'Pixel Art', 'Assets': 'Assets', 'Pipelines': 'Pipelines', 'Mapas': 'Maps', 'Mundo': 'World', 'Jobs': 'Jobs', 'Exportar': 'Export', 'Planificado': 'Planned', 'Persistencia local activa': 'Local persistence active',
  'Cargando Authoring Core…': 'Loading Authoring Core…', 'No se pudo cargar el editor': 'The editor could not be loaded', 'Reintentar': 'Retry',
  'Workspace': 'Workspace', 'Catálogo': 'Catalog', 'Importar': 'Import', 'Buscar assets': 'Search assets', 'Nombre, tipo o hash': 'Name, type or hash', 'Sin assets importados': 'No imported assets', 'Importa o arrastra imágenes': 'Import or drag images', 'PNG, JPEG o WebP · originales inmutables': 'PNG, JPEG or WebP · immutable originals', 'Vista de trabajo': 'Work view', 'Receta no destructiva': 'Non-destructive recipe', 'Ejecución: Navegador': 'Execution: Browser', 'Ejecución: Local': 'Execution: Local', 'Original': 'Original', 'Salida': 'Output', 'Vista previa pendiente': 'Preview pending', 'Ejecuta receta': 'Run recipe', 'Consola': 'Console', 'grupos': 'groups', 'eventos': 'events', 'Sin errores actuales.': 'No current errors.', 'Inspector': 'Inspector', 'Resize pixel-perfect + conversión': 'Pixel-perfect resize + conversion', 'Ancho': 'Width', 'Alto': 'Height', 'Formato': 'Format', 'Calidad': 'Quality', 'Añadir a cola': 'Add to queue', 'Exportar imagen': 'Export image', 'Exportar manifiesto': 'Export manifest', 'Eliminar asset': 'Delete asset', 'Cola': 'Queue', 'Sin jobs.': 'No jobs.', 'Cancelar': 'Cancel', 'Tipo': 'Type', 'Tamaño': 'Size', 'Hash original': 'Original hash', 'Original protegido': 'Protected original', 'Resize y conversión crean salida derivada. El hash fuente y receta quedan en manifiesto JSON.': 'Resize and conversion create a derived output. Source hash and recipe stay in the JSON manifest.',
  'Archivo': 'File', 'Editar': 'Edit', 'Imagen': 'Image', 'Capa': 'Layer', 'Seleccionar': 'Select', 'Filtro': 'Filter', 'Vista': 'View', 'Ventana': 'Window', 'Otro': 'Other', 'Mapa': 'Map', 'Tileset': 'Tileset', 'Nuevo…': 'New…', 'Abrir…': 'Open…', 'Guardar proyecto': 'Save project', 'Deshacer': 'Undo', 'Rehacer': 'Redo', 'Copiar selección': 'Copy selection', 'Cortar selección': 'Cut selection', 'Pegar selección': 'Paste selection', 'Eliminar selección': 'Delete selection', 'Guardar modo…': 'Save mode…', 'Enviar tilesheet a Mapas': 'Send tilesheet to Maps', 'Enviar imagen a Assets': 'Send image to Assets',
  'Seleccionar Color principal': 'Select primary color', 'Lápiz': 'Pencil', 'Borrador': 'Eraser', 'Relleno': 'Fill', 'Línea': 'Line', 'Rectángulo': 'Rectangle', 'Elipse': 'Ellipse', 'Selección rectangular': 'Rectangular selection', 'Selector de color': 'Color picker', 'Selector de tile': 'Tile picker', 'Balde': 'Bucket', 'Selección': 'Selection', 'Mano': 'Hand', 'Color': 'Color', 'Color principal': 'Primary color', 'Relleno de formas': 'Shape fill', 'Capas': 'Layers', 'Timeline': 'Timeline', 'Documento': 'Document', 'Lienzo': 'Canvas', 'Colores usados': 'Used colors', 'Duración': 'Duration', 'Onion skin': 'Onion skin', 'Redimensionar inspector': 'Resize inspector', 'Redimensionar capas': 'Resize layers', 'Redimensionar timeline': 'Resize timeline', 'Redimensionar controles de timeline': 'Resize timeline controls', 'Canvas Pixel Art editable': 'Editable Pixel Art canvas', 'Canvas de pixel art': 'Pixel Art canvas', 'Sprite sin título': 'Untitled sprite', 'Capa 1': 'Layer 1', 'Ocultar': 'Hide', 'Bloquear': 'Lock', 'Eliminar': 'Delete', 'Reproducir animación': 'Play animation', 'Añadir frame': 'Add frame', 'Duplicar frame': 'Duplicate frame', 'Eliminar frame': 'Delete frame', 'Exportar sprite sheet': 'Export sprite sheet', 'Lienzo centrado': 'Canvas centered', 'Shift: restringir ángulo/proporción · Clic medio: mover lienzo': 'Shift: constrain angle/proportion · Middle click: pan canvas', '0: ajustar · P/E/G/L/R/O/M/H: herramientas · PageUp/Down: frames': '0: fit · P/E/G/L/R/O/M/H: tools · PageUp/Down: frames',
  'Biblioteca': 'Library', 'Tilesets': 'Tilesets', 'Mapa sin título': 'Untitled map', 'Cerrar Mapa sin título': 'Close untitled map', 'Árbol': 'Tree', 'Grid': 'Grid', 'Redimensionar mapa': 'Resize map', 'Redimensionar tilesets': 'Resize tilesets', 'Diagnósticos': 'Diagnostics', 'Sin errores': 'No errors', 'Crea o importa un tileset': 'Create or import a tileset', 'Nuevo mapa': 'New map', 'Nombre': 'Name', 'Ancho tiles': 'Tile width', 'Alto tiles': 'Tile height', 'Tile width': 'Tile width', 'Tile height': 'Tile height', 'Fondo transparente': 'Transparent background', 'Grid visible': 'Grid visible', 'Crear mapa': 'Create map', 'Importar tilesheet…': 'Import tilesheet…', 'Configurar autotile…': 'Configure autotile…', 'Ajustar mapa': 'Fit map', 'Copiar': 'Copy', 'Cortar': 'Cut', 'Pegar': 'Paste', 'Duplicar selección': 'Duplicate selection', 'Seleccionar…': 'Select…', 'Asset interno': 'Internal asset', 'Sin tilesets': 'No tilesets', 'Seleccionar Color del grid': 'Select grid color', 'Color del grid': 'Grid color', 'Color de fondo': 'Background color', 'Guardar': 'Save', 'Zoom 100%': 'Zoom 100%', 'Acercar': 'Zoom in', 'Alejar': 'Zoom out', 'Clic medio: pan · rueda: zoom al cursor · 0: ajustar': 'Middle click: pan · wheel: zoom at cursor · 0: fit', 'Canvas de mapa editable': 'Editable map canvas', 'Canvas de mapa ortogonal': 'Orthogonal map canvas', 'Contraer carpeta': 'Collapse folder', 'Carpeta 1': 'Folder 1', 'Capa 3': 'Layer 3', 'Capa 4': 'Layer 4', 'Flip X': 'Flip X', 'Flip Y': 'Flip Y', 'Rotar 90°': 'Rotate 90°', '180°': '180°', '270°': '270°',
  'Selección copiada': 'Selection copied', 'Selección cortada': 'Selection cut', 'Selección pegada': 'Selection pasted', 'Capa bloqueada': 'Layer locked', 'Capa oculta: muéstrala para editar': 'Layer hidden: show it to edit', 'Tilesheet enviado a Mapas': 'Tilesheet sent to Maps', 'Imagen enviada a Assets': 'Image sent to Assets', 'Editor compartido Web + Desktop': 'Shared Web + Desktop editor', 'Centrar lienzo': 'Center canvas', 'Próximamente': 'Coming soon', 'Restablecer espacio': 'Reset workspace', 'Panel de capas': 'Layers panel', 'Guardar layout': 'Save layout', 'Aplicar layout': 'Apply layout', 'Eliminar layout': 'Delete layout', 'Alternar grid': 'Toggle grid', 'Exportar JSON neutral': 'Export neutral JSON', 'Exportar PNG': 'Export PNG', 'Exportar JSON + assets ZIP': 'Export JSON + assets ZIP',
}

const ru: Record<string, string> = {
  ...en,
  'Asset Pipeline AI': 'Asset Pipeline AI', 'Idioma': 'Язык', 'Actualización de Mosaico disponible': 'Доступно обновление Mosaico', '¿Instalar ahora?': 'Установить сейчас?', 'Actualizador Mosaico no disponible': 'Обновление Mosaico недоступно', 'Conectado': 'Подключено', 'Sin conexión': 'Не в сети', 'Módulos principales': 'Основные модули', 'Assets': 'Ресурсы', 'Pipelines': 'Пайплайны', 'Mapas': 'Карты', 'Mundo': 'Мир', 'Jobs': 'Задачи', 'Exportar': 'Экспорт', 'Planificado': 'Запланировано', 'Persistencia local activa': 'Локальное сохранение включено', 'Cargando Authoring Core…': 'Загрузка редактора…', 'No se pudo cargar el editor': 'Не удалось загрузить редактор', 'Reintentar': 'Повторить',
  'Archivo': 'Файл', 'Editar': 'Правка', 'Imagen': 'Изображение', 'Capa': 'Слой', 'Seleccionar': 'Выделение', 'Filtro': 'Фильтр', 'Vista': 'Вид', 'Ventana': 'Окно', 'Otro': 'Другое', 'Nuevo…': 'Создать…', 'Abrir…': 'Открыть…', 'Guardar proyecto': 'Сохранить проект', 'Deshacer': 'Отменить', 'Rehacer': 'Повторить', 'Copiar selección': 'Копировать выделение', 'Cortar selección': 'Вырезать выделение', 'Pegar selección': 'Вставить выделение', 'Eliminar selección': 'Удалить выделение', 'Guardar modo…': 'Сохранить режим…', 'Enviar tilesheet a Mapas': 'Отправить тайлсет в Карты', 'Enviar imagen a Assets': 'Отправить изображение в Ресурсы',
  'Menú principal': 'Главное меню', 'Herramientas': 'Инструменты', 'Exportar imagen': 'Экспортировать изображение', 'Onion skin': 'Луковая кожа', 'Duración del frame': 'Длительность кадра', 'Seleccionar frame 1': 'Выбрать кадр 1', 'Seleccionar frame': 'Выбрать кадр', 'assets': 'ресурсов', 'jobs': 'задач', 'errores agrupados': 'сгруппированных ошибок', 'Mapa': 'Карта', 'Tileset': 'Тайлсет', 'Mapa sin título': 'Безымянная карта', 'Cerrar Mapa sin título': 'Закрыть безымянную карту', 'Biblioteca': 'Библиотека', 'Tilesets': 'Тайлсеты', 'Sin tilesets': 'Нет тайлсетов', 'Importar': 'Импортировать', 'Guardar': 'Сохранить', 'Redimensionar mapa': 'Изменить размер карты', 'Redimensionar tilesets': 'Изменить размер тайлсетов', 'Diagnósticos': 'Диагностика', 'Diagnostics': 'Диагностика', 'Sin errores': 'Ошибок нет', 'No errors': 'Ошибок нет', 'Crea o importa un tileset': 'Создайте или импортируйте тайлсет', 'Create or import a tileset': 'Создайте или импортируйте тайлсет', 'Canvas de mapa editable': 'Редактируемый холст карты', 'Canvas de mapa ortogonal': 'Ортогональный холст карты', 'Contraer carpeta': 'Свернуть папку', 'Carpeta 1': 'Папка 1', 'Capa 3': 'Слой 3', 'Capa 4': 'Слой 4', 'Árbol': 'Дерево', 'Seleccionar Color del grid': 'Выбрать цвет сетки', 'Grid': 'Сетка', 'Tiles': 'тайлов', 'px': 'пикс.', 'Clic medio: pan · rueda: zoom al cursor · 0: ajustar': 'Средняя кнопка: панорама · колесо: масштаб к курсору · 0: уместить', 'Flip X': 'Отразить X', 'Flip Y': 'Отразить Y', 'Rotar 90°': 'Повернуть на 90°', '180°': '180°', '270°': '270°', 'Seleccionar Color principal': 'Выбрать основной цвет', 'Lápiz': 'Карандаш', 'Borrador': 'Ластик', 'Relleno': 'Заливка', 'Línea': 'Линия', 'Rectángulo': 'Прямоугольник', 'Elipse': 'Эллипс', 'Selección rectangular': 'Прямоугольное выделение', 'Selector de color': 'Пипетка', 'Selector de tile': 'Выбор тайла', 'Balde': 'Ведро', 'Selección': 'Выделение', 'Mano': 'Рука', 'Color': 'Цвет', 'Color principal': 'Основной цвет', 'Relleno de formas': 'Заливка фигур', 'Capas': 'Слои', 'Timeline': 'Таймлайн', 'Documento': 'Документ', 'Lienzo': 'Холст', 'Colores usados': 'Использованные цвета', 'Duración': 'Длительность', 'Redimensionar inspector': 'Изменить размер инспектора', 'Redimensionar capas': 'Изменить размер слоёв', 'Redimensionar timeline': 'Изменить размер таймлайна', 'Redimensionar controles de timeline': 'Изменить размер элементов таймлайна', 'Canvas Pixel Art editable': 'Редактируемый холст Pixel Art', 'Canvas de pixel art': 'Холст Pixel Art', 'Sprite sin título': 'Безымянный спрайт', 'Capa 1': 'Слой 1', 'Ocultar': 'Скрыть', 'Bloquear': 'Заблокировать', 'Eliminar': 'Удалить', 'Reproducir анимацию': 'Воспроизвести анимацию', 'Añadir frame': 'Добавить кадр', 'Duplicar frame': 'Дублировать кадр', 'Eliminar frame': 'Удалить кадр', 'Exportar sprite sheet': 'Экспортировать спрайт-лист', 'Lienzo centrado': 'Холст по центру', 'Shift: restringir ángulo/proporción · Clic medio: mover lienzo': 'Shift: ограничить угол/пропорции · Средняя кнопка: панорамирование', '0: ajustar · P/E/G/L/R/O/M/H: herramientas · PageUp/Down: frames': '0: уместить · P/E/G/L/R/O/M/H: инструменты · PageUp/Down: кадры',
}

ru['Reproducir animación'] = 'Воспроизвести анимацию'
const dictionaries: Record<Locale, Record<string, string>> = { en, es: Object.fromEntries(Object.keys(en).map((key) => [key, key])), ru }
const reverse = Object.fromEntries(Object.values(dictionaries).flatMap((dictionary) => Object.entries(dictionary).map(([key, value]) => [value, key])))

export function translateText(text: string, locale: Locale): string {
  const trimmed = text.trim()
  if (!trimmed) return text
  const frame = trimmed.match(/^(?:Seleccionar frame|Select frame|Выбрать кадр) (\d+)$/)
  if (frame) {
    const translated = locale === 'ru' ? `Выбрать кадр ${frame[1]}` : locale === 'en' ? `Select frame ${frame[1]}` : `Seleccionar frame ${frame[1]}`
    return text.replace(trimmed, translated)
  }
  const hotkey = trimmed.match(/^(?:Lápiz|Pencil|Карандаш|Borrador|Eraser|Ластик|Relleno|Fill|Заливка|Línea|Line|Линия|Selección|Selection|Выделение|Mano|Hand|Рука) \(([A-Z])\)$/)
  if (hotkey) {
    const tool = trimmed.slice(0, trimmed.lastIndexOf(' ('))
    return text.replace(trimmed, `${translateText(tool, locale)} (${hotkey[1]})`)
  }
  const groups = trimmed.match(/^(\d+) (?:grupos|groups|групп) · (\d+) (?:eventos|events|событий)(.*)$/)
  if (groups) {
    const translated = locale === 'ru' ? `${groups[1]} групп · ${groups[2]} событий${groups[3] ?? ''}` : locale === 'en' ? `${groups[1]} groups · ${groups[2]} events${groups[3] ?? ''}` : `${groups[1]} grupos · ${groups[2]} eventos${groups[3] ?? ''}`
    return text.replace(trimmed, translated)
  }
  const counts = trimmed.match(/^(\d+) (?:assets|ресурсов) · (\d+) (?:jobs|задач) · (\d+) (?:errores agrupados|grouped errors|сгруппированных ошибок)$/)
  if (counts) {
    const translated = locale === 'ru' ? `${counts[1]} ресурсов · ${counts[2]} задач · ${counts[3]} сгруппированных ошибок` : locale === 'en' ? `${counts[1]} assets · ${counts[2]} jobs · ${counts[3]} grouped errors` : trimmed
    return text.replace(trimmed, translated)
  }
  const key = en[trimmed] ? trimmed : reverse[trimmed] ?? trimmed
  const translated = dictionaries[locale][key] ?? trimmed
  return text.replace(trimmed, translated)
}

export function localizeElement(root: HTMLElement, locale: Locale): void {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  const nodes: Text[] = []
  while (walker.nextNode()) nodes.push(walker.currentNode as Text)
  for (const node of nodes) { const value = node.nodeValue ?? ''; const translated = translateText(value, locale); if (translated !== value) node.nodeValue = translated }
  for (const element of root.querySelectorAll<HTMLElement>('[aria-label],[title],[placeholder]')) {
    for (const attribute of ['aria-label', 'title', 'placeholder']) {
      const value = element.getAttribute(attribute)
      if (value) { const translated = translateText(value, locale); if (translated !== value) element.setAttribute(attribute, translated) }
    }
  }
}

export function useLocale(): [Locale, (locale: Locale) => void] {
  const [locale, setLocale] = useState<Locale>(getStoredLocale)
  useEffect(() => { document.documentElement.lang = locale; try { window.localStorage.setItem(storageKey, locale) } catch { /* storage unavailable */ } }, [locale])
  return [locale, setLocale]
}

export function getStoredLocale(): Locale {
  try { const saved = window.localStorage.getItem(storageKey); return saved === 'es' || saved === 'ru' ? saved : 'en' } catch { return 'en' }
}
