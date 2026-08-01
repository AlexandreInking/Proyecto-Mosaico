import { useMemo, useState } from 'react'
import { Search, X } from 'lucide-react'
import { createDemoNode, type DemoNodeKind } from './pipeline-editor-model.js'
import { getPublishedNodeLibrary } from './pipeline-node-registry.js'
import type { Locale } from './i18n.js'

type Localized = Record<Locale, string>
type HelpEntry = {
  id: string
  folder: string
  level: 1 | 2
  title: Localized
  body: Localized
  tags: string[]
}

const copy = (es: string, en: string, ru: string, fr: string, it: string): Localized => ({ es, en, ru, fr, it })

const staticEntries: readonly HelpEntry[] = [
  {
    id: 'start', folder: 'start', level: 1,
    title: copy('Inicio', 'Getting started', 'Начало', 'Démarrage', 'Avvio'),
    body: copy(
      'Mosaico es un espacio de trabajo compartido para Assets, Editor, Pipelines y Maps. La barra superior cambia de pestaña sin destruir los documentos. Los botones de guardar y abrir workspace usan .mws y contienen el estado completo.',
      'Mosaico is a shared workspace for Assets, Editor, Pipelines and Maps. The top bar switches views without destroying documents. Workspace save and open use .mws and contain the complete state.',
      'Mosaico — единое рабочее пространство для Assets, Editor, Pipelines и Maps. Верхняя панель переключает представления, не уничтожая документы. Сохранение и открытие workspace используют .mws и сохраняют всё состояние.',
      'Mosaico est un espace de travail partagé pour Assets, Editor, Pipelines et Maps. La barre supérieure change de vue sans détruire les documents. Le workspace complet est enregistré en .mws.',
      'Mosaico è uno spazio di lavoro condiviso per Assets, Editor, Pipelines e Mappe. La barra superiore cambia vista senza eliminare i documenti. Il workspace completo viene salvato in .mws.',
    ), tags: ['workspace', 'tabs', 'mws'],
  },
  {
    id: 'assets', folder: 'assets', level: 1,
    title: copy('Assets: catálogo y carpetas', 'Assets: catalog and folders', 'Assets: каталог и папки', 'Assets : catalogue et dossiers', 'Assets: catalogo e cartelle'),
    body: copy(
      'Importa PNG y GIF con Importar o arrastrando archivos sobre Assets. Cada Asset conserva nombre, tipo, dimensiones, hash, thumbnail y Blob original. El catálogo usa deduplicación SHA-256 e IndexedDB. Crea carpetas virtuales, pulsa una carpeta para entrar y arrastra una tarjeta sobre otra carpeta. Doble clic sobre un Asset dentro de una carpeta lo devuelve a la raíz. Estas carpetas no mueven archivos reales de Windows. Desde el detalle puedes abrir el Asset en Editor, añadirlo a Pipelines o usarlo como tileset en Maps.',
      'Import PNG and GIF files with Import or by dropping files onto Assets. Each Asset keeps its name, type, dimensions, hash, thumbnail and original Blob. The catalog uses SHA-256 deduplication and IndexedDB. Create virtual folders, open a folder, and drag an Asset card onto another folder. Double-click an Asset inside a folder to return it to the root. Folders never move Windows files. The detail view can open an Asset in Editor, add it to Pipelines, or use it as a Maps tileset.',
      'Импортируйте PNG и GIF кнопкой Import или перетаскиванием. Asset сохраняет имя, тип, размеры, hash, thumbnail и исходный Blob. Каталог использует дедупликацию SHA-256 и IndexedDB. Создавайте виртуальные папки и перетаскивайте карточки. Двойной щелчок по Asset в папке возвращает его в корень. Папки не перемещают файлы Windows. Из карточки Asset можно открыть его в Editor, добавить в Pipelines или использовать как tileset в Maps.',
      'Importez des PNG et GIF avec Importer ou par glisser-déposer. Chaque Asset conserve son nom, son type, ses dimensions, son hash, sa miniature et son Blob original. Les dossiers sont virtuels et ne déplacent pas les fichiers Windows. La fiche permet d’ouvrir l’Asset dans Editor, de l’ajouter à Pipelines ou de l’utiliser comme tileset dans Maps.',
      'Importa PNG e GIF con Importa o trascinandoli. Ogni Asset conserva nome, tipo, dimensioni, hash, miniatura e Blob originale. Le cartelle sono virtuali e non spostano i file Windows. Dal dettaglio puoi aprire l’Asset nell’Editor, aggiungerlo a Pipelines o usarlo come tileset nelle Mappe.',
    ), tags: ['png', 'gif', 'folders', 'sha256', 'indexeddb', 'drag'],
  },
  {
    id: 'editor-tools', folder: 'editor', level: 1,
    title: copy('Editor: herramientas', 'Editor: tools', 'Editor: инструменты', 'Editor : outils', 'Editor: strumenti'),
    body: copy(
      'Lienzo: Lápiz pinta un píxel o trazo; Borrador escribe transparencia; Relleno aplica flood fill; Selector de color toma un color del frame; Línea, Rectángulo y Elipse dibujan formas; Mano hace pan; Selección ofrece rectangular, elíptica, lazo y varita mágica. Shift restringe líneas y proporciones. Una selección se puede mover arrastrándola. El inspector muestra colores usados, capas, visibilidad, bloqueo, carpetas y renombrado por doble clic. El canvas enfocado admite copiar, cortar y pegar la selección.',
      'Canvas: Pencil paints pixels or strokes; Eraser writes transparency; Fill applies flood fill; Color picker samples a frame; Line, Rectangle and Ellipse draw shapes; Hand pans; Selection provides rectangle, ellipse, lasso and magic wand. Shift constrains lines and proportions. A selection can be moved by dragging. The inspector exposes used colors, layers, visibility, locking, folders and double-click renaming. The focused canvas supports copying, cutting and pasting selections.',
      'Холст: Pencil рисует, Eraser делает прозрачность, Fill выполняет заливку, Color picker выбирает цвет, Line/Rectangle/Ellipse рисуют формы, Hand перемещает холст, Selection предлагает прямоугольник, эллипс, лассо и волшебную палочку. Shift ограничивает линии и пропорции. Выделение можно перемещать. Инспектор управляет цветами, слоями, видимостью, блокировкой, папками и переименованием. На сфокусированном холсте работают копирование, вырезание и вставка.',
      'Canvas : Pencil dessine, Eraser crée de la transparence, Fill remplit, Color picker prélève une couleur, Line/Rectangle/Ellipse dessinent, Hand déplace la vue et Selection propose rectangle, ellipse, lasso et baguette magique. Shift contraint les lignes et proportions. Une sélection peut être déplacée. L’inspecteur gère couleurs, calques, visibilité, verrouillage, dossiers et renommage. Le canvas focalisé accepte copier, couper et coller.',
      'Canvas: Pencil disegna, Eraser crea trasparenza, Fill riempie, Color picker campiona un colore, Line/Rectangle/Ellipse disegnano forme, Hand sposta la vista e Selection offre rettangolo, ellisse, lazo e bacchetta magica. Shift vincola linee e proporzioni. La selezione si può trascinare. L’ispettore gestisce colori, livelli, visibilità, blocco, cartelle e rinomina. Con il canvas attivo funzionano copia, taglia e incolla.',
    ), tags: ['pencil', 'eraser', 'fill', 'selection', 'layers', 'clipboard'],
  },
  {
    id: 'editor-animation', folder: 'editor', level: 2,
    title: copy('Editor: frames y exportación', 'Editor: frames and export', 'Editor: кадры и экспорт', 'Editor : images et export', 'Editor: frame ed esportazione'),
    body: copy(
      'El timeline del Editor permite crear, duplicar, seleccionar y eliminar frames, cambiar duración en milisegundos, reproducir la animación y usar onion skin. Archivo permite guardar .mpe, abrir .mpe/.mosaico legacy, exportar PNG/JPG/WebP/GIF y enviar sprite, animación o tilesheet a Assets. Las pestañas de documentos tienen su propio botón de cierre; cerrar el documento activo cambia al vecino y nunca deja el Editor sin documento.',
      'The Editor timeline creates, duplicates, selects and deletes frames, edits duration in milliseconds, plays animation and supports onion skin. File can save .mpe, open .mpe or legacy .mosaico, export PNG/JPG/WebP/GIF, and send a sprite, animation or tilesheet to Assets. Document tabs have their own close button; closing the active document selects a neighbor and never leaves Editor without a document.',
      'Timeline Editor позволяет создавать, дублировать, выбирать и удалять кадры, менять длительность, воспроизводить анимацию и включать onion skin. File сохраняет .mpe, открывает .mpe и legacy .mosaico, экспортирует PNG/JPG/WebP/GIF и отправляет sprite, animation или tilesheet в Assets. У вкладок документов есть кнопка закрытия; активная вкладка закрывается с выбором соседней, последний документ сохраняется.',
      'La timeline d’Editor crée, duplique, sélectionne et supprime les images, modifie leur durée, lit l’animation et propose onion skin. File enregistre .mpe, ouvre .mpe ou le legacy .mosaico, exporte PNG/JPG/WebP/GIF et envoie sprite, animation ou tilesheet vers Assets. Chaque onglet possède un bouton de fermeture et le dernier document reste ouvert.',
      'La timeline dell’Editor crea, duplica, seleziona ed elimina frame, modifica la durata, riproduce l’animazione e supporta onion skin. File salva .mpe, apre .mpe o il legacy .mosaico, esporta PNG/JPG/WebP/GIF e invia sprite, animazione o tilesheet agli Assets. Ogni scheda ha un pulsante di chiusura e l’ultimo documento resta aperto.',
    ), tags: ['frames', 'timeline', 'gif', 'mpe', 'export'],
  },
  {
    id: 'maps-tools', folder: 'maps', level: 1,
    title: copy('Maps: herramientas y capas', 'Maps: tools and layers', 'Maps: инструменты и слои', 'Maps : outils et calques', 'Mappe: strumenti e livelli'),
    body: copy(
      'Maps trabaja con tilesets, capas y celdas. Lápiz pinta el patrón seleccionado; Borrador elimina; Selector de tile toma un tile del mapa; Relleno rellena una región; Línea, Rectángulo y Elipse aplican patrones; Selección copia, corta, pega, mueve, transforma y elimina regiones; Mano hace pan. El panel de tilesets importa un tilesheet con ancho, alto, margen, spacing y offset, permite renombrar y ajustar zoom. Las capas se organizan en árbol, se pueden ocultar, bloquear, renombrar y agrupar. Selección no dibuja un tile-hover sobre el mapa.',
      'Maps works with tilesets, layers and cells. Pencil paints the selected pattern; Eraser removes; Tile picker samples a tile; Fill fills a region; Line, Rectangle and Ellipse apply patterns; Selection copies, cuts, pastes, moves, transforms and deletes regions; Hand pans. The tileset panel imports a sheet with width, height, margin, spacing and offset, and supports renaming and thumbnail zoom. Layers form a tree and can be hidden, locked, renamed and grouped. Selection does not draw a tile hover over the map.',
      'Maps работает с tilesets, слоями и ячейками. Pencil рисует выбранный шаблон, Eraser удаляет, Tile picker выбирает tile, Fill заполняет область, Line/Rectangle/Ellipse применяют шаблоны, Selection копирует, вырезает, вставляет, перемещает, преобразует и удаляет области, Hand перемещает вид. Панель tileset импортирует sheet с шириной, высотой, margin, spacing и offset. Слои можно скрывать, блокировать, переименовывать и группировать. В режиме Selection hover-tile не показывается.',
      'Maps utilise tilesets, calques et cellules. Pencil peint le motif, Eraser efface, Tile picker prélève un tile, Fill remplit, Line/Rectangle/Ellipse appliquent des motifs, Selection copie, coupe, colle, déplace, transforme et supprime des zones, Hand déplace la vue. Le panneau tileset importe une feuille avec largeur, hauteur, marge, espacement et offset, et permet le renommage et le zoom. Les calques sont masquables, verrouillables, renommables et groupables. Selection n’affiche pas de tile-hover.',
      'Le Mappe usano tileset, livelli e celle. Pencil dipinge il pattern, Eraser cancella, Tile picker preleva un tile, Fill riempie, Line/Rectangle/Ellisse applicano pattern, Selection copia, taglia, incolla, sposta, trasforma ed elimina aree, Hand sposta la vista. Il pannello tileset importa sheet con larghezza, altezza, margine, spacing e offset. I livelli si possono nascondere, bloccare, rinominare e raggruppare. Selection non mostra il tile-hover.',
    ), tags: ['maps', 'tileset', 'layers', 'selection', 'clipboard'],
  },
  {
    id: 'pipelines-canvas', folder: 'pipelines', level: 1,
    title: copy('Pipelines: canvas y palette', 'Pipelines: canvas and palette', 'Pipelines: холст и palette', 'Pipelines : canvas et palette', 'Pipelines: canvas e palette'),
    body: copy(
      'El canvas de Pipelines es la única vista que contiene nodos. Doble clic en un espacio vacío, Space o F2 con el canvas enfocado abre la palette flotante. El buscador y las pestañas filtran nodos publicados por familia. La palette se arrastra desde su encabezado, se cierra con Escape o clic fuera y añade el nodo en la última posición del cursor o en el centro visible. Shift añade nodos a la selección. El botón de limpiar elimina nodos, conexiones, keyframes y snapshots usando undo. Las conexiones se crean desde handles reales y rechazan ciclos, puertos incompatibles, duplicados y entradas ocupadas.',
      'The Pipelines canvas is the only view that contains nodes. Double-click empty space, press Space or F2 with the canvas focused to open the floating palette. Search and tabs filter published nodes by family. Drag the palette from its header; Escape or an outside click closes it. New nodes use the last cursor position or the visible canvas center. Shift adds nodes to the selection. Clear removes nodes, connections, keyframes and snapshots through undo. Connections use real handles and reject cycles, incompatible ports, duplicates and occupied inputs.',
      'Canvas Pipelines — единственное представление с узлами. Двойной щелчок по пустому месту, Space или F2 открывает плавающую palette. Поиск и вкладки фильтруют опубликованные узлы по семейству. Palette можно перетаскивать за заголовок; Escape и клик вне неё закрывают её. Новый узел появляется у курсора или в центре canvas. Shift добавляет узлы к выбору. Clear удаляет узлы, связи, keyframes и snapshots через undo. Связи используют реальные handles и отклоняют циклы, несовместимые порты, дубликаты и занятые входы.',
      'Le canvas Pipelines est la seule vue contenant des nœuds. Double-cliquez dans un espace vide, appuyez sur Space ou F2 pour ouvrir la palette flottante. La recherche et les onglets filtrent les nœuds publiés. La palette se déplace par son en-tête et se ferme avec Escape ou un clic extérieur. Les nouveaux nœuds suivent le curseur ou le centre visible. Shift ajoute à la sélection. Clear supprime nœuds, connexions, keyframes et snapshots via undo. Les connexions utilisent de vrais handles et refusent cycles, types incompatibles, doublons et entrées occupées.',
      'Il canvas Pipelines è l’unica vista che contiene nodi. Doppio clic nello spazio vuoto, Space o F2 aprono la palette flottante. Ricerca e schede filtrano i nodi pubblicati. La palette si trascina dall’intestazione e si chiude con Escape o clic esterno. I nuovi nodi seguono il cursore o il centro visibile. Shift aggiunge alla selezione. Clear elimina nodi, connessioni, keyframe e snapshot tramite undo. Le connessioni usano handle reali e rifiutano cicli, tipi incompatibili, duplicati e input occupati.',
    ), tags: ['pipelines', 'palette', 'nodes', 'handles', 'shift'],
  },
  {
    id: 'pipelines-inspector', folder: 'pipelines', level: 2,
    title: copy('Pipelines: inspector y puertos', 'Pipelines: inspector and ports', 'Pipelines: инспектор и порты', 'Pipelines : inspecteur et ports', 'Pipelines: ispettore e porte'),
    body: copy(
      'El inspector muestra cada parámetro una sola vez. El ojo abierto significa que el parámetro tiene un handle visible en el nodo; no muestra el valor interno. El ojo cerrado conserva la edición en inspector y oculta el handle. Los puertos de parámetros usan parameter:<id>. Los nodos matemáticos aceptan Value o Surface en el mismo conector: Value + Surface hace broadcast por píxel y las operaciones binarias usan las dimensiones de A cuando A es Surface. El menú contextual del nodo ofrece Collapse Preview/Show Preview y Delete Node.',
      'The inspector lists each parameter once. An open eye means the parameter has a visible node handle; it never exposes the internal value. A closed eye keeps inspector editing and hides the handle. Parameter ports use parameter:<id>. Math nodes accept Value or Surface through the same connector: Value + Surface broadcasts per pixel, and binary operations use A dimensions when A is a Surface. The node context menu offers Collapse Preview/Show Preview and Delete Node.',
      'Инспектор показывает каждый параметр один раз. Открытый глаз означает видимый handle узла, а не отображение внутреннего значения. Закрытый глаз оставляет редактирование в инспекторе и скрывает handle. Порты параметров используют parameter:<id>. Математические узлы принимают Value или Surface одним коннектором; скаляр распространяется по пикселям, а бинарная Surface-операция использует размеры A. Контекстное меню предлагает Collapse Preview/Show Preview и Delete Node.',
      'L’inspecteur affiche chaque paramètre une seule fois. L’œil ouvert signifie qu’un handle est visible sur le nœud, pas que la valeur interne est affichée. L’œil fermé conserve l’édition dans l’inspecteur et masque le handle. Les ports de paramètres utilisent parameter:<id>. Les nœuds math acceptent Value ou Surface sur le même connecteur, avec broadcast du scalaire par pixel et taille de A pour les opérations binaires. Le menu du nœud propose Collapse Preview/Show Preview et Delete Node.',
      'L’ispettore mostra ogni parametro una sola volta. L’occhio aperto indica un handle visibile sul nodo, non il valore interno. L’occhio chiuso mantiene la modifica nell’ispettore e nasconde il handle. Le porte parametro usano parameter:<id>. I nodi matematici accettano Value o Surface sullo stesso connettore, con broadcast dello scalare per pixel e dimensioni di A per le operazioni binarie. Il menu del nodo offre Collapse Preview/Show Preview e Delete Node.',
    ), tags: ['inspector', 'parameters', 'surface-or-value', 'context-menu'],
  },
  {
    id: 'pipelines-timeline', folder: 'pipelines', level: 2,
    title: copy('Pipelines: timeline y frames', 'Pipelines: timeline and frames', 'Pipelines: timeline и кадры', 'Pipelines : timeline et images', 'Pipelines: timeline e frame'),
    body: copy(
      'El timeline de Pipelines genera frames reales a FPS configurable, incluye tiempos de keyframes, muestra thumbnails transparentes y permite seleccionar frames, reproducir, pausar, detener, hacer loop, cambiar zoom temporal y redimensionar su alto. Cada keyframe es un rombo geométrico y pertenece a un único nodo, parámetro y tiempo. Los valores se guardan dentro del keyframe; editar fuera modifica el valor base. Rotation, Zoom y GIF se evalúan según el tiempo actual. Snapshots solo se capturan cuando existe un resultado RGBA real.',
      'The Pipelines timeline generates real frames at a configurable FPS, includes keyframe times, shows transparent thumbnails, supports frame selection, play/pause/stop/loop, temporal zoom and height resizing. Each keyframe is a geometric diamond and belongs to one node, parameter and time. Values are stored inside the keyframe; editing outside a keyframe changes the base value. Rotation, Zoom and GIF evaluate at the current time. Snapshots require a real RGBA result.',
      'Timeline Pipelines генерирует реальные кадры с настраиваемым FPS, включает времена keyframes, показывает прозрачные thumbnails, поддерживает выбор кадров, play/pause/stop/loop, временной zoom и изменение высоты. Каждый keyframe — геометрический ромб для одного узла, параметра и времени. Значение хранится в keyframe; редактирование вне keyframe меняет базовое значение. Rotation, Zoom и GIF вычисляются по текущему времени. Snapshot возможен только при реальном RGBA-результате.',
      'La timeline Pipelines génère des images réelles à FPS configurable, inclut les temps des keyframes, affiche des miniatures transparentes, permet la sélection, play/pause/stop/loop, le zoom temporel et le redimensionnement. Chaque keyframe est un losange géométrique associé à un nœud, un paramètre et un temps. Les valeurs restent propres au keyframe. Rotation, Zoom et GIF suivent le temps courant. Un snapshot exige un résultat RGBA réel.',
      'La timeline Pipelines genera frame reali a FPS configurabile, include i tempi dei keyframe, mostra miniature trasparenti, supporta selezione, play/pause/stop/loop, zoom temporale e ridimensionamento. Ogni keyframe è un rombo geometrico legato a nodo, parametro e tempo. Il valore resta nel keyframe. Rotation, Zoom e GIF seguono il tempo corrente. Lo snapshot richiede un risultato RGBA reale.',
    ), tags: ['timeline', 'frames', 'keyframes', 'diamonds', 'gif'],
  },
  {
    id: 'formats', folder: 'workspace', level: 1,
    title: copy('Formatos y guardado', 'Formats and saving', 'Форматы и сохранение', 'Formats et enregistrement', 'Formati e salvataggio'),
    body: copy(
      'MWS es el formato portable del workspace completo: catálogo de Assets, carpetas, documentos de Editor, mapas, pipelines, nodos personalizados y selecciones. MPL guarda un Pipeline independiente. MPE guarda un documento del Editor. MTM guarda un mapa. La lectura legacy de .mosaico se conserva, pero ningún guardado nuevo usa esa extensión. Los Blobs de Assets se incluyen una sola vez por hash.',
      'MWS is the portable complete-workspace format: Assets, folders, Editor documents, maps, pipelines, custom nodes and selections. MPL saves an independent Pipeline. MPE saves an Editor document. MTM saves a map. Legacy .mosaico remains readable, but new saves never use it. Asset Blobs are included once per hash.',
      'MWS — переносимый формат всего workspace: Assets, папки, документы Editor, карты, pipelines, custom nodes и выбор. MPL сохраняет отдельный Pipeline, MPE — документ Editor, MTM — карту. Legacy .mosaico читается, но новые файлы не создаются. Blobs Assets включаются один раз на hash.',
      'MWS est le format portable du workspace complet : Assets, dossiers, documents Editor, cartes, pipelines, nœuds personnalisés et sélections. MPL, MPE et MTM servent aux échanges indépendants. Le legacy .mosaico reste lisible mais n’est plus créé. Les Blobs sont inclus une seule fois par hash.',
      'MWS è il formato portabile dell’intero workspace: Assets, cartelle, documenti Editor, mappe, pipeline, nodi personalizzati e selezioni. MPL, MPE e MTM servono per lo scambio indipendente. Il legacy .mosaico resta leggibile ma non viene più creato. I Blob sono inclusi una sola volta per hash.',
    ), tags: ['mws', 'mpl', 'mpe', 'mtm', 'mosaico'],
  },
  {
    id: 'shortcuts', folder: 'shortcuts', level: 1,
    title: copy('Atajos de teclado', 'Keyboard shortcuts', 'Сочетания клавиш', 'Raccourcis clavier', 'Scorciatoie da tastiera'),
    body: copy(
      'Global: F1 abre la documentación. Editor: P Lápiz, E Borrador, I Selector de color, G Relleno, L Línea, R Rectángulo, O Elipse, M Selección, H Mano, PageUp/PageDown cambia frame, Ctrl/Cmd+C/X/V copia/corta/pega. Maps: P Lápiz, E Borrador, I Selector de tile, G Relleno, L Línea, R Rectángulo, O Elipse, M Selección, H Mano, Space activa pan temporal, Ctrl/Cmd+C/X/V opera sobre tiles. Pipelines: Space o F2 abre la palette, Shift selecciona de forma aditiva, Delete/Backspace elimina selección, Escape cierra overlays.',
      'Global: F1 opens documentation. Editor: P Pencil, E Eraser, I Color picker, G Fill, L Line, R Rectangle, O Ellipse, M Selection, H Hand, PageUp/PageDown changes frame, Ctrl/Cmd+C/X/V copies/cuts/pastes. Maps: P Pencil, E Eraser, I Tile picker, G Fill, L Line, R Rectangle, O Ellipse, M Selection, H Hand, Space temporarily pans, Ctrl/Cmd+C/X/V operates on tiles. Pipelines: Space or F2 opens the palette, Shift adds to selection, Delete/Backspace removes selection, Escape closes overlays.',
      'Глобально: F1 открывает документацию. Editor: P Pencil, E Eraser, I Color picker, G Fill, L Line, R Rectangle, O Ellipse, M Selection, H Hand, PageUp/PageDown меняет кадр, Ctrl/Cmd+C/X/V копирует, вырезает и вставляет. Maps: те же клавиши для tiles; Space временно включает pan. Pipelines: Space или F2 открывает palette, Shift добавляет выбор, Delete/Backspace удаляет выбор, Escape закрывает overlay.',
      'Global : F1 ouvre la documentation. Editor : P Pencil, E Eraser, I Color picker, G Fill, L Line, R Rectangle, O Ellipse, M Selection, H Hand, PageUp/PageDown change l’image, Ctrl/Cmd+C/X/V copie, coupe et colle. Maps utilise les mêmes raccourcis pour les tiles ; Space active temporairement le déplacement. Pipelines : Space ou F2 ouvre la palette, Shift ajoute à la sélection, Delete/Backspace supprime, Escape ferme les overlays.',
      'Globale: F1 apre la documentazione. Editor: P Pencil, E Eraser, I Color picker, G Fill, L Line, R Rectangle, O Ellisse, M Selection, H Hand, PageUp/PageDown cambia frame, Ctrl/Cmd+C/X/V copia, taglia e incolla. Mappe usa gli stessi tasti per i tile; Space attiva temporaneamente il pan. Pipelines: Space o F2 apre la palette, Shift aggiunge alla selezione, Delete/Backspace elimina, Escape chiude gli overlay.',
    ), tags: ['hotkeys', 'keyboard', 'f1', 'clipboard'],
  },
  {
    id: 'diagnostics', folder: 'recovery', level: 1,
    title: copy('Diagnósticos y recuperación', 'Diagnostics and recovery', 'Диагностика и восстановление', 'Diagnostics et récupération', 'Diagnostica e recupero'),
    body: copy(
      'Las salidas sin entrada válida son RGBA transparentes, no imágenes falsas. Las conexiones inválidas muestran diagnóstico contextual. Los borradores se guardan localmente con debounce; un borrador corrupto se descarta sin mutar IndexedDB. Un archivo ZIP inválido, hash incorrecto, ruta insegura o Asset demasiado grande se rechaza antes de cambiar el estado. Usa undo después de limpiar Pipelines y guarda un .mws para una copia portable.',
      'Missing or invalid inputs produce transparent RGBA, never fake images. Invalid connections show contextual diagnostics. Drafts autosave with debounce; corrupt drafts are discarded without mutating IndexedDB. Invalid ZIPs, wrong hashes, unsafe paths and oversized Assets are rejected before state changes. Use undo after clearing Pipelines and save an .mws for a portable copy.',
      'Отсутствующие или неверные входы дают прозрачный RGBA, а не ложные изображения. Неверные связи показывают диагностику. Черновики сохраняются с debounce; повреждённый черновик удаляется без изменения IndexedDB. Неверный ZIP, hash, небезопасный путь или слишком большой Asset отклоняются до изменения состояния. После очистки Pipelines используйте undo и сохраните .mws.',
      'Une entrée absente ou invalide produit un RGBA transparent, jamais une fausse image. Les connexions invalides affichent un diagnostic. Les brouillons sont enregistrés avec debounce et les brouillons corrompus sont rejetés sans modifier IndexedDB. ZIP invalide, hash incorrect, chemin dangereux et Asset trop grand sont refusés avant toute mutation. Utilisez undo puis enregistrez un .mws.',
      'Gli input mancanti o non validi producono RGBA trasparente, mai immagini false. Le connessioni errate mostrano una diagnosi. Le bozze sono salvate con debounce; una bozza corrotta viene scartata senza modificare IndexedDB. ZIP, hash, percorsi non sicuri e Asset troppo grandi vengono rifiutati prima della mutazione. Usa undo e salva un .mws.',
    ), tags: ['errors', 'diagnostics', 'transparent', 'recovery'],
  },
]

function nodeEntries(): HelpEntry[] {
  return getPublishedNodeLibrary().map((item) => {
    const node = createDemoNode(item.kind as DemoNodeKind, `help-${item.kind}`, { x: 0, y: 0 })
    const inputs = node.inputs.filter((port) => port.direction === 'input').map((port) => `${port.id}:${port.type}`).join(', ') || 'none'
    const outputs = node.outputs.filter((port) => port.direction === 'output').map((port) => `${port.id}:${port.type}`).join(', ') || 'none'
    const parameters = node.parameters.map((parameter) => `${parameter.id}:${parameter.kind}=${JSON.stringify(parameter.value)}`).join(', ') || 'none'
    const technical = `kind=${item.kind}; evaluator=${item.description}; inputs=${inputs}; outputs=${outputs}; parameters=${parameters}`
    return {
      id: `node:${item.kind}`, folder: 'nodes', level: 2,
      title: copy(item.label, item.label, item.label, item.label, item.label),
      body: copy(
        `${item.description}. Familia: ${item.family}. Identidad técnica: ${technical}. El evaluador trabaja localmente y de forma determinista. Las entradas ausentes producen transparencia, cero o falso según el tipo; los parámetros conectables se editan una sola vez desde Inspector y sus handles se controlan con el ojo.`,
        `${item.description}. Family: ${item.family}. Technical identity: ${technical}. The evaluator runs locally and deterministically. Missing inputs produce transparency, zero or false according to type; connectable parameters are edited once in Inspector and their handles are controlled by the eye toggle.`,
        `${item.description}. Семейство: ${item.family}. Техническая идентичность: ${technical}. Evaluator локальный и детерминированный. Отсутствующие входы дают прозрачность, ноль или false по типу; подключаемые параметры редактируются один раз в Inspector, а handles управляются глазом.`,
        `${item.description}. Famille : ${item.family}. Identité technique : ${technical}. L’évaluateur est local et déterministe. Les entrées absentes produisent transparence, zéro ou faux selon le type ; les paramètres connectables sont édités une seule fois dans Inspector et leurs handles suivent l’œil.`,
        `${item.description}. Famiglia: ${item.family}. Identità tecnica: ${technical}. L’evaluator è locale e deterministico. Gli input mancanti producono trasparenza, zero o false in base al tipo; i parametri collegabili si modificano una sola volta nell’Ispettore e i relativi handle seguono l’occhio.`,
      ), tags: ['node', item.kind, item.family ?? 'node', ...item.description.split(/\s+/).slice(0, 3).filter((tag): tag is string => Boolean(tag))],
    }
  })
}

const entries: readonly HelpEntry[] = [...staticEntries, ...nodeEntries()]

const shellText: Record<Locale, { title: string; search: string; close: string; empty: string; topics: string }> = {
  es: { title: 'Ayuda de Mosaico', search: 'Buscar por herramienta, nodo o atajo', close: 'Cerrar ayuda', empty: 'Sin resultados', topics: 'Temas de ayuda' },
  en: { title: 'Mosaico help', search: 'Search tools, nodes or shortcuts', close: 'Close help', empty: 'No results', topics: 'Help topics' },
  ru: { title: 'Справка Mosaico', search: 'Поиск инструментов, узлов или клавиш', close: 'Закрыть справку', empty: 'Нет результатов', topics: 'Темы справки' },
  fr: { title: 'Aide Mosaico', search: 'Rechercher outils, nœuds ou raccourcis', close: 'Fermer l’aide', empty: 'Aucun résultat', topics: 'Sujets d’aide' },
  it: { title: 'Aiuto Mosaico', search: 'Cerca strumenti, nodi o scorciatoie', close: 'Chiudi aiuto', empty: 'Nessun risultato', topics: 'Argomenti della guida' },
}

export function DocumentationCenter({ locale, onClose }: { locale: Locale; onClose: () => void }) {
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState('start')
  const text = shellText[locale]
  const filtered = useMemo(() => entries.filter((entry) => `${entry.title[locale]} ${entry.title.en} ${entry.body[locale]} ${entry.tags.join(' ')}`.toLocaleLowerCase().includes(query.toLocaleLowerCase())), [locale, query])
  const current = filtered.find((entry) => entry.id === selected) ?? filtered[0]
  const folders = useMemo(() => [...new Set(filtered.map((entry) => entry.folder))], [filtered])
  return <div className="documentation-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <section className="documentation-center" role="dialog" aria-modal="true" aria-label={text.title}>
      <header><div><p className="eyebrow">MOSAICO</p><h2>{text.title}</h2></div><button type="button" aria-label={text.close} title={text.close} onClick={onClose}><X size={16} /></button></header>
      <label className="documentation-search"><Search size={15} /><input autoFocus type="search" value={query} placeholder={text.search} onChange={(event) => setQuery(event.target.value)} /></label>
      <div className="documentation-body"><nav aria-label={text.topics} className="documentation-tree">{folders.map((folder) => <div key={folder}><h4>{folder}</h4>{filtered.filter((entry) => entry.folder === folder).map((entry) => <button type="button" key={entry.id} className={entry.id === current?.id ? 'active' : ''} data-level={entry.level} onClick={() => setSelected(entry.id)}>{entry.title[locale]}</button>)}</div>)}{!filtered.length && <p role="status">{text.empty}</p>}</nav><article>{current && <><p className="eyebrow">{current.folder}</p><h3>{current.title[locale]}</h3>{current.body[locale].split('\n').map((paragraph, index) => <p key={index}>{paragraph}</p>)}<div className="documentation-tags">{current.tags.map((tag) => <span key={tag}>{tag}</span>)}</div></>}</article></div>
    </section>
  </div>
}
