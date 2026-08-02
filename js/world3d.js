/**
 * SENABOT 3D - Motor Gráfico Universo 3D con Three.js
 */

class World3D {
  /**
   * Color principal de SENABOT. Se lee de la variable CSS --sena-green para que
   * haya una sola fuente de verdad: al cambiarla en styles.css, el rover cambia
   * con ella. El valor de respaldo solo aplica fuera del navegador (pruebas).
   */
  static get SENABOT_MAIN() { return World3D.readCssColor('--sena-green', 0x39A900); }

  // Lee una variable CSS de :root y la convierte a entero hexadecimal
  static readCssColor(nombre, alterno) {
    try {
      if (typeof document === 'undefined' || typeof getComputedStyle !== 'function') return alterno;

      const valor = getComputedStyle(document.documentElement).getPropertyValue(nombre).trim();
      if (!valor) return alterno;

      const hex = valor.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
      if (hex) {
        const d = hex[1];
        const completo = d.length === 3 ? d[0] + d[0] + d[1] + d[1] + d[2] + d[2] : d;
        return parseInt(completo, 16);
      }

      // El navegador puede devolver la variable ya resuelta como rgb()
      const rgb = valor.match(/^rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/i);
      if (rgb) return (Number(rgb[1]) << 16) | (Number(rgb[2]) << 8) | Number(rgb[3]);

      return alterno;
    } catch (e) {
      return alterno;
    }
  }

  /**
   * Aclara (factor > 0) u oscurece (factor < 0) un color.
   * Los acentos del rover se derivan del color principal en vez de fijarse
   * a mano, así toda la paleta sigue a --sena-green.
   */
  static mixColor(hex, factor) {
    const canal = c => factor >= 0
      ? Math.round(c + (255 - c) * factor)
      : Math.round(c * (1 + factor));
    return (canal((hex >> 16) & 0xFF) << 16)
      | (canal((hex >> 8) & 0xFF) << 8)
      | canal(hex & 0xFF);
  }

  // Cuánto sube un disco cuando SENABOT ocupa su casilla (despeja el mástil)
  static get DISC_LIFT() { return 1.55; }

  // Logo estampado en las caras de los discos. Si el archivo no existe,
  // los discos simplemente quedan dorados lisos.
  static get DISC_LOGO_URL() { return 'assets/disco-logo.png'; }
  static get GOAL_LOGO_URL() { return 'assets/logo-sena.png'; }

  // Dimensiones del disco recolectable
  static get DISC_RADIUS() { return 0.42; }
  static get DISC_THICKNESS() { return 0.046; }

  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.controls = null;
    
    // Meshes y Objetos
    this.gridGroup = new THREE.Group();
    this.robotMesh = null;
    this.discMeshes = [];
    this.obstacleMeshes = [];
    this.targetMeshes = [];
    this.carriedDiscMesh = null;

    // Estado del Mundo
    this.gridSize = { cols: 8, rows: 8 };
    this.tileSize = 2.0;
    // Altura en unidades de mundo de un nivel de elevación (1X).
    // Equivale al 50% del ancho de casilla: un obstáculo de height 1 mide 1.0.
    this.blockHeight = this.tileSize * 0.5;
    this.robotState = {
      x: 0,
      z: 0,
      dir: 1, // 0: Norte (-Z), 1: Este (+X), 2: Sur (+Z), 3: Oeste (-X)
      discsCarried: 0,
      discsCollected: 0
    };
    
    // Animaciones
    this.isAnimating = false;
    this.animationQueue = [];
    
    this.init();
  }

  init() {
    // 1. Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x060C14);
    this.scene.fog = new THREE.FogExp2(0x060C14, 0.025);

    // 2. Camera
    const aspect = this.container.clientWidth / this.container.clientHeight;
    this.camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 1000);
    this.setCameraIsometric();

    // 3. Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.container.appendChild(this.renderer.domElement);

    // 4. Controls
    this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.maxPolarAngle = Math.PI / 2 - 0.05; // No ir bajo tierra

    // 5. Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    this.scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0x39A900, 1.2);
    dirLight.position.set(15, 25, 15);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    this.scene.add(dirLight);

    const blueLight = new THREE.PointLight(0x0088FF, 1.5, 30);
    blueLight.position.set(-10, 10, -10);
    this.scene.add(blueLight);

    // Grid Container
    this.scene.add(this.gridGroup);

    // Resize Handler
    window.addEventListener('resize', () => this.onWindowResize());

    // Loop
    this.animate();
  }

  setCameraIsometric() {
    const centerOffset = (this.gridSize.cols * this.tileSize) / 2;
    this.camera.position.set(centerOffset + 12, 14, centerOffset + 12);
    this.camera.lookAt(centerOffset, 0, centerOffset);
    if (this.controls) {
      this.controls.target.set(centerOffset, 0, centerOffset);
      this.controls.update();
    }
  }

  setCameraTop() {
    const centerOffset = (this.gridSize.cols * this.tileSize) / 2;
    this.camera.position.set(centerOffset, 22, centerOffset + 0.01);
    this.camera.lookAt(centerOffset, 0, centerOffset);
    if (this.controls) {
      this.controls.target.set(centerOffset, 0, centerOffset);
      this.controls.update();
    }
  }

  loadLevel(levelData) {
    this.gridSize = levelData.gridSize;
    this.clearWorld();

    // Crear Cuadrícula (Tiles)
    for (let r = 0; r < this.gridSize.rows; r++) {
      for (let c = 0; c < this.gridSize.cols; c++) {
        const isAlternate = (r + c) % 2 === 0;
        const tileMat = new THREE.MeshStandardMaterial({
          color: isAlternate ? 0x0F2338 : 0x142C44,
          roughness: 0.4,
          metalness: 0.2
        });

        const tileGeo = new THREE.BoxGeometry(this.tileSize - 0.08, 0.4, this.tileSize - 0.08);
        const tileMesh = new THREE.Mesh(tileGeo, tileMat);
        tileMesh.position.set(
          c * this.tileSize + this.tileSize / 2,
          -0.2,
          r * this.tileSize + this.tileSize / 2
        );
        tileMesh.receiveShadow = true;
        this.gridGroup.add(tileMesh);

        // Borde brillante SENA Green
        const edges = new THREE.EdgesGeometry(tileGeo);
        const lineMat = new THREE.LineBasicMaterial({ color: 0x39A900, transparent: true, opacity: 0.25 });
        const wireframe = new THREE.LineSegments(edges, lineMat);
        tileMesh.add(wireframe);
      }
    }

    this.createCardinalLabels();

    const obstacles = levelData.obstacles || [];

    // Casillas de Entrega con Moneda Flotante Vertical (Sin círculo en el piso)
    (levelData.deliveryTargets || []).forEach(target => {
      const obs = obstacles.find(o => o.x === target.x && o.z === target.z);
      const posY = obs ? this.blockHeight * obs.height : 0.0;
      const marker = this.createDeliveryMarker(target.x, posY, target.z);
      this.gridGroup.add(marker);
      this.targetMeshes.push(marker);
    });

    // Obstáculos (Elevaciones/Muros)
    obstacles.forEach(obs => {
      const obsGeo = new THREE.BoxGeometry(this.tileSize - 0.1, this.blockHeight * obs.height, this.tileSize - 0.1);
      const obsMat = new THREE.MeshStandardMaterial({
        color: 0x005580,
        roughness: 0.3,
        metalness: 0.6
      });
      const obsMesh = new THREE.Mesh(obsGeo, obsMat);
      const posY = (this.blockHeight * obs.height) / 2;
      obsMesh.position.set(
        obs.x * this.tileSize + this.tileSize / 2,
        posY,
        obs.z * this.tileSize + this.tileSize / 2
      );
      obsMesh.castShadow = true;
      obsMesh.receiveShadow = true;
      obsMesh.userData = { x: obs.x, z: obs.z, height: obs.height };
      this.gridGroup.add(obsMesh);
      this.obstacleMeshes.push(obsMesh);
    });

    // Discos recolectables
    (levelData.discs || []).forEach(d => {
      const discMesh = this.createDiscMesh(d.x, d.z);
      this.gridGroup.add(discMesh);
      this.discMeshes.push(discMesh);
    });

    // Robot SENABOT
    this.robotState = {
      x: levelData.robotStart.x,
      z: levelData.robotStart.z,
      dir: levelData.robotStart.dir,
      discsCarried: levelData.initialDiscs || 0,
      discsCollected: 0
    };
    this.createRobotMesh();
    this.updateBackpackDiscs();
    this.updateRobotTransform(false);
    this.setCameraIsometric();
  }

  /**
   * Rótulos de puntos cardinales en los cuatro bordes del mapa.
   * Van dentro de gridGroup, así que pertenecen al mundo: al orbitar la
   * cámara giran junto con el tablero y siempre señalan la misma dirección.
   */
  createCardinalLabels() {
    const ancho = this.gridSize.cols * this.tileSize;
    const fondo = this.gridSize.rows * this.tileSize;
    const margen = 1.7;

    // dir 0 es Norte (-Z), 1 Este (+X), 2 Sur (+Z), 3 Oeste (-X)
    const rotulos = [
      { texto: 'NORTE', x: ancho / 2, z: -margen },
      { texto: 'SUR', x: ancho / 2, z: fondo + margen },
      { texto: 'ESTE', x: ancho + margen, z: fondo / 2 },
      { texto: 'OESTE', x: -margen, z: fondo / 2 }
    ];

    rotulos.forEach(r => {
      const textura = this.makeTextTexture(r.texto);
      if (!textura) return; // sin canvas 2D disponible se omiten los rótulos

      const mat = new THREE.MeshBasicMaterial({
        map: textura,
        transparent: true,
        depthWrite: false,
        fog: false
      });
      const plano = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 1.4), mat);
      plano.rotation.x = -Math.PI / 2; // acostado sobre el piso, texto hacia el norte
      plano.position.set(r.x, 0.03, r.z);
      this.gridGroup.add(plano);
    });
  }

  // Dibuja el texto en un canvas y lo devuelve como textura de Three.js
  makeTextTexture(texto) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 256;

    const ctx = canvas.getContext && canvas.getContext('2d');
    if (!ctx) return null;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.font = 'bold 120px Outfit, Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Contorno oscuro para que el texto se lea sobre cualquier fondo
    ctx.lineWidth = 16;
    ctx.strokeStyle = 'rgba(4, 10, 18, 0.9)';
    ctx.strokeText(texto, canvas.width / 2, canvas.height / 2);
    ctx.fillStyle = '#7CF04A';
    ctx.fillText(texto, canvas.width / 2, canvas.height / 2);

    const textura = new THREE.CanvasTexture(canvas);
    textura.anisotropy = 4;
    return textura;
  }

  // Disco con el logo del SENA, acostado y estático sobre la casilla de entrega.
  // Va al ras del piso para no estorbarle al robot cuando se para encima.
  createDeliveryMarker(x, posY, z) {
    const targetGroup = new THREE.Group();

    const radio = 0.62;
    const alturaDisco = 0.06;
    // Apenas por encima del piso (y = 0) para que no haya z-fighting con la casilla
    const alturaSobrePiso = 0.03;

    const cantoMat = new THREE.MeshStandardMaterial({
      color: 0x39A900,
      emissive: 0x39A900,
      emissiveIntensity: 0.4,
      metalness: 0.5,
      roughness: 0.45
    });

    // La textura del logo va solo en la cara superior, que es la única visible
    const textura = this.getGoalLogoTexture();
    const caraMat = textura
      ? new THREE.MeshStandardMaterial({
          map: textura,
          emissiveMap: textura,
          emissive: 0xFFFFFF,
          emissiveIntensity: 0.3,
          metalness: 0.1,
          roughness: 0.6
        })
      : cantoMat;
    if (textura) this.goalLogoMaterials.push(caraMat);

    // CylinderGeometry ordena sus materiales como [lateral, tapa superior, tapa inferior]
    const discGeo = new THREE.CylinderGeometry(radio, radio, alturaDisco, 48);
    const disc = new THREE.Mesh(discGeo, [cantoMat, caraMat, cantoMat]);
    disc.position.y = alturaSobrePiso;
    // La tapa superior mapea el alto de la textura sobre +Z, que en la cámara
    // isométrica apunta hacia el observador: se gira para que el logo se lea derecho
    disc.rotation.y = 3 * Math.PI / 4;
    disc.receiveShadow = true;
    targetGroup.add(disc);

    // Aro brillante acostado que delimita la casilla de entrega
    const aroGeo = new THREE.TorusGeometry(radio, 0.03, 12, 48);
    aroGeo.rotateX(Math.PI / 2);
    const aroMat = new THREE.MeshStandardMaterial({ color: 0x00FFCC, emissive: 0x00FFCC, emissiveIntensity: 0.9 });
    const aro = new THREE.Mesh(aroGeo, aroMat);
    aro.position.y = alturaSobrePiso;
    targetGroup.add(aro);

    targetGroup.position.set(
      x * this.tileSize + this.tileSize / 2,
      posY,
      z * this.tileSize + this.tileSize / 2
    );
    return targetGroup;
  }

  /**
   * Carga (una sola vez) el logo de las casillas de entrega.
   * Si el PNG no está, los discos quedan verdes lisos en vez de romperse.
   */
  getGoalLogoTexture() {
    if (this.goalLogoTexture !== undefined) return this.goalLogoTexture;

    if (typeof THREE.TextureLoader !== 'function') {
      this.goalLogoTexture = null;
      return null;
    }

    this.goalLogoMaterials = [];

    this.goalLogoTexture = new THREE.TextureLoader().load(
      World3D.GOAL_LOGO_URL,
      undefined,
      undefined,
      () => {
        console.warn(`SENABOT: no se pudo cargar ${World3D.GOAL_LOGO_URL}. Las metas quedan sin logo.`);
        this.goalLogoTexture = null;
        this.goalLogoMaterials.forEach(m => {
          m.map = null;
          m.emissiveMap = null;
          m.color.setHex(0x39A900);
          m.emissive.setHex(0x39A900);
          m.emissiveIntensity = 0.4;
          m.needsUpdate = true;
        });
      }
    );

    this.goalLogoTexture.generateMipmaps = false;
    this.goalLogoTexture.minFilter = THREE.LinearFilter;
    this.goalLogoTexture.magFilter = THREE.LinearFilter;

    return this.goalLogoTexture;
  }

  /**
   * Carga (una sola vez) la textura del logo y la comparte entre todos los discos.
   * Devuelve null si no hay TextureLoader o si el PNG no está disponible.
   */
  getDiscLogoTexture() {
    if (this.discLogoTexture !== undefined) return this.discLogoTexture;

    if (typeof THREE.TextureLoader !== 'function') {
      this.discLogoTexture = null;
      return null;
    }

    this.discLogoMeshes = [];

    this.discLogoTexture = new THREE.TextureLoader().load(
      World3D.DISC_LOGO_URL,
      undefined,
      undefined,
      () => {
        console.warn(`SENABOT: no se pudo cargar ${World3D.DISC_LOGO_URL}. Los discos quedan sin logo.`);
        this.discLogoTexture = null;
        this.discLogoMeshes.forEach(m => { m.visible = false; });
      }
    );

    // Un PNG de 100x100 no es potencia de dos: sin mipmaps se evitan los
    // avisos de WebGL y el logo se ve nítido en lugar de borroso.
    this.discLogoTexture.generateMipmaps = false;
    this.discLogoTexture.minFilter = THREE.LinearFilter;
    this.discLogoTexture.magFilter = THREE.LinearFilter;

    return this.discLogoTexture;
  }

  createDiscMesh(x, z, stackIndex = 0) {
    const grosor = World3D.DISC_THICKNESS;
    const geo = new THREE.CylinderGeometry(World3D.DISC_RADIUS, World3D.DISC_RADIUS, grosor, 28);
    geo.rotateX(Math.PI / 2); // Disco parado, gira sobre su eje como moneda

    const mat = new THREE.MeshStandardMaterial({
      color: 0xFFC700,
      emissive: 0xFF7A00,
      emissiveIntensity: 0.5,
      metalness: 0.8,
      roughness: 0.2
    });
    mat.userData.baseEmissive = 0.5;

    const mesh = new THREE.Mesh(geo, mat);

    /*
     * El logo NO va sobre las tapas del cilindro: Three.js mapea sus UV con
     * U sobre el eje Z y V sobre el eje X, lo que deja la imagen girada 90°.
     * En su lugar se pegan dos círculos planos, cuyas UV sí están alineadas
     * con X e Y, así que el logo sale derecho sin trucos de rotación.
     */
    const logo = this.getDiscLogoTexture();
    if (logo) {
      const separacion = grosor / 2 + 0.004; // apenas por fuera de cada tapa
      [separacion, -separacion].forEach((offsetZ, i) => {
        const caraGeo = new THREE.CircleGeometry(World3D.DISC_RADIUS * 0.92, 32);
        const caraMat = new THREE.MeshStandardMaterial({
          map: logo,
          transparent: true,
          emissive: 0xFF7A00,
          emissiveIntensity: 0.15,
          metalness: 0.2,
          roughness: 0.6
        });
        const cara = new THREE.Mesh(caraGeo, caraMat);
        cara.position.z = offsetZ;
        // La cara trasera se voltea 180° sobre el eje vertical: así el logo
        // también se lee correctamente desde atrás, sin espejarlo a mano.
        if (i === 1) cara.rotation.y = Math.PI;
        cara.userData.esLogo = true;
        mesh.add(cara);
        this.discLogoMeshes.push(cara);
      });
    }

    // Un disco sobre una casilla elevada descansa encima del obstáculo
    const obs = this.obstacleMeshes.find(o => o.userData.x === x && o.userData.z === z);
    const baseY = (obs ? this.blockHeight * obs.userData.height : 0) + 0.55;

    // Los discos apilados en una misma casilla se separan para verse como una pila
    mesh.position.set(
      x * this.tileSize + this.tileSize / 2,
      baseY,
      z * this.tileSize + this.tileSize / 2 + stackIndex * (grosor + 0.05)
    );
    mesh.castShadow = true;
    // `phase` desfasa el vaivén para que una pila no oscile al unísono
    mesh.userData = { x, z, baseY, phase: x * 1.7 + z * 2.3 + stackIndex * 0.9 };
    return mesh;
  }

  createRobotMesh() {
    if (this.robotMesh) this.scene.remove(this.robotMesh);

    const robotGroup = new THREE.Group();

    // Paleta derivada del color institucional --sena-green
    const verde = World3D.SENABOT_MAIN;
    const verdeClaro = World3D.mixColor(verde, 0.45);  // acentos que brillan sobre el chasis
    const verdeOscuro = World3D.mixColor(verde, -0.6); // sombras y contenedor trasero

    const bodyMat = new THREE.MeshStandardMaterial({ color: verde, metalness: 0.55, roughness: 0.35 }); // Chasis SENABOT
    const panelMat = new THREE.MeshStandardMaterial({ color: 0x005580, metalness: 0.9, roughness: 0.1 }); // Paneles solares azul brillante
    const senaGreenMat = new THREE.MeshStandardMaterial({ color: verdeClaro, emissive: verdeClaro, emissiveIntensity: 0.8 }); // Acentos claros
    const wheelRubberMat = new THREE.MeshStandardMaterial({ color: 0x151A21, roughness: 0.9 }); // Ruedas todoterreno
    const silverMetalMat = new THREE.MeshStandardMaterial({ color: 0xB0BEC5, metalness: 0.9, roughness: 0.2 }); // Brazos cromados / Suspensión
    const sensorLensMat = new THREE.MeshStandardMaterial({ color: 0x00FFCC, emissive: 0x00E5FF, emissiveIntensity: 0.9 }); // Lente del mástil LiDAR/Cam
    const laserMat = new THREE.MeshStandardMaterial({ color: 0xFF3366, emissive: 0xFF0044, emissiveIntensity: 1.0 }); // Escáner láser frontal

    // 1. CHASIS PRINCIPAL (Estructura Hexagonal del Rover)
    const chasisShape = new THREE.Shape();
    chasisShape.moveTo(-0.45, -0.5);
    chasisShape.lineTo(0.45, -0.5);
    chasisShape.lineTo(0.55, 0.1);
    chasisShape.lineTo(0.35, 0.55);
    chasisShape.lineTo(-0.35, 0.55);
    chasisShape.lineTo(-0.55, 0.1);
    chasisShape.closePath();

    const extrudeSettings = { depth: 0.45, bevelEnabled: true, bevelSize: 0.04, bevelThickness: 0.04 };
    const chasisGeo = new THREE.ExtrudeGeometry(chasisShape, extrudeSettings);
    chasisGeo.rotateX(Math.PI / 2);
    chasisGeo.center();
    const chasis = new THREE.Mesh(chasisGeo, bodyMat);
    chasis.position.y = 0.55;
    chasis.castShadow = true;
    chasis.receiveShadow = true;
    robotGroup.add(chasis);

    // Cubierta Superior de Paneles Solares
    const solarGeo = new THREE.BoxGeometry(0.75, 0.04, 0.85);
    const solarPanel = new THREE.Mesh(solarGeo, panelMat);
    solarPanel.position.set(0, 0.8, 0.02);
    solarPanel.castShadow = true;
    robotGroup.add(solarPanel);

    // Líneas/Bordes embellecedores SENA Green en los costados del chasis
    [-0.56, 0.56].forEach(x => {
      const stripeGeo = new THREE.BoxGeometry(0.04, 0.12, 0.8);
      const stripe = new THREE.Mesh(stripeGeo, senaGreenMat);
      stripe.position.set(x, 0.55, 0);
      robotGroup.add(stripe);
    });

    // 2. SISTEMA DE SUSPENSIÓN Y 6 RUEDAS TODOTERRENO (Rocker-Bogie Suspension)
    const wheelPositions = [
      { x: -0.62, y: 0.28, z: -0.42 }, // Frontal Izquierda
      { x: 0.62, y: 0.28, z: -0.42 },  // Frontal Derecha
      { x: -0.65, y: 0.28, z: 0.0 },   // Central Izquierda
      { x: 0.65, y: 0.28, z: 0.0 },    // Central Derecha
      { x: -0.62, y: 0.28, z: 0.42 },  // Trasera Izquierda
      { x: 0.62, y: 0.28, z: 0.42 }   // Trasera Derecha
    ];

    wheelPositions.forEach((pos) => {
      const wheelGroup = new THREE.Group();
      wheelGroup.position.set(pos.x, pos.y, pos.z);

      // Neumático Roscado
      const tyreGeo = new THREE.CylinderGeometry(0.24, 0.24, 0.18, 20);
      tyreGeo.rotateZ(Math.PI / 2);
      const tyre = new THREE.Mesh(tyreGeo, wheelRubberMat);
      tyre.castShadow = true;
      wheelGroup.add(tyre);

      // Rin / Tapacubos de aleación cromada con centro SENA Green
      const rimGeo = new THREE.CylinderGeometry(0.14, 0.14, 0.19, 16);
      rimGeo.rotateZ(Math.PI / 2);
      const rim = new THREE.Mesh(rimGeo, silverMetalMat);
      wheelGroup.add(rim);

      const hubGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.2, 12);
      hubGeo.rotateZ(Math.PI / 2);
      const hub = new THREE.Mesh(hubGeo, senaGreenMat);
      wheelGroup.add(hub);

      // Brazo conector de suspensión al chasis
      const strutGeo = new THREE.BoxGeometry(0.12, 0.06, 0.06);
      const strut = new THREE.Mesh(strutGeo, silverMetalMat);
      strut.position.set(pos.x > 0 ? -0.1 : 0.1, 0.08, 0);
      wheelGroup.add(strut);

      robotGroup.add(wheelGroup);
    });

    // 3. MÁSTIL SENSOR PRINCIPAL (Cámara / LiDAR de Exploración)
    const mastGroup = new THREE.Group();
    mastGroup.position.set(-0.22, 0.82, -0.25);

    // Soporte Base del Mástil
    const mastBaseGeo = new THREE.CylinderGeometry(0.08, 0.1, 0.12, 12);
    const mastBase = new THREE.Mesh(mastBaseGeo, silverMetalMat);
    mastGroup.add(mastBase);

    // Mástil Vertical Elevado
    const mastPoleGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.65, 12);
    const mastPole = new THREE.Mesh(mastPoleGeo, silverMetalMat);
    mastPole.position.y = 0.38;
    mastPole.castShadow = true;
    mastGroup.add(mastPole);

    // Cabeza Sensorial Rotatoria (Cámara Panorámica LiDAR)
    const sensorHeadGroup = new THREE.Group();
    sensorHeadGroup.position.set(0, 0.7, 0);

    const sensorBoxGeo = new THREE.BoxGeometry(0.32, 0.2, 0.22);
    const sensorBox = new THREE.Mesh(sensorBoxGeo, bodyMat);
    sensorHeadGroup.add(sensorBox);

    // Ojo / Lente Principal Sensor Turquesa Neon
    const mainLensGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.06, 20);
    mainLensGeo.rotateX(-Math.PI / 2);
    const mainLens = new THREE.Mesh(mainLensGeo, sensorLensMat);
    mainLens.position.set(-0.06, 0.02, -0.12);
    sensorHeadGroup.add(mainLens);

    // Ojo Auxiliar de Navegación (Láser rojo/rosado)
    const subLensGeo = new THREE.CylinderGeometry(0.045, 0.045, 0.05, 16);
    subLensGeo.rotateX(-Math.PI / 2);
    const subLens = new THREE.Mesh(subLensGeo, laserMat);
    subLens.position.set(0.08, 0.02, -0.12);
    sensorHeadGroup.add(subLens);

    // Anillo Superior de Giro (LiDAR 360)
    const lidarRingGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.05, 16);
    const lidarRing = new THREE.Mesh(lidarRingGeo, senaGreenMat);
    lidarRing.position.y = 0.12;
    sensorHeadGroup.add(lidarRing);

    mastGroup.add(sensorHeadGroup);
    robotGroup.add(mastGroup);

    // 4. BRAZO ROBÓTICO ARTICULADO FRONTAL (Muestreador / Pinza)
    const armGroup = new THREE.Group();
    armGroup.position.set(0.22, 0.6, -0.38);

    // Articulación del hombro del brazo
    const armJoint1Geo = new THREE.SphereGeometry(0.08, 12, 12);
    const armJoint1 = new THREE.Mesh(armJoint1Geo, silverMetalMat);
    armGroup.add(armJoint1);

    // Tramo 1 del brazo
    const armSeg1Geo = new THREE.CylinderGeometry(0.04, 0.04, 0.35, 12);
    armSeg1Geo.rotateX(-Math.PI / 3);
    const armSeg1 = new THREE.Mesh(armSeg1Geo, silverMetalMat);
    armSeg1.position.set(0, -0.08, -0.15);
    armGroup.add(armSeg1);

    // Articulación del codo
    const armJoint2Geo = new THREE.SphereGeometry(0.06, 12, 12);
    const armJoint2 = new THREE.Mesh(armJoint2Geo, senaGreenMat);
    armJoint2.position.set(0, -0.18, -0.3);
    armGroup.add(armJoint2);

    // Pinza / Garra recolectora 3D
    const clawGroup = new THREE.Group();
    clawGroup.position.set(0, -0.22, -0.38);

    [-0.06, 0.06].forEach(xClaw => {
      const fingerGeo = new THREE.BoxGeometry(0.03, 0.12, 0.04);
      const finger = new THREE.Mesh(fingerGeo, silverMetalMat);
      finger.position.set(xClaw, 0, -0.05);
      finger.rotation.x = -0.3;
      clawGroup.add(finger);
    });
    armGroup.add(clawGroup);
    robotGroup.add(armGroup);

    // 5. ANTENA SATELITAL TRASERA (Plato Parabólico de Comunicaciones)
    const dishGroup = new THREE.Group();
    dishGroup.position.set(0.25, 0.82, 0.3);

    const dishPoleGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.3, 10);
    const dishPole = new THREE.Mesh(dishPoleGeo, silverMetalMat);
    dishPole.position.y = 0.15;
    dishGroup.add(dishPole);

    const dishShapeGeo = new THREE.CylinderGeometry(0.18, 0.02, 0.08, 16);
    dishShapeGeo.rotateX(0.5); // Inclinación parabólica hacia el cielo
    const dishMesh = new THREE.Mesh(dishShapeGeo, silverMetalMat);
    dishMesh.position.set(0, 0.32, -0.02);
    dishGroup.add(dishMesh);

    const dishTipGeo = new THREE.SphereGeometry(0.04, 10, 10);
    const dishTip = new THREE.Mesh(dishTipGeo, senaGreenMat);
    dishTip.position.set(0, 0.35, -0.05);
    dishGroup.add(dishTip);

    robotGroup.add(dishGroup);

    // 6. DEPOSITO CONTENEDOR TRASERO DE MUESTRAS / ESFERAS
    const packGeo = new THREE.BoxGeometry(0.55, 0.35, 0.3);
    const packMat = new THREE.MeshStandardMaterial({ color: verdeOscuro, metalness: 0.7, roughness: 0.4 });
    const backpack = new THREE.Mesh(packGeo, packMat);
    backpack.position.set(-0.05, 0.7, 0.35);
    backpack.castShadow = true;
    robotGroup.add(backpack);

    this.robotMesh = robotGroup;
    this.scene.add(this.robotMesh);
  }

  updateRobotTransform(animate = true, duration = 300) {
    if (!this.robotMesh) return;

    const targetX = this.robotState.x * this.tileSize + this.tileSize / 2;
    const targetZ = this.robotState.z * this.tileSize + this.tileSize / 2;
    
    // Altura según obstáculo
    let targetY = 0.0;
    const obsAtCell = this.obstacleMeshes.find(o => o.userData.x === this.robotState.x && o.userData.z === this.robotState.z);
    if (obsAtCell) {
      targetY = this.blockHeight * obsAtCell.userData.height;
    }

    // Orientación (0: Norte -Z, 1: Este +X, 2: Sur +Z, 3: Oeste -X)
    let targetRotY = 0;
    if (this.robotState.dir === 0) targetRotY = 0;             // Norte (-Z)
    if (this.robotState.dir === 1) targetRotY = -Math.PI / 2;  // Este (+X)
    if (this.robotState.dir === 2) targetRotY = Math.PI;       // Sur (+Z)
    if (this.robotState.dir === 3) targetRotY = Math.PI / 2;   // Oeste (-X)

    if (!animate) {
      this.robotMesh.position.set(targetX, targetY, targetZ);
      this.robotMesh.rotation.y = targetRotY;
    } else {
      this.animateMove(targetX, targetY, targetZ, targetRotY, duration);
    }
  }

  animateMove(tx, ty, tz, trotY, duration) {
    this.isAnimating = true;
    const startPos = this.robotMesh.position.clone();
    const startRotY = this.robotMesh.rotation.y;
    const startTime = performance.now();

    // Normalizar diferencia de rotación al camino más corto
    let diffRotY = trotY - startRotY;
    while (diffRotY < -Math.PI) diffRotY += Math.PI * 2;
    while (diffRotY > Math.PI) diffRotY -= Math.PI * 2;

    const step = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1.0);
      const ease = progress < 0.5 ? 2 * progress * progress : -1 + (4 - 2 * progress) * progress;

      this.robotMesh.position.x = startPos.x + (tx - startPos.x) * ease;
      this.robotMesh.position.y = startPos.y + (ty - startPos.y) * ease;
      this.robotMesh.position.z = startPos.z + (tz - startPos.z) * ease;
      this.robotMesh.rotation.y = startRotY + diffRotY * ease;

      if (progress < 1.0) {
        requestAnimationFrame(step);
      } else {
        this.robotMesh.position.set(tx, ty, tz);
        this.robotMesh.rotation.y = trotY;
        this.isAnimating = false;
      }
    };
    requestAnimationFrame(step);
  }

  animateJump(tx, ty, tz, duration = 450) {
    this.isAnimating = true;
    const startPos = this.robotMesh.position.clone();
    const startTime = performance.now();
    const peakHeight = Math.max(startPos.y, ty) + 1.2;

    const step = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1.0);
      const ease = progress;

      this.robotMesh.position.x = startPos.x + (tx - startPos.x) * ease;
      this.robotMesh.position.z = startPos.z + (tz - startPos.z) * ease;

      // Parábola de salto
      const arc = Math.sin(progress * Math.PI);
      // La parábola se escala con la altura de bloque para que el salto de 1 nivel se vea proporcionado
      this.robotMesh.position.y = startPos.y + (ty - startPos.y) * progress + arc * this.blockHeight;

      if (progress < 1.0) {
        requestAnimationFrame(step);
      } else {
        this.robotMesh.position.set(tx, ty, tz);
        this.isAnimating = false;
      }
    };
    requestAnimationFrame(step);
  }

  discsAt(x, z) {
    return this.discMeshes.filter(d => d.userData.x === x && d.userData.z === z).length;
  }

  pickDiscAt(x, z) {
    const idx = this.discMeshes.findIndex(d => d.userData.x === x && d.userData.z === z);
    if (idx !== -1) {
      const disc = this.discMeshes[idx];
      this.gridGroup.remove(disc);
      this.discMeshes.splice(idx, 1);
      this.robotState.discsCarried++;
      this.robotState.discsCollected++;

      // Mostrar mini disco en la mochila del robot
      this.updateBackpackDiscs();
      return true;
    }
    return false;
  }

  dropDiscAt(x, z) {
    if (this.robotState.discsCarried > 0) {
      this.robotState.discsCarried--;
      const discMesh = this.createDiscMesh(x, z, this.discsAt(x, z));
      this.gridGroup.add(discMesh);
      this.discMeshes.push(discMesh);
      this.updateBackpackDiscs();
      return true;
    }
    return false;
  }

  updateBackpackDiscs() {
    if (!this.robotMesh) return;
    if (this.carriedDiscMesh) {
      this.robotMesh.remove(this.carriedDiscMesh);
      this.carriedDiscMesh = null;
    }
    if (this.robotState.discsCarried > 0) {
      const geo = new THREE.CylinderGeometry(0.18, 0.18, 0.023, 20);
      geo.rotateX(Math.PI / 2);
      const mat = new THREE.MeshStandardMaterial({ color: 0xFFC700, emissive: 0xFF7A00, emissiveIntensity: 0.8 });
      this.carriedDiscMesh = new THREE.Mesh(geo, mat);
      this.carriedDiscMesh.position.set(-0.05, 0.95, 0.35);
      this.robotMesh.add(this.carriedDiscMesh);
    }
  }

  clearWorld() {
    while (this.gridGroup.children.length > 0) {
      this.gridGroup.remove(this.gridGroup.children[0]);
    }
    this.discMeshes = [];
    this.obstacleMeshes = [];
    this.targetMeshes = [];
    // Los materiales del nivel anterior ya no están en escena: solo interesan los del actual
    if (this.goalLogoMaterials) this.goalLogoMaterials = [];
    this.carriedDiscMesh = null;
    if (this.robotMesh) {
      this.scene.remove(this.robotMesh);
      this.robotMesh = null;
    }
  }

  onWindowResize() {
    if (!this.container || !this.renderer || !this.camera) return;
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  animate() {
    requestAnimationFrame(() => this.animate());
    if (this.controls) this.controls.update();

    // Micro-animación de exploración inactiva del Rover SENABOT
    if (this.robotMesh && !this.isAnimating) {
      const time = Date.now() * 0.002;
      const mastGroup = this.robotMesh.children[10]; // Mástil sensor
      if (mastGroup && mastGroup.children[2]) {
        mastGroup.children[2].rotation.y = Math.sin(time) * 0.4; // Escaneo panorámico LiDAR
      }
      const dishGroup = this.robotMesh.children[12]; // Antena satelital
      if (dishGroup) {
        dishGroup.rotation.y = Math.cos(time * 0.7) * 0.15; // Seguimiento de señal
      }
    }

    const levitateTime = Date.now() * 0.003;

    // Los discos giran y flotan; si SENABOT entra a su casilla se elevan
    // por encima del rover para no atravesarlo.
    const s = this.robotState;
    this.discMeshes.forEach(d => {
      d.rotation.y += 0.02;

      const bajoElRobot = d.userData.x === s.x && d.userData.z === s.z;
      const alturaMeta = d.userData.baseY
        + (bajoElRobot ? World3D.DISC_LIFT : 0)
        + Math.sin(levitateTime + d.userData.phase) * 0.07;

      // Interpolación suave hacia la altura objetivo
      d.position.y += (alturaMeta - d.position.y) * 0.12;

      d.material.emissiveIntensity = bajoElRobot ? 0.95 : 0.5;
    });
    // Las metas de entrega son discos estáticos: no giran ni levitan

    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }
  }
}
