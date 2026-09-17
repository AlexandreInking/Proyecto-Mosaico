# Mosaico — diez accesos gratuitos limitados en itch.io

## Modelo elegido

Página pública, de pago, sin demo separada. Diez personas reciben una download key individual de itch.io. La clave concede acceso a los archivos de la página; no activa una licencia dentro de Mosaico.

itch.io permite generar claves singulares o en lote, etiquetarlas, ver sus usos y revocarlas. Revocar una clave corta el acceso a la página, pero no puede borrar un instalador ya descargado. [Download keys](https://itch.io/docs/creators/download-keys) · [Creator FAQ](https://itch.io/docs/creators/faq)

## Preparación

1. Crear la página pública de Mosaico.
2. Fijar precio mínimo de **US$14.99**.
3. Subir solamente el instalador y/o ZIP que ya haya pasado la prueba de Windows limpio.
4. Añadir changelog, licencia, requisitos, límites y canal de bugs.
5. Confirmar que no hay una demo gratuita ni una descarga pública alternativa que contradiga la alpha pagada.

## Generar las diez claves

En el panel del proyecto:

1. Abrir **Edit → Distribute → Download Keys**.
2. Elegir generación individual para tener control por persona.
3. Crear exactamente diez claves.
4. Etiquetarlas:
   - `MOSAICO-ALPHA-01`
   - `MOSAICO-ALPHA-02`
   - …
   - `MOSAICO-ALPHA-10`
5. No activar ni añadir external keys de Steam: el tester solo necesita los archivos de itch.
6. Copiar cada URL solo una vez al registro privado.

Una clave de itch.io no es necesariamente “one use”. La limitación segura es **diez claves emitidas**, más una fecha de revisión y revocación manual. No prometer expiración automática.

## Registro privado

Guardar fuera de Git y no publicar el contenido completo de las URLs.

| Campo | Ejemplo |
|---|---|
| Etiqueta | `MOSAICO-ALPHA-03` |
| Tester/handle | `@name` |
| Fecha enviada | `2026-08-05` |
| Estado | `issued / claimed / active / revoked / reissued` |
| Uso descargado | `0/1/2…` |
| Build entregada | `0.2.20-alpha` |
| Feedback recibido | `no / partial / complete` |
| Fecha de cierre | `2026-08-19` |

No almacenar nombre legal, correo o archivos personales si no es necesario. Si se guarda un correo para soporte, limitar acceso y eliminarlo al terminar el programa de testers.

## Entrega al tester

Enviar mensaje individual:

> You have one private Mosaico alpha download key. Please attach it to your itch.io account, do not repost it, and use it only for your own testing. The access window ends on **[DATE]**. The build is Windows-only and experimental. Please report issues with version, steps, expected result, actual result, and screenshots when possible.

Después de enviar, marcar `issued`. Cuando el tester confirme que la clave funciona, marcar `claimed` y registrar la versión descargada.

## Desactivar al terminar

1. Cerrar el periodo de prueba en la fecha anunciada.
2. Revisar si hay feedback pendiente.
3. Ir a **Edit → Distribute → Download Keys**.
4. Buscar la etiqueta del tester.
5. Revocar la clave individual.
6. Marcarla `revoked` con fecha y motivo.
7. Enviar aviso corto: el acceso de testing terminó; si quiere continuar, puede comprar la página pública.

Revocar solo detiene el acceso futuro a itch.io. No revoca archivos guardados en el disco, copias compartidas ni screenshots. Para abuso, revocar la clave y no reemitirla automáticamente.

## Qué no hacer

- No publicar las diez URLs en Reddit, Discord, README o spreadsheet público.
- No prometer que una revocación desinstala Mosaico.
- No entregar una única clave compartida a diez personas.
- No llamar “license key” a una download key de itch.io.
- No usar la clave como sustituto de términos de uso o política de soporte.
- No añadir Gumroad, API de licencias o backend solo para este piloto.

## Métricas del piloto

- 10 claves generadas.
- 10 destinatarios registrados.
- Claves reclamadas.
- Descarga/instalación exitosa.
- Flujo completado.
- Feedback recibido.
- Claves revocadas al cierre.
- Compras posteriores, sin atribuirlas como causalidad segura.
