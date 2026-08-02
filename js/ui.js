/**
 * SENABOT 3D - Gestor de Interfaz de Usuario y Bloques
 */

document.addEventListener('DOMContentLoaded', () => {
  const ui = new UI();
  ui.init();
});

class UI {
  constructor() {
    this.world = null;
    this.interpreter = null;
    this.programAST = [];
    this.currentLevel = SENABOT_LEVELS[0];
    this.blockIdCounter = 1;

    // Editor de bloques: contenedor donde caen los bloques nuevos y estado de arrastre
    this.rootContainer = null;
    this.activeContainer = null;
    this.dragState = null;
    this.dropIndicator = null;
  }

  init() {
    // 1. Inicializar Motor 3D
    this.world = new World3D('canvas3dContainer');

    // 2. Inicializar Intérprete
    this.interpreter = new Interpreter(this.world, this);

    // 3. Cargar Niveles en Dropdown
    this.populateLevels();
    this.loadLevel(SENABOT_LEVELS[0]);

    // 4. Configurar Event Listeners
    this.setupEventListeners();
    this.setupProgramCanvas();

    this.updateHUD();
  }

  // El lienzo del programa es la zona raíz: acepta bloques soltados y
  // al hacer clic en su fondo vuelve a ser el destino de inserción.
  setupProgramCanvas() {
    const list = document.getElementById('programList');
    this.rootContainer = list;
    this.makeDropZone(list);
    list.addEventListener('click', (e) => {
      if (e.target === list || e.target.closest('.empty-state')) {
        this.setActiveContainer(list);
      }
    });
    this.setActiveContainer(list);
  }

  populateLevels() {
    const select = document.getElementById('levelSelect');
    select.innerHTML = '';
    SENABOT_LEVELS.forEach(lvl => {
      const opt = document.createElement('option');
      opt.value = lvl.id;
      opt.textContent = lvl.title;
      select.appendChild(opt);
    });

    select.addEventListener('change', (e) => {
      const lvlId = parseInt(e.target.value);
      const level = SENABOT_LEVELS.find(l => l.id === lvlId);
      if (level) this.loadLevel(level);
    });
  }

  loadLevel(level) {
    this.currentLevel = level;
    document.getElementById('missionTitle').innerHTML = `<i class="fa-solid fa-bullseye"></i> ${level.title}`;
    document.getElementById('missionDescription').textContent = level.description;

    this.world.loadLevel(level);
    this.interpreter.stop();
    this.updateHUD();
    this.log(`Cargado ${level.title}: ${level.description}`, "info");
  }

  setupEventListeners() {
    // Pestanas de Toolbox
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        
        btn.classList.add('active');
        const tabId = btn.getAttribute('data-tab');
        document.getElementById(`tab-${tabId}`).classList.add('active');
      });
    });

    // Botones de paleta: clic inserta en el contenedor activo, o se pueden arrastrar
    document.querySelectorAll('.block-btn').forEach(btn => {
      const action = btn.getAttribute('data-action');

      btn.addEventListener('click', () => this.addBlockToProgram(action));

      btn.setAttribute('draggable', 'true');
      btn.addEventListener('dragstart', (e) => {
        this.dragState = { type: 'palette', action };
        e.dataTransfer.effectAllowed = 'copy';
        e.dataTransfer.setData('text/plain', action);
      });
      btn.addEventListener('dragend', () => this.cleanupDrag());
    });

    // Limpiar Programa
    document.getElementById('btnClearProgram').addEventListener('click', () => {
      this.clearProgram();
    });

    // Botones de Ejecución
    document.getElementById('btnRun').addEventListener('click', () => {
      const ast = this.buildAST();
      if (ast.length === 0) {
        this.log("⚠️ El programa está vacío. Añade bloques antes de ejecutar.", "error");
        return;
      }
      this.interpreter.run(ast);
    });

    document.getElementById('btnStep').addEventListener('click', () => {
      const ast = this.buildAST();
      if (ast.length === 0) {
        this.log("⚠️ El programa está vacío. Añade bloques.", "error");
        return;
      }
      this.interpreter.stepOnce(ast);
    });

    document.getElementById('btnStop').addEventListener('click', () => {
      this.interpreter.stop();
      this.log("Ejecución detenida por el usuario.", "info");
    });

    // Control de Velocidad
    const speedRange = document.getElementById('speedRange');
    const speedLabel = document.getElementById('speedValue');
    const speedNames = { 1: "Muy Lento", 2: "Lento", 3: "Normal", 4: "Rápido", 5: "Ultra" };
    speedRange.addEventListener('input', (e) => {
      const val = parseInt(e.target.value);
      speedLabel.textContent = speedNames[val];
      this.interpreter.setSpeed(val);
    });

    // Reiniciar Universo: botón del encabezado y atajo de ícono junto a Velocidad
    const reiniciarUniverso = () => {
      this.loadLevel(this.currentLevel);
      this.log("Universo de SENABOT reiniciado.", "info");
    };
    document.getElementById('btnResetWorld').addEventListener('click', reiniciarUniverso);
    document.getElementById('btnResetWorldMini').addEventListener('click', reiniciarUniverso);

    // Controles de Cámara
    document.getElementById('camIso').addEventListener('click', () => this.world.setCameraIsometric());
    document.getElementById('camTop').addEventListener('click', () => this.world.setCameraTop());
    document.getElementById('camReset').addEventListener('click', () => this.world.setCameraIsometric());

    // Limpiar Consola
    document.getElementById('btnClearConsole').addEventListener('click', () => {
      document.getElementById('consoleLog').innerHTML = '';
    });

    // Modal Ayuda
    const helpModal = document.getElementById('helpModal');
    document.getElementById('btnToggleHelp').addEventListener('click', () => helpModal.classList.remove('hidden'));
    document.getElementById('btnCloseHelp').addEventListener('click', () => helpModal.classList.add('hidden'));
    helpModal.addEventListener('click', (e) => {
      if (e.target === helpModal) helpModal.classList.add('hidden');
    });
  }

  // Definición de las estructuras de control disponibles
  static get CONTROL_DEFS() {
    return {
      repetir: {
        icon: 'fa-repeat', title: 'Repetir', tail: 'veces:', input: 'count'
      },
      si_condicion: {
        icon: 'fa-code-branch', title: 'Si', tail: 'entonces:',
        options: ['hay_disco', 'frente_libre', 'tiene_disco', 'frente_bloqueado']
      },
      mientras: {
        icon: 'fa-arrows-spin', title: 'Mientras', tail: 'hacer:',
        options: ['frente_libre', 'hay_disco', 'tiene_disco']
      }
    };
  }

  static get ACTION_LABELS() {
    return {
      paso_adelante: { label: 'Paso Adelante', icon: 'fa-arrow-up' },
      giro_derecha: { label: 'Giro Derecha (90°)', icon: 'fa-rotate-right' },
      giro_izquierda: { label: 'Giro Izquierda (90°)', icon: 'fa-rotate-left' },
      saltar: { label: 'Saltar Bloque', icon: 'fa-person-running' },
      toma_disco: { label: 'Toma Disco', icon: 'fa-hand-holding' },
      deja_disco: { label: 'Deja Disco', icon: 'fa-box-archive' }
    };
  }

  /**
   * Inserta un bloque. Sin `container` va al contenedor activo, que puede ser
   * el programa principal o el interior de cualquier estructura de control.
   */
  addBlockToProgram(actionType, container = null, before = null) {
    const target = container || this.activeContainer || this.rootContainer;
    const id = `block_${this.blockIdCounter++}`;
    const def = UI.CONTROL_DEFS[actionType];

    const node = def
      ? this.createControlBlock(actionType, def, id)
      : this.createActionBlock(actionType, id);

    target.insertBefore(node, before);

    // Al añadir una estructura de control, su interior pasa a ser el destino
    if (def) this.setActiveContainer(node.querySelector(':scope > .nested-container'));

    this.refreshPlaceholders();
    this.updateBlockCount();
    return node;
  }

  // Bloque de acción simple (una tarjeta suelta)
  createActionBlock(actionType, id) {
    const info = UI.ACTION_LABELS[actionType] || { label: actionType, icon: 'fa-cube' };

    const card = document.createElement('div');
    card.className = 'program-card';
    card.setAttribute('data-id', id);
    card.setAttribute('data-type', 'action');
    card.setAttribute('data-action', actionType);
    card.innerHTML = `
      <div class="card-left">
        <i class="fa-solid fa-grip-vertical card-handle"></i>
        <i class="fa-solid ${info.icon}" style="color:var(--sena-green)"></i>
        <span class="card-title">${info.label}</span>
      </div>
      <button class="card-remove" title="Eliminar bloque">&times;</button>
    `;

    card.querySelector('.card-remove').addEventListener('click', (e) => {
      e.stopPropagation();
      this.removeBlock(card);
    });

    // Seleccionar una acción apunta la inserción a su mismo contenedor
    card.addEventListener('click', (e) => {
      if (e.target.closest('.card-remove')) return;
      e.stopPropagation();
      this.setActiveContainer(card.parentElement);
    });

    this.makeDraggableBlock(card, card);
    return card;
  }

  /**
   * Estructura de control: una tarjeta cabecera + un contenedor anidado que
   * acepta acciones y otras estructuras de control, sin límite de profundidad.
   */
  createControlBlock(type, def, id) {
    const inputHtml = def.input === 'count'
      ? `<input type="number" class="card-num-input" value="3" min="1" max="20">`
      : `<select class="card-select">${def.options.map(o => `<option value="${o}">${o}</option>`).join('')}</select>`;

    const card = document.createElement('div');
    card.className = 'program-card control-card';
    card.setAttribute('data-id', id);
    card.setAttribute('data-type', type);
    card.innerHTML = `
      <div class="card-left">
        <i class="fa-solid fa-grip-vertical card-handle"></i>
        <i class="fa-solid ${def.icon}" style="color:var(--sena-accent-orange)"></i>
        <span class="card-title">${def.title}</span>
        ${inputHtml}
        <span>${def.tail}</span>
      </div>
      <button class="card-remove" title="Eliminar bloque">&times;</button>
    `;

    const nested = document.createElement('div');
    nested.className = 'nested-container';
    nested.setAttribute('data-parent', id);
    this.makeDropZone(nested);
    nested.addEventListener('click', (e) => {
      e.stopPropagation();
      this.setActiveContainer(nested);
    });

    const group = document.createElement('div');
    group.className = 'block-group';
    group.setAttribute('data-group', id);
    group.appendChild(card);
    group.appendChild(nested);

    card.querySelector('.card-remove').addEventListener('click', (e) => {
      e.stopPropagation();
      this.removeBlock(group);
    });

    // Clic en la cabecera apunta la inserción al interior de esta estructura
    card.addEventListener('click', (e) => {
      if (e.target.closest('.card-remove') || e.target.closest('input, select')) return;
      e.stopPropagation();
      this.setActiveContainer(nested);
    });

    // Se arrastra por la cabecera, pero se mueve el grupo completo con su contenido
    this.makeDraggableBlock(group, card);
    return group;
  }

  removeBlock(node) {
    // Si se elimina el bloque que contenía el destino activo, volver a la raíz
    if (node.contains(this.activeContainer)) this.setActiveContainer(this.rootContainer);
    node.remove();
    this.refreshPlaceholders();
    this.updateBlockCount();
  }

  // --- Destino de inserción -------------------------------------------------

  setActiveContainer(container) {
    this.activeContainer = container || this.rootContainer;
    document.querySelectorAll('.active-target').forEach(c => c.classList.remove('active-target'));
    this.activeContainer.classList.add('active-target');
    this.updateTargetLabel();
  }

  updateTargetLabel() {
    const label = document.getElementById('insertTarget');
    if (!label) return;

    const path = [];
    let node = this.activeContainer;
    while (node && node !== this.rootContainer) {
      if (node.classList.contains('nested-container')) {
        const header = node.previousElementSibling;
        const title = header ? header.querySelector('.card-title').textContent : '?';
        path.unshift(title);
      }
      node = node.parentElement;
    }

    label.textContent = path.length
      ? `▸ dentro de ${path.join(' ▸ ')}`
      : '▸ programa principal';
  }

  // Marca los contenedores vacíos y muestra/oculta el estado inicial
  refreshPlaceholders() {
    document.querySelectorAll('.nested-container').forEach(c => {
      c.classList.toggle('is-empty', this.blockChildren(c).length === 0);
    });
    const empty = document.getElementById('emptyState');
    if (empty) {
      empty.style.display = this.blockChildren(this.rootContainer).length ? 'none' : '';
    }
  }

  // Hijos directos que son bloques reales (ignora placeholders e indicadores)
  blockChildren(container) {
    return Array.from(container.children).filter(
      c => c.classList.contains('program-card') || c.classList.contains('block-group')
    );
  }

  // --- Arrastrar y soltar ---------------------------------------------------

  makeDraggableBlock(node, handleCard) {
    handleCard.setAttribute('draggable', 'true');
    handleCard.addEventListener('dragstart', (e) => {
      e.stopPropagation();
      this.dragState = { type: 'move', el: node };
      node.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', handleCard.getAttribute('data-id'));
    });
    handleCard.addEventListener('dragend', () => this.cleanupDrag());
  }

  makeDropZone(container) {
    const rejects = () => {
      if (!this.dragState) return true;
      // Un bloque no puede soltarse dentro de sí mismo
      return this.dragState.type === 'move' && this.dragState.el.contains(container);
    };

    container.addEventListener('dragover', (e) => {
      if (rejects()) return;
      e.preventDefault();
      e.stopPropagation(); // el contenedor más interno gana
      e.dataTransfer.dropEffect = this.dragState.type === 'move' ? 'move' : 'copy';
      this.showDropTarget(container, e.clientY);
    });

    container.addEventListener('drop', (e) => {
      if (rejects()) return;
      e.preventDefault();
      e.stopPropagation();
      const before = this.getDropAnchor(container, e.clientY);
      if (this.dragState.type === 'palette') {
        this.addBlockToProgram(this.dragState.action, container, before);
      } else {
        container.insertBefore(this.dragState.el, before);
        this.refreshPlaceholders();
        this.updateBlockCount();
      }
      this.cleanupDrag();
    });
  }

  showDropTarget(container, y) {
    document.querySelectorAll('.drop-active').forEach(c => c.classList.remove('drop-active'));
    container.classList.add('drop-active');

    if (!this.dropIndicator) {
      this.dropIndicator = document.createElement('div');
      this.dropIndicator.className = 'drop-indicator';
    }
    container.insertBefore(this.dropIndicator, this.getDropAnchor(container, y));
  }

  // Bloque ante el cual insertar según la posición vertical del cursor
  getDropAnchor(container, y) {
    return this.blockChildren(container).find(el => {
      if (el.classList.contains('dragging')) return false;
      const box = el.getBoundingClientRect();
      return y < box.top + box.height / 2;
    }) || null;
  }

  cleanupDrag() {
    if (this.dropIndicator && this.dropIndicator.parentElement) this.dropIndicator.remove();
    document.querySelectorAll('.drop-active').forEach(c => c.classList.remove('drop-active'));
    document.querySelectorAll('.dragging').forEach(c => c.classList.remove('dragging'));
    this.dragState = null;
  }

  clearProgram() {
    this.rootContainer.innerHTML = `
      <div class="empty-state" id="emptyState">
        <i class="fa-solid fa-puzzle-piece"></i>
        <p>Haz clic en las acciones para añadirlas al programa de SENABOT, o arrástralas hasta aquí.</p>
      </div>
    `;
    this.setActiveContainer(this.rootContainer);
    this.refreshPlaceholders();
    this.updateBlockCount();
  }

  updateBlockCount() {
    const count = document.querySelectorAll('.program-card').length;
    document.getElementById('blockCount').textContent = `${count} bloques`;
  }

  // Construir Árbol AST del Programa desde la Interfaz DOM (recursivo)
  buildAST(container = this.rootContainer) {
    const ast = [];

    this.blockChildren(container).forEach(el => {
      const isGroup = el.classList.contains('block-group');
      const card = isGroup ? el.querySelector(':scope > .program-card') : el;
      if (!card) return;

      // `:scope >` evita capturar el contenedor de una estructura más profunda
      const nested = isGroup ? el.querySelector(':scope > .nested-container') : null;
      const type = card.getAttribute('data-type');
      const id = card.getAttribute('data-id');

      if (type === 'action') {
        ast.push({ type: 'action', action: card.getAttribute('data-action'), id });
      } else if (type === 'repetir') {
        ast.push({
          type: 'repetir',
          count: parseInt(card.querySelector('.card-num-input').value) || 1,
          children: nested ? this.buildAST(nested) : [],
          id
        });
      } else if (type === 'si_condicion' || type === 'mientras') {
        ast.push({
          type,
          condition: card.querySelector('.card-select').value,
          children: nested ? this.buildAST(nested) : [],
          id
        });
      }
    });

    return ast;
  }

  setExecutionState(running) {
    document.getElementById('btnRun').disabled = running;
    document.getElementById('btnStep').disabled = running && !this.interpreter.isPaused;
    document.getElementById('btnStop').disabled = !running;
  }

  highlightBlock(blockId) {
    this.clearHighlights();
    if (!blockId) return;
    const card = document.querySelector(`[data-id="${blockId}"]`);
    if (card) card.classList.add('executing');
  }

  clearHighlights() {
    document.querySelectorAll('.program-card').forEach(c => c.classList.remove('executing'));
  }

  updateHUD() {
    const s = this.world.robotState;
    const dirs = ["Norte (▲)", "Este (►)", "Sur (▼)", "Oeste (◄)"];

    document.getElementById('hudPos').textContent = `X: ${s.x} | Z: ${s.z}`;
    document.getElementById('hudDir').textContent = dirs[s.dir] || "Norte";
    document.getElementById('hudDiscs').textContent = `${s.discsCarried} / ${this.discsGoal()}`;
  }

  // Meta de discos del nivel según su objetivo
  discsGoal() {
    const level = this.currentLevel;
    if (level.objective === 'deliver_discs') {
      return (level.deliveryTargets || []).reduce((sum, t) => sum + t.requiredCount, 0);
    }
    return level.requiredDiscsCollected || (level.discs || []).length;
  }

  updateStats(steps) {
    document.getElementById('hudSteps').textContent = steps;
    this.updateHUD();
  }

  log(msg, type = "system") {
    const consoleLog = document.getElementById('consoleLog');
    if (!consoleLog) return;

    const now = new Date();
    const timeStr = `${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

    const entry = document.createElement('div');
    entry.className = `log-entry ${type}`;
    entry.innerHTML = `<span class="timestamp">[${timeStr}]</span> ${msg}`;
    consoleLog.appendChild(entry);
    consoleLog.scrollTop = consoleLog.scrollHeight;
  }
}
