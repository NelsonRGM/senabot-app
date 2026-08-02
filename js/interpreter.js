/**
 * SENABOT 3D - Intérprete y Ejecutor de Algoritmos
 */

class Interpreter {
  constructor(world, ui) {
    this.world = world;
    this.ui = ui;
    
    this.isRunning = false;
    this.isPaused = false;
    this.currentStepIndex = 0;
    this.flatInstructions = [];
    this.stepDelay = 400; // ms
    this.timer = null;
    this.stepCount = 0;
  }

  setSpeed(speedLevel) {
    // 1: 900ms, 2: 600ms, 3: 400ms, 4: 250ms, 5: 120ms
    const map = { 1: 900, 2: 600, 3: 400, 4: 250, 5: 120 };
    this.stepDelay = map[speedLevel] || 400;
  }

  // Desenrollar/Aplanar la estructura en un árbol ejecutable de instrucciones
  flattenProgram(programAST) {
    let instructions = [];
    
    programAST.forEach(node => {
      if (node.type === 'action') {
        instructions.push({ type: 'action', action: node.action, id: node.id });
      } else if (node.type === 'repetir') {
        const count = parseInt(node.count) || 1;
        for (let i = 0; i < count; i++) {
          instructions.push({ type: 'marker', text: `Repetición ${i+1}/${count}`, id: node.id });
          instructions = instructions.concat(this.flattenProgram(node.children));
        }
      } else if (node.type === 'si_condicion') {
        instructions.push({ type: 'condition', condition: node.condition, children: node.children, elseChildren: node.elseChildren, id: node.id });
      } else if (node.type === 'mientras') {
        instructions.push({ type: 'while', condition: node.condition, children: node.children, id: node.id });
      }
    });

    return instructions;
  }

  async run(programAST) {
    if (this.isRunning) return;
    this.isRunning = true;
    this.isPaused = false;
    this.stepCount = 0;
    
    this.ui.log("Iniciando ejecución del programa de SENABOT...", "info");
    this.ui.setExecutionState(true);

    this.flatInstructions = this.flattenProgram(programAST);
    this.currentStepIndex = 0;

    await this.executionLoop();
  }

  async executionLoop() {
    let loopGuard = 0;
    const maxInstructions = 300;

    while (this.isRunning && this.currentStepIndex < this.flatInstructions.length) {
      if (this.isPaused) break;
      if (loopGuard++ > maxInstructions) {
        this.ui.log("¡Límite de instrucciones alcanzado (posible bucle infinito)! Ejecución detenida.", "error");
        this.stop();
        return;
      }

      const currentItem = this.flatInstructions[this.currentStepIndex];
      this.ui.highlightBlock(currentItem.id);

      const success = await this.executeItem(currentItem);
      if (!success) {
        this.ui.log("Ejecución pausada debido a un bloqueo o error.", "error");
        this.stop();
        return;
      }

      this.stepCount++;
      this.ui.updateStats(this.stepCount);
      this.currentStepIndex++;

      // Retardo según velocidad
      await new Promise(resolve => setTimeout(resolve, this.stepDelay));
    }

    if (this.currentStepIndex >= this.flatInstructions.length && this.isRunning) {
      this.ui.log(`Programa finalizado con éxito en ${this.stepCount} pasos.`, "success");
      this.checkMissionComplete();
      this.stop();
    }
  }

  async stepOnce(programAST) {
    if (!this.isRunning) {
      this.isRunning = true;
      this.isPaused = true;
      this.flatInstructions = this.flattenProgram(programAST);
      this.currentStepIndex = 0;
      this.stepCount = 0;
      this.ui.setExecutionState(true);
    }

    if (this.currentStepIndex < this.flatInstructions.length) {
      const currentItem = this.flatInstructions[this.currentStepIndex];
      this.ui.highlightBlock(currentItem.id);

      const success = await this.executeItem(currentItem);
      if (success) {
        this.stepCount++;
        this.ui.updateStats(this.stepCount);
        this.currentStepIndex++;
      } else {
        this.stop();
        return;
      }

      if (this.currentStepIndex >= this.flatInstructions.length) {
        this.ui.log(`Programa paso a paso finalizado.`, "success");
        this.checkMissionComplete();
        this.stop();
      }
    }
  }

  stop() {
    this.isRunning = false;
    this.isPaused = false;
    this.ui.setExecutionState(false);
    this.ui.clearHighlights();
  }

  async executeItem(item) {
    if (item.type === 'action') {
      return await this.executeAction(item.action);
    } else if (item.type === 'condition') {
      const condResult = this.evaluateCondition(item.condition);
      this.ui.log(`Evaluando condición '${item.condition}': ${condResult ? 'VERDADERO' : 'FALSO'}`, "info");
      
      const subTree = condResult ? item.children : (item.elseChildren || []);
      const subFlat = this.flattenProgram(subTree);
      
      // Inyectar sub-instrucciones inmediatamente después
      this.flatInstructions.splice(this.currentStepIndex + 1, 0, ...subFlat);
      return true;
    } else if (item.type === 'while') {
      const condResult = this.evaluateCondition(item.condition);
      if (condResult) {
        const subFlat = this.flattenProgram(item.children);
        // Volver a insertar la instrucción mientras para reevaluar al final
        this.flatInstructions.splice(this.currentStepIndex + 1, 0, ...subFlat, item);
      }
      return true;
    } else if (item.type === 'marker') {
      return true;
    }
    return true;
  }

  // Nivel de elevación de una casilla: 0 si está a ras de suelo
  heightAt(x, z) {
    const obs = this.world.obstacleMeshes.find(o => o.userData.x === x && o.userData.z === z);
    return obs ? obs.userData.height : 0;
  }

  async executeAction(action) {
    const s = this.world.robotState;
    const grid = this.world.gridSize;

    // Calculo de casilla frontal según orientación
    // 0: Norte (-Z), 1: Este (+X), 2: Sur (+Z), 3: Oeste (-X)
    let nextX = s.x;
    let nextZ = s.z;
    if (s.dir === 0) nextZ -= 1;
    if (s.dir === 1) nextX += 1;
    if (s.dir === 2) nextZ += 1;
    if (s.dir === 3) nextX -= 1;

    switch (action) {
      case 'paso_adelante': {
        // Validar límites
        if (nextX < 0 || nextX >= grid.cols || nextZ < 0 || nextZ >= grid.rows) {
          this.ui.log(`❌ SENABOT intentó salir del universo en (${nextX}, ${nextZ}).`, "error");
          return false;
        }

        // Caminar es plano: cualquier cambio de altura exige 'Saltar'
        const currH = this.heightAt(s.x, s.z);
        const nextH = this.heightAt(nextX, nextZ);

        if (nextH !== currH) {
          const sentido = nextH > currH ? "subir" : "bajar";
          this.ui.log(`❌ La casilla (${nextX}, ${nextZ}) está a otra altura. Usa 'Saltar' para ${sentido} 1 nivel.`, "error");
          return false;
        }

        s.x = nextX;
        s.z = nextZ;
        this.world.updateRobotTransform(true, this.stepDelay * 0.8);
        this.ui.log(`SENABOT avanza a la casilla (${s.x}, ${s.z}).`, "system");
        return true;
      }

      case 'giro_derecha': {
        s.dir = (s.dir + 1) % 4;
        this.world.updateRobotTransform(true, this.stepDelay * 0.7);
        this.ui.log(`SENABOT gira 90° a la derecha.`, "system");
        return true;
      }

      case 'giro_izquierda': {
        s.dir = (s.dir + 3) % 4;
        this.world.updateRobotTransform(true, this.stepDelay * 0.7);
        this.ui.log(`SENABOT gira 90° a la izquierda.`, "system");
        return true;
      }

      case 'saltar': {
        if (nextX < 0 || nextX >= grid.cols || nextZ < 0 || nextZ >= grid.rows) {
          this.ui.log(`❌ No se puede saltar fuera del mapa.`, "error");
          return false;
        }

        // Solo se salta cuando hay desnivel, y como máximo de 1 nivel (subiendo o bajando)
        const currH = this.heightAt(s.x, s.z);
        const nextH = this.heightAt(nextX, nextZ);
        const desnivel = nextH - currH;

        if (desnivel === 0) {
          this.ui.log(`❌ La casilla (${nextX}, ${nextZ}) está a la misma altura. Solo se puede saltar hacia un desnivel; usa 'Paso Adelante'.`, "error");
          return false;
        }
        if (Math.abs(desnivel) > 1) {
          const sentido = desnivel > 0 ? "subir" : "bajar";
          this.ui.log(`❌ Desnivel de ${Math.abs(desnivel)} niveles: SENABOT solo puede ${sentido} 1 nivel de un salto.`, "error");
          return false;
        }

        s.x = nextX;
        s.z = nextZ;
        const ty = this.world.blockHeight * nextH;

        this.world.animateJump(
          nextX * this.world.tileSize + this.world.tileSize / 2,
          ty,
          nextZ * this.world.tileSize + this.world.tileSize / 2,
          this.stepDelay * 0.9
        );
        const accion = desnivel > 0 ? "sube" : "baja";
        this.ui.log(`SENABOT salta y ${accion} 1 nivel hasta (${s.x}, ${s.z}).`, "system");
        return true;
      }

      case 'toma_disco': {
        const picked = this.world.pickDiscAt(s.x, s.z);
        if (picked) {
          this.ui.log(`✨ SENABOT recogió un disco en (${s.x}, ${s.z}). Discos en inventario: ${s.discsCarried}`, "success");
          return true;
        } else {
          this.ui.log(`⚠️ No hay ningún disco en la casilla (${s.x}, ${s.z}) para recoger.`, "error");
          return false;
        }
      }

      case 'deja_disco': {
        const dropped = this.world.dropDiscAt(s.x, s.z);
        if (dropped) {
          this.ui.log(`📦 SENABOT depositó un disco en (${s.x}, ${s.z}). Le quedan ${s.discsCarried}.`, "info");
          return true;
        } else {
          this.ui.log(`⚠️ SENABOT no tiene discos en el inventario para dejar.`, "error");
          return false;
        }
      }

      default:
        return true;
    }
  }

  evaluateCondition(condition) {
    const s = this.world.robotState;
    const grid = this.world.gridSize;

    let nextX = s.x;
    let nextZ = s.z;
    if (s.dir === 0) nextZ -= 1;
    if (s.dir === 1) nextX += 1;
    if (s.dir === 2) nextZ += 1;
    if (s.dir === 3) nextX -= 1;

    switch (condition) {
      // 'Libre' significa que 'Paso Adelante' funcionaría: dentro del mapa y sin
      // cambio de altura. Así 'mientras frente_libre -> paso_adelante' también
      // recorre una meseta elevada, donde sí hay obstáculo bajo el robot.
      case 'frente_libre': {
        if (nextX < 0 || nextX >= grid.cols || nextZ < 0 || nextZ >= grid.rows) return false;
        return this.heightAt(nextX, nextZ) === this.heightAt(s.x, s.z);
      }
      case 'frente_bloqueado': {
        if (nextX < 0 || nextX >= grid.cols || nextZ < 0 || nextZ >= grid.rows) return true;
        return this.heightAt(nextX, nextZ) !== this.heightAt(s.x, s.z);
      }
      case 'hay_disco': {
        return this.world.discsAt(s.x, s.z) > 0;
      }
      case 'tiene_disco': {
        return s.discsCarried > 0;
      }
      default:
        return false;
    }
  }

  checkMissionComplete() {
    const level = this.ui.currentLevel;
    const pending = level.objective === 'deliver_discs'
      ? this.checkDeliveries(level)
      : this.checkCollection(level);

    if (pending.length === 0) {
      this.ui.log(`🎉 ¡FELICITACIONES! Misión cumplida con éxito.`, "success");
      if (typeof confetti === 'function') {
        confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
      }
    } else {
      pending.forEach(msg => this.ui.log(`⚠️ ${msg}`, "info"));
      if (level.hint) this.ui.log(`💡 ${level.hint}`, "info");
    }
  }

  // objective: "collect_all" — todos los discos deben quedar recogidos
  checkCollection(level) {
    const collected = this.world.robotState.discsCollected;
    const required = level.requiredDiscsCollected || (level.discs || []).length;
    if (collected >= required) return [];
    return [`Te faltan discos por recolectar (${collected}/${required}).`];
  }

  // objective: "deliver_discs" — cada casilla de entrega debe acumular su cuota
  checkDeliveries(level) {
    const pending = [];
    (level.deliveryTargets || []).forEach(t => {
      const delivered = this.world.discsAt(t.x, t.z);
      if (delivered < t.requiredCount) {
        pending.push(`Faltan discos en la casilla de entrega (${t.x}, ${t.z}): ${delivered}/${t.requiredCount}.`);
      }
    });
    return pending;
  }
}
