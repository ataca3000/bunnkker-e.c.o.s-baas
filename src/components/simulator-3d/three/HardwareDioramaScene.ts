import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  createDioramaMaterials,
  createWarehouseRack,
  createForklift,
  createHandPalletTruck,
  createQueueStanchions,
  createStoreInterior,
  createDispatchAndDock,
  createDeliveryTruck,
  createSupplierTruck,
  createHumanFigure,
  createConveyorBelt,
  createDestinationHouse,
  createPackageMesh,
  createStockGaugeBillboard,
  createFloatingStockSprite,
  createPackageTrackingSprite,
  createDeliveryMilestoneSprite,
  createShockwaveMesh,
  createModularPodium,
  createNeonZoneBadge,
  createFloatingBalloonBadge,
  type FloatingBalloonBadge,
  createLogisticsControlRoom,
  createSurtidoWorkstations,
  createEntregasDock,
  createAtencionDesk,
  createCajaCobroStation,
  createAlmacenWalls,
  createCurvedConveyorTrack,
  createBateoReceptionTray,
  createDomicilioPodium,
  createCustomerWithPhoneMesh,
  createBunkkerControlBoardMesh,
  createDataPacketSprite,
  createNeonDataArcBeam,
  createCargoBoxTruck,
  createWoodenPallet,
  type DioramaMaterials,
} from './models/dioramaModels';
import {
  createWarehouseFloorTexture,
  createRoadTexture,
  createCircuitGridFloorTexture,
  createModularPodiumTexture,
} from './proceduralTextures';
import type {
  BoxDestination,
  CameraPreset,
  DeliveryType,
  PerspectiveType,
  ScenarioMode,
  SimulationStep,
  UserRole,
  ActiveBoxItem,
  ErpOrder,
  ErpOrderStatus,
  ErpSignalPacket,
} from '../types/logistics';
import type {
  TwinControlBoardRow,
  TwinFlowImpulse,
  TwinSnapshot,
  TwinZoneKey,
} from '@/lib/twinFlowBridge';

export interface SceneCallbacks {
  onStepChange: (step: SimulationStep, progress: number) => void;
  onOrderComplete: () => void;
  onSoundTrigger: (sound: 'scan' | 'cash' | 'tape' | 'truck' | 'success') => void;
  onStockEvent?: (
    type: 'plus' | 'minus',
    destination: BoxDestination,
    locationName: string,
    trackingId?: string,
    productName?: string
  ) => void;
  onBoxCountChange?: (activeCount: number) => void;
  onActiveBoxesUpdate?: (boxes: ActiveBoxItem[]) => void;
  onHoverZone?: (zoneName: string | null) => void;
  onErpOrdersUpdate?: (orders: ErpOrder[]) => void;
  autoDemoLoop?: boolean;
}

interface ActiveBox {
  id: string;
  trackingId: string;
  destination: BoxDestination;
  productName: string;
  category: string;
  mesh: THREE.Group;
  curve: THREE.CatmullRomCurve3;
  progress: number;
  speed: number;
  isValidated: boolean;
  trackingSprite?: THREE.Sprite;
}

interface FloatingBadge {
  sprite: THREE.Sprite;
  life: number;
  yVel: number;
}

export class HardwareDioramaScene {
  private container: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private materials: DioramaMaterials;
  private callbacks: SceneCallbacks;

  private frameId: number = 0;
  private isSoftwareGl: boolean = false;
  private clock: THREE.Clock = new THREE.Clock();

  // Dynamic Multi-Box Pool (Max 9 simultaneous boxes)
  public activeBoxes: ActiveBox[] = [];
  public maxBoxes: number = 9;
  private floatingBadges: FloatingBadge[] = [];
  public floatingZoneBadges: FloatingBalloonBadge[] = [];

  // 3D Visual Route Guides, Beacons & Shockwaves
  private routeGuides: {
    destination: BoxDestination;
    group: THREE.Group;
    pulseBead: THREE.Mesh;
    curve: THREE.CatmullRomCurve3;
  }[] = [];
  private landingBeacons: {
    destination: BoxDestination;
    group: THREE.Group;
    outerRing: THREE.Mesh;
    innerRing: THREE.Mesh;
    lightPillar: THREE.Mesh;
  }[] = [];
  private shockwaves: {
    mesh: THREE.Mesh;
    radius: number;
    maxRadius: number;
    life: number;
  }[] = [];

  // Permanent Vehicles & Scenery
  private truckGroup: THREE.Group | null = null;
  private supplierTruckGroup: THREE.Group | null = null;
  private forkliftGroup: THREE.Group | null = null;
  private palletTruckGroup: THREE.Group | null = null;
  private storeGroup: THREE.Group | null = null;
  private dockGroup: THREE.Group | null = null;

  // Actors
  private client1_counter: THREE.Group | null = null;
  private client2_aisle: THREE.Group | null = null;
  private client3_queue: THREE.Group | null = null;
  private client4_home: THREE.Group | null = null;
  private cashier1: THREE.Group | null = null;
  private salesAdvisor2: THREE.Group | null = null;
  private picker1_forklift: THREE.Group | null = null;
  private picker2_trolley: THREE.Group | null = null;
  private packer1_bench: THREE.Group | null = null;
  private packer2_dock: THREE.Group | null = null;
  private driver1_van: THREE.Group | null = null;
  private driver2_supplier: THREE.Group | null = null;
  private clientPhoneFigure: THREE.Group | null = null;
  private bunkkerControlBoard: THREE.Group | null = null;
  private cargoOperator: THREE.Group | null = null;

  // ERP Bunkker State & Neon Data Beams
  public erpOrders: ErpOrder[] = [];
  private realBoardRows: TwinControlBoardRow[] | null = null;
  private syncBoardSubtitle: string = '● FLUJO REAL E.C.O.S. ACTIVO';
  private erpBeams: { group: THREE.Group; curve: THREE.CatmullRomCurve3; pulseBead: THREE.Mesh; id: string }[] = [];
  private activeSignalPackets: { id: string; sprite: THREE.Sprite; curve: THREE.CatmullRomCurve3; progress: number; speed: number }[] = [];
  private flowIntervalId: ReturnType<typeof setInterval> | null = null;
  private pendingTimers: Set<ReturnType<typeof setTimeout>> = new Set();
  private autoDemoEnabled: boolean = false;

  // Splines
  private localCurve!: THREE.CatmullRomCurve3;     // Box to Caja
  private deliveryCurve!: THREE.CatmullRomCurve3;  // Box to Domicilio
  private inboundCurve!: THREE.CatmullRomCurve3;   // Box to Carga / Proveedor -> Almacén

  // Billboard
  private stockBillboardUpdater: ((name: string, s: number, m: number) => void) | null = null;

  // Animation State
  private isSimulating: boolean = true;
  private simulationSpeed: number = 1.0;
  private currentPerspective: PerspectiveType = 'alejada_panoramica';
  private targetCameraPos: THREE.Vector3 = new THREE.Vector3(28, 30, 36);
  private targetLookAt: THREE.Vector3 = new THREE.Vector3(2.0, 0.5, 0.5);
  private isTransitioningCamera: boolean = true;

  // Zone labels for 2D screen projection (Exact match to maqueta)
  public zonePositions: { name: string; position: THREE.Vector3 }[] = [
    { name: 'ALMACÉN / SPA', position: new THREE.Vector3(-14.0, 4.8, -11.0) },
    { name: 'SURTIDO / SPA', position: new THREE.Vector3(0.0, 4.2, -0.5) },
    { name: 'LOGÍSTICA / SPA', position: new THREE.Vector3(15.5, 4.8, -9.5) },
    { name: 'CAJA DE COBRO / SPA', position: new THREE.Vector3(-4.5, 3.8, 10.5) },
    { name: 'ATENCIÓN / SPA', position: new THREE.Vector3(-15.0, 3.8, 8.5) },
    { name: 'ENTREGAS / SPA', position: new THREE.Vector3(13.0, 4.4, 9.5) },
    { name: 'DOMICILIO / SPA', position: new THREE.Vector3(25.5, 4.4, 9.5) },
  ];

  constructor(container: HTMLElement, callbacks: SceneCallbacks) {
    this.container = container;
    this.callbacks = callbacks;

    this.isSoftwareGl = (() => {
      const gl = document.createElement('canvas').getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
      alpha: false,
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.18;
    this.renderer.setPixelRatio(this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0a101d);
    this.scene.fog = new THREE.FogExp2(0x0a101d, 0.010);

    // Default Zoomed-Out Panoramic Camera matching reference maqueta
    this.camera = new THREE.PerspectiveCamera(
      36,
      container.clientWidth / container.clientHeight,
      0.5,
      140
    );
    this.camera.position.set(25, 27, 30);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = !this.isSoftwareGl;
    this.controls.dampingFactor = 0.08;
    this.controls.enableRotate = true;
    this.controls.enableZoom = true;
    this.controls.enablePan = true;
    this.controls.zoomSpeed = 1.15;
    this.controls.rotateSpeed = 0.85;
    this.controls.maxPolarAngle = Math.PI / 2 - 0.04;
    this.controls.minDistance = 2.5;
    this.controls.maxDistance = 95;
    this.controls.target.set(0, 0.5, 0);

    // Give user 100% free rotation, free zoom, and free pan the instant they interact!
    this.controls.addEventListener('start', () => {
      this.isTransitioningCamera = false;
    });

    const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    pmremGenerator.dispose();

    this.materials = createDioramaMaterials();
    this.setupLighting();
    this.setupGround();
    this.buildZones();
    this.setupSplines();
    this.buildConveyors();
    this.buildErpNeonDataNetwork();
    this.buildRouteGuides();
    this.buildLandingBeacons();

    this.autoDemoEnabled = Boolean(callbacks.autoDemoLoop);

    if (this.autoDemoEnabled) {
      this.setAutoDemoLoop(true);
    }

    window.addEventListener('resize', this.onResize);
    this.tick = this.tick.bind(this);
    this.startLoop();
  }

  private scheduleSafeTimeout(fn: () => void, delayMs: number) {
    const id = setTimeout(() => {
      this.pendingTimers.delete(id);
      fn();
    }, delayMs);
    this.pendingTimers.add(id);
    return id;
  }

  public setAutoDemoLoop(enabled: boolean) {
    this.autoDemoEnabled = enabled;
    if (this.flowIntervalId) {
      clearInterval(this.flowIntervalId);
      this.flowIntervalId = null;
    }
    if (!enabled) return;

    this.scheduleSafeTimeout(() => {
      if (this.autoDemoEnabled) this.launchAllErpFlows();
    }, 300);

    let autoFlowCycle = 0;
    this.flowIntervalId = setInterval(() => {
      if (!this.isSimulating || !this.autoDemoEnabled) return;
      autoFlowCycle = (autoFlowCycle + 1) % 3;
      if (autoFlowCycle === 0) {
        this.launchPedidoCargaFlow();
      } else if (autoFlowCycle === 1) {
        this.launchPedidoDomicilioFlow();
      } else {
        this.launchPedidoCajaRapidaFlow();
      }
    }, 9000);
  }

  private setupLighting() {
    // Warm key directional light with high-fidelity soft shadows
    const keyLight = new THREE.DirectionalLight(0xfff1e6, 1.95);
    keyLight.position.set(22, 32, 20);
    keyLight.castShadow = !this.isSoftwareGl;
    if (!this.isSoftwareGl) {
      keyLight.shadow.mapSize.width = 2048;
      keyLight.shadow.mapSize.height = 2048;
      keyLight.shadow.camera.near = 2;
      keyLight.shadow.camera.far = 85;
      const d = 32;
      keyLight.shadow.camera.left = -d;
      keyLight.shadow.camera.right = d;
      keyLight.shadow.camera.top = d;
      keyLight.shadow.camera.bottom = -d;
      keyLight.shadow.bias = -0.0004;
      keyLight.shadow.normalBias = 0.02;
    }
    this.scene.add(keyLight);

    // Cool celestial fill light
    const hemiLight = new THREE.HemisphereLight(0x93c5fd, 0x0f172a, 0.95);
    hemiLight.position.set(0, 26, 0);
    this.scene.add(hemiLight);

    // Dedicated zone accent lights
    // Surtido central island spotlight
    const surtidoLight = new THREE.SpotLight(0x38bdf8, 2.4, 24, Math.PI / 4, 0.4);
    surtidoLight.position.set(0, 10, -1);
    surtidoLight.target.position.set(0, 1, -1);
    this.scene.add(surtidoLight);
    this.scene.add(surtidoLight.target);

    // Almacén industrial cyan light
    const warehouseLight = new THREE.PointLight(0x38bdf8, 1.8, 26);
    warehouseLight.position.set(-14.0, 7.5, -11.0);
    this.scene.add(warehouseLight);

    // Logística NOC neon blue light
    const nocLight = new THREE.PointLight(0x0284c7, 2.0, 24);
    nocLight.position.set(15.5, 6.5, -9.5);
    this.scene.add(nocLight);

    // Entregas loading dock safety amber light
    const dockLight = new THREE.PointLight(0xf97316, 2.0, 24);
    dockLight.position.set(13.0, 6.5, 9.5);
    this.scene.add(dockLight);

    // Caja de cobro warm retail spotlight
    const cajaLight = new THREE.PointLight(0x10b981, 1.8, 22);
    cajaLight.position.set(-4.5, 6.0, 10.5);
    this.scene.add(cajaLight);
  }

  private setupGround() {
    // 1. Technical Circuit Grid Floor Plane (Lavender/Navy from reference photo)
    const gridGeo = new THREE.PlaneGeometry(76, 64);
    const gridTex = createCircuitGridFloorTexture();
    const gridMat = new THREE.MeshStandardMaterial({
      map: gridTex,
      roughness: 0.75,
      metalness: 0.2,
    });
    const gridFloor = new THREE.Mesh(gridGeo, gridMat);
    gridFloor.rotation.x = -Math.PI / 2;
    gridFloor.position.set(2.0, 0, 0);
    gridFloor.receiveShadow = true;
    this.scene.add(gridFloor);

    // 2. Interconnecting Glowing Circuit Data Traces connecting the platforms
    const circuitMat = new THREE.MeshStandardMaterial({
      color: 0x06b6d4,
      emissive: 0x38bdf8,
      emissiveIntensity: 0.8,
      roughness: 0.2,
      metalness: 0.5,
    });

    const traces: [number, number, number, number][] = [
      // Surtido -> Almacén
      [0, -0.5, -14.0, -11.0],
      // Surtido -> Logística
      [0, -0.5, 15.5, -9.5],
      // Surtido -> Caja de Cobro
      [0, -0.5, -4.5, 10.5],
      // Surtido -> Entregas Dock
      [0, -0.5, 13.0, 9.5],
      // Surtido -> Atención Bottom-Left
      [0, -0.5, -15.0, 8.5],
      // Surtido -> Atención Upper Mezzanine
      [0, -0.5, 3.0, -14.0],
      // Entregas -> Domicilio
      [13.0, 9.5, 25.5, 9.5],
    ];

    traces.forEach(([x1, z1, x2, z2]) => {
      // Orthogonal PCB trace path (with 90 deg corner elbow)
      const midZ = (z1 + z2) / 2;
      const pts = [
        new THREE.Vector3(x1, 0.02, z1),
        new THREE.Vector3(x1, 0.02, midZ),
        new THREE.Vector3(x2, 0.02, midZ),
        new THREE.Vector3(x2, 0.02, z2),
      ];
      const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal', 0.1);
      const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 32, 0.04, 6, false), circuitMat);
      this.scene.add(tube);

      // Glowing junction disc at connection point
      const nodeGeo = new THREE.CylinderGeometry(0.24, 0.24, 0.02, 16);
      const nodeMesh = new THREE.Mesh(nodeGeo, circuitMat);
      nodeMesh.position.set(x2, 0.025, z2);
      this.scene.add(nodeMesh);
    });
  }

  private buildZones() {
    const industrialTex = createModularPodiumTexture('industrial');
    const officeTex = createModularPodiumTexture('office');
    const islandTex = createModularPodiumTexture('island');
    const asphaltTex = createModularPodiumTexture('asphalt');

    // ─────────────────────────────────────────────────────────────
    // 1. ALMACÉN / SPA (Top-Left Platform with Reverse-Docked Trucks & Mini-Forklift)
    // ─────────────────────────────────────────────────────────────
    const almacenGroup = new THREE.Group();
    almacenGroup.position.set(-14.0, 0, -11.0);

    const almacenPodium = createModularPodium(11.5, 9.5, 0.5, 0.8, industrialTex, 0x0284c7);
    almacenGroup.add(almacenPodium);

    const almacenWalls = createAlmacenWalls();
    almacenWalls.position.y = 0.58;
    almacenGroup.add(almacenWalls);

    // 2 Heavy-duty pallet racks
    const rack1 = createWarehouseRack(this.materials, 6.4, 4.5, 1.4);
    rack1.position.set(0, 0.58, -2.4);
    almacenGroup.add(rack1);

    const rack2 = createWarehouseRack(this.materials, 6.4, 4.5, 1.4);
    rack2.position.set(0, 0.58, 1.2);
    almacenGroup.add(rack2);

    // 3D Stock Billboard above rack 2
    const billboard = createStockGaugeBillboard('Taladro Percutor 20V', 24, 8);
    billboard.group.position.set(0, 5.8, 1.2);
    almacenGroup.add(billboard.group);
    this.stockBillboardUpdater = billboard.update;

    // Standard Warehouse Forklift and Almacenista 1 inside aisles
    this.forkliftGroup = createForklift(this.materials);
    this.forkliftGroup.position.set(2.4, 0.58, -0.6);
    this.forkliftGroup.rotation.y = Math.PI / 2;
    almacenGroup.add(this.forkliftGroup);

    this.picker1_forklift = createHumanFigure(this.materials, 'almacenista');
    this.picker1_forklift.position.set(2.1, 0.58, -0.6);
    this.picker1_forklift.rotation.y = Math.PI / 2;
    almacenGroup.add(this.picker1_forklift);

    // Hand Pallet Truck & Almacenista 2
    this.palletTruckGroup = createHandPalletTruck(this.materials);
    this.palletTruckGroup.position.set(-1.8, 0.58, -0.6);
    almacenGroup.add(this.palletTruckGroup);

    this.picker2_trolley = createHumanFigure(this.materials, 'almacenista', 0x0284c7);
    this.picker2_trolley.position.set(-1.8, 0.58, -1.4);
    almacenGroup.add(this.picker2_trolley);

    // ─────────────────────────────────────────────────────────────
    // CAMIONES DE REVERSA JUNTO AL ALMACÉN (Requested by user)
    // ─────────────────────────────────────────────────────────────
    const truckDockAsphalt = createModularPodium(8.5, 9.5, 0.42, 0.8, asphaltTex, 0x334155);
    truckDockAsphalt.position.set(-9.8, -0.04, 0);
    almacenGroup.add(truckDockAsphalt);

    // Camión 1: Cargo Box Truck estacionado de reversa en el muelle
    const reverseTruck1 = createCargoBoxTruck(this.materials);
    reverseTruck1.position.set(-9.5, 0.5, -2.2);
    reverseTruck1.rotation.y = 0; // Culata de reversa dando hacia la pared de carga del almacén
    almacenGroup.add(reverseTruck1);

    // Camión 2: Delivery Box Truck estacionado de reversa a su lado
    const reverseTruck2 = createDeliveryTruck(this.materials);
    reverseTruck2.position.set(-9.5, 0.5, 2.2);
    reverseTruck2.rotation.y = 0;
    almacenGroup.add(reverseTruck2);

    // Bolardos de seguridad y topes de goma detrás de los camiones
    const bollardMat = this.materials.hazardTape;
    [-4.2, 0, 4.2].forEach((bz) => {
      const bGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.8, 12);
      const bMesh = new THREE.Mesh(bGeo, bollardMat);
      bMesh.position.set(-5.6, 0.85, bz);
      almacenGroup.add(bMesh);
    });

    // ─────────────────────────────────────────────────────────────
    // MONTACARGAS PEQUEÑO JUNTO AL ALMACÉN (Requested by user)
    // ─────────────────────────────────────────────────────────────
    const miniForklift = createForklift(this.materials);
    miniForklift.scale.setScalar(0.65); // Montacargas compacto pequeño
    miniForklift.position.set(-4.8, 0.58, -0.2);
    miniForklift.rotation.y = -Math.PI / 2; // Orientado hacia la bahía de descarga
    almacenGroup.add(miniForklift);

    // Mini palet de madera sobre las uñas del montacargas pequeño
    const miniPallet = createWoodenPallet(this.materials, 1.2, 0.1, 0.8);
    miniPallet.position.set(-4.1, 0.82, -0.2);
    almacenGroup.add(miniPallet);

    // Mini bultos de carga sobre el palet
    const miniBox1 = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.3, 0.35), this.materials.cardboard);
    miniBox1.position.set(-4.1, 1.05, -0.2);
    almacenGroup.add(miniBox1);

    // Operador del montacargas pequeño
    const miniForkliftDriver = createHumanFigure(this.materials, 'almacenista', 0x0284c7);
    miniForkliftDriver.scale.setScalar(0.85);
    miniForkliftDriver.position.set(-4.8, 0.65, -0.2);
    miniForkliftDriver.rotation.y = -Math.PI / 2;
    almacenGroup.add(miniForkliftDriver);

    this.scene.add(almacenGroup);

    // ─────────────────────────────────────────────────────────────
    // 2. ATENCIÓN / SPA (Top-Center / Upper Mezzanine Platform)
    // ─────────────────────────────────────────────────────────────
    const atencionTopGroup = new THREE.Group();
    atencionTopGroup.position.set(3.0, 0, -14.0);

    const atencionTopPodium = createModularPodium(6.2, 5.0, 0.5, 0.8, officeTex, 0x38bdf8);
    atencionTopGroup.add(atencionTopPodium);

    const deskTop = createAtencionDesk(this.materials);
    deskTop.position.set(0, 0.58, -0.2);
    atencionTopGroup.add(deskTop);

    this.scene.add(atencionTopGroup);

    // ─────────────────────────────────────────────────────────────
    // 3. LOGÍSTICA / SPA (Top-Right Operations Control Room / NOC)
    // ─────────────────────────────────────────────────────────────
    const logisticaGroup = new THREE.Group();
    logisticaGroup.position.set(15.5, 0, -9.5);

    const logisticaPodium = createModularPodium(9.5, 7.5, 0.5, 0.8, officeTex, 0x0284c7);
    logisticaGroup.add(logisticaPodium);

    const nocControl = createLogisticsControlRoom(this.materials);
    nocControl.position.set(0, 0.58, 0.4);
    logisticaGroup.add(nocControl);

    // 3D Bunkker ERP Digital Control Board Scoreboard
    const bunkkerBoard = createBunkkerControlBoardMesh(this.materials);
    bunkkerBoard.position.set(-1.8, 0.58, -1.2);
    bunkkerBoard.rotation.y = Math.PI / 4;
    logisticaGroup.add(bunkkerBoard);
    this.bunkkerControlBoard = bunkkerBoard;

    this.scene.add(logisticaGroup);

    // ─────────────────────────────────────────────────────────────
    // 4. SURTIDO / SPA (Center Island - Elevated Plinth)
    // ─────────────────────────────────────────────────────────────
    const surtidoGroup = new THREE.Group();
    surtidoGroup.position.set(0.0, 0, -0.5);

    const surtidoPodium = createModularPodium(9.8, 7.0, 0.7, 0.9, islandTex, 0x06b6d4);
    surtidoGroup.add(surtidoPodium);

    const surtidoStations = createSurtidoWorkstations(this.materials);
    surtidoStations.position.set(0, 0.78, 0);
    surtidoGroup.add(surtidoStations);

    this.scene.add(surtidoGroup);

    // ─────────────────────────────────────────────────────────────
    // 5. CAJA DE COBRO / SPA (Bottom-Center-Left Retail POS)
    // ─────────────────────────────────────────────────────────────
    const cajaGroup = new THREE.Group();
    cajaGroup.position.set(-4.5, 0, 10.5);

    const cajaPodium = createModularPodium(7.5, 6.5, 0.5, 0.8, officeTex, 0x10b981);
    cajaGroup.add(cajaPodium);

    const cajaStation = createCajaCobroStation(this.materials);
    cajaStation.position.set(0, 0.58, -0.4);
    cajaGroup.add(cajaStation);

    // Capture cashier and customer figures for counter animations
    cajaStation.children.forEach((child) => {
      if (child.userData.cashier && !this.cashier1) {
        this.cashier1 = child.userData.cashier;
      }
      if (child.userData.client && !this.client1_counter) {
        this.client1_counter = child.userData.client;
      }
    });

    this.scene.add(cajaGroup);

    // ─────────────────────────────────────────────────────────────
    // 6. ATENCIÓN / SPA (Bottom-Left Customer Service Station)
    // ─────────────────────────────────────────────────────────────
    const atencionBtmGroup = new THREE.Group();
    atencionBtmGroup.position.set(-15.0, 0, 8.5);

    const atencionBtmPodium = createModularPodium(6.5, 5.5, 0.5, 0.8, officeTex, 0x38bdf8);
    atencionBtmGroup.add(atencionBtmPodium);

    const deskBtm = createAtencionDesk(this.materials);
    deskBtm.position.set(0, 0.58, -0.2);
    atencionBtmGroup.add(deskBtm);

    // Customer holding smartphone with illuminated screen and pulsing Wi-Fi beacon
    this.clientPhoneFigure = createCustomerWithPhoneMesh(this.materials);
    this.clientPhoneFigure.position.set(1.4, 0.58, 0.8);
    this.clientPhoneFigure.rotation.y = -Math.PI / 3;
    atencionBtmGroup.add(this.clientPhoneFigure);

    this.scene.add(atencionBtmGroup);

    // ─────────────────────────────────────────────────────────────
    // 7. ENTREGAS / SPA (Bottom-Right Dispatch Loading Dock)
    // ─────────────────────────────────────────────────────────────
    const entregasGroup = new THREE.Group();
    entregasGroup.position.set(13.0, 0, 9.5);

    const entregasPodium = createModularPodium(10.5, 8.5, 0.5, 0.8, asphaltTex, 0xf97316);
    entregasGroup.add(entregasPodium);

    const entregasDock = createEntregasDock(this.materials);
    entregasDock.position.set(0, 0.58, 0);
    entregasGroup.add(entregasDock);

    // Cargo & Loading Operator figure
    this.cargoOperator = createHumanFigure(this.materials, 'despachador', 0xeab308);
    this.cargoOperator.position.set(-1.6, 0.58, 1.2);
    this.cargoOperator.rotation.y = Math.PI / 4;
    entregasGroup.add(this.cargoOperator);

    this.scene.add(entregasGroup);

    // ─────────────────────────────────────────────────────────────
    // 8. DOMICILIO / SPA (Home Delivery - Porch & Bateo Residencial)
    // ─────────────────────────────────────────────────────────────
    const domicilioGroup = createDomicilioPodium(this.materials);
    domicilioGroup.position.set(25.5, 0, 9.5);
    this.client4_home = (domicilioGroup.userData.clientHome as THREE.Group) || null;
    this.scene.add(domicilioGroup);

    // ─────────────────────────────────────────────────────────────
    // 9. GLOBOS DE ETIQUETAS FLOTANTES Y ANIMADOS (Diagrama de Flujo Bunkker)
    // ─────────────────────────────────────────────────────────────
    const balloonConfigs = [
      { title: 'almacén / inventariado', color: '#00f0ff', x: -14.0, y: 5.8, z: -10.0, sw: 4.6, sh: 1.3 },
      { title: 'entrada stok', color: '#facc15', x: -19.5, y: 4.2, z: -4.5, sw: 3.2, sh: 0.95 },
      { title: 'catalogo virtual', color: '#06b6d4', x: -15.0, y: 5.0, z: 8.5, sw: 3.8, sh: 1.15 },
      { title: 'CAJA DE COBRO', color: '#10b981', x: -4.5, y: 5.0, z: 10.5, sw: 3.8, sh: 1.15 },
      { title: 'cobro entrega', color: '#2dd4bf', x: -1.0, y: 3.8, z: 5.5, sw: 3.0, sh: 0.95 },
      { title: 'pedido y recoleccion', color: '#38bdf8', x: 0.0, y: 5.4, z: -0.5, sw: 4.5, sh: 1.25 },
      { title: 'CARGA / pick-up', color: '#00f2fe', x: 13.0, y: 5.2, z: 9.5, sw: 4.2, sh: 1.2 },
      { title: 'entrega', color: '#0284c7', x: 8.5, y: 3.8, z: 7.0, sw: 2.6, sh: 0.85 },
      { title: 'recoleccion repartidores', color: '#818cf8', x: 15.5, y: 5.6, z: -9.5, sw: 4.8, sh: 1.3 },
    ];

    balloonConfigs.forEach((cfg) => {
      const badge = createFloatingBalloonBadge(cfg.title, cfg.color, cfg.y, cfg.sw, cfg.sh);
      badge.group.position.set(cfg.x, cfg.y, cfg.z);
      this.scene.add(badge.group);
      this.floatingZoneBadges.push(badge);
    });
  }

  private setupSplines() {
    // 1. Path to Caja de Cobro / Mostrador & Bateo en Caja
    this.localCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-14.0, 2.5, -10.5), // Starts high in Almacén racks (preparador)
      new THREE.Vector3(-9.5, 2.05, -6.8),  // Conveyor bridge over wide floor
      new THREE.Vector3(-4.8, 1.65, -3.2),  // Surtido infeed
      new THREE.Vector3(0.0, 1.48, -0.5),   // Surtido sorting hub
      new THREE.Vector3(-1.8, 1.38, 3.8),   // Conveyor bridge towards Caja
      new THREE.Vector3(-3.2, 1.25, 7.5),   // Approaching checkout counter
      new THREE.Vector3(-4.5, 1.15, 10.0),  // Slides into BATEO EN CAJA!
    ]);
    this.localCurve.curveType = 'catmullrom';
    this.localCurve.tension = 0.35;

    // 2. Path to Entregas Dock & Domicilio Porch Bateo
    this.deliveryCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-14.0, 2.5, -9.5),  // Starts in Almacén racks (preparador)
      new THREE.Vector3(-9.5, 2.05, -6.0),  // Main picking conveyor
      new THREE.Vector3(-4.8, 1.65, -3.0),  // Surtido infeed
      new THREE.Vector3(0.0, 1.48, -0.5),   // Packaged & sealed at Surtido
      new THREE.Vector3(4.8, 1.40, 2.8),    // Conveyor bridge towards Entregas
      new THREE.Vector3(9.2, 1.30, 6.5),    // Entregas loading bay infeed
      new THREE.Vector3(13.0, 1.25, 9.5),   // Dock dispatch / transfer
      new THREE.Vector3(17.2, 1.20, 9.5),   // Express residential conveyor bridge
      new THREE.Vector3(21.5, 1.12, 9.5),   // Entering suburban yard
      new THREE.Vector3(25.0, 1.05, 9.5),   // Lands right on BATEO EN DOMICILIO!
    ]);
    this.deliveryCurve.curveType = 'catmullrom';
    this.deliveryCurve.tension = 0.35;

    // 3. Inbound Path: Inbound cargo from reverse-parked trucks into Almacén Racks
    this.inboundCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-19.5, 1.20, -10.5), // Reverse-docked truck loading bay
      new THREE.Vector3(-16.8, 1.55, -10.5), // Inbound dock staging & lift
      new THREE.Vector3(-14.0, 2.65, -10.5), // High shelf placement in Almacén
    ]);
    this.inboundCurve.curveType = 'catmullrom';
    this.inboundCurve.tension = 0.35;
  }

  /**
   * BUILD CONTINUOUS PHYSICAL 3D CONVEYOR BELT SYSTEMS (BANDAS TRANSPORTADORAS)
   * Connects Almacén -> Surtido -> Caja Counter (Bateo en Caja)
   * and Surtido -> Entregas -> Domicilio Porch (Bateo en Domicilio).
   */
  private buildConveyors() {
    // 1. Conveyor Line 1: ALMACÉN Picking Station -> SURTIDO Central Hub
    const convAlmacenToSurtido = createCurvedConveyorTrack(
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(-14.0, 2.5, -10.0),
        new THREE.Vector3(-9.5, 2.05, -6.4),
        new THREE.Vector3(-4.8, 1.65, -3.1),
        new THREE.Vector3(0.0, 1.48, -0.5),
      ]),
      this.materials,
      {
        width: 0.68,
        railColor: 0x0284c7,
        edgeGlowColor: 0x38bdf8,
        rollerSpacing: 0.32,
        withScanner: true,
        scannerT: 0.35,
        scannerLabel: 'SCANNER 01 - RECOLECCIÓN',
        scannerColor: 0x06b6d4,
      }
    );
    this.scene.add(convAlmacenToSurtido);

    // 2. Conveyor Line 2: SURTIDO Hub -> CAJA DE COBRO Counter
    const convSurtidoToCaja = createCurvedConveyorTrack(
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(0.0, 1.48, -0.5),
        new THREE.Vector3(-1.8, 1.38, 3.8),
        new THREE.Vector3(-3.2, 1.25, 7.5),
        new THREE.Vector3(-4.5, 1.15, 10.0),
      ]),
      this.materials,
      {
        width: 0.68,
        railColor: 0x10b981,
        edgeGlowColor: 0x34d399,
        rollerSpacing: 0.32,
        withScanner: true,
        scannerT: 0.48,
        scannerLabel: 'SCANNER 02 - CAJA POS',
        scannerColor: 0x10b981,
        hasEndChute: true,
        endChuteLabel: 'BATEO EN CAJA',
      }
    );
    this.scene.add(convSurtidoToCaja);

    // 3. Conveyor Line 3: SURTIDO Hub -> ENTREGAS Dock Dispatch Bay
    const convSurtidoToEntregas = createCurvedConveyorTrack(
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(0.0, 1.48, -0.5),
        new THREE.Vector3(4.8, 1.40, 2.8),
        new THREE.Vector3(9.2, 1.30, 6.5),
        new THREE.Vector3(13.0, 1.25, 9.5),
      ]),
      this.materials,
      {
        width: 0.68,
        railColor: 0xf97316,
        edgeGlowColor: 0xfb923c,
        rollerSpacing: 0.32,
        withScanner: true,
        scannerT: 0.50,
        scannerLabel: 'SCANNER 03 - DESPACHO',
        scannerColor: 0xf97316,
      }
    );
    this.scene.add(convSurtidoToEntregas);

    // 4. Conveyor Line 4: ENTREGAS Dock -> DOMICILIO Porch ("BATEO EN DOMICILIO")
    const convEntregasToDomicilio = createCurvedConveyorTrack(
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(13.0, 1.25, 9.5),
        new THREE.Vector3(17.2, 1.20, 9.5),
        new THREE.Vector3(21.5, 1.12, 9.5),
        new THREE.Vector3(25.0, 1.05, 9.5),
      ]),
      this.materials,
      {
        width: 0.68,
        railColor: 0xf59e0b,
        edgeGlowColor: 0xfbbf24,
        rollerSpacing: 0.32,
        withScanner: true,
        scannerT: 0.45,
        scannerLabel: 'SCANNER 04 - DOMICILIO',
        scannerColor: 0xf59e0b,
        hasEndChute: true,
        endChuteLabel: 'BATEO EN DOMICILIO',
      }
    );
    this.scene.add(convEntregasToDomicilio);

    // 5. Conveyor Line 5: Inbound Reverse Truck Unloading -> Almacén Racks
    const convInbound = createCurvedConveyorTrack(
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(-19.5, 1.20, -10.5),
        new THREE.Vector3(-16.8, 1.55, -10.5),
        new THREE.Vector3(-14.0, 2.65, -10.5),
      ]),
      this.materials,
      {
        width: 0.65,
        railColor: 0x06b6d4,
        edgeGlowColor: 0x38bdf8,
        rollerSpacing: 0.35,
      }
    );
    this.scene.add(convInbound);
  }

  /**
   * BUILD HIGH-VISIBILITY GLOWING 3D FLOOR ROUTE GUIDES
   */
  private buildRouteGuides() {
    const routesConfig: {
      destination: BoxDestination;
      curve: THREE.CatmullRomCurve3;
      color: number;
      label: string;
    }[] = [
      { destination: 'caja', curve: this.localCurve, color: 0x10b981, label: 'RUTA VERDE: CAJA DE COBRO' },
      { destination: 'domicilio', curve: this.deliveryCurve, color: 0xf97316, label: 'RUTA NARANJA: ENTREGAS' },
      { destination: 'carga', curve: this.inboundCurve, color: 0x06b6d4, label: 'RUTA CIAN: ALMACÉN' },
    ];

    routesConfig.forEach((cfg) => {
      const group = new THREE.Group();

      // Glowing route spline tube
      const tubeGeo = new THREE.TubeGeometry(cfg.curve, 80, 0.034, 8, false);
      const tubeMat = new THREE.MeshStandardMaterial({
        color: cfg.color,
        emissive: cfg.color,
        emissiveIntensity: 0.9,
        roughness: 0.25,
        metalness: 0.3,
        transparent: true,
        opacity: 0.85,
      });
      const tubeMesh = new THREE.Mesh(tubeGeo, tubeMat);
      group.add(tubeMesh);

      // Floor projected guide line
      const points = cfg.curve.getPoints(50);
      const floorPoints = points.map((p) => new THREE.Vector3(p.x, 0.03, p.z));
      const floorGeo = new THREE.BufferGeometry().setFromPoints(floorPoints);
      const floorMat = new THREE.LineBasicMaterial({
        color: cfg.color,
        transparent: true,
        opacity: 0.75,
      });
      const floorLine = new THREE.Line(floorGeo, floorMat);
      group.add(floorLine);

      // Moving glowing energy pulse bead along curve
      const beadGeo = new THREE.SphereGeometry(0.12, 16, 16);
      const beadMat = new THREE.MeshBasicMaterial({
        color: cfg.color,
        transparent: true,
        opacity: 0.95,
      });
      const pulseBead = new THREE.Mesh(beadGeo, beadMat);
      const startPt = cfg.curve.getPointAt(0);
      pulseBead.position.copy(startPt);
      group.add(pulseBead);

      this.scene.add(group);
      this.routeGuides.push({
        destination: cfg.destination,
        group,
        pulseBead,
        curve: cfg.curve,
      });
    });
  }

  /**
   * BUILD PERMANENT DESTINATION LANDING TARGET BEACONS
   */
  private buildLandingBeacons() {
    const beaconsConfig: {
      destination: BoxDestination;
      pos: THREE.Vector3;
      color: number;
      hexString: string;
      label: string;
    }[] = [
      {
        destination: 'caja',
        pos: new THREE.Vector3(-4.5, 0.58, 10.0),
        color: 0x10b981,
        hexString: '#10b981',
        label: '🟢 DESTINO: BATEO EN CAJA',
      },
      {
        destination: 'domicilio',
        pos: new THREE.Vector3(25.0, 0.58, 9.5),
        color: 0xf97316,
        hexString: '#f97316',
        label: '🟠 DESTINO: BATEO EN DOMICILIO',
      },
      {
        destination: 'carga',
        pos: new THREE.Vector3(-14.0, 0.58, -10.5),
        color: 0x06b6d4,
        hexString: '#06b6d4',
        label: '🔵 DESTINO: ALMACÉN / RACKS',
      },
    ];

    beaconsConfig.forEach((b) => {
      const group = new THREE.Group();
      group.position.copy(b.pos);

      // Circular floor target pad
      const padGeo = new THREE.CircleGeometry(0.9, 32);
      const padMat = new THREE.MeshBasicMaterial({
        color: b.color,
        transparent: true,
        opacity: 0.25,
        side: THREE.DoubleSide,
      });
      const pad = new THREE.Mesh(padGeo, padMat);
      pad.rotation.x = -Math.PI / 2;
      group.add(pad);

      // Outer rotating ring
      const outerRingGeo = new THREE.RingGeometry(0.8, 0.95, 32);
      const outerRingMat = new THREE.MeshBasicMaterial({
        color: b.color,
        transparent: true,
        opacity: 0.9,
        side: THREE.DoubleSide,
      });
      const outerRing = new THREE.Mesh(outerRingGeo, outerRingMat);
      outerRing.rotation.x = -Math.PI / 2;
      group.add(outerRing);

      // Inner ring
      const innerRingGeo = new THREE.RingGeometry(0.38, 0.48, 24);
      const innerRingMat = new THREE.MeshBasicMaterial({
        color: b.color,
        transparent: true,
        opacity: 0.95,
        side: THREE.DoubleSide,
      });
      const innerRing = new THREE.Mesh(innerRingGeo, innerRingMat);
      innerRing.rotation.x = -Math.PI / 2;
      group.add(innerRing);

      // Upward vertical holographic light pillar
      const beamGeo = new THREE.CylinderGeometry(0.05, 0.65, 2.4, 16, 1, true);
      const beamMat = new THREE.MeshBasicMaterial({
        color: b.color,
        transparent: true,
        opacity: 0.38,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const lightPillar = new THREE.Mesh(beamGeo, beamMat);
      lightPillar.position.y = 1.2;
      group.add(lightPillar);

      // Floating Holographic Signpost
      const canvas = document.createElement('canvas');
      canvas.width = 400;
      canvas.height = 96;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = 'rgba(10, 15, 29, 0.92)';
      if (ctx.roundRect) ctx.roundRect(4, 4, 392, 88, 16);
      else ctx.rect(4, 4, 392, 88);
      ctx.fill();
      ctx.strokeStyle = b.hexString;
      ctx.lineWidth = 5;
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.font = '900 18px "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(b.label, 200, 48);

      const signTex = new THREE.CanvasTexture(canvas);
      signTex.colorSpace = THREE.SRGBColorSpace;
      const signMat = new THREE.SpriteMaterial({
        map: signTex,
        transparent: true,
        depthTest: false,
      });
      const signSprite = new THREE.Sprite(signMat);
      signSprite.position.set(0, 2.4, 0);
      signSprite.scale.set(2.5, 0.65, 1.0);
      group.add(signSprite);

      this.scene.add(group);
      this.landingBeacons.push({
        destination: b.destination,
        group,
        outerRing,
        innerRing,
        lightPillar,
      });
    });
  }

  /**
   * BUILD ELEVATED PARABOLIC NEON DATA ARCS (ERP BUNKKER LOCAL WI-FI NETWORK)
   * High-arching glowing neon tubes with animated pulse beads and Wi-Fi signal routing.
   */
  public buildErpNeonDataNetwork() {
    // Key station 3D world coordinates
    const clientePos = new THREE.Vector3(-15.0, 1.8, 8.5);
    const bunkkerPos = new THREE.Vector3(15.5, 3.8, -9.5);
    const almacenPos = new THREE.Vector3(-14.0, 3.2, -11.0);
    const surtidoPos = new THREE.Vector3(0.0, 2.2, -0.5);
    const cajaPos = new THREE.Vector3(-4.5, 2.2, 10.5);
    const cargaPos = new THREE.Vector3(13.0, 2.2, 9.5);
    const domicilioPos = new THREE.Vector3(25.0, 2.0, 9.5);
    const stockInPos = new THREE.Vector3(-19.5, 2.0, -4.5);
    const cobroEntregaPos = new THREE.Vector3(-1.0, 2.0, 5.5);

    // Conexiones de alta diferenciación cromática según los 4 flujos circulatorios del diagrama
    const arcsConfig = [
      // 1. Entrada de Stock (Amarillo Neón)
      { id: 'stock-alm', start: stockInPos, end: almacenPos, height: 4.8, color: 0xfacc15, label: '📦 ENTRADA STOCK' },
      // 2. Rutas Púrpuras: Catálogo -> Almacén -> Logística / Repartidores -> Ruta
      { id: 'cli-alm-purple', start: clientePos, end: almacenPos, height: 7.2, color: 0xa855f7, label: '🌐 CATÁLOGO VIRTUAL' },
      { id: 'alm-bunkker-purple', start: almacenPos, end: bunkkerPos, height: 7.8, color: 0x8b5cf6, label: '📊 LOGÍSTICA & TELEMETRÍA' },
      { id: 'bunkker-dom-purple', start: bunkkerPos, end: domicilioPos, height: 6.8, color: 0x7c3aed, label: '🛵 RECOLECCIÓN REPARTIDORES' },
      // 3. Rutas Rojas: Pedido, recolección y transferencia a Carga / Pick-up
      { id: 'caja-alm-red', start: cajaPos, end: almacenPos, height: 6.5, color: 0xef4444, label: '⚡ AUTORIZACIÓN & ORDEN' },
      { id: 'alm-surtido-red', start: almacenPos, end: surtidoPos, height: 5.2, color: 0xf43f5e, label: '🛒 PEDIDO Y RECOLECCIÓN' },
      { id: 'surtido-carga-red', start: surtidoPos, end: cargaPos, height: 5.5, color: 0xe11d48, label: '🚚 CARGA / PICK-UP' },
      { id: 'bunkker-carga-red', start: bunkkerPos, end: cargaPos, height: 6.8, color: 0xd946ef, label: '📋 AUTORIZACIÓN DESPACHO' },
      // 4. Rutas Verdes: Pago en caja, transferencia y entrega final
      { id: 'cli-caja-green', start: clientePos, end: cajaPos, height: 3.8, color: 0x10b981, label: '💳 CAJA DE COBRO' },
      { id: 'caja-surtido-green', start: cajaPos, end: cobroEntregaPos, height: 4.2, color: 0x22c55e, label: '💵 COBRO ENTREGA' },
      { id: 'surtido-carga-green', start: cobroEntregaPos, end: cargaPos, height: 4.6, color: 0x14b8a6, label: '📦 ENTREGA LISTA' },
    ];

    arcsConfig.forEach((cfg) => {
      const beam = createNeonDataArcBeam(cfg.start, cfg.end, cfg.height, cfg.color, cfg.label);
      this.scene.add(beam.group);
      this.erpBeams.push({
        id: cfg.id,
        group: beam.group,
        curve: beam.curve,
        pulseBead: beam.pulseBead,
      });
    });

    // Initial ERP list starts empty until hydrated by real BUNKKER state (or demo mode)
    this.erpOrders = [];
    this.callbacks.onErpOrdersUpdate?.([]);
  }

  private getZoneWorldPosition(zone: TwinZoneKey): THREE.Vector3 {
    switch (zone) {
      case 'cliente':
        return new THREE.Vector3(-15.0, 1.8, 8.5);
      case 'bunkker':
        return new THREE.Vector3(15.5, 3.8, -9.5);
      case 'almacen':
        return new THREE.Vector3(-14.0, 3.2, -11.0);
      case 'surtido':
        return new THREE.Vector3(0.0, 2.2, -0.5);
      case 'caja':
        return new THREE.Vector3(-4.5, 2.2, 10.5);
      case 'carga':
        return new THREE.Vector3(-14.0, 2.2, -10.5);
      case 'entregas':
        return new THREE.Vector3(13.0, 2.2, 9.5);
      case 'domicilio':
        return new THREE.Vector3(25.0, 2.0, 9.5);
      case 'stockIn':
        return new THREE.Vector3(-19.5, 2.0, -4.5);
    }
  }

  public syncRealErpState(snapshot: TwinSnapshot, syncSubtitle?: string) {
    this.erpOrders = [...snapshot.erpOrders];
    this.realBoardRows = snapshot.controlBoardRows;
    if (syncSubtitle) {
      this.syncBoardSubtitle = syncSubtitle;
    }

    if (snapshot.featuredStock) {
      this.updateStockGauge(
        snapshot.featuredStock.name,
        snapshot.featuredStock.stock,
        snapshot.featuredStock.minStock
      );
    }

    this.callbacks.onErpOrdersUpdate?.([...this.erpOrders]);
    this.syncBunkkerControlBoard();
  }

  public triggerRealFlowImpulse(impulse: TwinFlowImpulse) {
    const signals = impulse.signals || [];
    signals.forEach((sig, index) => {
      const spawnFn = () => {
        this.spawnErpSignalPacket(
          this.getZoneWorldPosition(sig.fromZone),
          this.getZoneWorldPosition(sig.toZone),
          sig.arcHeight,
          sig.emoji,
          sig.label,
          sig.colorHex,
          sig.speed ?? 0.55
        );
      };
      if (index === 0) {
        spawnFn();
      } else {
        this.scheduleSafeTimeout(spawnFn, index * 480);
      }
    });

    if (impulse.box) {
      this.launchBox(
        impulse.box.destination,
        impulse.box.productName,
        impulse.box.trackingId,
        impulse.box.category,
        true
      );
    }

    if (impulse.openDrawer && this.storeGroup?.userData.setDrawerOpen) {
      this.storeGroup.userData.setDrawerOpen(1.0);
      this.scheduleSafeTimeout(() => {
        this.storeGroup?.userData.setDrawerOpen?.(0);
      }, 2200);
    }

    if (impulse.openDock && this.dockGroup?.userData.setDoorOpen) {
      this.dockGroup.userData.setDoorOpen(1.0);
    }

    if (impulse.celebration) {
      this.spawnCelebrationMilestone(
        impulse.celebration.destination,
        impulse.celebration.productName,
        impulse.celebration.trackingId,
        this.getZoneWorldPosition(impulse.celebration.zone)
      );
    }

    if (impulse.stockEvent) {
      this.callbacks.onStockEvent?.(
        impulse.stockEvent.type,
        impulse.stockEvent.destination,
        impulse.stockEvent.locationName,
        impulse.stockEvent.trackingId,
        impulse.stockEvent.productName
      );
    }

    if (impulse.sound) {
      this.callbacks.onSoundTrigger(impulse.sound);
    }
  }

  /**
   * SPAWN 3D ERP NEON DATA SIGNAL PACKET
   * Glowing badge with emoji & text that glides along an elevated parabolic arc.
   */
  public spawnErpSignalPacket(
    start: THREE.Vector3,
    end: THREE.Vector3,
    arcHeight: number,
    emoji: string,
    label: string,
    colorHex: string = '#00f0ff',
    speed: number = 0.45,
    onComplete?: () => void
  ) {
    const midX = (start.x + end.x) / 2;
    const midZ = (start.z + end.z) / 2;
    const midY = Math.max(start.y, end.y) + arcHeight;

    const curve = new THREE.CatmullRomCurve3([
      start.clone(),
      new THREE.Vector3(midX, midY, midZ),
      end.clone(),
    ]);

    const sprite = createDataPacketSprite(emoji, label, colorHex);
    sprite.position.copy(start);
    this.scene.add(sprite);

    const packet = {
      id: 'pkt-' + Math.random().toString(36).substring(2, 8),
      sprite,
      curve,
      progress: 0,
      speed,
      onComplete,
    };
    (this.activeSignalPackets as any).push(packet);
    this.callbacks.onSoundTrigger('scan');
  }

  public upsertErpOrder(order: ErpOrder) {
    const idx = this.erpOrders.findIndex((o) => o.id === order.id);
    if (idx >= 0) {
      this.erpOrders[idx] = { ...this.erpOrders[idx], ...order };
    } else {
      this.erpOrders.push(order);
    }
    this.callbacks.onErpOrdersUpdate?.([...this.erpOrders]);
    this.syncBunkkerControlBoard();
  }

  public updateErpOrderStatus(
    orderId: string,
    status: ErpOrderStatus,
    stepDescription: string,
    progress: number,
    activeSignalEmoji?: string
  ) {
    const order = this.erpOrders.find((o) => o.id === orderId);
    if (order) {
      order.status = status;
      order.stepDescription = stepDescription;
      order.progress = progress;
      if (activeSignalEmoji) order.activeSignalEmoji = activeSignalEmoji;
      order.timestamp = Date.now();
      this.callbacks.onErpOrdersUpdate?.([...this.erpOrders]);
      this.syncBunkkerControlBoard();
    }
  }

  private syncBunkkerControlBoard() {
    if (this.realBoardRows && this.bunkkerControlBoard?.userData.updateRealBoard) {
      this.bunkkerControlBoard.userData.updateRealBoard(
        this.realBoardRows,
        this.syncBoardSubtitle
      );
      return;
    }

    if (this.bunkkerControlBoard?.userData.updateBoard) {
      const getStatusLabel = (id: string, def: string) => {
        const ord = this.erpOrders.find((o) => o.id === id);
        if (!ord) return def;
        switch (ord.status) {
          case 'pendiente': return 'PENDIENTE';
          case 'preparando': return 'PREPARANDO';
          case 'listo_para_cobro': return 'PASE A CAJA';
          case 'en_ruta': return 'EN RUTA';
          case 'en_carga': return 'EN CARGA';
          case 'completado_ok': return 'ENTREGADO OK';
          default: return (ord.status as string).toUpperCase();
        }
      };
      this.bunkkerControlBoard.userData.updateBoard(
        getStatusLabel('ORD-01', 'PREPARANDO'),
        getStatusLabel('ORD-02', 'EN RUTA'),
        getStatusLabel('ORD-03', 'ENTREGADO OK')
      );
    }
  }

  /**
   * FLUJO 1: PEDIDO EN CARGA / PATIO (Celular -> Almacén -> Notif Caja -> Pago -> Carga OK)
   */
  public launchPedidoCargaFlow() {
    const clientePos = new THREE.Vector3(-15.0, 1.8, 8.5);
    const bunkkerPos = new THREE.Vector3(15.5, 3.8, -9.5);
    const almacenPos = new THREE.Vector3(-14.0, 3.2, -11.0);
    const cajaPos = new THREE.Vector3(-4.5, 2.2, 10.5);
    const cargaPos = new THREE.Vector3(-14.0, 2.2, -10.5);

    // Initial state
    this.upsertErpOrder({
      id: 'ORD-01',
      orderNumber: 'PED-01',
      flowType: 1,
      channelName: 'Carga / Patio',
      productName: 'Cemento Portland 50kg',
      status: 'preparando',
      stepDescription: '1/5: Cliente levanta pedido desde celular hacia ERP Bunkker.',
      progress: 0.2,
      timestamp: Date.now(),
      ticketNumber: 'TK-' + Math.floor(1000 + Math.random() * 9000),
      signatureCaptured: false,
      activeSignalEmoji: '📲',
    });

    // Step 1: Client phone -> Bunkker NOC (Verde Lima Neón)
    this.spawnErpSignalPacket(clientePos, bunkkerPos, 6.8, '📱', '1. AUTO-PEDIDO QR', '#84cc16', 0.5, () => {
      // Step 2: Bunkker -> Almacén (Turquesa Bodega)
      this.updateErpOrderStatus('ORD-01', 'preparando', '2/5: Bunkker asigna a Almacén. Preparando bultos en racks.', 0.4, '📦');
      this.spawnErpSignalPacket(bunkkerPos, almacenPos, 6.2, '📦', '3. SURTIDO EN ESTANTES', '#06b6d4', 0.5, () => {
        // Physical box launched on conveyor towards dock/carga
        this.launchBox('carga', 'Cemento Portland 50kg', '#ORD-01', 'Carga Pesada & Obra');

        // Step 3: Almacén -> Carga + Notification to Client Phone (Ámbar)
        setTimeout(() => {
          this.updateErpOrderStatus('ORD-01', 'listo_para_cobro', '3/5: Pedido listo en Carga. Notificación al cliente: pase a pagar en Caja.', 0.65, '🔔');
          this.spawnErpSignalPacket(cargaPos, clientePos, 6.0, '🔔', 'NOTIF: PASE A CAJA', '#fbbf24', 0.5, () => {
            // Step 4: Client goes to Caja & Pays (Verde Validación)
            setTimeout(() => {
              this.updateErpOrderStatus('ORD-01', 'en_carga', '4/5: Cliente paga en Caja. Caja emite ticket y valida en ERP.', 0.85, '💳');
              this.callbacks.onSoundTrigger('cash');
              this.spawnErpSignalPacket(cajaPos, cargaPos, 5.6, '🧾', 'TICKET & COBRO VALIDADO', '#22c55e', 0.5, () => {
                // Step 5: Cargo Operator validates ticket & hands over goods
                this.updateErpOrderStatus('ORD-01', 'completado_ok', '5/5: Operador de carga entrega mercancía en patio. Pedido cerrado en OK.', 1.0, '✅');
                this.spawnCelebrationMilestone('carga', 'Cemento Portland 50kg', '#ORD-01', cargaPos);
                this.callbacks.onSoundTrigger('success');
              });
            }, 800);
          });
        }, 1200);
      });
    });
  }

  /**
   * FLUJO 2: PEDIDO A DOMICILIO (Bunkker -> Repartidor prepara -> En ruta -> Domicilio -> Firma digital OK)
   */
  public launchPedidoDomicilioFlow() {
    const clientePos = new THREE.Vector3(-15.0, 1.8, 8.5);
    const bunkkerPos = new THREE.Vector3(15.5, 3.8, -9.5);
    const almacenPos = new THREE.Vector3(-14.0, 3.2, -11.0);
    const entregasPos = new THREE.Vector3(13.0, 2.2, 9.5);
    const domicilioPos = new THREE.Vector3(25.0, 2.0, 9.5);

    // Initial state: Pendiente
    this.upsertErpOrder({
      id: 'ORD-02',
      orderNumber: 'PED-02',
      flowType: 2,
      channelName: 'Domicilio',
      productName: 'Taladro Percutor 20V',
      status: 'pendiente',
      stepDescription: '1/4: Pedido registrado en Bunkker en estado Pendiente.',
      progress: 0.15,
      timestamp: Date.now(),
      ticketNumber: 'TK-' + Math.floor(1000 + Math.random() * 9000),
      signatureCaptured: false,
      activeSignalEmoji: '📱',
    });

    this.spawnErpSignalPacket(clientePos, bunkkerPos, 6.8, '📱', '1. AUTO-PEDIDO DOMICILIO', '#84cc16', 0.5, () => {
      // Step 2: Repartidor prepara en Almacén
      this.updateErpOrderStatus('ORD-02', 'preparando', '2/4: Repartidor prepara y empaca el pedido en almacén.', 0.4, '📦');
      this.spawnErpSignalPacket(bunkkerPos, almacenPos, 6.2, '📦', '3. REPARTIDOR PREPARA', '#06b6d4', 0.5, () => {
        // Physical box launched to Domicilio
        this.launchBox('domicilio', 'Taladro Percutor 20V', '#ORD-02', 'Herramientas Eléctricas');

        // Step 3: En ruta (Violeta Ruta)
        setTimeout(() => {
          this.updateErpOrderStatus('ORD-02', 'en_ruta', '3/4: Repartidor en ruta con camioneta hacia domicilio.', 0.7, '🚚');
          this.spawnErpSignalPacket(entregasPos, domicilioPos, 4.5, '🚛', '5B. RUTA REPARTO', '#8b5cf6', 0.5, () => {
            // Step 4: Llega a domicilio, cliente recibe en bateo residencial, firma digital
            setTimeout(() => {
              this.updateErpOrderStatus('ORD-02', 'completado_ok', '4/4: Entrega en bateo residencial. Repartidor toma firma digital y regresa: OK!', 1.0, '✍️');
              const ord = this.erpOrders.find((o) => o.id === 'ORD-02');
              if (ord) ord.signatureCaptured = true;
              this.spawnCelebrationMilestone('domicilio', 'Taladro Percutor 20V', '#ORD-02', domicilioPos);
              this.callbacks.onSoundTrigger('success');

              // Confirmation pulse back to Bunkker (Verde Esmeralda Cierre)
              this.spawnErpSignalPacket(domicilioPos, bunkkerPos, 6.5, '✍️', '6. FIRMA PoD / CIERRE', '#10b981', 0.5);
            }, 600);
          });
        }, 1400);
      });
    });
  }

  /**
   * FLUJO 3: VENTA EN CAJA DE COBRO EXPRÉS (Mismo prepara en mostrador, valida rápido y OK)
   */
  public launchPedidoCajaRapidaFlow() {
    const bunkkerPos = new THREE.Vector3(15.5, 3.8, -9.5);
    const cajaPos = new THREE.Vector3(-4.5, 2.2, 10.5);

    this.upsertErpOrder({
      id: 'ORD-03',
      orderNumber: 'PED-03',
      flowType: 3,
      channelName: 'Caja Mostrador',
      productName: 'Caja Herramientas 128 Pzs',
      status: 'preparando',
      stepDescription: '1/3: Venta directa en mostrador. Preparación y validación inmediata.',
      progress: 0.3,
      timestamp: Date.now(),
      ticketNumber: 'TK-' + Math.floor(1000 + Math.random() * 9000),
      signatureCaptured: true,
      activeSignalEmoji: '⚡',
    });

    // Rapid pulse Caja -> Bunkker (Cian Eléctrico Bloqueo & Cobro)
    this.spawnErpSignalPacket(cajaPos, bunkkerPos, 6.0, '💳', '2. BLOQUEO WAL & COBRO', '#00f0ff', 0.55, () => {
      // Launch box down conveyor into Bateo en Caja
      this.launchBox('caja', 'Caja Herramientas 128 Pzs', '#ORD-03', 'Herramientas Eléctricas');
      this.callbacks.onSoundTrigger('scan');

      // Response Bunkker -> Caja (Verde Validación)
      setTimeout(() => {
        this.spawnErpSignalPacket(bunkkerPos, cajaPos, 6.0, '🧾', 'TICKET VALIDADO OK', '#22c55e', 0.55, () => {
          this.updateErpOrderStatus('ORD-03', 'completado_ok', '3/3: Cajero valida en mostrador, cobra y entrega en Bateo en Caja. OK!', 1.0, '✅');
          this.callbacks.onSoundTrigger('cash');
          this.spawnCelebrationMilestone('caja', 'Caja Herramientas 128 Pzs', '#ORD-03', cajaPos);
        });
      }, 900);
    });
  }

  /**
   * EJECUTAR LOS 3 FLUJOS ERP SIMULTÁNEAMENTE
   */
  public launchAllErpFlows() {
    this.launchPedidoCargaFlow();
    setTimeout(() => {
      this.launchPedidoDomicilioFlow();
    }, 1200);
    setTimeout(() => {
      this.launchPedidoCajaRapidaFlow();
    }, 2400);
  }

  private boxSequenceCounter: number = 1;
  private tickUpdateCounter: number = 0;

  /**
   * LAUNCH A NEW BOX (Up to 9 simultaneous boxes)
   * With custom tracking ID, category classification, and 3D billboard identifier
   */
  public launchBox(
    destination: BoxDestination,
    productName: string = 'Producto Ferretero',
    trackingId?: string,
    category: string = 'Herramientas Eléctricas',
    isValidated: boolean = true
  ): boolean {
    if (this.activeBoxes.length >= this.maxBoxes) {
      // Reached 9 boxes limit to prevent oversaturation
      return false;
    }

    const actualTrackingId = trackingId || `#BX-${String(this.boxSequenceCounter++).padStart(2, '0')}`;

    let curve: THREE.CatmullRomCurve3;
    let boxSize = 0.5;
    if (destination === 'caja') {
      curve = this.localCurve;
      boxSize = 0.46;
    } else if (destination === 'domicilio') {
      curve = this.deliveryCurve;
      boxSize = 0.52;
    } else {
      curve = this.inboundCurve;
      boxSize = 0.55;
    }

    // Build color-coded package mesh customized for this destination
    const boxMesh = createPackageMesh(
      this.materials,
      boxSize,
      destination,
      category,
      productName,
      actualTrackingId
    );
    const startPoint = curve.getPointAt(0);
    boxMesh.position.copy(startPoint);

    // Attach 3D floating tracking identifier sprite billboard
    const trackingSprite = createPackageTrackingSprite(
      actualTrackingId,
      destination,
      productName,
      category,
      isValidated
    );
    trackingSprite.position.set(0, boxSize * 0.5 + 0.55, 0);
    boxMesh.add(trackingSprite);

    this.scene.add(boxMesh);

    const newBox: ActiveBox = {
      id: 'box-' + Math.random().toString(36).substring(2, 9),
      trackingId: actualTrackingId,
      destination,
      productName,
      category,
      mesh: boxMesh,
      curve,
      progress: 0,
      speed: 1.0,
      isValidated,
      trackingSprite,
    };

    this.activeBoxes.push(newBox);
    this.callbacks.onBoxCountChange?.(this.activeBoxes.length);
    this.notifyActiveBoxes();

    if (destination === 'caja') {
      this.callbacks.onSoundTrigger('scan');
    } else if (destination === 'domicilio') {
      this.callbacks.onSoundTrigger('tape');
    } else {
      this.callbacks.onSoundTrigger('truck');
    }

    return true;
  }

  /**
   * Focus camera smoothly onto an active box by ID or tracking ID
   */
  public focusOnBox(targetId: string) {
    const box = this.activeBoxes.find((b) => b.id === targetId || b.trackingId === targetId);
    if (box) {
      const pt = box.mesh.position;
      this.targetCameraPos.set(pt.x + 3.8, pt.y + 3.2, pt.z + 4.5);
      this.targetLookAt.copy(pt);
      this.isTransitioningCamera = true;
    }
  }

  /**
   * Notify subscribers of current active boxes with tracking and progress
   */
  public notifyActiveBoxes() {
    if (this.callbacks.onActiveBoxesUpdate) {
      const items: ActiveBoxItem[] = this.activeBoxes.map((b) => ({
        id: b.id,
        trackingId: b.trackingId,
        destination: b.destination,
        productName: b.productName,
        category: b.category,
        progress: b.progress,
        label: `${b.trackingId} • ${b.productName}`,
        isValidated: b.isValidated,
        validationChecks: {
          barcode: true,
          weight: true,
          seal: true,
        },
        weightKg: b.destination === 'carga' ? 42.0 : b.destination === 'domicilio' ? 8.5 : 2.4,
        timestamp: Date.now(),
      }));
      this.callbacks.onActiveBoxesUpdate(items);
    }
  }

  public getActiveBoxesList(): ActiveBoxItem[] {
    return this.activeBoxes.map((b) => ({
      id: b.id,
      trackingId: b.trackingId,
      destination: b.destination,
      productName: b.productName,
      category: b.category,
      progress: b.progress,
      label: `${b.trackingId} • ${b.productName}`,
      isValidated: b.isValidated,
      validationChecks: {
        barcode: true,
        weight: true,
        seal: true,
      },
      weightKg: b.destination === 'carga' ? 42.0 : b.destination === 'domicilio' ? 8.5 : 2.4,
      timestamp: Date.now(),
    }));
  }

  /**
   * Start a specific scenario or launch flow
   */
  public startScenario(scenario: ScenarioMode, deliveryType: DeliveryType, speed: number = 1.0) {
    this.setSpeed(speed);
    if (scenario === 'venta_mostrador') {
      this.launchBox('caja', 'Taladro Percutor 850W', '#BX-01', 'Herramientas Eléctricas');
    } else if (scenario === 'domicilio_completo') {
      this.launchBox('domicilio', 'Juego Llaves Stanley', '#BX-02', 'Herramientas');
    } else if (scenario === 'gestion_inventario') {
      this.launchBox('carga', 'Cemento Portland 50kg', '#BX-03', 'Carga Pesada & Obra');
    } else {
      // simultaneo_total: launch 1 box to each path
      this.launchBox('caja', 'Taladro Percutor 850W', '#BX-01', 'Herramientas Eléctricas');
      this.launchBox('domicilio', 'Esmalte Sintético 4L', '#BX-02', 'Pinturas & Químicos');
      this.launchBox('carga', 'Cemento Portland 50kg', '#BX-03', 'Carga Pesada & Obra');
    }
  }

  /**
   * Clear all active boxes
   */
  public clearBoxes() {
    this.activeBoxes.forEach((b) => {
      this.scene.remove(b.mesh);
    });
    this.activeBoxes = [];
    this.callbacks.onBoxCountChange?.(0);
    this.notifyActiveBoxes();
  }

  /**
   * Spawn a 3D Floating Stock Badge (+1 Green / -1 Red)
   */
  private spawnStockBadge(type: '+1' | '-1', position: THREE.Vector3) {
    const sprite = createFloatingStockSprite(type);
    sprite.position.copy(position);
    sprite.position.y += 0.8;
    this.scene.add(sprite);

    this.floatingBadges.push({
      sprite,
      life: 1.0,
      yVel: 1.6,
    });
  }

  /**
   * Spawn a Rich 3D Floating Milestone Celebration Badge with product name, destination, and shockwave ring
   */
  private spawnCelebrationMilestone(
    destination: BoxDestination,
    productName: string,
    trackingId: string,
    position: THREE.Vector3
  ) {
    const sprite = createDeliveryMilestoneSprite(destination, productName, trackingId);
    sprite.position.copy(position);
    sprite.position.y += 1.8;
    this.scene.add(sprite);

    this.floatingBadges.push({
      sprite,
      life: 1.6,
      yVel: 0.95,
    });

    // Expanding shockwave ground ring
    const ringColor = destination === 'caja' ? 0x10b981 : destination === 'domicilio' ? 0xf97316 : 0x06b6d4;
    const shockwave = createShockwaveMesh(ringColor);
    shockwave.position.set(position.x, 0.05, position.z);
    this.scene.add(shockwave);

    this.shockwaves.push({
      mesh: shockwave,
      radius: 0.3,
      maxRadius: 2.8,
      life: 1.0,
    });
  }

  public updateStockGauge(productName: string, stock: number, minStock: number) {
    if (this.stockBillboardUpdater) {
      this.stockBillboardUpdater(productName, stock, minStock);
    }
  }

  public setPerspective(perspective: PerspectiveType) {
    this.currentPerspective = perspective;
    this.isTransitioningCamera = true;
    switch (perspective) {
      case 'alejada_panoramica':
        this.targetCameraPos.set(28, 30, 36);
        this.targetLookAt.set(2.0, 0.5, 0.5);
        break;
      case 'isometrica':
        this.targetCameraPos.set(20, 22, 26);
        this.targetLookAt.set(2.0, 0.5, 0.5);
        break;
      case 'cliente':
        this.targetCameraPos.set(-14.0, 3.5, 12.5);
        this.targetLookAt.set(-14.0, 1.5, 8.5);
        break;
      case 'vendedor':
        this.targetCameraPos.set(-4.5, 3.2, 7.5);
        this.targetLookAt.set(-4.5, 1.3, 10.5);
        break;
      case 'almacenista':
        this.targetCameraPos.set(-10.0, 5.0, -8.0);
        this.targetLookAt.set(-14.0, 2.5, -11.0);
        break;
      case 'repartidor':
        this.targetCameraPos.set(10.0, 4.5, 6.0);
        this.targetLookAt.set(13.0, 1.5, 9.5);
        break;
    }
  }

  public zoomIn() {
    this.isTransitioningCamera = false;
    const dir = new THREE.Vector3().subVectors(this.controls.target, this.camera.position).normalize();
    const dist = this.camera.position.distanceTo(this.controls.target);
    if (dist > this.controls.minDistance + 1.5) {
      this.camera.position.addScaledVector(dir, 4.5);
    }
  }

  public zoomOut() {
    this.isTransitioningCamera = false;
    const dir = new THREE.Vector3().subVectors(this.controls.target, this.camera.position).normalize();
    const dist = this.camera.position.distanceTo(this.controls.target);
    if (dist < this.controls.maxDistance - 4) {
      this.camera.position.addScaledVector(dir, -4.5);
    }
  }

  public resetToOverview() {
    this.setPerspective('alejada_panoramica');
  }

  public focusOnRole(role: UserRole, clientDeliveryType: 'mostrador' | 'domicilio' = 'mostrador') {
    if (role === 'cliente') {
      if (clientDeliveryType === 'domicilio') {
        this.targetCameraPos.set(25.5, 3.6, 13.5);
        this.targetLookAt.set(25.0, 1.4, 9.5);
      } else {
        this.targetCameraPos.set(-4.5, 3.0, 13.5);
        this.targetLookAt.set(-4.5, 1.3, 10.0);
      }
      this.isTransitioningCamera = true;
    } else if (role === 'almacenista') {
      this.targetCameraPos.set(-10.0, 5.0, -8.0);
      this.targetLookAt.set(-14.0, 2.5, -11.0);
      this.isTransitioningCamera = true;
    } else if (role === 'vendedor') {
      this.targetCameraPos.set(-4.5, 3.2, 7.5);
      this.targetLookAt.set(-4.5, 1.3, 10.5);
      this.isTransitioningCamera = true;
    } else {
      this.resetToOverview();
    }
  }

  public triggerRoleAction(role: UserRole, action: string, productName: string = 'Producto Ferretero') {
    if (role === 'cliente') {
      if (action === 'mostrador') {
        this.focusOnRole('cliente', 'mostrador');
        this.launchBox('caja', productName);
      } else if (action === 'domicilio') {
        this.focusOnRole('cliente', 'domicilio');
        this.launchBox('domicilio', productName);
      }
    } else if (role === 'almacenista') {
      this.focusOnRole('almacenista');
      if (action === 'picking') {
        this.launchBox('caja', productName);
        this.callbacks.onSoundTrigger('scan');
      } else if (action === 'packing') {
        this.launchBox('domicilio', productName);
        this.callbacks.onSoundTrigger('tape');
      } else if (action === 'loading') {
        if (this.dockGroup?.userData.setDoorOpen) {
          this.dockGroup.userData.setDoorOpen(1.0);
        }
        this.callbacks.onSoundTrigger('truck');
      } else if (action === 'restock') {
        this.launchBox('carga', productName);
      }
    } else if (role === 'vendedor') {
      this.focusOnRole('vendedor');
      if (action === 'scan') {
        this.callbacks.onSoundTrigger('scan');
      } else if (action === 'payment') {
        this.callbacks.onSoundTrigger('cash');
        if (this.storeGroup?.userData.setDrawerOpen) {
          this.storeGroup.userData.setDrawerOpen(1.0);
          setTimeout(() => {
            this.storeGroup?.userData.setDrawerOpen?.(0);
          }, 2400);
        }
      } else if (action === 'request_picking') {
        this.launchBox('caja', productName);
        this.callbacks.onSoundTrigger('scan');
      } else if (action === 'handover') {
        this.callbacks.onSoundTrigger('success');
      }
    }
  }

  public setCameraPreset(preset: CameraPreset) {
    this.setPerspective(preset);
  }

  public setSpeed(speed: number) {
    this.simulationSpeed = speed;
  }

  public pause() {
    this.isSimulating = false;
  }

  public resume() {
    this.isSimulating = true;
  }

  public reset() {
    this.clearBoxes();
    if (this.truckGroup) {
      this.truckGroup.position.set(5.5, 0, -2);
      this.truckGroup.rotation.y = 0;
    }
    if (this.dockGroup?.userData.setDoorOpen) {
      this.dockGroup.userData.setDoorOpen(0);
    }
    if (this.storeGroup?.userData.setDrawerOpen) {
      this.storeGroup.userData.setDrawerOpen(0);
    }
  }

  private startLoop() {
    const tick = () => {
      this.tick();
      if (this.isSoftwareGl) {
        this.afterDraw(tick);
      } else {
        this.frameId = requestAnimationFrame(tick);
      }
    };
    if (this.isSoftwareGl) {
      this.afterDraw(tick);
    } else {
      this.frameId = requestAnimationFrame(tick);
    }
  }

  private afterDraw(cb: () => void) {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const poll = () => {
      const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
      if (state === gl.UNSIGNALED) {
        this.frameId = window.setTimeout(poll, 5);
      } else {
        if (sync) gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, 60);
      }
    };
    this.frameId = window.setTimeout(poll, 5);
  }

  private tick() {
    const delta = Math.min(this.clock.getDelta(), 0.1);
    const elapsedTime = this.clock.getElapsedTime();

    if (this.isSimulating) {
      // 1. Advance Active Boxes (Max 9) with calmer, representative pace
      const finishedIndices: number[] = [];

      let hasPickingBox = false;
      let hasCounterBox = false;
      let counterBoxProg = 0;
      let hasDeliveryBox = false;
      let deliveryBoxProg = 0;
      let hasInboundBox = false;
      let inboundBoxProg = 0;

      for (let i = 0; i < this.activeBoxes.length; i++) {
        const box = this.activeBoxes[i];
        // Slower base durations: 18s domicilio, 14s caja, 16s carga for clear step-by-step observation
        const baseDuration = box.destination === 'domicilio' ? 18.0 : box.destination === 'caja' ? 14.0 : 16.0;
        box.progress += (delta * this.simulationSpeed) / baseDuration;

        if (box.destination === 'caja') {
          hasCounterBox = true;
          counterBoxProg = box.progress;
          if (box.progress < 0.38) hasPickingBox = true;
        } else if (box.destination === 'domicilio') {
          hasDeliveryBox = true;
          deliveryBoxProg = box.progress;
          if (box.progress < 0.35) hasPickingBox = true;
        } else if (box.destination === 'carga') {
          hasInboundBox = true;
          inboundBoxProg = box.progress;
        }

        if (box.progress >= 1.0) {
          finishedIndices.push(i);
        } else {
          // Move package along its spline
          const point = box.curve.getPointAt(box.progress);
          const tangent = box.curve.getTangentAt(box.progress);

          box.mesh.position.copy(point);
          box.mesh.position.y += Math.sin(elapsedTime * 4 + i) * 0.015;

          if (tangent.lengthSq() > 0.001) {
            box.mesh.lookAt(point.clone().add(tangent));
          }

          // Domicilio: Delivery Van route
          if (box.destination === 'domicilio' && this.truckGroup) {
            if (box.progress >= 0.40 && box.progress <= 0.88) {
              const normT = (box.progress - 0.40) / (0.88 - 0.40);
              const truckX = THREE.MathUtils.lerp(13.0, 23.5, normT);
              const truckZ = THREE.MathUtils.lerp(8.0, 9.5, Math.pow(normT, 1.2));
              this.truckGroup.position.set(truckX, 0, truckZ);
              this.truckGroup.rotation.y = -Math.PI / 2;
            } else if (box.progress > 0.88) {
              this.truckGroup.position.set(23.5, 0, 9.5);
              this.truckGroup.rotation.y = -Math.PI / 2;
            }
          }

          // Caja: Cash register drawer
          if (box.destination === 'caja' && this.storeGroup?.userData.setDrawerOpen) {
            if (box.progress >= 0.60 && box.progress <= 0.88) {
              const drawerRatio = Math.sin(((box.progress - 0.60) / 0.28) * Math.PI);
              this.storeGroup.userData.setDrawerOpen(drawerRatio);
            }
          }

          // Carga: Forklift elevation
          if (box.destination === 'carga' && this.forkliftGroup?.userData.setForkHeight) {
            if (box.progress >= 0.70 && box.progress <= 0.98) {
              const forkElev = Math.sin(((box.progress - 0.70) / 0.28) * Math.PI) * 1.2;
              this.forkliftGroup.userData.setForkHeight(forkElev);
            }
          }
        }
      }

      // Periodic state sync for active box tracker (every 10 ticks)
      this.tickUpdateCounter++;
      if (this.tickUpdateCounter % 10 === 0 && this.activeBoxes.length > 0) {
        this.notifyActiveBoxes();
      }

      // Process Finished Boxes
      for (let k = finishedIndices.length - 1; k >= 0; k--) {
        const idx = finishedIndices[k];
        const box = this.activeBoxes[idx];

        if (box.destination === 'carga') {
          // Merchandize Restocked (+1 Milestone Celebration Card at Rack)
          this.spawnCelebrationMilestone('carga', box.productName, box.trackingId, new THREE.Vector3(-14.0, 3.8, -10.5));
          this.callbacks.onStockEvent?.('plus', 'carga', 'Bodega & Racks', box.trackingId, box.productName);
          this.callbacks.onSoundTrigger('cash');
        } else if (box.destination === 'caja') {
          // Delivered to Client at Store Checkout Bateo
          const targetPos = new THREE.Vector3(-4.5, 2.2, 10.0);
          this.spawnCelebrationMilestone('caja', box.productName, box.trackingId, targetPos);
          this.callbacks.onStockEvent?.('minus', 'caja', 'Bateo en Caja de Cobro', box.trackingId, box.productName);
          this.callbacks.onSoundTrigger('cash');
        } else if (box.destination === 'domicilio') {
          // Delivered to Client at Home Porch Bateo
          const targetPos = new THREE.Vector3(25.0, 2.2, 9.5);
          this.spawnCelebrationMilestone('domicilio', box.productName, box.trackingId, targetPos);
          this.callbacks.onStockEvent?.('minus', 'domicilio', 'Bateo en Domicilio Residencial', box.trackingId, box.productName);
          this.callbacks.onSoundTrigger('success');
        }

        this.scene.remove(box.mesh);
        this.activeBoxes.splice(idx, 1);
        this.callbacks.onBoxCountChange?.(this.activeBoxes.length);
        this.notifyActiveBoxes();
      }

      // 2. Realistic Preparer, Handoff & Customer Reception Animations

      // Almacenista 1 (Preparador en Almacén): Recolecta del rack y alimenta la banda transportadora
      if (this.picker1_forklift) {
        if (hasPickingBox) {
          const walkProg = (Math.sin(elapsedTime * 2.2) + 1) / 2;
          this.picker1_forklift.position.x = THREE.MathUtils.lerp(-14.0, -12.5, walkProg);
          this.picker1_forklift.position.z = THREE.MathUtils.lerp(-11.0, -9.0, walkProg);
          this.picker1_forklift.rotation.y = walkProg > 0.5 ? Math.PI / 4 : -3 * Math.PI / 4;
          this.picker1_forklift.userData.animateWalk?.(elapsedTime * 5.0, 1.0);
          this.picker1_forklift.userData.setHolding?.(true);
        } else {
          this.picker1_forklift.position.set(-14.0, 0, -10.5);
          this.picker1_forklift.rotation.y = Math.PI / 2;
          this.picker1_forklift.userData.setHolding?.(false);
          this.picker1_forklift.userData.animateWalk?.(0, 0);
        }
      }

      // Despachador (Packer 1): Prepares at bench, inspects and classifies on Surtido conveyor
      if (this.packer1_bench) {
        if (hasCounterBox && counterBoxProg >= 0.30 && counterBoxProg < 0.60) {
          this.packer1_bench.position.set(0.0, 0, -1.8);
          this.packer1_bench.rotation.y = 0;
          this.packer1_bench.userData.animateWalk?.(elapsedTime * 4.0, 0.5);
          this.packer1_bench.userData.setHolding?.(true);
        } else {
          this.packer1_bench.position.set(0.0, 0, -1.8);
          this.packer1_bench.rotation.y = 0;
          this.packer1_bench.userData.setHolding?.(false);
          this.packer1_bench.userData.animateWalk?.(0, 0);
        }
      }

      // Cajero 1: Behind checkout counter, validates and passes box into Bateo en Caja
      if (this.cashier1) {
        if (hasCounterBox && counterBoxProg >= 0.65 && counterBoxProg < 0.95) {
          this.cashier1.userData.setHolding?.(true);
        } else {
          this.cashier1.userData.setHolding?.(false);
        }
      }

      // Cliente en Mostrador (Client 1): Receives package at Bateo en Caja
      if (this.client1_counter) {
        if (hasCounterBox && counterBoxProg >= 0.75) {
          this.client1_counter.userData.setHolding?.(true);
        } else {
          this.client1_counter.userData.setHolding?.(false);
        }
      }

      // Cliente en Domicilio (Client 4): Waiting on porch, steps forward to Bateo en Domicilio and receives order!
      if (this.client4_home) {
        if (hasDeliveryBox && deliveryBoxProg >= 0.78) {
          this.client4_home.userData.setHolding?.(true);
          const porchT = (deliveryBoxProg - 0.78) / 0.22;
          this.client4_home.position.z = THREE.MathUtils.lerp(-0.4, 0.1, Math.sin(porchT * Math.PI));
        } else {
          this.client4_home.userData.setHolding?.(false);
          this.client4_home.position.z = -0.4;
        }
      }

      // Repartidor (Driver 1): When van arrives at house (prog > 0.86), steps out & walks to front porch!
      if (this.driver1_van) {
        if (hasDeliveryBox && deliveryBoxProg >= 0.86) {
          const walkPorch = (deliveryBoxProg - 0.86) / 0.14;
          this.driver1_van.position.set(
            THREE.MathUtils.lerp(23.5, 25.0, walkPorch),
            0,
            THREE.MathUtils.lerp(9.5, 9.5, walkPorch)
          );
          this.driver1_van.rotation.y = -Math.PI / 2;
          this.driver1_van.userData.setHolding?.(true);
          this.driver1_van.userData.animateWalk?.(elapsedTime * 5.0, 1.0);
        } else if (hasDeliveryBox && deliveryBoxProg >= 0.40 && deliveryBoxProg < 0.86) {
          // Inside van
          this.driver1_van.position.set(999, 0, 999);
        } else {
          // Waiting at loading dock
          this.driver1_van.position.set(13.0, 0, 7.5);
          this.driver1_van.rotation.y = Math.PI / 2;
          this.driver1_van.userData.setHolding?.(false);
          this.driver1_van.userData.animateWalk?.(0, 0);
        }
      }

      // Almacenista 2 (Picker 2 with Pallet Truck): Unloads supplier truck when Carga box is active
      if (this.palletTruckGroup && this.picker2_trolley) {
        if (hasInboundBox) {
          const inboundT = inboundBoxProg < 0.5 ? inboundBoxProg / 0.5 : (1.0 - inboundBoxProg) / 0.5;
          const trolleyX = THREE.MathUtils.lerp(-19.0, -14.0, inboundT);
          this.palletTruckGroup.position.set(trolleyX, 0, -10.5);
          this.picker2_trolley.position.set(trolleyX + 0.8, 0, -10.5);
          this.picker2_trolley.rotation.y = inboundBoxProg < 0.5 ? -Math.PI / 2 : Math.PI / 2;
          this.picker2_trolley.userData.animateWalk?.(elapsedTime * 4.5, 1.0);
        } else {
          const idleZ = -10.5 + Math.sin(elapsedTime * 0.8) * 0.8;
          this.palletTruckGroup.position.set(-15.5, 0, idleZ);
          this.picker2_trolley.position.set(-15.5, 0, idleZ - 0.8);
          this.picker2_trolley.rotation.y = 0;
          this.picker2_trolley.userData.animateWalk?.(elapsedTime * 2.0, 0.5);
        }
      }

      // Dock roll-up door lifts automatically when trucks or goods pass
      if (this.dockGroup?.userData.setDoorOpen) {
        const needsDoor = hasDeliveryBox || hasInboundBox;
        const targetLift = needsDoor ? 1.0 : 0.35 + Math.sin(elapsedTime * 0.8) * 0.25;
        this.dockGroup.userData.setDoorOpen(targetLift);
      }
    }

    // 2B. Animate 3D Floating Zone Balloon Badges (Levitación senoidal continua)
    for (const badge of this.floatingZoneBadges) {
      badge.group.position.y =
        badge.baseY + Math.sin(elapsedTime * badge.floatSpeed + badge.floatPhase) * badge.floatAmp;
    }

    // 3. Animate 3D Floating Stock Badges & Milestone Sprites
    for (let b = this.floatingBadges.length - 1; b >= 0; b--) {
      const badge = this.floatingBadges[b];
      badge.life -= delta * 0.55;
      badge.sprite.position.y += delta * badge.yVel;

      const mat = badge.sprite.material as THREE.SpriteMaterial;
      mat.opacity = Math.max(0, badge.life);

      if (badge.life <= 0) {
        this.scene.remove(badge.sprite);
        this.floatingBadges.splice(b, 1);
      }
    }

    // 4. Animate 3D Shockwaves (Ground expansion celebration)
    for (let s = this.shockwaves.length - 1; s >= 0; s--) {
      const sw = this.shockwaves[s];
      sw.life -= delta * 0.85;
      sw.radius = THREE.MathUtils.lerp(sw.radius, sw.maxRadius, 1 - Math.exp(-3.5 * delta));
      sw.mesh.scale.set(sw.radius, sw.radius, sw.radius);
      const mat = sw.mesh.material as THREE.MeshBasicMaterial;
      mat.opacity = Math.max(0, sw.life * 0.9);
      if (sw.life <= 0) {
        this.scene.remove(sw.mesh);
        this.shockwaves.splice(s, 1);
      }
    }

    // 5. Animate 3D Route Guides (energy pulses traveling along curves)
    for (const rg of this.routeGuides) {
      const hasActive = this.activeBoxes.some((b) => b.destination === rg.destination);
      const pulseT = ((elapsedTime * (hasActive ? 0.35 : 0.15)) % 1.0);
      const pt = rg.curve.getPointAt(pulseT);
      rg.pulseBead.position.copy(pt);
      rg.pulseBead.scale.setScalar(hasActive ? 1.4 : 0.9);
    }

    // 6. Animate Destination Landing Target Beacons (concentric rings & light pillars)
    for (const beacon of this.landingBeacons) {
      beacon.outerRing.rotation.z += delta * 1.4;
      beacon.innerRing.rotation.z -= delta * 2.0;

      const hasActive = this.activeBoxes.some((b) => b.destination === beacon.destination);
      const pulseFactor = hasActive
        ? 1.0 + Math.sin(elapsedTime * 8) * 0.28
        : 1.0 + Math.sin(elapsedTime * 2.5) * 0.08;

      beacon.outerRing.scale.set(pulseFactor, pulseFactor, 1.0);
      beacon.innerRing.scale.set(pulseFactor, pulseFactor, 1.0);

      const pillarMat = beacon.lightPillar.material as THREE.MeshBasicMaterial;
      pillarMat.opacity = hasActive ? 0.55 + Math.sin(elapsedTime * 6) * 0.2 : 0.25;
      beacon.lightPillar.scale.y = hasActive ? 1.35 : 1.0;
    }

    // 7. Animate Elevated Neon ERP Data Network (Energy pulses along parabolic arches)
    for (const beam of this.erpBeams) {
      const pulseT = ((elapsedTime * 0.32) % 1.0);
      const pt = beam.curve.getPointAt(pulseT);
      beam.pulseBead.position.copy(pt);
      const tube = beam.group.children[0] as THREE.Mesh;
      if (tube && (tube.material as THREE.MeshStandardMaterial).emissiveIntensity !== undefined) {
        (tube.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.75 + Math.sin(elapsedTime * 4.0) * 0.25;
      }
    }

    // 8. Animate Active Wi-Fi ERP Data Signal Packets
    for (let p = this.activeSignalPackets.length - 1; p >= 0; p--) {
      const pkt = this.activeSignalPackets[p];
      pkt.progress += delta * pkt.speed * this.simulationSpeed;
      if (pkt.progress >= 1.0) {
        pkt.progress = 1.0;
        const endPt = pkt.curve.getPointAt(1.0);
        pkt.sprite.position.copy(endPt);
        if ((pkt as any).onComplete) {
          (pkt as any).onComplete();
        }
        this.scene.remove(pkt.sprite);
        this.activeSignalPackets.splice(p, 1);
      } else {
        const pt = pkt.curve.getPointAt(pkt.progress);
        pkt.sprite.position.copy(pt);
        const scalePulse = 1.0 + Math.sin(elapsedTime * 9) * 0.1;
        pkt.sprite.scale.set(2.4 * scalePulse, 0.85 * scalePulse, 1.0);
      }
    }

    // 9. Animate Customer Smartphone Wi-Fi Beacon Ring
    if (this.clientPhoneFigure?.userData.wifiBeacon) {
      const beacon = this.clientPhoneFigure.userData.wifiBeacon as THREE.Mesh;
      const bScale = 1.0 + Math.sin(elapsedTime * 5.0) * 0.25;
      beacon.scale.set(bScale, bScale, 1.0);
      beacon.rotation.z += delta * 1.5;
    }

    // 10. Smooth Programmatic Camera Lerp (Only when transitioning presets — user has 100% free orbit!)
    if (this.isTransitioningCamera) {
      const dampFactor = 1 - Math.exp(-3.5 * delta);
      this.camera.position.lerp(this.targetCameraPos, dampFactor);
      this.controls.target.lerp(this.targetLookAt, dampFactor);
      if (
        this.camera.position.distanceTo(this.targetCameraPos) < 0.08 &&
        this.controls.target.distanceTo(this.targetLookAt) < 0.08
      ) {
        this.isTransitioningCamera = false;
      }
    }
    this.controls.update();

    this.renderer.render(this.scene, this.camera);
  }

  private onResize = () => {
    if (!this.container) return;
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  };

  public getScreenCoordinates(worldPos: THREE.Vector3): { x: number; y: number; visible: boolean } {
    const pos = worldPos.clone();
    pos.project(this.camera);

    const isBehind = pos.z > 1.0;
    const x = (pos.x * 0.5 + 0.5) * this.container.clientWidth;
    const y = (-(pos.y * 0.5) + 0.5) * this.container.clientHeight;

    return { x, y, visible: !isBehind };
  }

  public dispose() {
    window.removeEventListener('resize', this.onResize);
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);
    if (this.flowIntervalId) {
      clearInterval(this.flowIntervalId);
      this.flowIntervalId = null;
    }
    this.pendingTimers.forEach((timerId) => clearTimeout(timerId));
    this.pendingTimers.clear();
    this.renderer.dispose();
  }
}
