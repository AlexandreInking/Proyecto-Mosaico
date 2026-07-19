# Inventario verificable del corpus documental

**Corte:** 19 de julio de 2026, después del commit base `c250491`.  
**Raíz:** `C:\Users\Intel\Desktop\Proyecto_Mosaico`.  
**Algoritmo:** SHA-256 sobre bytes exactos. Líneas contadas como líneas lógicas por PowerShell `Get-Content -Encoding UTF8`; no aplica a PNG.  
**Alcance:** fuentes no modificadas. Este archivo registra el estado observado, no corrige rutas ni declara decisiones de producto.

## 1. Resumen y clasificación

| Grupo | Archivos | Bytes | Líneas de texto | Estado |
|---|---:|---:|---:|---|
| Capítulos PM-00…PM-14 | 15 | 127.555 | 3.320 | Canónicos propuestos |
| Fuentes visuales DOT | 8 | 5.883 | 148 | Canónicas propuestas para diagramas |
| PNG renderizados | 8 | 657.375 | N/A | Derivados |
| README | 1 | 762 | 19 | Índice auxiliar |
| Dossier completo | 1 | 127.773 | 3.384 | Derivado; no debe editarse como segunda fuente |
| **Corpus previsto** | **33** | **919.348** | **6.871** | **Completo por cantidad** |

Decisión recomendada: capítulos independientes y DOT son fuentes canónicas; dossier y PNG se generan. README solo orienta. Razón: evita deriva entre dos copias del texto y entre código DOT y bitmap. Esta decisión requiere formalización en gobernanza/CI; hoy no existe generador verificable.

## 2. Registro de los 33 archivos previstos

### 2.1 Documentos

| # | Archivo | Bytes | Líneas | SHA-256 | Clase | Propietario sugerido | Dependencias documentales principales |
|---:|---|---:|---:|---|---|---|---|
| 1 | `README.md` | 762 | 19 | `a423aa954a72a9da9949326abb6721c6b4c8bdcb2646d1f73d4091c8bd00990f` | Auxiliar | Documentación | PM-00 y estructura del corpus |
| 2 | `Proyecto_Mosaico_Dossier_Completo.md` | 127.773 | 3.384 | `b284234fd4b3011f36c95594eb17ee64812b1b0fc346655983c281b9dbf421b2` | Derivado | Documentación/release | PM-00…PM-14; 8 PNG |
| 3 | `documentos/00_Indice_Maestro_y_Gobernanza.md` | 8.333 | 146 | `a4e348dcf4553cb8ce8f33e5f55fa4cbe09f23fd2f1969d5fe9c6b11d6744a36` | Canónico | Arquitectura + producto | Ninguna; gobierna corpus |
| 4 | `documentos/01_Vision_Producto_y_Alcance.md` | 10.009 | 183 | `bdaf070afc99408c7a98aaa22fae52daf6c3c225745e6b7c3203eff8fc65df9f` | Canónico | Producto | PM-00 |
| 5 | `documentos/02_Especificacion_de_Requisitos.md` | 13.005 | 196 | `b895957e263e322912c1797adad5454091c60604a6ee0fce4da7929352bd9d72` | Canónico | Producto + QA | PM-00, PM-01 |
| 6 | `documentos/03_Arquitectura_de_Software.md` | 9.098 | 226 | `6f4f06ff13b4f5c6782f7ab98b8450a830ad828143c6106e01b1fe0e97761c17` | Canónico | Arquitectura | PM-00, PM-02 |
| 7 | `documentos/04_Modelo_Espacial_Grillas_y_Proyecciones.md` | 7.774 | 210 | `f206b18ee0e1e35af3a422a592b0f910a8987a0f6113fcf6998f10d0b0713c00` | Canónico | Arquitectura + algoritmos | PM-02, PM-03 |
| 8 | `documentos/05_Modelo_de_Datos_y_Persistencia.md` | 8.809 | 263 | `d0e18fdcfef85766905a08f15ef11738c849f1ff4737c1127800d35513dc2960` | Canónico | Formato/persistencia | PM-02, PM-03, PM-04 |
| 9 | `documentos/06_UX_del_Editor_y_Flujos.md` | 8.120 | 201 | `a574388be056cff3e9a3fd7c30055ae354d136b38054e2e4cc5d7d3ded070799` | Canónico | UX | PM-01…PM-05 |
| 10 | `documentos/07_Autotiling_Wang_y_Motor_de_Patrones.md` | 8.127 | 246 | `aaf6751a0deb2a10dec224a26d90c0551eb1c41ae2a820db492359afde83de86` | Canónico | Algoritmos | PM-02, PM-04, PM-05, PM-06 |
| 11 | `documentos/08_Generacion_Procedural_2D.md` | 8.044 | 230 | `2878a40dc4ce7ec1f651cff1a16108b530297f58584a24f33da311b3d8656b23` | Canónico | Algoritmos | PM-02, PM-04…PM-07 |
| 12 | `documentos/09_Motor_Wave_Function_Collapse.md` | 8.185 | 262 | `d98af8bc928564ab63465ec1878a220f349b7844c77a5ad4f541d7326ce3b9ee` | Canónico | Algoritmos | PM-02, PM-04, PM-05, PM-08 |
| 13 | `documentos/10_Renderizado_Rendimiento_y_Concurrencia.md` | 7.360 | 184 | `0f8867ce548bfeacd00b3d1385184be9a19a3171f40f93feaf0657ac17628f72` | Canónico | Render/rendimiento | PM-02…PM-05, PM-07…PM-09 |
| 14 | `documentos/11_Importacion_Exportacion_Plugins_e_Integraciones.md` | 6.954 | 210 | `2bc15f3b0711863b96e2ca943f877bd02f76f803895db36c99ee6ea04d9e6d5b` | Canónico | Integraciones + seguridad | PM-02, PM-03, PM-05 |
| 15 | `documentos/12_Pruebas_QA_Seguridad_y_Release.md` | 7.182 | 181 | `8c6d38380c9bd9001c0fad2edd541b0f1fad202c04af4d7dc01711e906dc332a` | Canónico | QA + seguridad/release | PM-02…PM-11 |
| 16 | `documentos/13_Sistema_Agentico_de_Desarrollo.md` | 8.356 | 254 | `6eaf36e20360ca6ce3a8d39ee7e3df780d3e3f15e2b12415a5b5c7784237aa40` | Canónico | Coordinación + arquitectura | PM-00, PM-02, PM-03, PM-12, PM-14 |
| 17 | `documentos/14_Roadmap_Backlog_ADR_y_Plantillas.md` | 8.199 | 328 | `89fa85aa6de2bd2db00503cc87605dc00527f3a5364e1b6430629ca9776ff0f4` | Canónico orientativo | Producto + arquitectura | PM-00, PM-01, PM-02 y diseños PM-03…PM-13 |

### 2.2 Diagramas DOT y PNG

| # | Archivo | Bytes | Líneas | SHA-256 | Clase | Propietario sugerido | Dependencia |
|---:|---|---:|---:|---|---|---|---|
| 18 | `diagramas/agentic_org.dot` | 834 | 25 | `4634a48fe2000c6e4856e36998e1479400cc5f8caf4873bfe078b4411917fbc0` | Canónico visual | Coordinación | PM-13 |
| 19 | `diagramas/agentic_org.png` | 110.139 | N/A | `2af8b5a0b0a0696c1ba5feb5f0e84746121edcf69b70e88717e6826533519e8f` | Derivado | Documentación/release | `agentic_org.dot` |
| 20 | `diagramas/architecture.dot` | 872 | 22 | `3385a3cf743ca337f9617aff0d2a4d842910185abf593887a47926dcc770d3ac` | Canónico visual | Arquitectura | PM-03 |
| 21 | `diagramas/architecture.png` | 112.804 | N/A | `0221592eadeaeb7eeca2c610fba04ed498b8a1ee84b9b42f441f12e3b6067c08` | Derivado | Documentación/release | `architecture.dot` |
| 22 | `diagramas/context.dot` | 870 | 16 | `76046c8e56d142468962e6f36cab2ac6c8ae459cc48b5bad5b9491109c2673d8` | Canónico visual | Producto | PM-00, PM-01 |
| 23 | `diagramas/context.png` | 106.389 | N/A | `4473ea3636eb8e10a0ba87ae988ea25883258e8507b1b0051eeb23e7e7155bab` | Derivado | Documentación/release | `context.dot` |
| 24 | `diagramas/plugin_architecture.dot` | 602 | 20 | `8891fa5bd81671381c2f15e80f46eaf6fb4386a2cc0e8fcaedeb7fe26f58898e` | Canónico visual | Integraciones + seguridad | PM-11 |
| 25 | `diagramas/plugin_architecture.png` | 81.031 | N/A | `a23eff45383d22f386453dacf7405117bd0eb1e9300e8cf918181ff1fcfd310e` | Derivado | Documentación/release | `plugin_architecture.dot` |
| 26 | `diagramas/release_pipeline.dot` | 675 | 15 | `cc59b6f6baeb706108ba7cf11fed2e7964ef8f1b5fccc7cc8df6ebf3d4127c9e` | Canónico visual | QA + release | PM-12 |
| 27 | `diagramas/release_pipeline.png` | 41.659 | N/A | `0071fccdc05daa11390e1e7943d35e22bb83c21036b4cc4734fb737710220cf7` | Derivado | Documentación/release | `release_pipeline.dot` |
| 28 | `diagramas/semantic_pipeline.dot` | 722 | 19 | `a56fc752248e18aaadeb45ddb03181ad59339d139aeb12c96c9092cde0ea16c0` | Canónico visual | Producto + arquitectura | PM-01, PM-03 |
| 29 | `diagramas/semantic_pipeline.png` | 78.850 | N/A | `46b998246f3d39832584b9b91804385dd6168e0f41c2306872aae6ba47c72098` | Derivado | Documentación/release | `semantic_pipeline.dot` |
| 30 | `diagramas/spatial_transform.dot` | 561 | 12 | `99f96c4d56c5ed6e701cda91ebfbe50ce22fdf4e2add7623730f28933098934a` | Canónico visual | Arquitectura espacial | PM-04 |
| 31 | `diagramas/spatial_transform.png` | 42.147 | N/A | `00b1ee407b963401e0f8c11184c888901ecda9f25b5a8468cffa6fa845cd8f20` | Derivado | Documentación/release | `spatial_transform.dot` |
| 32 | `diagramas/wfc_cycle.dot` | 747 | 19 | `b2b948787966c6098cf91a4036ae460ccaf8bcefa0a26dcf5d4f34fad599d1da` | Canónico visual | Algoritmos | PM-09 |
| 33 | `diagramas/wfc_cycle.png` | 84.356 | N/A | `2bc0502b65487ba979321aba53549fcf92d4812daee8d69dad8a7a2c914443ae` | Derivado | Documentación/release | `wfc_cycle.dot` |

## 3. Artefactos de bootstrap y auditoría, fuera del corpus de 33

| Archivo | Bytes | Líneas | SHA-256 | Clase/propietario | Nota |
|---|---:|---:|---|---|---|
| `.gitignore` | 350 | 31 | `fc64beafd8dbfdfab463da893f9d7155bd9ee410aa927b97fa3925ef2c46a979` | Soporte de repositorio / release | Incluido en baseline Git; no es documento de producto |
| `PLAN_ANALISIS_DOCUMENTACION.md` | 24.290 | 454 | `07d337c3b65e7e150140fb58b7fb945cdfa0a507ec686737a45ccebe8facf2f8` | Plan / coordinación | Incluido en baseline; no canónico del producto |
| `analisis_documental/05_auditoria_tecnica.md` | 26.084 | 313 | `5a7d2ec4cb240c5282f7be1f53bad89838f9f8eafc8d6235d43fc0abc78eff94` | Auditoría / arquitectura | Nuevo, no versionado al corte |
| `analisis_documental/06_auditoria_producto_ux.md` | 19.766 | 230 | `3746de26903ee8070b30f68db442bf950b53ac0c359cc0d7cf1ebd933fafe21e` | Auditoría / producto + UX | Nuevo, no versionado al corte |
| `analisis_documental/07_auditoria_qa_seguridad.md` | 20.270 | 171 | `590fba87941d45a16f6c362e6729daec9fe4d1581525b390cf10ecd7e13063b6` | Auditoría / QA + seguridad | Nuevo, no versionado al corte |

Este inventario no incluye su propio hash: incrustarlo alteraría el archivo y produciría una referencia circular. Debe incluirse en un manifiesto externo o calcularse después de cada actualización.

## 4. Enlaces locales y rutas no portables

Verificación por extracción de enlaces Markdown locales y `\input{...}`:

| Tipo | Capítulos | Dossier | Total | Resueltos desde esta máquina |
|---|---:|---:|---:|---:|
| `header.tex` bajo `/mnt/data/.../src/` | 15 | 15 | 30 | 0 |
| PNG bajo `/mnt/data/.../assets/` | 8 | 8 | 16 | 0 |
| **Referencias locales examinadas** | **23** | **23** | **46** | **0** |

Hallazgos:

- `header.tex` no existe dentro del repositorio. Las 30 inclusiones rompen una compilación Pandoc/LaTeX fuera del entorno original.
- Los ocho PNG sí existen en `diagramas/`, pero las 16 referencias apuntan a `/mnt/data/proyecto_mosaico_documentacion/assets/`; por tanto siguen rotas localmente.
- Capítulos con imagen rota: PM-00 `context`, PM-01 `semantic_pipeline`, PM-03 `architecture`, PM-04 `spatial_transform`, PM-09 `wfc_cycle`, PM-11 `plugin_architecture`, PM-12 `release_pipeline`, PM-13 `agentic_org`. Dossier repite las ocho.
- No se detectaron otras referencias Markdown locales en el corpus. URLs HTTP no se probaron: requieren auditoría de fuentes/red separada.
- Corrección futura recomendada, no aplicada: rutas relativas `../diagramas/<nombre>.png` desde capítulos y `diagramas/<nombre>.png` desde dossier; versionar `header.tex` o retirar `\input`.

## 5. Correspondencia DOT ↔ PNG

| Base | DOT | PNG | Pareja por basename | Uso documental |
|---|---|---|---|---|
| `agentic_org` | Sí | Sí | OK | PM-13 + dossier |
| `architecture` | Sí | Sí | OK | PM-03 + dossier |
| `context` | Sí | Sí | OK | PM-00 + dossier |
| `plugin_architecture` | Sí | Sí | OK | PM-11 + dossier |
| `release_pipeline` | Sí | Sí | OK | PM-12 + dossier |
| `semantic_pipeline` | Sí | Sí | OK | PM-01 + dossier |
| `spatial_transform` | Sí | Sí | OK | PM-04 + dossier |
| `wfc_cycle` | Sí | Sí | OK | PM-09 + dossier |

Resultado: 8 DOT, 8 PNG, 8 intersecciones exactas, 0 huérfanos por nombre. Esto verifica presencia y emparejamiento nominal, no identidad visual del render. No hay comando, versión Graphviz ni parámetros registrados para regenerar PNG y comparar salida; por ello el estado derivado no es reproducible todavía.

## 6. Dependencias y autoridad

Flujo recomendado:

```text
PM-00 gobernanza
  └─ PM-01 visión
      └─ PM-02 requisitos
          ├─ PM-03 arquitectura ─ PM-04 espacial ─ PM-05 datos
          │                                      └─ PM-06 UX
          ├─ PM-07 reglas ─ PM-08 procedural ─ PM-09 WFC
          ├─ PM-10 render/rendimiento
          ├─ PM-11 integraciones/plugins
          └─ PM-12 QA/seguridad/release
                    └─ PM-13 sistema agéntico
Todos ───────────────── PM-14 roadmap (orientativo)

PM canónicos + DOT → dossier + PNG derivados → README/paquete
```

La precedencia efectiva proviene de PM-00: ADR aceptado posterior → PM-02 → contratos PM-03/04/05 → diseño especializado → roadmap/ejemplos. El propietario sugerido no modifica esa autoridad.

## 7. Limitación histórica y estado Git

- Repositorio local presente.
- Rama: `main`.
- Historia disponible: **un solo commit**, `c250491c0cd82c43e814744f5b7b4fd81257e4e2` (`docs: establish Mosaico documentation baseline`), fechado `2026-07-19T09:34:14-05:00`.
- Commit base contiene 35 archivos: los 33 del corpus, `.gitignore` y plan.
- Las tres auditorías estaban sin seguimiento (`?? analisis_documental/`) al corte.
- No existe commit, tag, changelog verificable, autoría por documento ni metadato dentro de esta carpeta que demuestre procedencia anterior al baseline.
- Git conserva historia desde la importación, no recupera versiones, revisiones ni decisiones previas. Fechas internas “18 de julio de 2026” son declaraciones documentales, no evidencia de historial.
- Privacidad del remoto no puede inferirse del contenido ni del commit local. Debe verificarse aparte con configuración/remoto autorizado.

## 8. Comprobaciones reproducibles

Ejecutar desde raíz con PowerShell:

```powershell
# Conteo del corpus previsto
$corpus = @('README.md', 'Proyecto_Mosaico_Dossier_Completo.md') +
  (Get-ChildItem -LiteralPath documentos -File).FullName +
  (Get-ChildItem -LiteralPath diagramas -File).FullName
$corpus.Count # 33

# Tamaño y hashes
$corpus | ForEach-Object {
  $item = Get-Item -LiteralPath $_
  [pscustomobject]@{
    Path = $item.FullName
    Bytes = $item.Length
    SHA256 = (Get-FileHash -LiteralPath $item.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
  }
}

# Rutas heredadas
rg -n --no-ignore '/mnt/data' README.md Proyecto_Mosaico_Dossier_Completo.md documentos

# Pares visuales
$dot = (Get-ChildItem -LiteralPath diagramas -Filter *.dot).BaseName | Sort-Object
$png = (Get-ChildItem -LiteralPath diagramas -Filter *.png).BaseName | Sort-Object
Compare-Object $dot $png # salida vacía

# Historia disponible
git rev-list --count HEAD # 1 al corte
git status --short
```

## 9. Criterio de cierre del inventario

- [x] 33/33 archivos previstos enumerados individualmente.
- [x] Bytes, líneas y SHA-256 registrados.
- [x] Canónico/derivado y propietario sugerido declarados.
- [x] Dependencias principales y autoridad descritas.
- [x] 46/46 referencias locales identificadas como rotas.
- [x] 30 rutas a `header.tex` y 16 rutas de imagen bajo `/mnt/data` contabilizadas.
- [x] 8/8 parejas DOT↔PNG, sin huérfanos nominales.
- [x] Bootstrap/auditorías separados del corpus.
- [x] Limitación histórica documentada.
