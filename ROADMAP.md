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

El sitio se hospeda en **nginx dentro de un entorno Laravel que ya existe**. La aplicación se desarrolla en **https://senabot.nelric.com**.

**Laravel expone únicamente la API.** El frontend sigue siendo HTML, CSS y JavaScript plano servido desde `public/`: sin build, sin Blade, sin acoplarlo al framework. La persistencia y la autenticación se construyen como endpoints de Laravel, no sobre un servicio externo.

Implicación: hoy los mapas viven en `js/levels.js` como un arreglo en el propio archivo. Cuando existan los endpoints, esos datos pasan a venir de la API y `levels.js` se convierte en respaldo o desaparece.

## Modelo de datos

**Nivel = grado de dificultad.** Son cinco y son fijos:

1. Principiante
2. Intermedio
3. Avanzado
4. Genio
5. Personalizados

**Mapa = el reto concreto que se juega.** Cada nivel contiene varios. Lo que crece con el tiempo es la cantidad de mapas, no la de niveles.

Los cinco retos que hoy tiene `js/levels.js` no son niveles: son **mapas** que habrá que repartir entre Principiante e Intermedio.

**"Personalizados" es donde aterriza el creador de niveles.** El hito 2 no necesita un concepto aparte: lo que arme el usuario entra como mapas de ese quinto nivel.

### Desbloqueo

Secuencial en los dos ejes: un mapa se abre al completar el anterior, y un nivel se abre al completar el anterior.

Como la persistencia vive en Laravel, el desbloqueo no puede funcionar hasta que existan los endpoints. **Pendiente de decidir** cómo se maneja mientras tanto: dejar el bloqueo inerte tras un interruptor, adelantar los endpoints de persistencia antes que el login, o no tocar el bloqueo hasta el hito 3.

**Pendiente de decidir** también si "Personalizados" queda exento del bloqueo — parece razonable que alguien pueda abrir los mapas que él mismo creó sin haber terminado Genio.

## Hitos pendientes

### 1. Versión móvil

**En definición.** El diseño lo fija Nelson antes de escribir código.

La interfaz actual es de escritorio: dos columnas (editor de 360 px y universo 3D con consola) que asumen ancho amplio y no tienen ninguna media query. En móvil hay que resolver al menos:

- la convivencia del lienzo 3D con el editor de bloques, que juntos no caben en el alto de un teléfono;
- los controles de cámara, que hoy se explican con botones del mouse;
- el arrastrar y soltar bloques, que no funciona con el tacto (tocar el bloque sí lo añade, así que degrada bien);
- si la navegación de niveles y mapas con candados entra en este hito o llega después.

### 2. Creador de niveles

Editor para armar mapas sin tocar `js/levels.js`. Debe cubrir lo que ya entiende el motor: tamaño de rejilla, posición y orientación inicial del robot, discos, obstáculos con altura, metas de entrega con cantidad requerida, objetivo y pista.

### 3. Login con Google y guardado de avance

Autenticación sobre Laravel con proveedor Google. Guarda el progreso del aprendiz por mapa, que además es la fuente de verdad de qué tiene desbloqueado.

## Pendientes menores conocidos

- **El contador "PASOS DADOS" infla la cifra.** `Interpreter.executionLoop()` incrementa `stepCount` por cada instrucción del programa aplanado, y `flattenProgram()` inserta un marcador por iteración de `repetir`. Así, `repetir 3 { paso adelante }` reporta 6 pasos aunque el robot solo avance 3 casillas. `si` y `mientras` también consumen un paso por evaluación. El arreglo es contar solo cuando `currentItem.type === 'action'`.
- **Tres verdes distintos en el proyecto.** El CSS usa `#39A900`, que es el verde declarado en el sitio del SENA. Pero `assets/disco-logo.png` es `#00AB00` y el logotipo oficial en www.sena.edu.co es `#00AF00`. No rompe nada, pero unificar los PNG al verde del CSS es barato.
- **Ningún nivel usa bloques de más de 1X.** La regla de salto los soporta y está probada, pero `js/levels.js` solo tiene obstáculos de altura 1, así que el límite de "solo 1 nivel por salto" no se puede ver jugando.
