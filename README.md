# SENABOT 3D — Laboratorio de Lógica & Programación

Plataforma web interactiva para aprender lógica de programación en un universo 3D, orientada a aprendices del SENA. El usuario construye un programa con bloques de comandos y observa cómo **SENABOT** los ejecuta paso a paso sobre una cuadrícula tridimensional.

## Características

- **Mundo 3D** renderizado con Three.js y controles de órbita para explorar la escena.
- **Editor de programas visual**: secuencias de comandos con estructuras de control.
- **Ejecución paso a paso** con resaltado de la instrucción activa.
- **Sistema de niveles** con objetivos, obstáculos, saltos y entregas de discos.
- **Retroalimentación inmediata**: pistas, validación de objetivos y celebración con confeti al superar un reto.

## Comandos disponibles

**Acciones**

| Comando | Efecto |
| --- | --- |
| `paso_adelante` | Avanza una casilla en la dirección actual |
| `giro_derecha` | Gira 90° a la derecha |
| `giro_izquierda` | Gira 90° a la izquierda |
| `saltar` | Salta sobre un obstáculo |
| `toma_disco` | Recoge un disco de la casilla actual |
| `deja_disco` | Deposita un disco en la casilla actual |

**Condiciones**

`frente_libre`, `frente_bloqueado`, `hay_disco`, `tiene_disco`

**Estructuras de control**

`repetir` (repetición un número fijo de veces) y `mientras` (repetición condicional).

## Cómo ejecutarlo

No requiere instalación ni proceso de compilación. Basta con servir la carpeta con cualquier servidor estático:

```bash
# Con Python
python -m http.server 8000

# Con Node.js
npx serve .
```

Luego abre <http://localhost:8000> en el navegador.

> Abrir `index.html` directamente con `file://` también funciona en la mayoría de navegadores, pero se recomienda un servidor local.

## Estructura del proyecto

```
senabot-app/
├── index.html          # Estructura de la interfaz
├── styles.css          # Estilos e identidad visual SENA
├── assets/
│   ├── disco-logo.png  # Textura del disco recolectable
│   └── logo-sena.png   # Textura del disco de meta de entrega
└── js/
    ├── levels.js       # Definición de niveles y retos
    ├── interpreter.js  # Intérprete del lenguaje de comandos
    ├── world3d.js      # Escena 3D, robot y animaciones
    └── ui.js           # Editor, controles y estado de la interfaz
```

## Tecnologías

- HTML5, CSS3 y JavaScript (sin framework ni bundler)
- [Three.js](https://threejs.org/) r128 + OrbitControls
- [canvas-confetti](https://github.com/catdad/canvas-confetti)
- Font Awesome 6 y Google Fonts (Outfit, Work Sans)

Todas las dependencias se cargan desde CDN.

## Hacia dónde va el proyecto

Las decisiones de infraestructura y el trabajo pendiente están en [ROADMAP.md](ROADMAP.md).

## Autor

Nelson R. Gómez — [@NelsonRGM](https://github.com/NelsonRGM)
