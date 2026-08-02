/**
 * Configuración de Niveles y Retos para SENABOT 3D
 */

const SENABOT_LEVELS = [
  {
    id: 1,
    title: "Nivel 1: Primer Recolector de Discos",
    description: "Programa a SENABOT para avanzar 3 pasos, girar a la derecha y tomar el disco flotante en la casilla (3, 3).",
    gridSize: { cols: 8, rows: 8 },
    robotStart: { x: 0, z: 0, dir: 1 }, // 0: Norte (-Z), 1: Este (+X), 2: Sur (+Z), 3: Oeste (-X)
    initialDiscs: 0,
    discs: [
      { x: 3, z: 3 }
    ],
    obstacles: [],
    objective: "collect_all",
    requiredDiscsCollected: 1,
    hint: "Pista: Usa 'Paso Adelante', 'Giro Derecha' y cuando estés sobre la casilla del disco, usa 'Toma Disco'."
  },
  {
    id: 2,
    title: "Nivel 2: Transporte y Entrega de Discos",
    description: "SENABOT inicia con 1 disco en su mochila. Debes trasladarlo hasta la casilla de entrega en (4, 4) y usar 'Deja Disco'.",
    gridSize: { cols: 8, rows: 8 },
    robotStart: { x: 0, z: 0, dir: 1 },
    initialDiscs: 1,
    discs: [
      { x: 2, z: 0 }
    ],
    deliveryTargets: [
      { x: 4, z: 4, requiredCount: 2 }
    ],
    obstacles: [],
    objective: "deliver_discs",
    hint: "Pista: Recoge el disco en (2, 0) con 'Toma Disco' y lleva los 2 discos hasta (4, 4) usando 'Deja Disco'."
  },
  {
    id: 3,
    title: "Nivel 3: El Desafío del Salto y Muro",
    description: "Hay muros en el camino. Usa 'Saltar' para superar los bloques, recoge el disco y llévalo a la meta de entrega.",
    gridSize: { cols: 8, rows: 8 },
    robotStart: { x: 1, z: 1, dir: 1 },
    initialDiscs: 0,
    discs: [
      { x: 3, z: 1 }
    ],
    deliveryTargets: [
      { x: 5, z: 1, requiredCount: 1 }
    ],
    obstacles: [
      { x: 2, z: 1, height: 1 },
      { x: 4, z: 1, height: 1 }
    ],
    objective: "deliver_discs",
    hint: "Pista: 'Saltar' le permite a SENABOT subir sobre casillas elevadas."
  },
  {
    id: 4,
    title: "Nivel 4: Automatización con Ciclos (Recolector)",
    description: "Usa el bloque 'Repetir N Veces' para recorrer la pista recolectando los 5 discos alineados.",
    gridSize: { cols: 8, rows: 8 },
    robotStart: { x: 0, z: 2, dir: 1 },
    initialDiscs: 0,
    discs: [
      { x: 1, z: 2 },
      { x: 2, z: 2 },
      { x: 3, z: 2 },
      { x: 4, z: 2 },
      { x: 5, z: 2 }
    ],
    obstacles: [],
    objective: "collect_all",
    requiredDiscsCollected: 5,
    hint: "Pista: Agrega 'Repetir 5 veces' y coloca dentro 'Paso Adelante' y 'Toma Disco'."
  },
  {
    id: 5,
    title: "Nivel 5: Logística Avanzada (Toma y Deja Disco)",
    description: "Utiliza condicionales 'Si hay disco' y ciclos 'Mientras frente libre' para recolectar todos los discos y entregarlos en (6, 6).",
    gridSize: { cols: 8, rows: 8 },
    robotStart: { x: 0, z: 0, dir: 1 },
    initialDiscs: 1,
    discs: [
      { x: 3, z: 0 },
      { x: 6, z: 3 }
    ],
    deliveryTargets: [
      { x: 6, z: 6, requiredCount: 3 }
    ],
    obstacles: [
      { x: 6, z: 0, height: 1 },
      { x: 0, z: 6, height: 1 }
    ],
    objective: "deliver_discs",
    hint: "Pista: Usa 'Si hay disco -> Toma disco' y deposita la carga acumulada en (6, 6) con 'Deja disco'."
  }
];
