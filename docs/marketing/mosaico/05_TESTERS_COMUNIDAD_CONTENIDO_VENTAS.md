# Mosaico — testers, comunidad, contenido y ventas

## Objetivo de los primeros diez testers

No buscar “diez descargas”. Buscar diez personas que intenten el flujo completo, describan dónde dudaron y permitan medir si el producto merece una alpha pagada.

### Composición recomendada

- 4 creadores indie 2D.
- 2 level designers.
- 2 technical artists o artistas de Pixel Art.
- 2 usuarios de Godot/Unity que trabajen con assets propios.

Es una distribución de reclutamiento, no una afirmación sobre el mercado.

### Filtro breve

1. ¿Qué engine y herramientas usas hoy?
2. ¿Cuándo fue la última vez que preparaste un tilesheet o mapa?
3. ¿Qué paso manual repites más?
4. ¿Puedes probar una build Windows durante 30–45 minutos?
5. ¿Aceptas reportar errores con pasos reproducibles?

Priorizar experiencia reciente y problema real sobre número de seguidores.

## Guion de prueba

Enviar una única tarea:

> Importa el fixture, ajusta el tilesheet, crea un mapa pequeño, edita un asset, ejecuta una transformación, guarda el workspace y exporta el resultado.

Observar sin enseñar inmediatamente:

- Tiempo hasta encontrar el botón correcto.
- Campo que no entiende.
- Momento en que pregunta “¿dónde quedó mi archivo?”.
- Error que puede recuperar solo.
- Resultado que considera suficientemente útil.

No pedir que evalúe cien features. El flujo principal decide la prioridad.

## Formulario posterior

- ¿Qué intentabas conseguir?
- ¿Qué herramienta usabas antes?
- ¿Qué parte fue más clara?
- ¿Dónde te atascaste?
- ¿Qué resultado esperabas y qué obtuviste?
- ¿Volverías a usarlo esta semana? ¿Por qué?
- ¿Qué precio único te parecería razonable para esta etapa?
- ¿Permites citar tu comentario sin nombre?

Etiquetar respuestas `activation`, `workflow`, `trust`, `bug`, `format`, `pricing`, `engine`.

## Comunidad

### Casa principal

Usar GitHub Discussions/Issues como registro público de decisiones y bugs. Cada issue debe contener versión, sistema operativo, pasos, resultado esperado, resultado actual y adjuntos no sensibles.

### Ritmo

- Lunes: responder issues y elegir un problema.
- Miércoles: mostrar una corrección o aprendizaje.
- Viernes: publicar changelog o fixture.
- Mensual: resumen “qué arreglamos / qué no haremos todavía”.

No abrir Discord antes de tener conversación sostenida; un canal vacío añade trabajo y no comunidad.

## Sistema de contenido reutilizable

Cada flujo produce:

1. Video vertical de 30–60 s.
2. GIF antes/después.
3. Captura con una frase.
4. Tutorial corto.
5. Issue o pregunta de feedback.
6. Entrada de changelog.

### Pilares

- **Workflow:** menos cambios de contexto.
- **Craft:** pixel-perfect, tilesets, capas, autotile.
- **Reliability:** hashes, validación, cancelación y recuperación.
- **Transparency:** qué está hecho, qué está roto y qué viene después.

### Ciclo semanal sin presupuesto

| Día | Pieza |
|---|---|
| Lunes | Problema concreto y captura del estado inicial. |
| Martes | Clip del flujo. |
| Miércoles | Tutorial o explicación técnica. |
| Jueves | Pregunta de feedback en comunidad pertinente. |
| Viernes | Changelog y enlace a itch/GitHub. |

## De tester a venta

1. Tester recibe acceso y tarea clara.
2. Producto registra activación y blocker.
3. Se corrigen fallos de instalación/flujo.
4. Se solicita testimonio solo con permiso.
5. Se publica evidencia del resultado.
6. Se mantiene la página itch a US$14.99.
7. Se ofrece compra para continuidad, sin prometer lo que no esté en los términos.

La venta debe responder “qué puedo hacer hoy” antes de “qué llegará algún día”.

## Criterios de decisión

**Continuar alpha:** al menos 5/10 completan el flujo y 3/10 repiten uso.
**Corregir antes de promocionar:** fallos de instalación, guardado, reabrir o exportar.
**Reducir alcance:** la gente usa solo una superficie y no entiende la suite completa.
**Subir a US$19.99:** flujo estable, soporte manejable, changelog continuo y evidencia de compras sin intervención manual.
