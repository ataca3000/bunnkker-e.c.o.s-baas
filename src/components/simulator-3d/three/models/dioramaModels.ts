import * as THREE from 'three';
import {
  createHazardStripeTexture,
  createCardboardTexture,
  createSignboardTexture,
  createDestinationBoxTexture,
  createNeonSignboardTexture,
  createNocScreenTexture,
  createModularPodiumTexture,
  createCircuitGridFloorTexture,
} from '../proceduralTextures';

/**
 * Procedural 3D Architectural & Industrial Models for the Hardware Store Diorama.
 * Following Three.js skill: 3–12 part composites, varied roughness/metalness, grounded bottom-center pivots.
 */

// Shared reusable materials
export interface DioramaMaterials {
  rackUpright: THREE.MeshStandardMaterial;
  rackBeam: THREE.MeshStandardMaterial;
  woodPallet: THREE.MeshStandardMaterial;
  steelChrome: THREE.MeshStandardMaterial;
  darkMetal: THREE.MeshStandardMaterial;
  plasticYellow: THREE.MeshStandardMaterial;
  plasticOrange: THREE.MeshStandardMaterial;
  plasticBlue: THREE.MeshStandardMaterial;
  cardboard: THREE.MeshStandardMaterial;
  concreteFloor: THREE.MeshStandardMaterial;
  glass: THREE.MeshPhysicalMaterial;
  hazardTape: THREE.MeshStandardMaterial;
  rubberBlack: THREE.MeshStandardMaterial;
  skinTone: THREE.MeshStandardMaterial;
  clothesBlue: THREE.MeshStandardMaterial;
  clothesOrange: THREE.MeshStandardMaterial;
  clothesGreen: THREE.MeshStandardMaterial;
  asphalt: THREE.MeshStandardMaterial;
}

export function createDioramaMaterials(): DioramaMaterials {
  const hazardTex = createHazardStripeTexture();
  const cardboardTex = createCardboardTexture('FERRETERÍA');

  return {
    rackUpright: new THREE.MeshStandardMaterial({
      color: 0x1d4ed8, // Industrial blue
      roughness: 0.35,
      metalness: 0.6,
    }),
    rackBeam: new THREE.MeshStandardMaterial({
      color: 0xea580c, // Safety orange
      roughness: 0.4,
      metalness: 0.5,
    }),
    woodPallet: new THREE.MeshStandardMaterial({
      color: 0xba8c54,
      roughness: 0.85,
      metalness: 0.05,
    }),
    steelChrome: new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      roughness: 0.15,
      metalness: 0.9,
    }),
    darkMetal: new THREE.MeshStandardMaterial({
      color: 0x334155,
      roughness: 0.5,
      metalness: 0.7,
    }),
    plasticYellow: new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      roughness: 0.3,
      metalness: 0.1,
    }),
    plasticOrange: new THREE.MeshStandardMaterial({
      color: 0xf97316,
      roughness: 0.35,
      metalness: 0.1,
    }),
    plasticBlue: new THREE.MeshStandardMaterial({
      color: 0x2563eb,
      roughness: 0.35,
      metalness: 0.1,
    }),
    cardboard: new THREE.MeshStandardMaterial({
      map: cardboardTex,
      roughness: 0.8,
      metalness: 0.0,
    }),
    concreteFloor: new THREE.MeshStandardMaterial({
      color: 0x334155,
      roughness: 0.75,
      metalness: 0.15,
    }),
    glass: new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.4,
      roughness: 0.1,
      metalness: 0.1,
      transmission: 0.9,
      ior: 1.5,
    }),
    hazardTape: new THREE.MeshStandardMaterial({
      map: hazardTex,
      roughness: 0.5,
      metalness: 0.1,
    }),
    rubberBlack: new THREE.MeshStandardMaterial({
      color: 0x18181b,
      roughness: 0.85,
      metalness: 0.1,
    }),
    skinTone: new THREE.MeshStandardMaterial({
      color: 0xfbcfe8,
      roughness: 0.7,
      metalness: 0.0,
    }),
    clothesBlue: new THREE.MeshStandardMaterial({
      color: 0x1e40af,
      roughness: 0.75,
      metalness: 0.0,
    }),
    clothesOrange: new THREE.MeshStandardMaterial({
      color: 0xea580c,
      roughness: 0.7,
      metalness: 0.0,
    }),
    clothesGreen: new THREE.MeshStandardMaterial({
      color: 0x15803d,
      roughness: 0.7,
      metalness: 0.0,
    }),
    asphalt: new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.9,
      metalness: 0.05,
    }),
  };
}

/**
 * 1. HIGH-BAY INDUSTRIAL RACK WITH PALLETS & PRODUCTS
 */
export function createWarehouseRack(m: DioramaMaterials, width = 6, height = 4.5, depth = 1.4): THREE.Group {
  const group = new THREE.Group();

  // 4 Vertical upright posts (blue steel)
  const postGeo = new THREE.BoxGeometry(0.12, height, 0.12);
  const xOffsets = [-width / 2, width / 2];
  const zOffsets = [-depth / 2, depth / 2];

  for (const x of xOffsets) {
    for (const z of zOffsets) {
      const post = new THREE.Mesh(postGeo, m.rackUpright);
      post.position.set(x, height / 2, z);
      post.castShadow = true;
      post.receiveShadow = true;
      group.add(post);
    }
  }

  // Horizontal load beams (orange) on 3 shelf levels
  const beamXGeo = new THREE.BoxGeometry(width + 0.1, 0.15, 0.08);
  const beamZGeo = new THREE.BoxGeometry(0.08, 0.12, depth);
  const levels = [0.8, 2.2, 3.6];

  levels.forEach((yLevel) => {
    // Front & rear long orange beams
    for (const z of zOffsets) {
      const beam = new THREE.Mesh(beamXGeo, m.rackBeam);
      beam.position.set(0, yLevel, z);
      beam.castShadow = true;
      group.add(beam);
    }
    // Side braces
    for (const x of xOffsets) {
      const brace = new THREE.Mesh(beamZGeo, m.rackUpright);
      brace.position.set(x, yLevel, 0);
      group.add(brace);
    }

    // Wooden Pallets on this level (2 per level)
    [-width / 4, width / 4].forEach((palX, idx) => {
      const pallet = createWoodenPallet(m, 2.2, 0.14, 1.2);
      pallet.position.set(palX, yLevel + 0.08, 0);
      group.add(pallet);

      // Stack cargo boxes/materials on pallets
      if (idx === 0) {
        // Stack of tool/hardware cardboard boxes
        for (let bx = -0.5; bx <= 0.5; bx += 0.5) {
          for (let bz = -0.3; bz <= 0.3; bz += 0.6) {
            const boxGeo = new THREE.BoxGeometry(0.45, 0.35, 0.5);
            const box = new THREE.Mesh(boxGeo, m.cardboard);
            box.position.set(palX + bx, yLevel + 0.34, bz);
            box.castShadow = true;
            group.add(box);
          }
        }
      } else {
        // Stack of industrial paint buckets or cement bags
        const bucketGeo = new THREE.CylinderGeometry(0.2, 0.17, 0.45, 12);
        for (let bx = -0.5; bx <= 0.5; bx += 0.5) {
          for (let bz = -0.3; bz <= 0.3; bz += 0.6) {
            const bucketMat = (bx > 0) ? m.plasticBlue : m.plasticYellow;
            const bucket = new THREE.Mesh(bucketGeo, bucketMat);
            bucket.position.set(palX + bx, yLevel + 0.38, bz);
            bucket.castShadow = true;
            group.add(bucket);
          }
        }
      }
    });
  });

  // Top Aisle Signboard
  const aisleSignTex = createSignboardTexture('RACK 04 - LOGÍSTICA', 'ZONA DE PICKING', '#1e40af');
  const signMat = new THREE.MeshStandardMaterial({ map: aisleSignTex, roughness: 0.3 });
  const signMesh = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.6, 0.08), signMat);
  signMesh.position.set(0, height + 0.35, 0);
  group.add(signMesh);

  return group;
}

// Procedural Wooden Pallet
export function createWoodenPallet(m: DioramaMaterials, w = 2.0, h = 0.14, d = 1.1): THREE.Group {
  const pallet = new THREE.Group();

  // Bottom runners (3 pieces)
  const runnerGeo = new THREE.BoxGeometry(w, 0.05, 0.1);
  [-d / 2 + 0.08, 0, d / 2 - 0.08].forEach((z) => {
    const runner = new THREE.Mesh(runnerGeo, m.woodPallet);
    runner.position.set(0, 0.025, z);
    runner.castShadow = true;
    pallet.add(runner);
  });

  // Top deck boards (6 slats)
  const slatGeo = new THREE.BoxGeometry(0.18, 0.03, d);
  const slatCount = 6;
  const startX = -w / 2 + 0.15;
  const stepX = (w - 0.3) / (slatCount - 1);
  for (let i = 0; i < slatCount; i++) {
    const slat = new THREE.Mesh(slatGeo, m.woodPallet);
    slat.position.set(startX + i * stepX, h - 0.015, 0);
    slat.castShadow = true;
    pallet.add(slat);
  }

  return pallet;
}

/**
 * 2. COMPOSITE INDUSTRIAL FORKLIFT (10 Parts)
 */
export function createForklift(m: DioramaMaterials): THREE.Group {
  const forklift = new THREE.Group();

  // 1. Main Chassis & Engine hood (Yellow)
  const chassisGeo = new THREE.BoxGeometry(1.6, 0.6, 1.1);
  const chassis = new THREE.Mesh(chassisGeo, m.plasticYellow);
  chassis.position.set(-0.2, 0.5, 0);
  chassis.castShadow = true;
  forklift.add(chassis);

  // 2. Rear counterweight (Heavy dark cast metal)
  const counterGeo = new THREE.BoxGeometry(0.4, 0.55, 1.05);
  const counter = new THREE.Mesh(counterGeo, m.darkMetal);
  counter.position.set(-0.95, 0.55, 0);
  counter.castShadow = true;
  forklift.add(counter);

  // 3. Driver roll cage / Protective overhead cabin (Black steel tubes)
  const cagePillars = [
    [-0.7, 1.2, -0.45],
    [-0.7, 1.2, 0.45],
    [0.3, 1.2, -0.45],
    [0.3, 1.2, 0.45],
  ];
  const pillarGeo = new THREE.CylinderGeometry(0.03, 0.03, 1.1, 8);
  cagePillars.forEach(([x, y, z]) => {
    const pillar = new THREE.Mesh(pillarGeo, m.darkMetal);
    pillar.position.set(x, y, z);
    forklift.add(pillar);
  });

  // Overhead roof grill
  const roofGeo = new THREE.BoxGeometry(1.1, 0.05, 1.0);
  const roof = new THREE.Mesh(roofGeo, m.darkMetal);
  roof.position.set(-0.2, 1.75, 0);
  forklift.add(roof);

  // 4. Operator seat & steering column
  const seatGeo = new THREE.BoxGeometry(0.4, 0.35, 0.4);
  const seat = new THREE.Mesh(seatGeo, m.rubberBlack);
  seat.position.set(-0.35, 0.85, 0);
  forklift.add(seat);

  const steerColGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.4, 8);
  const steer = new THREE.Mesh(steerColGeo, m.darkMetal);
  steer.rotation.z = -0.3;
  steer.position.set(0.1, 0.95, 0);
  forklift.add(steer);

  // 5. Vertical hydraulic mast (Front steel uprights)
  const mastColGeo = new THREE.BoxGeometry(0.1, 1.8, 0.08);
  [-0.3, 0.3].forEach((z) => {
    const col = new THREE.Mesh(mastColGeo, m.darkMetal);
    col.position.set(0.68, 1.05, z);
    forklift.add(col);
  });

  // 6. Carriage plate & Steel Forks (Tines) grouped for elevation animation
  const forkAssembly = new THREE.Group();
  const carriageGeo = new THREE.BoxGeometry(0.05, 0.4, 0.7);
  const carriage = new THREE.Mesh(carriageGeo, m.steelChrome);
  carriage.position.set(0.75, 0.35, 0);
  forkAssembly.add(carriage);

  // Dual forks
  const forkGeo = new THREE.BoxGeometry(0.8, 0.04, 0.1);
  [-0.2, 0.2].forEach((z) => {
    const fork = new THREE.Mesh(forkGeo, m.steelChrome);
    fork.position.set(1.15, 0.16, z);
    fork.castShadow = true;
    forkAssembly.add(fork);
  });
  forklift.add(forkAssembly);
  forklift.userData.forkAssembly = forkAssembly;
  forklift.userData.setForkHeight = (h: number) => {
    forkAssembly.position.y = Math.max(0, Math.min(1.5, h));
  };

  // 7. Wheels (Front big drive wheels, Rear steering wheels)
  const frontWheelGeo = new THREE.CylinderGeometry(0.24, 0.24, 0.18, 16);
  const rearWheelGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.14, 16);
  frontWheelGeo.rotateX(Math.PI / 2);
  rearWheelGeo.rotateX(Math.PI / 2);

  // Front wheels
  [-0.55, 0.55].forEach((z) => {
    const w = new THREE.Mesh(frontWheelGeo, m.rubberBlack);
    w.position.set(0.45, 0.24, z);
    w.castShadow = true;
    forklift.add(w);
  });

  // Rear wheels
  [-0.5, 0.5].forEach((z) => {
    const w = new THREE.Mesh(rearWheelGeo, m.rubberBlack);
    w.position.set(-0.7, 0.18, z);
    w.castShadow = true;
    forklift.add(w);
  });

  // Amber warning beacon on top
  const beaconGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.1, 12);
  const beaconMat = new THREE.MeshStandardMaterial({
    color: 0xf59e0b,
    emissive: 0xd97706,
    emissiveIntensity: 0.8,
  });
  const beacon = new THREE.Mesh(beaconGeo, beaconMat);
  beacon.position.set(-0.2, 1.83, 0);
  forklift.add(beacon);

  return forklift;
}

/**
 * 3. STORE INTERIOR: SALES DESK, POS & TOOL PEGBOARD WALL
 */
export function createStoreInterior(m: DioramaMaterials): THREE.Group {
  const store = new THREE.Group();

  // POS Sales Counter (L-Shape or straight long counter)
  const counterBodyGeo = new THREE.BoxGeometry(3.6, 0.95, 0.9);
  const counterWood = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.4 });
  const counter = new THREE.Mesh(counterBodyGeo, counterWood);
  counter.position.set(0, 0.475, 0);
  counter.castShadow = true;
  counter.receiveShadow = true;
  store.add(counter);

  // Countertop (White polished composite)
  const topGeo = new THREE.BoxGeometry(3.7, 0.08, 1.0);
  const top = new THREE.Mesh(topGeo, m.steelChrome);
  top.position.set(0, 0.98, 0);
  store.add(top);

  // POS Touch Monitor on stand
  const monitorStandGeo = new THREE.CylinderGeometry(0.04, 0.06, 0.3, 12);
  const stand = new THREE.Mesh(monitorStandGeo, m.darkMetal);
  stand.position.set(-0.6, 1.15, 0);
  store.add(stand);

  const screenGeo = new THREE.BoxGeometry(0.35, 0.26, 0.04);
  const screenMat = new THREE.MeshStandardMaterial({
    color: 0x0284c7,
    emissive: 0x0369a1,
    emissiveIntensity: 0.6,
  });
  const screen = new THREE.Mesh(screenGeo, screenMat);
  screen.rotation.x = -0.2;
  screen.position.set(-0.6, 1.33, 0.05);
  store.add(screen);

  // Barcode Handheld Scanner on cradle
  const scanBaseGeo = new THREE.BoxGeometry(0.12, 0.15, 0.12);
  const scannerBase = new THREE.Mesh(scanBaseGeo, m.darkMetal);
  scannerBase.position.set(-0.15, 1.08, 0.1);
  store.add(scannerBase);

  const scanGunGeo = new THREE.BoxGeometry(0.08, 0.12, 0.16);
  const scannerGun = new THREE.Mesh(scanGunGeo, m.plasticYellow);
  scannerGun.rotation.x = 0.4;
  scannerGun.position.set(-0.15, 1.2, 0.1);
  store.add(scannerGun);

  // Cash Register Drawer (Animated Slide)
  const cashDrawerGeo = new THREE.BoxGeometry(0.4, 0.1, 0.38);
  const cashDrawer = new THREE.Mesh(cashDrawerGeo, m.darkMetal);
  cashDrawer.position.set(-0.6, 0.98, 0);
  store.add(cashDrawer);
  store.userData.cashDrawer = cashDrawer;
  store.userData.setDrawerOpen = (openRatio: number) => {
    cashDrawer.position.z = Math.max(0, Math.min(0.35, openRatio * 0.35));
  };

  // Receipt Printer
  const printerGeo = new THREE.BoxGeometry(0.15, 0.12, 0.18);
  const printer = new THREE.Mesh(printerGeo, m.darkMetal);
  printer.position.set(-1.1, 1.06, 0.05);
  store.add(printer);

  // Back Tool Pegboard Wall (Herramientas en exhibición)
  const pegboardWallGeo = new THREE.BoxGeometry(3.6, 2.5, 0.15);
  const pegboardMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.6 });
  const wall = new THREE.Mesh(pegboardWallGeo, pegboardMat);
  wall.position.set(0, 1.25, -1.2);
  wall.castShadow = true;
  wall.receiveShadow = true;
  store.add(wall);

  // Tool racks on pegboard:
  // Hammers, saws, drills mounted
  [-1.0, -0.4, 0.2, 0.8, 1.3].forEach((tx, idx) => {
    // Hanging tools
    const toolShelfGeo = new THREE.BoxGeometry(0.45, 0.04, 0.2);
    const shelf = new THREE.Mesh(toolShelfGeo, m.darkMetal);
    shelf.position.set(tx, 1.6, -1.08);
    store.add(shelf);

    // Mini items (hammers/toolboxes)
    const itemGeo = (idx % 2 === 0)
      ? new THREE.BoxGeometry(0.3, 0.15, 0.15)
      : new THREE.CylinderGeometry(0.06, 0.06, 0.25, 8);
    const itemMat = (idx % 2 === 0) ? m.plasticOrange : m.plasticYellow;
    const item = new THREE.Mesh(itemGeo, itemMat);
    item.position.set(tx, 1.74, -1.08);
    store.add(item);
  });

  // Top Neon Sign: "FERRETERÍA CENTRAL - VENTAS & CAJA"
  const storeSignTex = createSignboardTexture('VENTAS & CAJA', 'ATENCIÓN Y RETIRO LOCAL', '#047857');
  const signMat = new THREE.MeshStandardMaterial({ map: storeSignTex, roughness: 0.3 });
  const sign = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.6, 0.08), signMat);
  sign.position.set(0, 2.8, -1.15);
  store.add(sign);

  return store;
}

/**
 * 4. DISPATCH, PACKING BENCH & LOADING DOCK
 */
export function createDispatchAndDock(m: DioramaMaterials): THREE.Group {
  const dock = new THREE.Group();

  // Heavy duty Packing Workbench
  const benchTopGeo = new THREE.BoxGeometry(2.8, 0.08, 1.2);
  const bench = new THREE.Mesh(benchTopGeo, m.woodPallet);
  bench.position.set(0, 0.95, 0);
  bench.castShadow = true;
  dock.add(bench);

  // Bench steel legs
  const legGeo = new THREE.BoxGeometry(0.08, 0.92, 0.08);
  [-1.25, 1.25].forEach((x) => {
    [-0.45, 0.45].forEach((z) => {
      const leg = new THREE.Mesh(legGeo, m.darkMetal);
      leg.position.set(x, 0.46, z);
      dock.add(leg);
    });
  });

  // Digital weighing scale on bench
  const scaleBaseGeo = new THREE.BoxGeometry(0.6, 0.06, 0.5);
  const scale = new THREE.Mesh(scaleBaseGeo, m.steelChrome);
  scale.position.set(-0.7, 1.01, 0);
  dock.add(scale);

  // Scale digital display tower
  const scalePoleGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.3, 8);
  const pole = new THREE.Mesh(scalePoleGeo, m.darkMetal);
  pole.position.set(-0.95, 1.15, -0.2);
  dock.add(pole);

  const displayGeo = new THREE.BoxGeometry(0.14, 0.1, 0.04);
  const displayMat = new THREE.MeshStandardMaterial({
    color: 0x22c55e,
    emissive: 0x15803d,
    emissiveIntensity: 0.7,
  });
  const display = new THREE.Mesh(displayGeo, displayMat);
  display.position.set(-0.95, 1.32, -0.2);
  dock.add(display);

  // Tape dispenser & shipping document tray
  const tapeGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.06, 16);
  const tape = new THREE.Mesh(tapeGeo, m.plasticOrange);
  tape.position.set(0.6, 1.02, -0.2);
  dock.add(tape);

  // Loading Dock Shutter Wall & Opening
  const wallGeo = new THREE.BoxGeometry(0.25, 4.0, 5.0);
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.7 });
  const wall = new THREE.Mesh(wallGeo, wallMat);
  wall.position.set(2.8, 2.0, 0);
  wall.castShadow = true;
  wall.receiveShadow = true;
  dock.add(wall);

  // Industrial roll-up door (metal slats - Animated lift)
  const doorGeo = new THREE.BoxGeometry(0.08, 2.8, 3.2);
  const doorMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.4, metalness: 0.6 });
  const door = new THREE.Mesh(doorGeo, doorMat);
  door.position.set(2.7, 1.8, 0);
  dock.add(door);
  dock.userData.door = door;
  dock.userData.setDoorOpen = (openRatio: number) => {
    door.position.y = 1.8 + Math.max(0, Math.min(1.0, openRatio)) * 1.8;
  };

  // Hazard striped safety edge around dock opening
  const hazardBeamGeo = new THREE.BoxGeometry(0.12, 0.15, 3.4);
  const hazardBeam = new THREE.Mesh(hazardBeamGeo, m.hazardTape);
  hazardBeam.position.set(2.8, 0.075, 0);
  dock.add(hazardBeam);

  // Dock sign
  const dockSignTex = createSignboardTexture('DESPACHO & MUELLE', 'CONTROL Y ENVÍOS', '#c2410c');
  const signMat = new THREE.MeshStandardMaterial({ map: dockSignTex, roughness: 0.3 });
  const sign = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.55, 2.4), signMat);
  sign.position.set(2.6, 3.5, 0);
  dock.add(sign);

  return dock;
}

/**
 * 5. COMPOSITE DELIVERY TRUCK (12 Parts)
 */
export function createDeliveryTruck(m: DioramaMaterials): THREE.Group {
  const truck = new THREE.Group();

  // 1. Chassis Frame (Dark steel beams)
  const chassisGeo = new THREE.BoxGeometry(4.2, 0.22, 1.4);
  const chassis = new THREE.Mesh(chassisGeo, m.darkMetal);
  chassis.position.set(0, 0.45, 0);
  chassis.castShadow = true;
  truck.add(chassis);

  // 2. Cargo Box (White/Navy with Ferretería Logo)
  const boxGeo = new THREE.BoxGeometry(2.6, 1.8, 1.6);
  const boxSignTex = createSignboardTexture('FERRE-EXPRESS', 'ENTREGAS A DOMICILIO', '#0284c7');
  const cargoBoxMat = new THREE.MeshStandardMaterial({
    map: boxSignTex,
    roughness: 0.35,
    metalness: 0.2,
  });
  const cargoBox = new THREE.Mesh(boxGeo, cargoBoxMat);
  cargoBox.position.set(-0.65, 1.45, 0);
  cargoBox.castShadow = true;
  truck.add(cargoBox);

  // 3. Driver Cabin (Clean White/Orange Modern Cab)
  const cabGeo = new THREE.BoxGeometry(1.2, 1.5, 1.5);
  const cabMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.25, metalness: 0.4 });
  const cab = new THREE.Mesh(cabGeo, cabMat);
  cab.position.set(1.4, 1.3, 0);
  cab.castShadow = true;
  truck.add(cab);

  // 4. Windshield Glass
  const windshieldGeo = new THREE.BoxGeometry(0.08, 0.6, 1.3);
  const windshield = new THREE.Mesh(windshieldGeo, m.glass);
  windshield.position.set(2.01, 1.5, 0);
  truck.add(windshield);

  // Side windows
  [-0.76, 0.76].forEach((z) => {
    const sideWinGeo = new THREE.BoxGeometry(0.65, 0.45, 0.05);
    const sideWin = new THREE.Mesh(sideWinGeo, m.glass);
    sideWin.position.set(1.4, 1.52, z);
    truck.add(sideWin);
  });

  // 5. Front Chrome Bumper & Grille
  const bumperGeo = new THREE.BoxGeometry(0.2, 0.28, 1.6);
  const bumper = new THREE.Mesh(bumperGeo, m.steelChrome);
  bumper.position.set(2.05, 0.45, 0);
  bumper.castShadow = true;
  truck.add(bumper);

  // Headlights (Warm/Bright LEDs)
  [-0.55, 0.55].forEach((z) => {
    const lightGeo = new THREE.BoxGeometry(0.05, 0.12, 0.2);
    const lightMat = new THREE.MeshStandardMaterial({
      color: 0xfef08a,
      emissive: 0xfef08a,
      emissiveIntensity: 0.9,
    });
    const light = new THREE.Mesh(lightGeo, lightMat);
    light.position.set(2.02, 0.7, z);
    truck.add(light);
  });

  // Rear brake taillights
  [-0.65, 0.65].forEach((z) => {
    const redLightGeo = new THREE.BoxGeometry(0.05, 0.12, 0.18);
    const redLightMat = new THREE.MeshStandardMaterial({
      color: 0xef4444,
      emissive: 0xdc2626,
      emissiveIntensity: 0.9,
    });
    const redLight = new THREE.Mesh(redLightGeo, redLightMat);
    redLight.position.set(-1.97, 0.7, z);
    truck.add(redLight);
  });

  // Side Mirrors
  [-0.88, 0.88].forEach((z) => {
    const mirrorGeo = new THREE.BoxGeometry(0.12, 0.22, 0.06);
    const mirror = new THREE.Mesh(mirrorGeo, m.darkMetal);
    mirror.position.set(1.7, 1.45, z);
    truck.add(mirror);
  });

  // 6 Wheels (2 front, 4 rear duals)
  const wheelGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.26, 18);
  wheelGeo.rotateX(Math.PI / 2);

  // Front wheel pair
  [-0.75, 0.75].forEach((z) => {
    const w = new THREE.Mesh(wheelGeo, m.rubberBlack);
    w.position.set(1.4, 0.35, z);
    w.castShadow = true;
    truck.add(w);

    // Rim hubcap
    const rimGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.28, 12);
    rimGeo.rotateX(Math.PI / 2);
    const rim = new THREE.Mesh(rimGeo, m.steelChrome);
    rim.position.set(1.4, 0.35, z);
    truck.add(rim);
  });

  // Rear wheel pairs
  [-0.9, -1.6].forEach((x) => {
    [-0.78, 0.78].forEach((z) => {
      const w = new THREE.Mesh(wheelGeo, m.rubberBlack);
      w.position.set(x, 0.35, z);
      w.castShadow = true;
      truck.add(w);

      const rimGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.28, 12);
      rimGeo.rotateX(Math.PI / 2);
      const rim = new THREE.Mesh(rimGeo, m.steelChrome);
      rim.position.set(x, 0.35, z);
      truck.add(rim);
    });
  });

  return truck;
}

/**
 * 6. COMPOSITE HUMAN FIGURES (ROLES)
 * 6 distinct parts: head, hair/hardhat, torso/shirt, vest, legs, arms
 */
export function createHumanFigure(
  m: DioramaMaterials,
  role: 'almacenista' | 'cajero' | 'despachador' | 'cliente' | 'repartidor',
  shirtColorHex?: number
): THREE.Group {
  const human = new THREE.Group();

  // Head
  const headGeo = new THREE.SphereGeometry(0.14, 12, 12);
  const head = new THREE.Mesh(headGeo, m.skinTone);
  head.position.set(0, 1.42, 0);
  human.add(head);

  // Hat / Hardhat depending on role
  if (role === 'almacenista' || role === 'despachador') {
    const hardhatGeo = new THREE.SphereGeometry(0.16, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2);
    const hardhatMat = role === 'almacenista' ? m.plasticYellow : m.plasticOrange;
    const hardhat = new THREE.Mesh(hardhatGeo, hardhatMat);
    hardhat.position.set(0, 1.46, 0);
    human.add(hardhat);

    const brimGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.02, 12);
    const brim = new THREE.Mesh(brimGeo, hardhatMat);
    brim.position.set(0, 1.45, 0.02);
    human.add(brim);
  } else if (role === 'repartidor') {
    const capGeo = new THREE.CylinderGeometry(0.15, 0.16, 0.08, 12);
    const cap = new THREE.Mesh(capGeo, m.clothesBlue);
    cap.position.set(0, 1.5, 0);
    human.add(cap);

    const visorGeo = new THREE.BoxGeometry(0.14, 0.02, 0.12);
    const visor = new THREE.Mesh(visorGeo, m.clothesBlue);
    visor.position.set(0, 1.48, 0.12);
    human.add(visor);
  } else {
    // Hair
    const hairGeo = new THREE.SphereGeometry(0.15, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2);
    const hairMat = new THREE.MeshStandardMaterial({ color: 0x3b2f2f, roughness: 0.9 });
    const hair = new THREE.Mesh(hairGeo, hairMat);
    hair.position.set(0, 1.45, 0);
    human.add(hair);
  }

  // Torso / Shirt
  const torsoGeo = new THREE.BoxGeometry(0.32, 0.45, 0.2);
  let shirtMat = m.clothesBlue;
  if (shirtColorHex !== undefined) {
    shirtMat = new THREE.MeshStandardMaterial({ color: shirtColorHex, roughness: 0.7 });
  } else if (role === 'cliente') {
    shirtMat = m.clothesGreen;
  }
  const torso = new THREE.Mesh(torsoGeo, shirtMat);
  torso.position.set(0, 1.05, 0);
  torso.castShadow = true;
  human.add(torso);

  // Safety Vest for warehouse/dispatcher
  if (role === 'almacenista' || role === 'despachador') {
    const vestGeo = new THREE.BoxGeometry(0.34, 0.42, 0.22);
    const vestMat = role === 'almacenista' ? m.plasticYellow : m.plasticOrange;
    const vest = new THREE.Mesh(vestGeo, vestMat);
    vest.position.set(0, 1.05, 0);
    human.add(vest);
  }

  // Left and Right Arms with shoulder pivots (y = 1.18)
  const armGeo = new THREE.CylinderGeometry(0.045, 0.045, 0.38, 8);
  const leftArmPivot = new THREE.Group();
  leftArmPivot.position.set(-0.21, 1.18, 0);
  const leftArm = new THREE.Mesh(armGeo, shirtMat);
  leftArm.position.set(0, -0.19, 0);
  leftArmPivot.add(leftArm);
  human.add(leftArmPivot);

  const rightArmPivot = new THREE.Group();
  rightArmPivot.position.set(0.21, 1.18, 0);
  const rightArm = new THREE.Mesh(armGeo, shirtMat);
  rightArm.position.set(0, -0.19, 0);
  rightArmPivot.add(rightArm);
  human.add(rightArmPivot);

  // Left and Right Legs with hip pivots (y = 0.72)
  const legGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.62, 8);
  const shoeGeo = new THREE.BoxGeometry(0.1, 0.08, 0.16);

  const leftLegPivot = new THREE.Group();
  leftLegPivot.position.set(-0.09, 0.72, 0);
  const leftLeg = new THREE.Mesh(legGeo, m.darkMetal);
  leftLeg.position.set(0, -0.27, 0);
  leftLeg.castShadow = true;
  leftLegPivot.add(leftLeg);
  const leftShoe = new THREE.Mesh(shoeGeo, m.rubberBlack);
  leftShoe.position.set(0, -0.6, 0.03);
  leftLegPivot.add(leftShoe);
  human.add(leftLegPivot);

  const rightLegPivot = new THREE.Group();
  rightLegPivot.position.set(0.09, 0.72, 0);
  const rightLeg = new THREE.Mesh(legGeo, m.darkMetal);
  rightLeg.position.set(0, -0.27, 0);
  rightLeg.castShadow = true;
  rightLegPivot.add(rightLeg);
  const rightShoe = new THREE.Mesh(shoeGeo, m.rubberBlack);
  rightShoe.position.set(0, -0.6, 0.03);
  rightLegPivot.add(rightShoe);
  human.add(rightLegPivot);

  // Attach joint references & animation controllers to human.userData
  human.userData.leftArm = leftArmPivot;
  human.userData.rightArm = rightArmPivot;
  human.userData.leftLeg = leftLegPivot;
  human.userData.rightLeg = rightLegPivot;
  human.userData.torso = torso;
  human.userData.head = head;

  human.userData.animateWalk = (cycle: number, speedFactor = 1.0) => {
    const swing = Math.sin(cycle * 4.5) * 0.45 * speedFactor;
    leftLegPivot.rotation.x = swing;
    rightLegPivot.rotation.x = -swing;
    leftArmPivot.rotation.x = -swing * 0.85;
    rightArmPivot.rotation.x = swing * 0.85;
    torso.position.y = 1.05 + Math.abs(Math.sin(cycle * 9)) * 0.035;
    head.position.y = 1.42 + Math.abs(Math.sin(cycle * 9)) * 0.035;
  };

  human.userData.setHolding = (holding: boolean) => {
    if (holding) {
      leftArmPivot.rotation.set(-Math.PI / 3.4, 0, Math.PI / 14);
      rightArmPivot.rotation.set(-Math.PI / 3.4, 0, -Math.PI / 14);
    } else {
      leftArmPivot.rotation.set(0, 0, 0);
      rightArmPivot.rotation.set(0, 0, 0);
    }
  };

  return human;
}

/**
 * 7. CONVEYOR BELT SEGMENT
 */
export function createConveyorBelt(m: DioramaMaterials, length = 4.0): THREE.Group {
  const conveyor = new THREE.Group();

  // Side Rails
  const railGeo = new THREE.BoxGeometry(length, 0.18, 0.06);
  [-0.35, 0.35].forEach((z) => {
    const rail = new THREE.Mesh(railGeo, m.plasticYellow);
    rail.position.set(0, 0.85, z);
    rail.castShadow = true;
    conveyor.add(rail);
  });

  // Rollers along length
  const rollerGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.64, 10);
  rollerGeo.rotateX(Math.PI / 2);
  const rollerCount = Math.floor(length / 0.22);
  const startX = -length / 2 + 0.15;
  const stepX = (length - 0.3) / (rollerCount - 1);

  for (let i = 0; i < rollerCount; i++) {
    const roller = new THREE.Mesh(rollerGeo, m.steelChrome);
    roller.position.set(startX + i * stepX, 0.82, 0);
    conveyor.add(roller);
  }

  // Steel Support legs
  const legGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.8, 8);
  [-length / 2 + 0.3, length / 2 - 0.3].forEach((x) => {
    [-0.3, 0.3].forEach((z) => {
      const leg = new THREE.Mesh(legGeo, m.darkMetal);
      leg.position.set(x, 0.4, z);
      conveyor.add(leg);
    });
  });

  return conveyor;
}

/**
 * 8. SUBURBAN DESTINATION HOUSE (HOME DELIVERY FINISH LINE)
 */
export function createDestinationHouse(m: DioramaMaterials): THREE.Group {
  const house = new THREE.Group();

  // House Base / Concrete Foundation
  const baseGeo = new THREE.BoxGeometry(4.5, 0.3, 4.0);
  const baseMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.8 });
  const base = new THREE.Mesh(baseGeo, baseMat);
  base.position.set(0, 0.15, 0);
  house.add(base);

  // Main House Walls (Cozy Cream Stucco)
  const wallGeo = new THREE.BoxGeometry(4.0, 2.4, 3.5);
  const wallMat = new THREE.MeshStandardMaterial({ color: 0xfef3c7, roughness: 0.7 });
  const walls = new THREE.Mesh(wallGeo, wallMat);
  walls.position.set(0, 1.45, 0);
  walls.castShadow = true;
  walls.receiveShadow = true;
  house.add(walls);

  // Pitched Terracotta Roof (Using Cone or Extruded Prism)
  const roofShape = new THREE.Shape();
  roofShape.moveTo(-2.2, 0);
  roofShape.lineTo(0, 1.4);
  roofShape.lineTo(2.2, 0);
  roofShape.closePath();

  const extrudeSettings = { depth: 3.8, bevelEnabled: false };
  const roofGeo = new THREE.ExtrudeGeometry(roofShape, extrudeSettings);
  const roofMat = new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.6 });
  const roof = new THREE.Mesh(roofGeo, roofMat);
  roof.position.set(0, 2.65, -1.9);
  roof.castShadow = true;
  house.add(roof);

  // Front Entrance Door (Dark Oak Wood)
  const doorGeo = new THREE.BoxGeometry(0.65, 1.4, 0.06);
  const doorMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.5 });
  const door = new THREE.Mesh(doorGeo, doorMat);
  door.position.set(-0.6, 1.0, 1.78);
  house.add(door);

  // Front Window with warm interior glow
  const winGeo = new THREE.BoxGeometry(0.9, 0.8, 0.06);
  const winMat = new THREE.MeshStandardMaterial({
    color: 0xfef08a,
    emissive: 0xfef08a,
    emissiveIntensity: 0.6,
  });
  const win = new THREE.Mesh(winGeo, winMat);
  win.position.set(0.9, 1.3, 1.78);
  house.add(win);

  // Mailbox on post
  const postGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.9, 8);
  const post = new THREE.Mesh(postGeo, m.darkMetal);
  post.position.set(-1.8, 0.45, 2.4);
  house.add(post);

  const mailBoxGeo = new THREE.BoxGeometry(0.3, 0.22, 0.4);
  const mailBox = new THREE.Mesh(mailBoxGeo, m.plasticYellow);
  mailBox.position.set(-1.8, 0.95, 2.4);
  mailBox.castShadow = true;
  house.add(mailBox);

  // Destination Sign
  const houseSignTex = createSignboardTexture('DOMICILIO CLIENTE', 'ENTREGA RESIDENCIAL', '#059669');
  const hSignMat = new THREE.MeshStandardMaterial({ map: houseSignTex, roughness: 0.3 });
  const hSign = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.5, 0.06), hSignMat);
  hSign.position.set(0, 3.4, 1.8);
  house.add(hSign);

  return house;
}

/**
 * 9. HERO PACKAGE WITH VIBRANT DESTINATION-SPECIFIC COLOR & 3D GLOW BEACONS
 * - 'caja': Emerald Green (#10b981) for Store Counter / POS sales.
 * - 'domicilio': Electric Safety Orange (#f97316) for Home Delivery van route.
 * - 'carga': Cyan Blue (#06b6d4) for Supplier Inbound restock to racks.
 */
export function createPackageMesh(
  m: DioramaMaterials,
  size = 0.55,
  destination: 'caja' | 'domicilio' | 'carga' = 'caja',
  category?: string,
  productName: string = 'Producto Ferretero',
  trackingId: string = '#BX-01'
): THREE.Group {
  const group = new THREE.Group();

  let hexColor = 0x10b981;
  let emissiveColor = 0x059669;
  let edgeColor = 0x34d399;
  let iconEmoji = '🏪';

  if (destination === 'domicilio') {
    hexColor = 0xf97316;
    emissiveColor = 0xea580c;
    edgeColor = 0xfb923c;
    iconEmoji = '🚚';
  } else if (destination === 'carga') {
    hexColor = 0x06b6d4;
    emissiveColor = 0x0284c7;
    edgeColor = 0x38bdf8;
    iconEmoji = '📥';
  }

  // 1. Destination-tailored textured crate body
  const boxTex = createDestinationBoxTexture(destination, trackingId, productName);
  const boxMat = new THREE.MeshStandardMaterial({
    map: boxTex,
    color: 0xffffff,
    emissive: emissiveColor,
    emissiveIntensity: 0.28,
    roughness: 0.45,
    metalness: 0.15,
  });

  const boxGeo = new THREE.BoxGeometry(size, size * 0.85, size * 1.1);
  const box = new THREE.Mesh(boxGeo, boxMat);
  box.castShadow = true;
  box.receiveShadow = true;
  group.add(box);

  // 2. Glowing Emissive Wireframe Edges in destination color
  const edgesGeo = new THREE.EdgesGeometry(boxGeo);
  const edgesMat = new THREE.LineBasicMaterial({
    color: edgeColor,
    linewidth: 2,
    transparent: true,
    opacity: 0.9,
  });
  const edgeLines = new THREE.LineSegments(edgesGeo, edgesMat);
  box.add(edgeLines);

  // 3. 8 Industrial Corner Reinforcement Brackets (Steel Chrome)
  const cornerSize = size * 0.16;
  const cornerGeo = new THREE.BoxGeometry(cornerSize, cornerSize, cornerSize);
  const hx = (size / 2) * 0.96;
  const hy = ((size * 0.85) / 2) * 0.96;
  const hz = ((size * 1.1) / 2) * 0.96;

  [-hx, hx].forEach((cx) => {
    [-hy, hy].forEach((cy) => {
      [-hz, hz].forEach((cz) => {
        const corner = new THREE.Mesh(cornerGeo, m.steelChrome);
        corner.position.set(cx, cy, cz);
        group.add(corner);
      });
    });
  });

  // 4. Overhead Vertical Laser Beacon Beam (Projecting upwards in destination color)
  const beamGeo = new THREE.CylinderGeometry(0.015, 0.08, 0.85, 12, 1, true);
  const beamMat = new THREE.MeshBasicMaterial({
    color: hexColor,
    transparent: true,
    opacity: 0.45,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const beam = new THREE.Mesh(beamGeo, beamMat);
  beam.position.set(0, size * 0.42 + 0.42, 0);
  group.add(beam);

  // 5. Soft circular contact shadow
  const shadowGeo = new THREE.PlaneGeometry(size * 1.45, size * 1.45);
  const shadowMat = new THREE.MeshBasicMaterial({
    color: 0x000000,
    transparent: true,
    opacity: 0.4,
    depthWrite: false,
  });
  const shadow = new THREE.Mesh(shadowGeo, shadowMat);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = -size * 0.42;
  group.add(shadow);

  // 6. Pulsing Destination Halo Ring on the Floor
  const haloGeo = new THREE.RingGeometry(size * 0.65, size * 0.88, 32);
  const haloMat = new THREE.MeshBasicMaterial({
    color: hexColor,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.85,
  });
  const halo = new THREE.Mesh(haloGeo, haloMat);
  halo.rotation.x = -Math.PI / 2;
  halo.position.y = -size * 0.41;
  halo.name = 'halo';
  group.add(halo);

  // 7. Top Destination Emblem Disc (🏪 Mostrador / 🚚 Domicilio / 📥 Almacén)
  const discCanvas = document.createElement('canvas');
  discCanvas.width = 128;
  discCanvas.height = 128;
  const dCtx = discCanvas.getContext('2d')!;
  dCtx.fillStyle = destination === 'caja' ? '#10b981' : destination === 'domicilio' ? '#f97316' : '#06b6d4';
  dCtx.beginPath();
  dCtx.arc(64, 64, 58, 0, Math.PI * 2);
  dCtx.fill();
  dCtx.strokeStyle = '#ffffff';
  dCtx.lineWidth = 6;
  dCtx.stroke();
  dCtx.font = '54px sans-serif';
  dCtx.textAlign = 'center';
  dCtx.textBaseline = 'middle';
  dCtx.fillText(iconEmoji, 64, 68);

  const discTex = new THREE.CanvasTexture(discCanvas);
  discTex.colorSpace = THREE.SRGBColorSpace;
  const discMat = new THREE.MeshBasicMaterial({
    map: discTex,
    transparent: true,
    side: THREE.DoubleSide,
  });
  const discMesh = new THREE.Mesh(new THREE.PlaneGeometry(size * 0.45, size * 0.45), discMat);
  discMesh.rotation.x = -Math.PI / 2;
  discMesh.position.set(0, size * 0.43, 0);
  group.add(discMesh);

  return group;
}

/**
 * 10. SUPPLIER RESTOCK TRUCK (LOGÍSTICA INBOUND / PROVEEDOR)
 */
export function createSupplierTruck(m: DioramaMaterials): THREE.Group {
  const truck = new THREE.Group();

  // Long flatbed chassis
  const chassisGeo = new THREE.BoxGeometry(5.2, 0.25, 1.6);
  const chassis = new THREE.Mesh(chassisGeo, m.darkMetal);
  chassis.position.set(0, 0.5, 0);
  chassis.castShadow = true;
  truck.add(chassis);

  // Heavy Duty Green Cab
  const cabGeo = new THREE.BoxGeometry(1.4, 1.7, 1.6);
  const cabMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.3, metalness: 0.3 });
  const cab = new THREE.Mesh(cabGeo, cabMat);
  cab.position.set(1.8, 1.45, 0);
  cab.castShadow = true;
  truck.add(cab);

  // Windshield
  const windshieldGeo = new THREE.BoxGeometry(0.08, 0.65, 1.4);
  const windshield = new THREE.Mesh(windshieldGeo, m.glass);
  windshield.position.set(2.51, 1.6, 0);
  truck.add(windshield);

  // Flatbed timber deck
  const deckGeo = new THREE.BoxGeometry(3.5, 0.1, 1.6);
  const deck = new THREE.Mesh(deckGeo, m.woodPallet);
  deck.position.set(-0.75, 0.68, 0);
  truck.add(deck);

  // Restock Pallets loaded on flatbed
  [-1.8, -0.7, 0.4].forEach((px) => {
    const pal = createWoodenPallet(m, 1.0, 0.12, 1.2);
    pal.position.set(px, 0.73, 0);
    truck.add(pal);

    // Stacks of cement / new inventory cartons
    const stackGeo = new THREE.BoxGeometry(0.8, 0.6, 1.0);
    const stackMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.7 });
    const stack = new THREE.Mesh(stackGeo, stackMat);
    stack.position.set(px, 1.15, 0);
    stack.castShadow = true;
    truck.add(stack);
  });

  // Heavy Wheels
  const wheelGeo = new THREE.CylinderGeometry(0.4, 0.4, 0.28, 16);
  wheelGeo.rotateX(Math.PI / 2);
  [-1.9, -1.0, 1.8].forEach((wx) => {
    [-0.85, 0.85].forEach((wz) => {
      const w = new THREE.Mesh(wheelGeo, m.rubberBlack);
      w.position.set(wx, 0.4, wz);
      w.castShadow = true;
      truck.add(w);
    });
  });

  // Supplier sign banner
  const signTex = createSignboardTexture('PROVEEDOR FERRETERO', 'REABASTECIMIENTO DE STOCK', '#15803d');
  const signMat = new THREE.MeshStandardMaterial({ map: signTex, roughness: 0.3 });
  const sign = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.5, 0.05), signMat);
  sign.position.set(-0.75, 1.8, 0);
  truck.add(sign);

  return truck;
}

/**
 * 11. DYNAMIC 3D STOCK GAUGE BILLBOARD ON RACKS
 */
export function updateStockCanvas(
  canvas: HTMLCanvasElement,
  productName: string,
  stock: number,
  minStock: number
) {
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, 512, 256);

  // Title
  ctx.fillStyle = '#94a3b8';
  ctx.font = 'bold 22px sans-serif';
  ctx.fillText('NIVEL DE STOCK EN RACKS', 24, 40);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 28px sans-serif';
  const truncated = productName.length > 24 ? productName.substring(0, 22) + '...' : productName;
  ctx.fillText(truncated, 24, 80);

  // Stock count & status
  const isCritical = stock <= minStock;
  const isOptimal = stock > minStock * 1.8;

  ctx.font = 'bold 44px monospace';
  ctx.fillStyle = isCritical ? '#ef4444' : isOptimal ? '#10b981' : '#f59e0b';
  ctx.fillText(`${stock} UNID`, 24, 140);

  ctx.font = 'bold 20px sans-serif';
  if (isCritical) {
    ctx.fillStyle = '#ef4444';
    ctx.fillText('⚠️ ¡ALERTA: STOCK CRÍTICO / REPONER!', 220, 135);
  } else {
    ctx.fillStyle = isOptimal ? '#10b981' : '#f59e0b';
    ctx.fillText(isOptimal ? '✓ STOCK ÓPTIMO' : '⚡ NIVEL MEDIO', 220, 135);
  }

  // Visual Gauge Bar
  const maxStock = Math.max(50, minStock * 4);
  const ratio = Math.max(0, Math.min(1.0, stock / maxStock));

  ctx.fillStyle = '#1e293b';
  ctx.fillRect(24, 175, 464, 30);

  ctx.fillStyle = isCritical ? '#ef4444' : isOptimal ? '#10b981' : '#f59e0b';
  ctx.fillRect(24, 175, 464 * ratio, 30);

  // Min stock line marker
  const minMarkerX = 24 + 464 * (minStock / maxStock);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(minMarkerX, 168);
  ctx.lineTo(minMarkerX, 212);
  ctx.stroke();

  ctx.fillStyle = '#cbd5e1';
  ctx.font = '14px sans-serif';
  ctx.fillText(`Pto. Reorden: ${minStock}`, Math.min(360, minMarkerX - 40), 232);
}

export function createStockGaugeBillboard(
  productName: string,
  stock: number,
  minStock: number
): { group: THREE.Group; update: (name: string, s: number, m: number) => void } {
  const group = new THREE.Group();

  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  updateStockCanvas(canvas, productName, stock, minStock);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;

  const mat = new THREE.MeshStandardMaterial({
    map: texture,
    roughness: 0.25,
    metalness: 0.1,
  });

  const boardGeo = new THREE.BoxGeometry(2.8, 1.4, 0.08);
  const board = new THREE.Mesh(boardGeo, mat);
  group.add(board);

  // Twin support poles
  const poleGeo = new THREE.CylinderGeometry(0.04, 0.04, 1.2, 8);
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.6 });
  [-1.0, 1.0].forEach((x) => {
    const pole = new THREE.Mesh(poleGeo, poleMat);
    pole.position.set(x, -1.0, 0);
    group.add(pole);
  });

  return {
    group,
    update: (name: string, s: number, m: number) => {
      updateStockCanvas(canvas, name, s, m);
      texture.needsUpdate = true;
    },
  };
}

/**
 * 12. MANUAL HAND PALLET TRUCK (TRANSPALETA MANUAL)
 */
export function createHandPalletTruck(m: DioramaMaterials): THREE.Group {
  const truck = new THREE.Group();

  // Low dual steel forks
  const forkGeo = new THREE.BoxGeometry(0.12, 0.05, 1.1);
  [-0.18, 0.18].forEach((x) => {
    const fork = new THREE.Mesh(forkGeo, m.plasticYellow);
    fork.position.set(x, 0.08, 0.5);
    fork.castShadow = true;
    truck.add(fork);
  });

  // Front hydraulic housing
  const houseGeo = new THREE.BoxGeometry(0.5, 0.45, 0.25);
  const house = new THREE.Mesh(houseGeo, m.plasticYellow);
  house.position.set(0, 0.28, 0);
  house.castShadow = true;
  truck.add(house);

  // Steering tiller handle
  const tillerGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.85, 8);
  const tiller = new THREE.Mesh(tillerGeo, m.darkMetal);
  tiller.rotation.x = -0.4;
  tiller.position.set(0, 0.65, -0.2);
  truck.add(tiller);

  // Handle loop
  const loopGeo = new THREE.TorusGeometry(0.1, 0.02, 8, 16);
  const loop = new THREE.Mesh(loopGeo, m.darkMetal);
  loop.position.set(0, 0.95, -0.38);
  truck.add(loop);

  // Steer rollers
  const wheelGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.06, 12);
  wheelGeo.rotateZ(Math.PI / 2);
  [-0.15, 0.15].forEach((x) => {
    const w = new THREE.Mesh(wheelGeo, m.rubberBlack);
    w.position.set(x, 0.08, 0);
    truck.add(w);
  });

  // Mini pallet with tool boxes stacked on it
  const pal = createWoodenPallet(m, 0.8, 0.1, 0.8);
  pal.position.set(0, 0.1, 0.5);
  truck.add(pal);

  const boxGeo = new THREE.BoxGeometry(0.65, 0.35, 0.65);
  const box = new THREE.Mesh(boxGeo, m.cardboard);
  box.position.set(0, 0.35, 0.5);
  box.castShadow = true;
  truck.add(box);

  return truck;
}

/**
 * 13. QUEUE STANCHIONS (POSTES DE FILA CON CORDÓN)
 */
export function createQueueStanchions(m: DioramaMaterials, count = 3): THREE.Group {
  const group = new THREE.Group();
  const poleGeo = new THREE.CylinderGeometry(0.025, 0.025, 0.9, 12);
  const baseGeo = new THREE.CylinderGeometry(0.16, 0.18, 0.04, 16);
  const ballGeo = new THREE.SphereGeometry(0.04, 10, 10);

  for (let i = 0; i < count; i++) {
    const post = new THREE.Group();
    const base = new THREE.Mesh(baseGeo, m.steelChrome);
    base.position.y = 0.02;
    post.add(base);

    const pole = new THREE.Mesh(poleGeo, m.steelChrome);
    pole.position.y = 0.45;
    post.add(pole);

    const ball = new THREE.Mesh(ballGeo, m.steelChrome);
    ball.position.y = 0.92;
    post.add(ball);

    post.position.set(-1.0 + (i - 1) * 0.9, 0, 7.6);
    group.add(post);
  }

  // Velvet rope curve
  const ropeCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-1.9, 0.82, 7.6),
    new THREE.Vector3(-1.45, 0.72, 7.6),
    new THREE.Vector3(-1.0, 0.82, 7.6),
    new THREE.Vector3(-0.55, 0.72, 7.6),
    new THREE.Vector3(-0.1, 0.82, 7.6),
  ]);
  const ropeGeo = new THREE.TubeGeometry(ropeCurve, 24, 0.018, 8, false);
  const ropeMat = new THREE.MeshStandardMaterial({ color: 0x991b1b, roughness: 0.6 });
  const rope = new THREE.Mesh(ropeGeo, ropeMat);
  group.add(rope);

  return group;
}

/**
 * 14. FLOATING 3D STOCK BADGE SPRITE (+1 GREEN / -1 RED)
 */
export function createFloatingStockSprite(type: '+1' | '-1'): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 384;
  canvas.height = 160;
  const ctx = canvas.getContext('2d')!;

  const isPlus = type === '+1';
  // Gradient background
  const grad = ctx.createLinearGradient(0, 0, 384, 160);
  if (isPlus) {
    grad.addColorStop(0, '#10b981');
    grad.addColorStop(1, '#047857');
  } else {
    grad.addColorStop(0, '#f43f5e');
    grad.addColorStop(1, '#b91c1c');
  }
  ctx.fillStyle = grad;
  ctx.beginPath();
  if (ctx.roundRect) {
    ctx.roundRect(8, 8, 368, 144, 28);
  } else {
    ctx.rect(8, 8, 368, 144);
  }
  ctx.fill();

  // Glow Border
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 6;
  ctx.stroke();

  // Big number tag
  ctx.fillStyle = '#ffffff';
  ctx.font = '900 58px "Plus Jakarta Sans", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(isPlus ? '+1 SURTIDO' : '-1 ENTREGA', 192, 60);

  // Subtitle
  ctx.fillStyle = '#fef08a';
  ctx.font = 'bold 26px "Plus Jakarta Sans", sans-serif';
  ctx.fillText(isPlus ? '▲ REABASTECIMIENTO' : '▼ DESPACHADO', 192, 116);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;

  const mat = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    opacity: 1.0,
    depthTest: false,
  });

  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(2.8, 1.2, 1.0);
  return sprite;
}

/**
 * 15. FLOATING 3D BOX TRACKING & VALIDATION IDENTIFIER SPRITE
 * Shows unique tracking ID (#BX-01), destination tag, product name, and validation status (✓ VALIDADO).
 */
export function createPackageTrackingSprite(
  trackingId: string,
  destination: 'caja' | 'domicilio' | 'carga',
  productName: string,
  category: string = 'General',
  isValidated: boolean = true
): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 220;
  const ctx = canvas.getContext('2d')!;

  // Background Slate Card
  ctx.fillStyle = 'rgba(10, 15, 29, 0.92)';
  ctx.beginPath();
  if (ctx.roundRect) {
    ctx.roundRect(8, 8, 496, 204, 24);
  } else {
    ctx.rect(8, 8, 496, 204);
  }
  ctx.fill();

  // Border colored by destination
  let strokeColor = '#38bdf8';
  let destBadgeText = 'DOMICILIO';
  let destBadgeBg = '#f59e0b';
  if (destination === 'caja') {
    strokeColor = '#10b981';
    destBadgeText = 'MOSTRADOR';
    destBadgeBg = '#10b981';
  } else if (destination === 'carga') {
    strokeColor = '#06b6d4';
    destBadgeText = 'PROVEEDOR (+1)';
    destBadgeBg = '#06b6d4';
  } else {
    strokeColor = '#f59e0b';
    destBadgeText = 'DOMICILIO (-1)';
    destBadgeBg = '#f59e0b';
  }

  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = 6;
  ctx.stroke();

  // Top Row: Tracking ID Pill & Destination Pill
  // ID Pill (Dark with bright yellow/amber text)
  ctx.fillStyle = '#1e293b';
  ctx.beginPath();
  if (ctx.roundRect) {
    ctx.roundRect(24, 22, 150, 48, 12);
  } else {
    ctx.rect(24, 22, 150, 48);
  }
  ctx.fill();
  ctx.fillStyle = '#fef08a';
  ctx.font = 'bold 26px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(trackingId, 99, 46);

  // Destination Pill
  ctx.fillStyle = destBadgeBg;
  ctx.beginPath();
  if (ctx.roundRect) {
    ctx.roundRect(188, 22, 175, 48, 12);
  } else {
    ctx.rect(188, 22, 175, 48);
  }
  ctx.fill();
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 20px "Plus Jakarta Sans", sans-serif';
  ctx.fillText(destBadgeText, 275, 46);

  // Validation Checkmark Badge
  ctx.fillStyle = isValidated ? '#15803d' : '#ca8a04';
  ctx.beginPath();
  if (ctx.roundRect) {
    ctx.roundRect(375, 22, 115, 48, 12);
  } else {
    ctx.rect(375, 22, 115, 48);
  }
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 18px "Plus Jakarta Sans", sans-serif';
  ctx.fillText(isValidated ? '✓ OK' : '⏳ PEND', 432, 46);

  // Middle Row: Product Name (Truncated cleanly)
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 30px "Plus Jakarta Sans", sans-serif';
  ctx.textAlign = 'left';
  const displayProd = productName.length > 22 ? productName.substring(0, 20) + '...' : productName;
  ctx.fillText(displayProd, 26, 115);

  // Bottom Row: Category & Quality Check Indicators
  ctx.fillStyle = '#94a3b8';
  ctx.font = 'bold 18px "Plus Jakarta Sans", sans-serif';
  ctx.fillText(`Cat: ${category}`, 26, 170);

  ctx.fillStyle = '#4ade80';
  ctx.font = 'bold 17px monospace';
  ctx.textAlign = 'right';
  ctx.fillText('|||| EAN-13 | PESO OK | SELLO ✓', 486, 170);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;

  const mat = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    opacity: 0.98,
    depthTest: false,
  });

  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(1.85, 0.8, 1.0);
  return sprite;
}

/**
 * 16. RICH 3D DELIVERY MILESTONE CELEBRATION SPRITE
 * Shows destination in bold, glowing colors, package tracking ID, full product name, and business impact.
 * Far superior to just "+1/-1".
 */
export function createDeliveryMilestoneSprite(
  destination: 'caja' | 'domicilio' | 'carga',
  productName: string,
  trackingId: string = '#BX-01'
): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 240;
  const ctx = canvas.getContext('2d')!;

  let gradStart = '#10b981';
  let gradEnd = '#065f46';
  let bannerText = '🟢 ¡ENTREGA EN TIENDA CONFIRMADA!';
  let locationDetail = '🏪 RETIRADO POR CLIENTE EN MOSTRADOR';
  let impactText = '✓ Cobrado en Caja • Stock Tienda -1 • Venta Registrada';
  let borderColor = '#34d399';

  if (destination === 'domicilio') {
    gradStart = '#f97316';
    gradEnd = '#9a3412';
    bannerText = '🟠 ¡ENTREGA A DOMICILIO EXITOSA!';
    locationDetail = '🚚 ENTREGADO EN PUERTA POR REPARTIDOR';
    impactText = '✓ Firma Digital OK • Stock -1 • Cliente Satisfecho';
    borderColor = '#fb923c';
  } else if (destination === 'carga') {
    gradStart = '#06b6d4';
    gradEnd = '#155e75';
    bannerText = '🔵 ¡REABASTECIMIENTO COMPLETADO!';
    locationDetail = '📥 DESCARGADO DE MUELLE A RACKS BODEGA';
    impactText = '✓ Control Calidad OK • Stock +1 • Inventario Actualizado';
    borderColor = '#38bdf8';
  }

  // Dark translucent backing
  ctx.fillStyle = 'rgba(10, 15, 29, 0.94)';
  ctx.beginPath();
  if (ctx.roundRect) {
    ctx.roundRect(8, 8, 496, 224, 24);
  } else {
    ctx.rect(8, 8, 496, 224);
  }
  ctx.fill();

  // Glow border in destination color
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = 6;
  ctx.stroke();

  // Top Title Ribbon with gradient
  const grad = ctx.createLinearGradient(16, 16, 496, 68);
  grad.addColorStop(0, gradStart);
  grad.addColorStop(1, gradEnd);
  ctx.fillStyle = grad;
  ctx.beginPath();
  if (ctx.roundRect) {
    ctx.roundRect(16, 16, 480, 52, 14);
  } else {
    ctx.rect(16, 16, 480, 52);
  }
  ctx.fill();

  // Title text
  ctx.fillStyle = '#ffffff';
  ctx.font = '900 22px "Plus Jakarta Sans", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(bannerText, 256, 42);

  // Middle Row: Tracking ID Pill & Product Name
  ctx.fillStyle = '#1e293b';
  ctx.beginPath();
  if (ctx.roundRect) {
    ctx.roundRect(24, 78, 110, 38, 10);
  } else {
    ctx.rect(24, 78, 110, 38);
  }
  ctx.fill();
  ctx.strokeStyle = '#fef08a';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = '#fef08a';
  ctx.font = 'bold 20px monospace';
  ctx.fillText(trackingId, 79, 97);

  // Product Name
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 24px "Plus Jakarta Sans", sans-serif';
  ctx.textAlign = 'left';
  const truncProd = productName.length > 24 ? productName.substring(0, 22) + '...' : productName;
  ctx.fillText(truncProd, 148, 97);

  // Subtitle / Location detail
  ctx.fillStyle = '#94a3b8';
  ctx.font = 'bold 16px "Plus Jakarta Sans", sans-serif';
  ctx.fillText(locationDetail, 26, 145);

  // Bottom impact badge
  ctx.fillStyle = 'rgba(30, 41, 59, 0.8)';
  ctx.beginPath();
  if (ctx.roundRect) {
    ctx.roundRect(24, 170, 464, 46, 10);
  } else {
    ctx.rect(24, 170, 464, 46);
  }
  ctx.fill();

  ctx.fillStyle = borderColor;
  ctx.font = 'bold 15px "Plus Jakarta Sans", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(impactText, 256, 193);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;

  const mat = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    opacity: 1.0,
    depthTest: false,
  });

  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(3.4, 1.6, 1.0);
  return sprite;
}

/**
 * 17. EXPANDING 3D SHOCKWAVE RING FOR DELIVERY CELEBRATION
 */
export function createShockwaveMesh(color: number): THREE.Mesh {
  const geo = new THREE.RingGeometry(0.2, 0.45, 32);
  const mat = new THREE.MeshBasicMaterial({
    color,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const ring = new THREE.Mesh(geo, mat);
  ring.rotation.x = -Math.PI / 2;
  return ring;
}

/**
 * 18. MODULAR ROUNDED PODIUM PLATFORM (Matches the maqueta's floating islands)
 */
export function createModularPodium(
  width: number,
  depth: number,
  height: number = 0.5,
  radius: number = 0.7,
  topTexture?: THREE.CanvasTexture,
  rimColor: number = 0x38bdf8
): THREE.Group {
  const group = new THREE.Group();

  // Create rounded rectangle 2D shape
  const shape = new THREE.Shape();
  const x = -width / 2;
  const y = -depth / 2;
  const r = Math.min(radius, width / 3, depth / 3);

  shape.moveTo(x + r, y);
  shape.lineTo(x + width - r, y);
  shape.quadraticCurveTo(x + width, y, x + width, y + r);
  shape.lineTo(x + width, y + depth - r);
  shape.quadraticCurveTo(x + width, y + depth, x + width - r, y + depth);
  shape.lineTo(x + r, y + depth);
  shape.quadraticCurveTo(x, y + depth, x, y + depth - r);
  shape.lineTo(x, y + r);
  shape.quadraticCurveTo(x, y, x + r, y);

  const extrudeSettings: THREE.ExtrudeGeometryOptions = {
    steps: 1,
    depth: height,
    bevelEnabled: true,
    bevelThickness: 0.08,
    bevelSize: 0.08,
    bevelSegments: 4,
  };

  const geo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
  geo.rotateX(Math.PI / 2); // Orient horizontal so +Y is up

  // Base architectural side/body material
  const sideMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0, // Clean architectural off-white / light silver
    roughness: 0.35,
    metalness: 0.2,
  });

  // Top surface material
  const topMat = topTexture
    ? new THREE.MeshStandardMaterial({
        map: topTexture,
        roughness: 0.6,
        metalness: 0.15,
      })
    : new THREE.MeshStandardMaterial({
        color: 0x1e293b,
        roughness: 0.5,
        metalness: 0.2,
      });

  const podiumMesh = new THREE.Mesh(geo, [topMat, sideMat]);
  podiumMesh.position.y = height + 0.08;
  podiumMesh.receiveShadow = true;
  podiumMesh.castShadow = true;
  group.add(podiumMesh);

  // Glowing perimeter outline rim tube
  const rimPoints: THREE.Vector3[] = [];
  const segments = 48;
  // Sample perimeter points around rounded rect
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const pt = shape.getPoint(t);
    rimPoints.push(new THREE.Vector3(pt.x, height + 0.09, -pt.y));
  }
  const rimCurve = new THREE.CatmullRomCurve3(rimPoints, true);
  const rimGeo = new THREE.TubeGeometry(rimCurve, 64, 0.035, 8, true);
  const rimMat = new THREE.MeshStandardMaterial({
    color: rimColor,
    emissive: rimColor,
    emissiveIntensity: 0.6,
    roughness: 0.2,
    metalness: 0.8,
  });
  const rimMesh = new THREE.Mesh(rimGeo, rimMat);
  group.add(rimMesh);

  // Soft ambient contact shadow disk underneath
  const shadowGeo = new THREE.PlaneGeometry(width * 1.08, depth * 1.08);
  const shadowMat = new THREE.MeshBasicMaterial({
    color: 0x050811,
    transparent: true,
    opacity: 0.5,
    depthWrite: false,
  });
  const shadowPlane = new THREE.Mesh(shadowGeo, shadowMat);
  shadowPlane.rotation.x = -Math.PI / 2;
  shadowPlane.position.y = 0.01;
  group.add(shadowPlane);

  return group;
}

/**
 * 19. 3D FLOATING NEON BADGE SIGN (Exact match to reference maqueta: 'ALMACÉN / SPA', etc.)
 */
export function createNeonZoneBadge(title: string, subtitle: string = 'SPA', poleHeight: number = 3.6): THREE.Group {
  const group = new THREE.Group();

  const signWidth = 2.6;
  const signHeight = 0.68;
  const signDepth = 0.08;

  // Sign face texture
  const tex = createNeonSignboardTexture(title, subtitle);

  // Front & Back face mesh
  const faceGeo = new THREE.PlaneGeometry(signWidth, signHeight);
  const faceMat = new THREE.MeshStandardMaterial({
    map: tex,
    roughness: 0.2,
    metalness: 0.1,
    emissive: 0x06b6d4,
    emissiveIntensity: 0.35,
    side: THREE.DoubleSide,
  });
  const faceMesh = new THREE.Mesh(faceGeo, faceMat);
  faceMesh.position.y = poleHeight;
  group.add(faceMesh);

  // Glowing Outer Bezel Frame
  const frameGeo = new THREE.BoxGeometry(signWidth + 0.08, signHeight + 0.08, signDepth);
  const frameMat = new THREE.MeshStandardMaterial({
    color: 0x0284c7,
    emissive: 0x06b6d4,
    emissiveIntensity: 0.7,
    roughness: 0.25,
    metalness: 0.8,
  });
  const frameMesh = new THREE.Mesh(frameGeo, frameMat);
  frameMesh.position.y = poleHeight;
  frameMesh.position.z = -0.01;
  group.add(frameMesh);

  // Twin slender mounting poles
  const poleGeo = new THREE.CylinderGeometry(0.02, 0.02, poleHeight, 8);
  const poleMat = new THREE.MeshStandardMaterial({
    color: 0x64748b,
    metalness: 0.85,
    roughness: 0.2,
  });
  [-signWidth * 0.38, signWidth * 0.38].forEach((px) => {
    const pole = new THREE.Mesh(poleGeo, poleMat);
    pole.position.set(px, poleHeight / 2, 0);
    group.add(pole);

    // Pole base ring
    const baseGeo = new THREE.CylinderGeometry(0.06, 0.08, 0.04, 12);
    const base = new THREE.Mesh(baseGeo, poleMat);
    base.position.set(px, 0.02, 0);
    group.add(base);
  });

  return group;
}

/**
 * 20. LOGÍSTICA / SPA: OPERATIONS CONTROL ROOM (NOC)
 * Features glowing multi-display video wall, dual workstations with operators, server rack.
 */
export function createLogisticsControlRoom(m: DioramaMaterials): THREE.Group {
  const group = new THREE.Group();

  // White architectural back wall
  const wallWidth = 7.8;
  const wallHeight = 3.2;
  const wallGeo = new THREE.BoxGeometry(wallWidth, wallHeight, 0.25);
  const wallMat = new THREE.MeshStandardMaterial({
    color: 0xf1f5f9,
    roughness: 0.4,
    metalness: 0.1,
  });
  const backWall = new THREE.Mesh(wallGeo, wallMat);
  backWall.position.set(0, wallHeight / 2, -2.6);
  backWall.receiveShadow = true;
  backWall.castShadow = true;
  group.add(backWall);

  // Top architectural wall cap with cyan LED strip
  const capGeo = new THREE.BoxGeometry(wallWidth + 0.2, 0.1, 0.35);
  const capMat = new THREE.MeshStandardMaterial({
    color: 0x0284c7,
    emissive: 0x38bdf8,
    emissiveIntensity: 0.5,
  });
  const cap = new THREE.Mesh(capGeo, capMat);
  cap.position.set(0, wallHeight + 0.05, -2.6);
  group.add(cap);

  // 3 Big NOC Video Wall Displays
  // 1. Center Map Screen
  const mapTex = createNocScreenTexture('map');
  const screenCenterGeo = new THREE.BoxGeometry(3.0, 1.8, 0.08);
  const screenCenterMat = new THREE.MeshStandardMaterial({
    map: mapTex,
    emissive: 0x38bdf8,
    emissiveIntensity: 0.45,
    roughness: 0.2,
  });
  const screenCenter = new THREE.Mesh(screenCenterGeo, screenCenterMat);
  screenCenter.position.set(0, 1.9, -2.44);
  group.add(screenCenter);

  // 2. Left Charts Screen
  const chartsTex = createNocScreenTexture('charts');
  const screenLeftGeo = new THREE.BoxGeometry(2.0, 1.8, 0.08);
  const screenLeftMat = new THREE.MeshStandardMaterial({
    map: chartsTex,
    emissive: 0x38bdf8,
    emissiveIntensity: 0.45,
    roughness: 0.2,
  });
  const screenLeft = new THREE.Mesh(screenLeftGeo, screenLeftMat);
  screenLeft.position.set(-2.6, 1.9, -2.44);
  group.add(screenLeft);

  // 3. Right Telemetry Screen
  const telemetryTex = createNocScreenTexture('telemetry');
  const screenRightGeo = new THREE.BoxGeometry(2.0, 1.8, 0.08);
  const screenRightMat = new THREE.MeshStandardMaterial({
    map: telemetryTex,
    emissive: 0x38bdf8,
    emissiveIntensity: 0.45,
    roughness: 0.2,
  });
  const screenRight = new THREE.Mesh(screenRightGeo, screenRightMat);
  screenRight.position.set(2.6, 1.9, -2.44);
  group.add(screenRight);

  // Workstation Desks with curved dual monitors & chairs
  [-1.6, 1.6].forEach((dx) => {
    const deskGroup = new THREE.Group();
    deskGroup.position.set(dx, 0, -0.6);

    // Modern white desk surface
    const deskGeo = new THREE.BoxGeometry(2.2, 0.08, 1.0);
    const deskTop = new THREE.Mesh(deskGeo, wallMat);
    deskTop.position.y = 0.8;
    deskTop.castShadow = true;
    deskGroup.add(deskTop);

    // Chrome legs
    const legGeo = new THREE.BoxGeometry(0.06, 0.8, 0.9);
    [-0.95, 0.95].forEach((lx) => {
      const leg = new THREE.Mesh(legGeo, m.steelChrome);
      leg.position.set(lx, 0.4, 0);
      deskGroup.add(leg);
    });

    // Dual Monitors on desk
    const monGeo = new THREE.BoxGeometry(0.75, 0.45, 0.04);
    const monScreenMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      emissive: 0x0ea5e9,
      emissiveIntensity: 0.5,
    });
    [-0.42, 0.42].forEach((mx, mIdx) => {
      const mon = new THREE.Mesh(monGeo, monScreenMat);
      mon.position.set(mx, 1.15, -0.15);
      mon.rotation.y = mIdx === 0 ? 0.15 : -0.15;
      deskGroup.add(mon);

      const monStandGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.3, 8);
      const monStand = new THREE.Mesh(monStandGeo, m.darkMetal);
      monStand.position.set(mx, 0.95, -0.15);
      deskGroup.add(monStand);
    });

    // Keyboard & Mousepad
    const kbGeo = new THREE.BoxGeometry(0.45, 0.015, 0.16);
    const kb = new THREE.Mesh(kbGeo, m.darkMetal);
    kb.position.set(0, 0.85, 0.15);
    deskGroup.add(kb);

    // Operator Swivel Chair
    const chairGroup = new THREE.Group();
    chairGroup.position.set(0, 0, 0.6);

    const seatGeo = new THREE.BoxGeometry(0.5, 0.08, 0.48);
    const chairMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.7 });
    const seat = new THREE.Mesh(seatGeo, chairMat);
    seat.position.y = 0.52;
    chairGroup.add(seat);

    const backGeo = new THREE.BoxGeometry(0.48, 0.55, 0.06);
    const back = new THREE.Mesh(backGeo, chairMat);
    back.position.set(0, 0.82, 0.22);
    chairGroup.add(back);

    const stemGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.5, 8);
    const stem = new THREE.Mesh(stemGeo, m.steelChrome);
    stem.position.y = 0.25;
    chairGroup.add(stem);

    deskGroup.add(chairGroup);

    // Operator human figure seated
    const operator = createHumanFigure(m, 'cajero');
    operator.position.set(0, 0, 0.6);
    operator.rotation.y = Math.PI; // Looking at monitors
    deskGroup.add(operator);

    group.add(deskGroup);
  });

  // Server rack tower at right side
  const rackGeo = new THREE.BoxGeometry(0.7, 2.2, 0.8);
  const rackMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    roughness: 0.4,
    metalness: 0.8,
  });
  const serverRack = new THREE.Mesh(rackGeo, rackMat);
  serverRack.position.set(3.4, 1.1, -1.2);
  serverRack.castShadow = true;
  group.add(serverRack);

  // Blinking server LEDs
  for (let y = 0.4; y < 2.0; y += 0.22) {
    const ledGeo = new THREE.BoxGeometry(0.55, 0.03, 0.02);
    const ledMat = new THREE.MeshBasicMaterial({
      color: Math.random() > 0.4 ? 0x22c55e : 0x06b6d4,
    });
    const led = new THREE.Mesh(ledGeo, ledMat);
    led.position.set(3.4, y, -0.79);
    group.add(led);
  }

  return group;
}

/**
 * 21. SURTIDO / SPA: CENTRAL PACKING & SORTING ISLAND
 * Features dual packing workbenches, central roller conveyor, tools, scales, cartons, and 3 workers.
 */
export function createSurtidoWorkstations(m: DioramaMaterials): THREE.Group {
  const group = new THREE.Group();

  // Central roller conveyor line running through the island
  const conveyor = createConveyorBelt(m, 5.8);
  conveyor.position.set(0, 0, 0);
  group.add(conveyor);

  // 2 Parallel Industrial Packaging Workbenches (North & South of conveyor)
  [-1.3, 1.3].forEach((tblZ, tIdx) => {
    const tableGroup = new THREE.Group();
    tableGroup.position.set(0, 0, tblZ);

    // Heavy duty steel frame
    const topGeo = new THREE.BoxGeometry(4.2, 0.08, 0.95);
    const topMat = new THREE.MeshStandardMaterial({
      color: 0x475569, // Laminated slate workbench
      roughness: 0.5,
      metalness: 0.3,
    });
    const tableTop = new THREE.Mesh(topGeo, topMat);
    tableTop.position.y = 0.85;
    tableTop.castShadow = true;
    tableGroup.add(tableTop);

    // Steel leg frame
    const legGeo = new THREE.BoxGeometry(0.08, 0.85, 0.85);
    [-1.9, 1.9].forEach((lx) => {
      const leg = new THREE.Mesh(legGeo, m.rackUpright);
      leg.position.set(lx, 0.425, 0);
      tableGroup.add(leg);
    });

    // Lower storage shelf with folded cartons
    const shelfGeo = new THREE.BoxGeometry(3.6, 0.04, 0.7);
    const shelf = new THREE.Mesh(shelfGeo, m.darkMetal);
    shelf.position.y = 0.25;
    tableGroup.add(shelf);

    // Stacks of flat cartons under table
    for (let c = 0; c < 3; c++) {
      const flatGeo = new THREE.BoxGeometry(0.7, 0.12, 0.5);
      const flat = new THREE.Mesh(flatGeo, m.cardboard);
      flat.position.set(-1.0 + c * 0.9, 0.33, 0);
      tableGroup.add(flat);
    }

    // Overhead tool / light rail
    const poleGeo = new THREE.CylinderGeometry(0.02, 0.02, 1.2, 8);
    [-1.8, 1.8].forEach((px) => {
      const pole = new THREE.Mesh(poleGeo, m.steelChrome);
      pole.position.set(px, 1.45, -0.38 * (tIdx === 0 ? 1 : -1));
      tableGroup.add(pole);
    });
    const railGeo = new THREE.BoxGeometry(3.8, 0.04, 0.04);
    const rail = new THREE.Mesh(railGeo, m.steelChrome);
    rail.position.set(0, 2.05, -0.38 * (tIdx === 0 ? 1 : -1));
    tableGroup.add(rail);

    // Overhead fluorescent fixture
    const lampGeo = new THREE.BoxGeometry(3.2, 0.06, 0.15);
    const lampMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xffedd5,
      emissiveIntensity: 0.8,
    });
    const lamp = new THREE.Mesh(lampGeo, lampMat);
    lamp.position.set(0, 2.0, -0.38 * (tIdx === 0 ? 1 : -1));
    tableGroup.add(lamp);

    // Tabletop tools: digital scale, tape dispenser, barcode scanner
    const scaleGeo = new THREE.BoxGeometry(0.5, 0.05, 0.4);
    const scaleMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.8 });
    const scale = new THREE.Mesh(scaleGeo, scaleMat);
    scale.position.set(-1.2, 0.9, 0);
    tableGroup.add(scale);

    const tapeGeo = new THREE.CylinderGeometry(0.1, 0.1, 0.08, 12);
    tapeGeo.rotateX(Math.PI / 2);
    const tape = new THREE.Mesh(tapeGeo, m.plasticOrange);
    tape.position.set(0.8, 0.95, 0.2);
    tableGroup.add(tape);

    // Open box being packed
    const packBoxGeo = new THREE.BoxGeometry(0.55, 0.4, 0.45);
    const packBox = new THREE.Mesh(packBoxGeo, m.cardboard);
    packBox.position.set(-0.2, 1.08, 0);
    packBox.castShadow = true;
    tableGroup.add(packBox);

    group.add(tableGroup);
  });

  // 3 Surtido packaging workers
  const worker1 = createHumanFigure(m, 'despachador');
  worker1.position.set(-0.8, 0, -2.1);
  worker1.rotation.y = 0; // facing table
  group.add(worker1);

  const worker2 = createHumanFigure(m, 'almacenista');
  worker2.position.set(1.0, 0, -2.1);
  worker2.rotation.y = 0;
  group.add(worker2);

  const worker3 = createHumanFigure(m, 'despachador');
  worker3.position.set(0, 0, 2.1);
  worker3.rotation.y = Math.PI; // facing table from south
  group.add(worker3);

  return group;
}

/**
 * 22. MODERN DELIVERY VAN (White with blue/orange logistics stripes, wheels, windshield)
 */
export function createDeliveryVanMesh(m: DioramaMaterials, accentColor: number = 0x2563eb): THREE.Group {
  const van = new THREE.Group();

  // Main chassis & body
  const bodyGeo = new THREE.BoxGeometry(1.8, 1.3, 3.8);
  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0xf8fafc, // Clean white van body
    roughness: 0.25,
    metalness: 0.1,
  });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.position.y = 0.95;
  body.castShadow = true;
  van.add(body);

  // Cabin front slope
  const cabGeo = new THREE.BoxGeometry(1.78, 0.95, 1.2);
  const cab = new THREE.Mesh(cabGeo, bodyMat);
  cab.position.set(0, 0.8, 1.8);
  van.add(cab);

  // Windshield & side glass
  const glassGeo = new THREE.BoxGeometry(1.7, 0.65, 0.9);
  const glass = new THREE.Mesh(glassGeo, m.glass);
  glass.position.set(0, 1.15, 1.6);
  van.add(glass);

  // Corporate accent color stripe along sides
  const stripeGeo = new THREE.BoxGeometry(1.82, 0.22, 3.6);
  const stripeMat = new THREE.MeshStandardMaterial({
    color: accentColor,
    roughness: 0.3,
    metalness: 0.2,
  });
  const stripe = new THREE.Mesh(stripeGeo, stripeMat);
  stripe.position.set(0, 0.75, 0);
  van.add(stripe);

  // Roof AC pod
  const acGeo = new THREE.BoxGeometry(0.8, 0.16, 1.1);
  const ac = new THREE.Mesh(acGeo, m.darkMetal);
  ac.position.set(0, 1.68, -0.4);
  van.add(ac);

  // Headlights
  const lightGeo = new THREE.BoxGeometry(0.28, 0.16, 0.05);
  const lightMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0xfef08a,
    emissiveIntensity: 0.9,
  });
  [-0.65, 0.65].forEach((lx) => {
    const hl = new THREE.Mesh(lightGeo, lightMat);
    hl.position.set(lx, 0.75, 2.41);
    van.add(hl);
  });

  // 4 Wheels
  const wheelGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.22, 16);
  wheelGeo.rotateZ(Math.PI / 2);
  [-0.92, 0.92].forEach((wx) => {
    // Front wheel
    const wf = new THREE.Mesh(wheelGeo, m.rubberBlack);
    wf.position.set(wx, 0.32, 1.4);
    wf.castShadow = true;
    van.add(wf);

    // Rear wheel
    const wr = new THREE.Mesh(wheelGeo, m.rubberBlack);
    wr.position.set(wx, 0.32, -1.2);
    wr.castShadow = true;
    van.add(wr);
  });

  return van;
}

/**
 * 23. CARGO BOX TRUCK (Orange Cab + White Cargo Box + Roll-up Door)
 */
export function createCargoBoxTruck(m: DioramaMaterials): THREE.Group {
  const truck = new THREE.Group();

  // Orange Cab
  const cabGeo = new THREE.BoxGeometry(1.9, 1.6, 1.6);
  const cab = new THREE.Mesh(cabGeo, m.plasticOrange);
  cab.position.set(0, 1.1, 1.8);
  cab.castShadow = true;
  truck.add(cab);

  // Cab windshield
  const windGeo = new THREE.BoxGeometry(1.82, 0.7, 0.1);
  const wind = new THREE.Mesh(windGeo, m.glass);
  wind.position.set(0, 1.35, 2.6);
  truck.add(wind);

  // Large White Cargo Box
  const boxGeo = new THREE.BoxGeometry(2.1, 2.1, 3.8);
  const boxMat = new THREE.MeshStandardMaterial({
    color: 0xf8fafc,
    roughness: 0.3,
    metalness: 0.1,
  });
  const cargoBox = new THREE.Mesh(boxGeo, boxMat);
  cargoBox.position.set(0, 1.45, -0.9);
  cargoBox.castShadow = true;
  truck.add(cargoBox);

  // Rear roll-up door
  const doorGeo = new THREE.BoxGeometry(1.85, 1.85, 0.05);
  const doorMat = new THREE.MeshStandardMaterial({
    color: 0x94a3b8,
    metalness: 0.7,
    roughness: 0.4,
  });
  const rollDoor = new THREE.Mesh(doorGeo, doorMat);
  rollDoor.position.set(0, 1.4, -2.81);
  truck.add(rollDoor);

  // 6 Wheels (2 front, 4 rear dual)
  const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.26, 16);
  wheelGeo.rotateZ(Math.PI / 2);
  [-1.0, 1.0].forEach((wx) => {
    // Front
    const wf = new THREE.Mesh(wheelGeo, m.rubberBlack);
    wf.position.set(wx, 0.38, 1.6);
    truck.add(wf);

    // Rear 1
    const wr1 = new THREE.Mesh(wheelGeo, m.rubberBlack);
    wr1.position.set(wx, 0.38, -0.6);
    truck.add(wr1);

    // Rear 2
    const wr2 = new THREE.Mesh(wheelGeo, m.rubberBlack);
    wr2.position.set(wx, 0.38, -1.8);
    truck.add(wr2);
  });

  return truck;
}

/**
 * 24. ENTREGAS / SPA: LOADING DOCK & VEHICLE DISPATCH PLATFORM
 * Features asphalt parking bays, sloped ramp, 2 delivery vans, 1 cargo truck, and dock workers.
 */
export function createEntregasDock(m: DioramaMaterials): THREE.Group {
  const group = new THREE.Group();

  // Sloped access ramp down to ground level
  const rampGeo = new THREE.BoxGeometry(2.6, 0.5, 4.2);
  const rampMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    roughness: 0.8,
  });
  const ramp = new THREE.Mesh(rampGeo, rampMat);
  ramp.position.set(-4.2, 0.22, 1.0);
  ramp.rotation.z = 0.09; // Gentle slope
  group.add(ramp);

  // Loading Bay Raised Canopy / Wall Frame at the back
  const canopyWallGeo = new THREE.BoxGeometry(8.5, 3.2, 0.3);
  const canopyWallMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.5,
  });
  const canopyWall = new THREE.Mesh(canopyWallGeo, canopyWallMat);
  canopyWall.position.set(0, 1.6, -3.2);
  group.add(canopyWall);

  // Yellow Safety Bollards along dock edge
  const bollardGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.8, 12);
  [-3.2, -1.0, 1.0, 3.2].forEach((bx) => {
    const bollard = new THREE.Mesh(bollardGeo, m.hazardTape);
    bollard.position.set(bx, 0.4, -2.8);
    group.add(bollard);
  });

  // Vehicle 1: Modern Delivery Van (Blue stripe) parked in Bay 1
  const van1 = createDeliveryVanMesh(m, 0x2563eb);
  van1.position.set(-2.4, 0, 0.4);
  van1.rotation.y = Math.PI; // Backed in to dock
  group.add(van1);

  // Vehicle 2: Delivery Van (Safety Orange stripe) parked in Bay 2
  const van2 = createDeliveryVanMesh(m, 0xea580c);
  van2.position.set(0.3, 0, 0.6);
  van2.rotation.y = Math.PI;
  group.add(van2);

  // Vehicle 3: Cargo Box Truck parked in Bay 3
  const truck = createCargoBoxTruck(m);
  truck.position.set(3.2, 0, 0.2);
  truck.rotation.y = Math.PI;
  group.add(truck);

  // Dock dispatch workers loading packages
  const dockWorker1 = createHumanFigure(m, 'repartidor');
  dockWorker1.position.set(-2.4, 0, -2.0);
  group.add(dockWorker1);

  const dockWorker2 = createHumanFigure(m, 'almacenista');
  dockWorker2.position.set(3.2, 0, -2.1);
  group.add(dockWorker2);

  // Pallet with cargo cartons at dock staging area
  const pal = createWoodenPallet(m, 1.2, 0.12, 1.0);
  pal.position.set(1.6, 0.06, -2.2);
  group.add(pal);

  for (let bx = -0.3; bx <= 0.3; bx += 0.3) {
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.35, 0.4), m.cardboard);
    box.position.set(1.6 + bx, 0.32, -2.2);
    group.add(box);
  }

  return group;
}

/**
 * 25. ATENCIÓN / SPA: CUSTOMER SERVICE DESK & INFORMATION KIOSK
 * Features curved reception desk with wood/orange front, advisor, customer, touch kiosk, and plant.
 */
export function createAtencionDesk(m: DioramaMaterials): THREE.Group {
  const group = new THREE.Group();

  // Curved modern reception desk
  const deskCurve = new THREE.CylinderGeometry(1.6, 1.6, 1.0, 16, 1, true, 0, Math.PI * 0.85);
  const deskFrontMat = new THREE.MeshStandardMaterial({
    color: 0xea580c, // Warm orange modern wood slat front
    roughness: 0.4,
    metalness: 0.1,
    side: THREE.DoubleSide,
  });
  const deskFront = new THREE.Mesh(deskCurve, deskFrontMat);
  deskFront.position.set(0, 0.5, 0);
  deskFront.rotation.y = -Math.PI * 0.42;
  group.add(deskFront);

  // Desk top ledge
  const topGeo = new THREE.BoxGeometry(2.4, 0.08, 0.9);
  const topMat = new THREE.MeshStandardMaterial({
    color: 0xffffff, // White quartz top
    roughness: 0.2,
    metalness: 0.1,
  });
  const deskTop = new THREE.Mesh(topGeo, topMat);
  deskTop.position.set(0, 1.0, -0.2);
  deskTop.castShadow = true;
  group.add(deskTop);

  // Desktop monitor
  const monGeo = new THREE.BoxGeometry(0.6, 0.4, 0.03);
  const monMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    emissive: 0x38bdf8,
    emissiveIntensity: 0.4,
  });
  const mon = new THREE.Mesh(monGeo, monMat);
  mon.position.set(0.3, 1.3, -0.25);
  mon.rotation.y = -0.2;
  group.add(mon);

  // Information Touch Kiosk Pedestal
  const kioskGroup = new THREE.Group();
  kioskGroup.position.set(-1.8, 0, 0.8);

  const baseGeo = new THREE.CylinderGeometry(0.28, 0.32, 0.06, 16);
  const base = new THREE.Mesh(baseGeo, m.steelChrome);
  base.position.y = 0.03;
  kioskGroup.add(base);

  const standGeo = new THREE.CylinderGeometry(0.06, 0.06, 1.2, 12);
  const stand = new THREE.Mesh(standGeo, m.steelChrome);
  stand.position.y = 0.65;
  kioskGroup.add(stand);

  const screenGeo = new THREE.BoxGeometry(0.55, 0.85, 0.05);
  const screenMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    emissive: 0x06b6d4,
    emissiveIntensity: 0.6,
  });
  const screen = new THREE.Mesh(screenGeo, screenMat);
  screen.position.set(0, 1.35, 0.05);
  screen.rotation.x = -0.3; // Tilted for user touch
  kioskGroup.add(screen);

  group.add(kioskGroup);

  // Architectural Potted Plant
  const planterGeo = new THREE.CylinderGeometry(0.3, 0.22, 0.65, 12);
  const planterMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.5 });
  const planter = new THREE.Mesh(planterGeo, planterMat);
  planter.position.set(1.9, 0.325, 0.6);
  group.add(planter);

  // Green foliage spheres
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.8 });
  const leaves = [
    { x: 1.9, y: 0.8, z: 0.6, r: 0.28 },
    { x: 1.8, y: 0.95, z: 0.55, r: 0.22 },
    { x: 2.05, y: 0.92, z: 0.65, r: 0.24 },
  ];
  leaves.forEach((lf) => {
    const leafMesh = new THREE.Mesh(new THREE.SphereGeometry(lf.r, 8, 8), leafMat);
    leafMesh.position.set(lf.x, lf.y, lf.z);
    group.add(leafMesh);
  });

  // Customer Service Advisor
  const advisor = createHumanFigure(m, 'cajero');
  advisor.position.set(0, 0, -0.8);
  advisor.rotation.y = 0; // Facing customer
  group.add(advisor);

  // Customer standing in front of desk
  const customer = createHumanFigure(m, 'cliente');
  customer.position.set(0.4, 0, 1.1);
  customer.rotation.y = Math.PI; // Facing desk
  group.add(customer);

  return group;
}

/**
 * 26. CAJA DE COBRO / SPA: RETAIL STORE CHECKOUT COUNTERS
 * Features dual checkout stations, POS terminals, scanner glass, cashiers, customer queue stanchions.
 */
export function createCajaCobroStation(m: DioramaMaterials): THREE.Group {
  const group = new THREE.Group();

  // Dual checkout counters
  [-1.4, 1.4].forEach((cx, idx) => {
    const counterGroup = new THREE.Group();
    counterGroup.position.set(cx, 0, 0);

    // Counter body
    const bodyGeo = new THREE.BoxGeometry(1.6, 0.95, 2.6);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.4,
      metalness: 0.2,
    });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 0.475;
    body.castShadow = true;
    counterGroup.add(body);

    // Stainless steel top plate with scanner window
    const topGeo = new THREE.BoxGeometry(1.65, 0.05, 2.65);
    const top = new THREE.Mesh(topGeo, m.steelChrome);
    top.position.y = 0.975;
    counterGroup.add(top);

    // Red laser scanner glass
    const scanGeo = new THREE.BoxGeometry(0.35, 0.02, 0.4);
    const scanMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
    const scanner = new THREE.Mesh(scanGeo, scanMat);
    scanner.position.set(0, 1.01, 0.2);
    counterGroup.add(scanner);

    // POS Touchscreen Display
    const posGeo = new THREE.BoxGeometry(0.45, 0.35, 0.04);
    const posMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      emissive: 0x10b981,
      emissiveIntensity: 0.5,
    });
    const posScreen = new THREE.Mesh(posGeo, posMat);
    posScreen.position.set(0.2, 1.3, -0.4);
    posScreen.rotation.y = -0.3;
    counterGroup.add(posScreen);

    // Stand
    const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.3, 8), m.steelChrome);
    stand.position.set(0.2, 1.12, -0.4);
    counterGroup.add(stand);

    // Dedicated Stainless Steel "BATEO EN CAJA" Reception Tray where packages arrive from conveyor
    const counterBateo = createBateoReceptionTray('BATEO EN CAJA', 1.0, 0.7, 0x10b981);
    counterBateo.position.set(0, 1.01, 0.4);
    counterGroup.add(counterBateo);

    // Cashier figure behind counter
    const cashier = createHumanFigure(m, 'cajero');
    cashier.position.set(0, 0, -1.0);
    cashier.rotation.y = 0;
    counterGroup.add(cashier);

    // Customer figure at counter
    const client = createHumanFigure(m, 'cliente');
    client.position.set(0, 0, 1.4 + idx * 0.3);
    client.rotation.y = Math.PI;
    counterGroup.add(client);

    counterGroup.userData.cashier = cashier;
    counterGroup.userData.client = client;
    counterGroup.userData.bateo = counterBateo;

    group.add(counterGroup);
  });

  // Stanchions queue rope in front
  const stanchions = createQueueStanchions(m, 3);
  stanchions.position.set(0, 0, -5.2);
  group.add(stanchions);

  return group;
}

/**
 * 27. WAREHOUSE L-SHAPED PERIMETER WALL FOR ALMACÉN / SPA
 */
export function createAlmacenWalls(): THREE.Group {
  const group = new THREE.Group();

  const wallMat = new THREE.MeshStandardMaterial({
    color: 0xf1f5f9, // Architectural off-white
    roughness: 0.35,
    metalness: 0.1,
  });

  // Back Wall
  const backGeo = new THREE.BoxGeometry(9.6, 4.2, 0.3);
  const back = new THREE.Mesh(backGeo, wallMat);
  back.position.set(0, 2.1, -4.2);
  back.receiveShadow = true;
  group.add(back);

  // Left Wall
  const leftGeo = new THREE.BoxGeometry(0.3, 4.2, 8.4);
  const left = new THREE.Mesh(leftGeo, wallMat);
  left.position.set(-4.8, 2.1, 0.1);
  left.receiveShadow = true;
  group.add(left);

  // Cyan architectural trim along wall base
  const trimGeo = new THREE.BoxGeometry(9.7, 0.08, 0.08);
  const trimMat = new THREE.MeshStandardMaterial({
    color: 0x0284c7,
    emissive: 0x38bdf8,
    emissiveIntensity: 0.6,
  });
  const trim = new THREE.Mesh(trimGeo, trimMat);
  trim.position.set(0, 0.04, -4.0);
  group.add(trim);

  return group;
}

/**
 * 28. CONTINUOUS CURVED INDUSTRIAL CONVEYOR TRACK (BANDAS TRANSPORTADORAS)
 * Procedural elevated conveyor tracks with tubular steel rails, metallic cylindrical rollers,
 * neon edge glow, vertical structural trestles, overhead barcode scanner arches, and transfer chutes.
 */
export interface CurvedConveyorOptions {
  width?: number;
  railColor?: number;
  edgeGlowColor?: number;
  rollerSpacing?: number;
  legSpacing?: number;
  withScanner?: boolean;
  scannerT?: number;
  scannerLabel?: string;
  scannerColor?: number;
  hasEndChute?: boolean;
  endChuteLabel?: string;
}

export function createCurvedConveyorTrack(
  curve: THREE.CatmullRomCurve3,
  m: DioramaMaterials,
  options: CurvedConveyorOptions = {}
): THREE.Group {
  const group = new THREE.Group();
  const width = options.width ?? 0.68;
  const railColor = options.railColor ?? 0xfacc15;
  const edgeGlowColor = options.edgeGlowColor ?? 0x38bdf8;
  const curveLength = curve.getLength();
  const numSamples = Math.max(28, Math.floor(curveLength * 7.5));

  // Generate parallel sample points for left rail, right rail, and center bed
  const leftPoints: THREE.Vector3[] = [];
  const rightPoints: THREE.Vector3[] = [];
  const centerPoints: THREE.Vector3[] = [];
  const up = new THREE.Vector3(0, 1, 0);

  for (let i = 0; i <= numSamples; i++) {
    const t = i / numSamples;
    const pt = curve.getPointAt(t);
    const tangent = curve.getTangentAt(t);
    let normal = new THREE.Vector3().crossVectors(tangent, up).normalize();
    if (normal.lengthSq() < 0.001) {
      normal.set(1, 0, 0);
    }

    centerPoints.push(new THREE.Vector3(pt.x, pt.y - 0.05, pt.z));
    leftPoints.push(
      new THREE.Vector3(
        pt.x - normal.x * (width / 2),
        pt.y + 0.06,
        pt.z - normal.z * (width / 2)
      )
    );
    rightPoints.push(
      new THREE.Vector3(
        pt.x + normal.x * (width / 2),
        pt.y + 0.06,
        pt.z + normal.z * (width / 2)
      )
    );
  }

  const leftRailCurve = new THREE.CatmullRomCurve3(leftPoints, false, 'centripetal', 0.2);
  const rightRailCurve = new THREE.CatmullRomCurve3(rightPoints, false, 'centripetal', 0.2);
  const centerBedCurve = new THREE.CatmullRomCurve3(centerPoints, false, 'centripetal', 0.2);

  const railMat = new THREE.MeshStandardMaterial({
    color: railColor,
    roughness: 0.35,
    metalness: 0.45,
  });

  const glowRailMat = new THREE.MeshStandardMaterial({
    color: edgeGlowColor,
    emissive: edgeGlowColor,
    emissiveIntensity: 0.85,
    roughness: 0.2,
  });

  // Dual tubular side guide rails
  const leftTube = new THREE.Mesh(new THREE.TubeGeometry(leftRailCurve, numSamples, 0.034, 8, false), railMat);
  leftTube.castShadow = true;
  group.add(leftTube);

  const rightTube = new THREE.Mesh(new THREE.TubeGeometry(rightRailCurve, numSamples, 0.034, 8, false), railMat);
  rightTube.castShadow = true;
  group.add(rightTube);

  // Under-rail neon glow edge strips
  const leftGlow = new THREE.Mesh(new THREE.TubeGeometry(leftRailCurve, numSamples, 0.012, 6, false), glowRailMat);
  leftGlow.position.y = -0.04;
  group.add(leftGlow);

  const rightGlow = new THREE.Mesh(new THREE.TubeGeometry(rightRailCurve, numSamples, 0.012, 6, false), glowRailMat);
  rightGlow.position.y = -0.04;
  group.add(rightGlow);

  // Steel bed tray underneath rollers
  const bedMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.7,
    metalness: 0.6,
  });
  const bedTube = new THREE.Mesh(
    new THREE.TubeGeometry(centerBedCurve, numSamples, (width / 2) * 0.85, 4, false),
    bedMat
  );
  bedTube.scale.set(1, 0.16, 1);
  group.add(bedTube);

  // Rollers along the curve
  const rollerSpacing = options.rollerSpacing ?? 0.32;
  const rollerCount = Math.max(3, Math.floor(curveLength / rollerSpacing));
  const rollerGeo = new THREE.CylinderGeometry(0.028, 0.028, width - 0.08, 10);
  const rollerMat = m.steelChrome;

  for (let k = 0; k < rollerCount; k++) {
    const t = (k + 0.5) / rollerCount;
    const pt = curve.getPointAt(t);
    const tangent = curve.getTangentAt(t);
    let normal = new THREE.Vector3().crossVectors(tangent, up).normalize();
    if (normal.lengthSq() < 0.001) normal.set(1, 0, 0);

    const roller = new THREE.Mesh(rollerGeo, rollerMat);
    roller.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);
    roller.position.set(pt.x, pt.y, pt.z);
    roller.castShadow = true;
    group.add(roller);
  }

  // Steel vertical support legs (trestles) down to floor
  const legSpacing = options.legSpacing ?? 2.8;
  const legCount = Math.max(2, Math.floor(curveLength / legSpacing));
  const legMat = m.darkMetal;
  const legRad = 0.038;

  for (let j = 0; j <= legCount; j++) {
    const t = Math.min(0.98, Math.max(0.02, j / legCount));
    const pt = curve.getPointAt(t);
    const tangent = curve.getTangentAt(t);
    let normal = new THREE.Vector3().crossVectors(tangent, up).normalize();
    if (normal.lengthSq() < 0.001) normal.set(1, 0, 0);

    const conveyorY = pt.y - 0.02;
    if (conveyorY > 0.35) {
      const legHeight = conveyorY;
      const legGeo = new THREE.CylinderGeometry(legRad, legRad, legHeight, 8);

      [-width / 2 + 0.06, width / 2 - 0.06].forEach((offsetSide) => {
        const lx = pt.x + normal.x * offsetSide;
        const lz = pt.z + normal.z * offsetSide;

        const leg = new THREE.Mesh(legGeo, legMat);
        leg.position.set(lx, legHeight / 2, lz);
        leg.castShadow = true;
        group.add(leg);

        // Floor baseplate
        const baseplate = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.02, 0.18), legMat);
        baseplate.position.set(lx, 0.01, lz);
        group.add(baseplate);
      });

      // Horizontal crossbar bracing between legs
      const crossbarGeo = new THREE.CylinderGeometry(0.022, 0.022, width - 0.12, 8);
      const crossbar = new THREE.Mesh(crossbarGeo, legMat);
      crossbar.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);
      crossbar.position.set(pt.x, conveyorY * 0.45, pt.z);
      group.add(crossbar);
    }
  }

  // Scanner Arch (Optional)
  if (options.withScanner) {
    const sT = options.scannerT ?? 0.5;
    const sPt = curve.getPointAt(sT);
    const sTang = curve.getTangentAt(sT);
    let sNorm = new THREE.Vector3().crossVectors(sTang, up).normalize();
    if (sNorm.lengthSq() < 0.001) sNorm.set(1, 0, 0);

    const archGroup = new THREE.Group();
    archGroup.position.copy(sPt);
    archGroup.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), sNorm);

    // Arch Frame
    const archMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.3,
      metalness: 0.7,
    });
    // Arch Left & Right Upright posts
    [-width / 2 - 0.08, width / 2 + 0.08].forEach((ax) => {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.9, 0.08), archMat);
      post.position.set(ax, 0.45, 0);
      archGroup.add(post);
    });

    // Arch Top Crossbar
    const topBar = new THREE.Mesh(new THREE.BoxGeometry(width + 0.32, 0.14, 0.12), archMat);
    topBar.position.set(0, 0.9, 0);
    archGroup.add(topBar);

    // Glowing LED Scanner Header display
    const labelColor = options.scannerColor ?? 0x10b981;
    const ledDisp = new THREE.Mesh(
      new THREE.BoxGeometry(width + 0.15, 0.08, 0.14),
      new THREE.MeshStandardMaterial({
        color: 0x0f172a,
        emissive: labelColor,
        emissiveIntensity: 0.8,
      })
    );
    ledDisp.position.set(0, 0.92, 0);
    archGroup.add(ledDisp);

    // Optical Barcode Scanner Camera & Laser Fan Plane
    const laserMat = new THREE.MeshBasicMaterial({
      color: 0xef4444, // Red optical laser
      transparent: true,
      opacity: 0.45,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });
    const laserPlane = new THREE.Mesh(new THREE.PlaneGeometry(width - 0.05, 0.75), laserMat);
    laserPlane.position.set(0, 0.45, 0);
    archGroup.add(laserPlane);

    group.add(archGroup);
  }

  // End Delivery Chute / Bateo Catchment (Optional)
  if (options.hasEndChute) {
    const endPt = curve.getPointAt(1.0);
    const endTang = curve.getTangentAt(1.0);

    const chuteGroup = new THREE.Group();
    chuteGroup.position.copy(endPt);
    chuteGroup.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), endTang);

    // Angled stainless steel ramp
    const chuteMat = m.steelChrome;
    const chuteGeo = new THREE.BoxGeometry(width + 0.1, 0.03, 0.55);
    const chute = new THREE.Mesh(chuteGeo, chuteMat);
    chute.position.set(0, -0.08, 0.25);
    chute.rotation.x = 0.28; // Slanted down
    chuteGroup.add(chute);

    // Catchment stop bumper with safety yellow
    const bumper = new THREE.Mesh(
      new THREE.BoxGeometry(width + 0.14, 0.08, 0.05),
      new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.4 })
    );
    bumper.position.set(0, -0.16, 0.52);
    chuteGroup.add(bumper);

    group.add(chuteGroup);
  }

  return group;
}

/**
 * 29. BATEO DE RECEPCIÓN / BANDEJA METÁLICA DE ENTREGA
 * High-visibility stainless steel receiving basin with protective rim and neon lettering.
 */
export function createBateoReceptionTray(
  label: string,
  width = 1.1,
  depth = 0.85,
  accentColor = 0x10b981
): THREE.Group {
  const group = new THREE.Group();

  // Polished Stainless Steel Tray Basin
  const basinMat = new THREE.MeshStandardMaterial({
    color: 0x94a3b8,
    roughness: 0.2,
    metalness: 0.85,
  });

  const baseGeo = new THREE.BoxGeometry(width, 0.04, depth);
  const base = new THREE.Mesh(baseGeo, basinMat);
  base.position.y = 0.02;
  base.castShadow = true;
  group.add(base);

  // Protective rubber rim cushions
  const rimMat = new THREE.MeshStandardMaterial({
    color: 0x18181b,
    roughness: 0.8,
  });
  // Left rim
  const rimL = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.08, depth), rimMat);
  rimL.position.set(-width / 2 + 0.02, 0.06, 0);
  group.add(rimL);
  // Right rim
  const rimR = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.08, depth), rimMat);
  rimR.position.set(width / 2 - 0.02, 0.06, 0);
  group.add(rimR);
  // Back bumper
  const rimB = new THREE.Mesh(new THREE.BoxGeometry(width, 0.08, 0.04), rimMat);
  rimB.position.set(0, 0.06, -depth / 2 + 0.02);
  group.add(rimB);

  // Front Badge with illuminated acrylic title
  const badgeMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    emissive: accentColor,
    emissiveIntensity: 0.65,
  });
  const badge = new THREE.Mesh(new THREE.BoxGeometry(width * 0.85, 0.07, 0.03), badgeMat);
  badge.position.set(0, 0.05, depth / 2 + 0.02);
  group.add(badge);

  // Canvas text label for high-visibility
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 96;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, 512, 96);
  ctx.fillStyle = accentColor === 0x10b981 ? '#34d399' : '#fb923c';
  ctx.font = 'bold 36px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, 256, 48);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const labelMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(width * 0.8, 0.065),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true })
  );
  labelMesh.position.set(0, 0.05, depth / 2 + 0.036);
  group.add(labelMesh);

  return group;
}

/**
 * 30. DOMICILIO / SPA: RESIDENTIAL HOME DELIVERY PODIUM
 * Suburban house with front porch ("El Bateo Residencial"), parcel drop station,
 * customer figure receiving deliveries, mailbox, warm lantern, and neon badge.
 */
export function createDomicilioPodium(m: DioramaMaterials): THREE.Group {
  const group = new THREE.Group();

  const residentialTex = createModularPodiumTexture('residential');
  // Podium plinth
  const podium = createModularPodium(10.5, 9.0, 0.5, 0.8, residentialTex, 0xf97316);
  group.add(podium);

  // 1. Suburban House Structure
  const houseGroup = new THREE.Group();
  houseGroup.position.set(-1.0, 0.58, -1.8);

  // Foundation & Brick Base
  const fndGeo = new THREE.BoxGeometry(5.2, 0.4, 4.2);
  const fndMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.8 });
  const fnd = new THREE.Mesh(fndGeo, fndMat);
  fnd.position.y = 0.2;
  fnd.receiveShadow = true;
  houseGroup.add(fnd);

  // Main Stucco Walls (Warm Cream)
  const wallGeo = new THREE.BoxGeometry(4.8, 2.6, 3.8);
  const wallMat = new THREE.MeshStandardMaterial({ color: 0xfef9c3, roughness: 0.65 });
  const walls = new THREE.Mesh(wallGeo, wallMat);
  walls.position.y = 1.6;
  walls.castShadow = true;
  walls.receiveShadow = true;
  houseGroup.add(walls);

  // Gabled Terracotta Roof
  const roofShape = new THREE.Shape();
  roofShape.moveTo(-2.6, 0);
  roofShape.lineTo(0, 1.6);
  roofShape.lineTo(2.6, 0);
  roofShape.closePath();
  const roofGeo = new THREE.ExtrudeGeometry(roofShape, { depth: 4.2, bevelEnabled: false });
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x9a3412, roughness: 0.6 });
  const roof = new THREE.Mesh(roofGeo, roofMat);
  roof.position.set(0, 2.9, -2.1);
  roof.castShadow = true;
  houseGroup.add(roof);

  // Warm glowing windows
  const winMat = new THREE.MeshStandardMaterial({
    color: 0xfef08a,
    emissive: 0xfbbf24,
    emissiveIntensity: 0.7,
  });
  const win = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.85, 0.06), winMat);
  win.position.set(1.2, 1.6, 1.92);
  houseGroup.add(win);

  // Front Door (Dark Wood)
  const doorGeo = new THREE.BoxGeometry(0.85, 1.6, 0.06);
  const doorMat = new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.4 });
  const door = new THREE.Mesh(doorGeo, doorMat);
  door.position.set(-0.8, 1.2, 1.92);
  houseGroup.add(door);

  // Brass Door Handle
  const handle = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 8), m.steelChrome);
  handle.position.set(-0.55, 1.15, 1.96);
  houseGroup.add(handle);

  group.add(houseGroup);

  // 2. Covered Front Porch ("EL BATEO RESIDENCIAL")
  const porchGroup = new THREE.Group();
  porchGroup.position.set(-1.0, 0.58, 0.8);

  // Timber deck floor
  const deckGeo = new THREE.BoxGeometry(5.0, 0.15, 2.0);
  const deckMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.7 });
  const deck = new THREE.Mesh(deckGeo, deckMat);
  deck.position.y = 0.075;
  deck.receiveShadow = true;
  porchGroup.add(deck);

  // Porch roof awning
  const porchRoofGeo = new THREE.BoxGeometry(5.2, 0.12, 2.2);
  const porchRoofMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.5 });
  const porchRoof = new THREE.Mesh(porchRoofGeo, porchRoofMat);
  porchRoof.position.set(0, 2.5, 0);
  porchRoof.castShadow = true;
  porchGroup.add(porchRoof);

  // White support pillars
  const pillarGeo = new THREE.BoxGeometry(0.12, 2.4, 0.12);
  const pillarMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.3 });
  [-2.3, 2.3].forEach((px) => {
    const pil = new THREE.Mesh(pillarGeo, pillarMat);
    pil.position.set(px, 1.25, 0.85);
    pil.castShadow = true;
    porchGroup.add(pil);
  });

  // Warm hanging porch carriage lantern
  const lanternMat = new THREE.MeshStandardMaterial({
    color: 0xfef08a,
    emissive: 0xf59e0b,
    emissiveIntensity: 0.9,
  });
  const lantern = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 0.22, 8), lanternMat);
  lantern.position.set(-0.8, 2.3, 0.8);
  porchGroup.add(lantern);

  // 3. Reception Parcel Table / Bateo Station ("BATEO EN DOMICILIO")
  const bateoTable = createBateoReceptionTray('BATEO EN DOMICILIO', 1.3, 0.9, 0xf97316);
  bateoTable.position.set(0.7, 0.16, 0.4);
  porchGroup.add(bateoTable);

  // Delivery drop box beside bateo
  const dropBoxGeo = new THREE.BoxGeometry(0.5, 0.65, 0.45);
  const dropBoxMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.4 });
  const dropBox = new THREE.Mesh(dropBoxGeo, dropBoxMat);
  dropBox.position.set(-1.8, 0.45, 0.4);
  dropBox.castShadow = true;
  porchGroup.add(dropBox);

  // Customer figure waiting at the Porch / Bateo ("Cliente en su Bateo")
  const clientHome = createHumanFigure(m, 'cliente', 0x10b981);
  clientHome.position.set(0.7, 0.15, -0.4);
  clientHome.rotation.y = Math.PI; // Facing outward toward delivery arrival
  clientHome.name = 'client_home_figure';
  porchGroup.add(clientHome);
  group.userData.clientHome = clientHome;

  group.add(porchGroup);

  // 4. White Picket Fence & Mailbox
  const fenceMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 });
  const fenceGeo = new THREE.BoxGeometry(0.08, 0.65, 0.08);
  [-3.8, -3.2, -2.6, 2.6, 3.2, 3.8].forEach((fx) => {
    const post = new THREE.Mesh(fenceGeo, fenceMat);
    post.position.set(fx, 0.58 + 0.325, 2.8);
    group.add(post);
  });
  const fenceRail = new THREE.Mesh(new THREE.BoxGeometry(7.8, 0.06, 0.04), fenceMat);
  fenceRail.position.set(0, 0.58 + 0.45, 2.8);
  group.add(fenceRail);

  // Curbside Mailbox
  const mailPost = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.9, 8), m.darkMetal);
  mailPost.position.set(-2.8, 0.58 + 0.45, 3.2);
  group.add(mailPost);

  const mailbox = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.22, 0.4), m.plasticYellow);
  mailbox.position.set(-2.8, 0.58 + 0.95, 3.2);
  group.add(mailbox);

  // 5. 3D Neon Zone Badge: DOMICILIO / SPA
  const signDomicilio = createNeonZoneBadge('DOMICILIO', 'SPA', 4.4);
  signDomicilio.position.set(0, 0.58, 3.8);
  group.add(signDomicilio);

  return group;
}

/**
 * 31. CLIENTE CON CELULAR (LIFTING ORDERS VIA MOBILE ERP)
 * Figure holding an illuminated smartphone with notification glow and pulsing antenna.
 */
export function createCustomerWithPhoneMesh(m: DioramaMaterials): THREE.Group {
  const group = createHumanFigure(m, 'cliente', 0x06b6d4); // Cyan jacket
  group.name = 'cliente_con_celular';

  // Smartphone body held in right hand
  const phoneGroup = new THREE.Group();
  phoneGroup.position.set(0.12, 1.15, 0.28);
  phoneGroup.rotation.set(-0.4, -0.2, 0.1);

  const phoneGeo = new THREE.BoxGeometry(0.12, 0.22, 0.015);
  const phoneMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    roughness: 0.2,
    metalness: 0.8,
  });
  const phoneMesh = new THREE.Mesh(phoneGeo, phoneMat);
  phoneGroup.add(phoneMesh);

  // Glowing screen displaying mobile order app
  const screenGeo = new THREE.PlaneGeometry(0.10, 0.19);
  const screenMat = new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
    side: THREE.DoubleSide,
  });
  const screenMesh = new THREE.Mesh(screenGeo, screenMat);
  screenMesh.position.set(0, 0, 0.01);
  phoneGroup.add(screenMesh);

  // Overhead Wi-Fi signal beacon ring (pulsing)
  const wifiRingGeo = new THREE.RingGeometry(0.2, 0.26, 16);
  const wifiRingMat = new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0.85,
    side: THREE.DoubleSide,
  });
  const wifiRing = new THREE.Mesh(wifiRingGeo, wifiRingMat);
  wifiRing.rotation.x = -Math.PI / 2;
  wifiRing.position.set(0, 1.85, 0);
  wifiRing.name = 'wifi_beacon';
  group.add(wifiRing);

  // Position arms holding phone
  if (group.userData.rightArm) {
    (group.userData.rightArm as THREE.Group).rotation.set(-Math.PI / 3.2, -0.25, -Math.PI / 12);
  }
  if (group.userData.leftArm) {
    (group.userData.leftArm as THREE.Group).rotation.set(-Math.PI / 4.2, 0.25, Math.PI / 12);
  }

  group.add(phoneGroup);
  group.userData.phoneScreen = screenMesh;
  group.userData.wifiBeacon = wifiRing;

  return group;
}

/**
 * 32. BUNKKER ERP • PUNTO DE CONTROL 3D (CENTRO OPERATIVO)
 * Futuristic operations billboard in Logística showing live order statuses,
 * Wi-Fi signal beacon, and LED order chips.
 */
export function createBunkkerControlBoardMesh(m: DioramaMaterials): THREE.Group {
  const group = new THREE.Group();

  // Support Posts
  const pylonGeo = new THREE.CylinderGeometry(0.06, 0.06, 2.8, 12);
  [-2.2, 2.2].forEach((px) => {
    const pylon = new THREE.Mesh(pylonGeo, m.darkMetal);
    pylon.position.set(px, 1.4, 0);
    pylon.castShadow = true;
    group.add(pylon);
  });

  // Base Plate
  const baseMesh = new THREE.Mesh(new THREE.BoxGeometry(5.0, 0.1, 0.6), m.darkMetal);
  baseMesh.position.set(0, 0.05, 0);
  group.add(baseMesh);

  // Ultra-wide Digital Display Frame
  const frameGeo = new THREE.BoxGeometry(4.8, 2.2, 0.18);
  const frameMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    roughness: 0.3,
    metalness: 0.8,
  });
  const frame = new THREE.Mesh(frameGeo, frameMat);
  frame.position.set(0, 2.3, 0);
  frame.castShadow = true;
  group.add(frame);

  // Screen Canvas Texture with live ERP Bunkker graphics
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  function drawBoard(
    p1Status = 'LISTO EN CARGA',
    p2Status = 'EN RUTA',
    p3Status = 'ENTREGADO OK'
  ) {
    // Background Dark Tech
    ctx.fillStyle = '#0a0f1d';
    ctx.fillRect(0, 0, 1024, 512);

    // Glowing Header Bar
    ctx.fillStyle = '#0284c7';
    ctx.fillRect(0, 0, 1024, 64);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 30px "Plus Jakarta Sans", sans-serif';
    ctx.fillText('BUNKKER ERP • CEREBRO OPERATIVO & PUNTO DE CONTROL', 32, 44);

    // Wi-Fi Status Tag
    ctx.fillStyle = '#10b981';
    ctx.font = 'bold 20px monospace';
    ctx.textAlign = 'right';
    ctx.fillText('● WI-FI LOCAL: ACTIVO (5.0 GHz)', 992, 42);
    ctx.textAlign = 'left';

    // 3 Order Status Cards
    const cards = [
      { id: 'PED-01', type: 'ENTREGA EN CARGA', status: p1Status, color: '#06b6d4', icon: '📲 ➔ 📦 ➔ 💳' },
      { id: 'PED-02', type: 'ENVÍO A DOMICILIO', status: p2Status, color: '#f97316', icon: '🚚 ➔ ✍️' },
      { id: 'PED-03', type: 'VENTA EN CAJA', status: p3Status, color: '#10b981', icon: '⚡ ➔ 🏪' },
    ];

    cards.forEach((c, idx) => {
      const y = 88 + idx * 130;
      // Card Box
      ctx.fillStyle = '#131b2e';
      ctx.strokeStyle = c.color;
      ctx.lineWidth = 3;
      if (ctx.roundRect) {
        ctx.beginPath();
        ctx.roundRect(32, y, 960, 110, 16);
        ctx.fill();
        ctx.stroke();
      } else {
        ctx.fillRect(32, y, 960, 110);
        ctx.strokeRect(32, y, 960, 110);
      }

      // Order ID
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 26px monospace';
      ctx.fillText(c.id, 54, y + 42);

      // Type
      ctx.fillStyle = '#94a3b8';
      ctx.font = 'bold 20px "Plus Jakarta Sans", sans-serif';
      ctx.fillText(c.type, 180, y + 42);

      // Flow Icon Journey
      ctx.fillStyle = '#cbd5e1';
      ctx.font = '20px sans-serif';
      ctx.fillText(c.icon, 54, y + 84);

      // Status Badge
      ctx.fillStyle = c.color;
      if (ctx.roundRect) {
        ctx.beginPath();
        ctx.roundRect(720, y + 26, 250, 58, 12);
        ctx.fill();
      } else {
        ctx.fillRect(720, y + 26, 250, 58);
      }
      ctx.fillStyle = '#0f172a';
      ctx.font = '900 20px "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(c.status, 845, y + 62);
      ctx.textAlign = 'left';
    });
  }

  drawBoard();

  const boardTex = new THREE.CanvasTexture(canvas);
  boardTex.colorSpace = THREE.SRGBColorSpace;

  const screenMat = new THREE.MeshStandardMaterial({
    map: boardTex,
    emissive: 0xffffff,
    emissiveMap: boardTex,
    emissiveIntensity: 0.55,
    roughness: 0.2,
    metalness: 0.1,
  });

  const screenMesh = new THREE.Mesh(new THREE.PlaneGeometry(4.65, 2.05), screenMat);
  screenMesh.position.set(0, 2.3, 0.1);
  group.add(screenMesh);

  // Top Neon Glow Wi-Fi Antenna
  const antGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.6, 8);
  const antMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    emissive: 0x38bdf8,
    emissiveIntensity: 1.0,
  });
  const antMesh = new THREE.Mesh(antGeo, antMat);
  antMesh.position.set(0, 3.7, 0);
  group.add(antMesh);

  const antBall = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 12), antMat);
  antBall.position.set(0, 4.0, 0);
  group.add(antBall);

  group.userData.updateBoard = (p1?: string, p2?: string, p3?: string) => {
    drawBoard(p1, p2, p3);
    boardTex.needsUpdate = true;
  };

  return group;
}

/**
 * 33. SPRITE DE PAQUETE DE DATOS NEÓN (SEÑAL ERP WI-FI)
 * Floating label with emoji and glowing border travelling along the neon data beam.
 */
export function createDataPacketSprite(emoji: string, label: string, colorHex: string = '#38bdf8'): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 320;
  canvas.height = 110;
  const ctx = canvas.getContext('2d')!;

  // Pill Background
  ctx.fillStyle = '#0f172a';
  ctx.strokeStyle = colorHex;
  ctx.lineWidth = 5;
  if (ctx.roundRect) {
    ctx.beginPath();
    ctx.roundRect(6, 6, 308, 98, 28);
    ctx.fill();
    ctx.stroke();
  } else {
    ctx.fillRect(6, 6, 308, 98);
    ctx.strokeRect(6, 6, 308, 98);
  }

  // Emoji + Label
  ctx.fillStyle = colorHex;
  ctx.font = 'bold 36px "Plus Jakarta Sans", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`${emoji} ${label}`, 160, 56);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;

  const mat = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    opacity: 0.95,
    depthTest: false,
  });

  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(2.4, 0.85, 1.0);
  return sprite;
}

/**
 * 34. HAZ DE LUZ NEÓN EN ARCO (CONEXIÓN WI-FI LOCAL ERP)
 * High-arching parabolic neon tube with moving pulse energy bead.
 */
export function createNeonDataArcBeam(
  start: THREE.Vector3,
  end: THREE.Vector3,
  arcHeight: number = 3.6,
  color: number = 0x38bdf8,
  label?: string
): {
  group: THREE.Group;
  curve: THREE.CatmullRomCurve3;
  pulseBead: THREE.Mesh;
} {
  const group = new THREE.Group();

  // 3-point parabolic arch: start -> apex -> end
  const midX = (start.x + end.x) / 2;
  const midZ = (start.z + end.z) / 2;
  const midY = Math.max(start.y, end.y) + arcHeight;

  const curve = new THREE.CatmullRomCurve3([
    start.clone(),
    new THREE.Vector3(midX, midY, midZ),
    end.clone(),
  ]);

  // Core neon tube
  const tubeGeo = new THREE.TubeGeometry(curve, 64, 0.055, 8, false);
  const tubeMat = new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: 1.6,
    roughness: 0.1,
    metalness: 0.2,
  });
  const tubeMesh = new THREE.Mesh(tubeGeo, tubeMat);
  group.add(tubeMesh);

  // Outer additive glowing aura (halo neón para máxima diferenciación y contraste)
  const auraGeo = new THREE.TubeGeometry(curve, 48, 0.11, 8, false);
  const auraMat = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.28,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const auraMesh = new THREE.Mesh(auraGeo, auraMat);
  group.add(auraMesh);

  // Moving glowing pulse bead (aumentado para mayor visibilidad y diferenciación)
  const beadGeo = new THREE.SphereGeometry(0.22, 16, 16);
  const beadMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.98,
  });
  const pulseBead = new THREE.Mesh(beadGeo, beadMat);
  pulseBead.position.copy(start);
  group.add(pulseBead);

  // Floating state badge label at apex
  if (label) {
    const canvas = document.createElement('canvas');
    canvas.width = 380;
    canvas.height = 80;
    const ctx = canvas.getContext('2d')!;

    // Pill background
    const hexColor = '#' + color.toString(16).padStart(6, '0');
    ctx.fillStyle = 'rgba(10, 15, 29, 0.94)';
    ctx.strokeStyle = hexColor;
    ctx.lineWidth = 4;
    if (ctx.roundRect) {
      ctx.beginPath();
      ctx.roundRect(4, 4, 372, 72, 20);
      ctx.fill();
      ctx.stroke();
    } else {
      ctx.fillRect(4, 4, 372, 72);
      ctx.strokeRect(4, 4, 372, 72);
    }

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 22px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, 190, 40);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const spriteMat = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthTest: false,
    });
    const labelSprite = new THREE.Sprite(spriteMat);
    labelSprite.position.set(midX, midY + 0.45, midZ);
    labelSprite.scale.set(2.4, 0.52, 1.0);
    group.add(labelSprite);
  }

  return { group, curve, pulseBead };
}

/**
 * 35. GLOBOS DE ETIQUETAS FLOTANTES Y ANIMADAS (Exact Match to User Reference Diagram)
 * Animated neon balloon badges with glowing borders and sinusoidal vertical levitation.
 */
export interface FloatingBalloonBadge {
  group: THREE.Group;
  sprite: THREE.Sprite;
  baseY: number;
  floatSpeed: number;
  floatAmp: number;
  floatPhase: number;
}

export function createFloatingBalloonBadge(
  title: string,
  colorHex: string = '#00f0ff',
  baseY: number = 4.5,
  scaleWidth: number = 3.8,
  scaleHeight: number = 1.15
): FloatingBalloonBadge {
  const group = new THREE.Group();

  const canvas = document.createElement('canvas');
  canvas.width = 640;
  canvas.height = 180;
  const ctx = canvas.getContext('2d')!;

  // 1. Semi-transparent high-tech dark background
  const grad = ctx.createLinearGradient(0, 0, 640, 180);
  grad.addColorStop(0, 'rgba(4, 9, 20, 0.90)');
  grad.addColorStop(0.5, 'rgba(8, 17, 36, 0.94)');
  grad.addColorStop(1, 'rgba(4, 9, 20, 0.90)');
  ctx.fillStyle = grad;

  const radius = 28;
  const paddingX = 16;
  const paddingY = 16;
  const boxW = 640 - paddingX * 2;
  const boxH = 180 - paddingY * 2 - 18; // Leave room for bottom pointer

  ctx.beginPath();
  if (ctx.roundRect) {
    ctx.roundRect(paddingX, paddingY, boxW, boxH, radius);
  } else {
    ctx.rect(paddingX, paddingY, boxW, boxH);
  }
  ctx.fill();

  // 2. Multi-layered neon glow border
  ctx.shadowColor = colorHex;
  ctx.shadowBlur = 24;
  ctx.strokeStyle = colorHex;
  ctx.lineWidth = 6;
  ctx.beginPath();
  if (ctx.roundRect) {
    ctx.roundRect(paddingX, paddingY, boxW, boxH, radius);
  } else {
    ctx.strokeRect(paddingX, paddingY, boxW, boxH);
  }
  ctx.stroke();

  // 3. Pointer tail at bottom
  ctx.beginPath();
  const midX = 640 / 2;
  const tailTop = paddingY + boxH;
  ctx.moveTo(midX - 18, tailTop - 2);
  ctx.lineTo(midX, tailTop + 16);
  ctx.lineTo(midX + 18, tailTop - 2);
  ctx.fillStyle = 'rgba(8, 17, 36, 0.95)';
  ctx.fill();
  ctx.stroke();

  // 4. Inner subtle border
  ctx.shadowBlur = 0;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  if (ctx.roundRect) {
    ctx.roundRect(paddingX + 6, paddingY + 6, boxW - 12, boxH - 12, radius - 4);
  }
  ctx.stroke();

  // 5. Glowing neon text
  ctx.shadowColor = colorHex;
  ctx.shadowBlur = 16;
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 34px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(title, midX, paddingY + boxH / 2);

  // 6. Three.js Sprite
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const spriteMat = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  });
  const sprite = new THREE.Sprite(spriteMat);
  sprite.scale.set(scaleWidth, scaleHeight, 1.0);
  sprite.position.y = 0;
  group.add(sprite);

  // 7. Ground pulsing ring beacon
  const ringGeo = new THREE.RingGeometry(0.25, 0.45, 24);
  const ringMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(colorHex),
    transparent: true,
    opacity: 0.55,
    side: THREE.DoubleSide,
  });
  const ringMesh = new THREE.Mesh(ringGeo, ringMat);
  ringMesh.rotation.x = -Math.PI / 2;
  ringMesh.position.y = -baseY + 0.05;
  group.add(ringMesh);

  group.position.y = baseY;

  return {
    group,
    sprite,
    baseY,
    floatSpeed: 1.8 + Math.random() * 0.5,
    floatAmp: 0.16 + Math.random() * 0.06,
    floatPhase: Math.random() * Math.PI * 2,
  };
}





