# Hoja de ruta de SENABOT

Documento vivo con las decisiones tomadas y el trabajo pendiente. Se mantiene en el repositorio a propósito: sobrevive a cualquier herramienta o asistente que se use para desarrollar, y viaja con el código.

Última actualización: 1 de agosto de 2026.

## Estado actual

Aplicación web estática, sin build ni dependencias instaladas: HTML + CSS + JavaScript plano con Three.js desde CDN. Se sirve con cualquier servidor de archivos.

Funciona el ciclo completo de aprendizaje: editor de bloques, intérprete con `repetir`/`si`/`mientras`, escena 3D con robot, discos, obstáculos con altura y metas de entrega, validación de objetivos y consola de ejecución.

### Reglas de movimiento vigentes

| Acción | Regla |
| --- | --- |
| `paso_adelante` | Solo en terreno plano. Cualquier cambio de altura lo rechaza. |
| `saltar` | Sube o baja **exactamente 1 nivel**. Requiere desnivel: no salta a la misma altura, ni supera desniveles de 2 o más. |
| `frente_libre` / `frente_bloqueado` | Comparan altura, no presencia de obstáculo. "Libre" significa que `paso_adelante` funcionaría. |

Consecuencia de diseño: para alcanzar un bloque de 3X o 4X hace falta una escalera de escalones de 1 nivel. Un bloque alto aislado es inalcanzable a propósito.

## Infraestructura

El sitio se hospedará en **nginx dentro de un entorno Laravel**. La persistencia y la autenticación se construyen como **endpoints de Laravel**, no sobre un servicio externo.

Implicación para el frontend actual: hoy los niveles viven en `js/levels.js` como un arreglo en el propio bundle. Cuando exista el backend, esos datos pasan a venir de la API, y `levels.js` se convierte en un respaldo o desaparece.

## Hitos pendientes

### 0. Modelo de datos: niveles con varios mapas

**Precede a los otros tres.** El proyecto final tendrá varios niveles y, dentro de cada nivel, varios mapas. Hoy `js/levels.js` es una lista plana donde cada entrada es a la vez nivel y mapa, y el `<select id="levelSelect">` los muestra de corrido.

Conviene acordar este esquema antes de invertir en los demás hitos, porque los define a todos:

- la **navegación móvil** no es la misma para un selector plano que para uno de dos niveles;
- el **creador de niveles** necesita saber si produce un mapa suelto o un nivel completo;
- el **guardado de avance** registra progreso por mapa, pero el desbloqueo probablemente sea por nivel.

### 1. Versión móvil

La interfaz actual es de escritorio: tres paneles en fila (editor, universo 3D, consola) que asumen ancho amplio. En móvil hay que resolver al menos la convivencia del lienzo 3D con el editor de bloques, y los controles de cámara, que hoy dependen de botones del mouse.

### 2. Creador de niveles

Editor para armar mapas sin tocar `js/levels.js`. Debe cubrir lo que ya entiende el motor: tamaño de rejilla, posición y orientación inicial del robot, discos, obstáculos con altura, metas de entrega con cantidad requerida, objetivo y pista.

### 3. Login con Google y guardado de avance

Autenticación sobre Laravel con proveedor Google. Guarda el progreso del aprendiz por mapa.

## Pendientes menores conocidos

- **El contador "PASOS DADOS" infla la cifra.** `Interpreter.executionLoop()` incrementa `stepCount` por cada instrucción del programa aplanado, y `flattenProgram()` inserta un marcador por iteración de `repetir`. Así, `repetir 3 { paso adelante }` reporta 6 pasos aunque el robot solo avance 3 casillas. `si` y `mientras` también consumen un paso por evaluación. El arreglo es contar solo cuando `currentItem.type === 'action'`.
- **Tres verdes distintos en el proyecto.** El CSS usa `#39A900`, que es el verde declarado en el sitio del SENA. Pero `assets/disco-logo.png` es `#00AB00` y el logotipo oficial en www.sena.edu.co es `#00AF00`. No rompe nada, pero unificar los PNG al verde del CSS es barato.
- **Ningún nivel usa bloques de más de 1X.** La regla de salto los soporta y está probada, pero `js/levels.js` solo tiene obstáculos de altura 1, así que el límite de "solo 1 nivel por salto" no se puede ver jugando.
