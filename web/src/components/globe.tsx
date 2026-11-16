"use client";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { LEVEL_COLOR, number } from "@/lib/data";
import { PALETTE } from "@/lib/theme";
import type { CellVoice, GeoCollection } from "@/lib/types";
import { CompatibleGlobe } from "./compatible-globe";

export type GlobeLayers = { fires: boolean; orbits: boolean; waves: boolean };
interface Props {
  cells: CellVoice[];
  geo: GeoCollection | null;
  layers: GlobeLayers;
  rotating: boolean;
  resetKey: number;
  zoom: number;
  onInspect: (cell: CellVoice | null) => void;
}
function point(lat: number, lon: number, r: number) {
  const a = (lat * Math.PI) / 180,
    b = (lon * Math.PI) / 180;
  return new THREE.Vector3(
    r * Math.cos(a) * Math.cos(b),
    r * Math.sin(a),
    -r * Math.cos(a) * Math.sin(b),
  );
}
function disposeNode(node: THREE.Object3D) {
  node.traverse((n) => {
    if (
      n instanceof THREE.Mesh ||
      n instanceof THREE.Line ||
      n instanceof THREE.Points
    ) {
      n.geometry.dispose();
      for (const m of Array.isArray(n.material) ? n.material : [n.material])
        m.dispose();
    }
  });
}

export function Globe({
  cells,
  geo,
  layers,
  rotating,
  resetKey,
  zoom,
  onInspect,
}: Props) {
  const host = useRef<HTMLDivElement>(null),
    state = useRef<{
      earth: THREE.Group;
      markers: THREE.Group;
      orbits: THREE.Group;
      waves: THREE.Group;
      controls: OrbitControls;
      camera: THREE.PerspectiveCamera;
    } | null>(null);
  const latest = useRef({ cells, layers, rotating, onInspect });
  latest.current = { cells, layers, rotating, onInspect };
  const [failed, setFailed] = useState(false),
    [textureFailed, setTextureFailed] = useState(false);
  useEffect(() => {
    if (!host.current) return;
    if (failed) return;
    const el = host.current;
    let renderer: THREE.WebGLRenderer;
    try {
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("webgl2", {
        alpha: true,
        antialias: true,
        powerPreference: "low-power",
      });
      if (!context) {
        setFailed(true);
        return;
      }
      renderer = new THREE.WebGLRenderer({
        canvas,
        context,
        alpha: true,
        antialias: true,
        powerPreference: "low-power",
      });
    } catch {
      setFailed(true);
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.7));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setClearColor(0x000000, 0);
    el.appendChild(renderer.domElement);
    const scene = new THREE.Scene(),
      camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
    const home = point(-7, -71, 5.7);
    camera.position.copy(home);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.045;
    controls.enablePan = false;
    controls.minDistance = 3.1;
    controls.maxDistance = 8;
    controls.rotateSpeed = 0.45;
    controls.enableZoom = true;
    const earth = new THREE.Group();
    scene.add(earth);
    const material = new THREE.MeshPhongMaterial({
      color: PALETTE.secondary,
      shininess: 13,
      specular: PALETTE.lineStrong,
    });
    const loader = new THREE.TextureLoader();
    let mounted = true;
    loader.load(
      "/textures/earth.jpg",
      (tex) => {
        if (!mounted) {
          tex.dispose();
          return;
        }
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
        material.map = tex;
        material.needsUpdate = true;
      },
      undefined,
      () => {
        if (mounted) setTextureFailed(true);
      },
    );
    const earthBody = new THREE.Mesh(
      new THREE.SphereGeometry(1.65, 80, 56),
      material,
    );
    earth.add(earthBody);
    scene.add(new THREE.AmbientLight(PALETTE.secondary, 1.45));
    const sun = new THREE.DirectionalLight(PALETTE.text, 2.4);
    sun.position.set(-3, 3, 5);
    scene.add(sun);
    const rim = new THREE.DirectionalLight(PALETTE.glow, 1.4);
    rim.position.set(4, -1, -3);
    scene.add(rim);
    const atmosphere = new THREE.Mesh(
      new THREE.SphereGeometry(1.7, 64, 48),
      new THREE.ShaderMaterial({
        vertexShader:
          "varying vec3 vNormal; varying vec3 vPosition; void main(){vNormal=normalize(normalMatrix*normal);vPosition=(modelViewMatrix*vec4(position,1.0)).xyz;gl_Position=projectionMatrix*vec4(vPosition,1.0);}",
        fragmentShader:
          "varying vec3 vNormal;varying vec3 vPosition;void main(){float a=pow(1.0-abs(dot(normalize(vNormal),normalize(-vPosition))),3.5);gl_FragColor=vec4(0.10,0.57,1.0,a*0.85);}",
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.FrontSide,
      }),
    );
    earth.add(atmosphere);
    // Geodetic guide lines are illustrative, not a NASA measurement layer.
    const grid = new THREE.Group();
    earth.add(grid);
    for (let lat = -60; lat <= 60; lat += 30) {
      const ps = [];
      for (let lon = -180; lon <= 180; lon += 3)
        ps.push(point(lat, lon, 1.657));
      grid.add(
        new THREE.Line(
          new THREE.BufferGeometry().setFromPoints(ps),
          new THREE.LineBasicMaterial({
            color: PALETTE.boundaries,
            transparent: true,
            opacity: 0.09,
          }),
        ),
      );
    }
    const markers = new THREE.Group();
    earth.add(markers);
    const waves = new THREE.Group();
    earth.add(waves);
    for (let i = 0; i < 3; i++) {
      const m = new THREE.Mesh(
        new THREE.RingGeometry(0.025, 0.029, 64),
        new THREE.MeshBasicMaterial({
          color: PALETTE.accent,
          transparent: true,
          opacity: 0.45,
          side: THREE.DoubleSide,
          depthWrite: false,
        }),
      );
      m.position.copy(point(-9, -74, 1.674));
      m.quaternion.setFromUnitVectors(
        new THREE.Vector3(0, 0, 1),
        m.position.clone().normalize(),
      );
      waves.add(m);
    }
    const orbits = new THREE.Group();
    scene.add(orbits);
    const satellites: THREE.Group[] = [];
    for (let j = 0; j < 2; j++) {
      const plane = new THREE.Group();
      plane.rotation.set(0.65 + j * 0.9, 0.2 + j * 0.7, 0.35 + j * 0.4);
      orbits.add(plane);
      const points = [];
      for (let i = 0; i <= 160; i++)
        points.push(
          new THREE.Vector3(
            Math.cos((i / 160) * Math.PI * 2) * 2.15,
            0,
            Math.sin((i / 160) * Math.PI * 2) * 2.15,
          ),
        );
      plane.add(
        new THREE.Line(
          new THREE.BufferGeometry().setFromPoints(points),
          new THREE.LineBasicMaterial({
            color: j === 0 ? PALETTE.boundaries : PALETTE.glow,
            transparent: true,
            opacity: 0.22,
          }),
        ),
      );
      const satellite = new THREE.Group();
      satellite.add(
        new THREE.Mesh(
          new THREE.BoxGeometry(0.07, 0.07, 0.09),
          new THREE.MeshPhongMaterial({ color: PALETTE.text }),
        ),
      );
      for (const side of [-1, 1]) {
        const panel = new THREE.Mesh(
          new THREE.BoxGeometry(0.12, 0.005, 0.08),
          new THREE.MeshPhongMaterial({
            color: PALETTE.lineStrong,
            emissive: PALETTE.ocean,
          }),
        );
        panel.position.x = side * 0.102;
        satellite.add(panel);
      }
      const beacon = new THREE.Mesh(
        new THREE.SphereGeometry(0.017, 8, 8),
        new THREE.MeshBasicMaterial({ color: PALETTE.accent }),
      );
      beacon.position.y = 0.06;
      satellite.add(beacon);
      plane.add(satellite);
      satellites.push(satellite);
    }
    const starPositions = [];
    let seed = 74;
    const rand = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };
    for (let i = 0; i < 450; i++)
      starPositions.push(
        (rand() - 0.5) * 35,
        (rand() - 0.5) * 22,
        (rand() - 0.5) * 30,
      );
    const stars = new THREE.Points(
      new THREE.BufferGeometry().setAttribute(
        "position",
        new THREE.Float32BufferAttribute(starPositions, 3),
      ),
      new THREE.PointsMaterial({
        color: PALETTE.muted,
        size: 0.016,
        transparent: true,
        opacity: 0.5,
      }),
    );
    scene.add(stars);
    const resize = new ResizeObserver(() => {
      const w = el.clientWidth,
        h = el.clientHeight;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    });
    resize.observe(el);
    const ray = new THREE.Raycaster();
    let down = { x: 0, y: 0 };
    const inspect = (e: PointerEvent, hover = false) => {
      if (!hover && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 8)
        return;
      const rect = el.getBoundingClientRect();
      ray.setFromCamera(
        new THREE.Vector2(
          ((e.clientX - rect.left) / rect.width) * 2 - 1,
          (-(e.clientY - rect.top) / rect.height) * 2 + 1,
        ),
        camera,
      );
      const hit = ray.intersectObjects(markers.children)[0];
      const surface = ray.intersectObject(earthBody)[0];
      latest.current.onInspect(
        hit && (!surface || hit.distance <= surface.distance + 0.03)
          ? (hit.object.userData.cell ?? null)
          : null,
      );
    };
    const pointerdown = (e: PointerEvent) => {
      down = { x: e.clientX, y: e.clientY };
    };
    renderer.domElement.addEventListener("pointerdown", pointerdown);
    const inspectClick = (e: PointerEvent) => inspect(e);
    let lastHover = 0;
    const hover = (e: PointerEvent) => {
      if (!e.buttons && performance.now() - lastHover > 120) {
        lastHover = performance.now();
        inspect(e, true);
      }
    };
    const leave = () => latest.current.onInspect(null);
    renderer.domElement.addEventListener("pointerup", inspectClick);
    renderer.domElement.addEventListener("pointermove", hover);
    renderer.domElement.addEventListener("pointerleave", leave);
    const contextLost = (e: Event) => {
      e.preventDefault();
      setFailed(true);
    };
    renderer.domElement.addEventListener("webglcontextlost", contextLost);
    state.current = { earth, markers, orbits, waves, controls, camera };
    let id = 0,
      last = 0,
      elapsed = 0;
    const animate = (now: number) => {
      id = requestAnimationFrame(animate);
      if (document.hidden || now - last < 32) return;
      const delta = last ? Math.min((now - last) / 1000, 0.06) : 0;
      last = now;
      const motion = latest.current.rotating;
      if (motion) elapsed += delta;
      controls.autoRotate = motion;
      controls.autoRotateSpeed = 0.12;
      controls.update();
      orbits.visible = latest.current.layers.orbits;
      waves.visible = latest.current.layers.waves;
      markers.visible = latest.current.layers.fires;
      satellites.forEach((s, i) => {
        const t = elapsed * (0.13 + i * 0.03) + i * 2.4;
        s.position.set(Math.cos(t) * 2.15, 0, Math.sin(t) * 2.15);
        s.rotation.y = -t;
      });
      waves.children.forEach((wave, i) => {
        const t = (elapsed * 0.28 + i / 3) % 1;
        wave.scale.setScalar(1 + t * 10);
        (
          wave as THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>
        ).material.opacity = (1 - t) * 0.55;
      });
      renderer.render(scene, camera);
    };
    id = requestAnimationFrame(animate);
    return () => {
      mounted = false;
      cancelAnimationFrame(id);
      resize.disconnect();
      controls.dispose();
      renderer.domElement.removeEventListener("pointerdown", pointerdown);
      renderer.domElement.removeEventListener("pointerup", inspectClick);
      renderer.domElement.removeEventListener("pointermove", hover);
      renderer.domElement.removeEventListener("pointerleave", leave);
      renderer.domElement.removeEventListener("webglcontextlost", contextLost);
      disposeNode(scene);
      material.map?.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      state.current = null;
    };
  }, [failed]);
  useEffect(() => {
    const s = state.current;
    if (!s) return;
    s.markers.children.slice().forEach((n) => {
      s.markers.remove(n);
      disposeNode(n);
    });
    for (const c of cells) {
      const size = 0.005 + Math.min(0.011, Math.log1p(c.count) * 0.0015);
      const m = new THREE.Mesh(
        new THREE.SphereGeometry(size, 6, 6),
        new THREE.MeshBasicMaterial({ color: LEVEL_COLOR[c.level] }),
      );
      m.position.copy(point(c.lat, c.lon, 1.667));
      m.userData.cell = c;
      s.markers.add(m);
    }
  }, [cells]);
  useEffect(() => {
    const s = state.current;
    if (!s || !geo) return;
    const lines = new THREE.Group();
    for (const f of geo.features) {
      const polys =
        f.geometry.type === "Polygon"
          ? [f.geometry.coordinates as number[][][]]
          : (f.geometry.coordinates as number[][][][]);
      for (const poly of polys)
        for (const ring of poly) {
          const line = new THREE.Line(
            new THREE.BufferGeometry().setFromPoints(
              ring.map(([lon, lat]) => point(lat, lon, 1.668)),
            ),
            new THREE.LineBasicMaterial({
              color: PALETTE.boundaries,
              transparent: true,
              opacity: 0.55,
            }),
          );
          lines.add(line);
        }
    }
    s.earth.add(lines);
    return () => {
      s.earth.remove(lines);
      disposeNode(lines);
    };
  }, [geo]);
  useEffect(() => {
    const s = state.current;
    if (s) {
      s.camera.position.copy(point(-7, -71, 5.7));
      s.controls.target.set(0, 0, 0);
      s.controls.update();
    }
  }, [resetKey]);
  useEffect(() => {
    const s = state.current;
    if (s) {
      s.camera.position.setLength(
        Math.max(3.1, Math.min(8, 5.7 - zoom * 0.45)),
      );
      s.controls.update();
    }
  }, [zoom]);
  return (
    <div className="globe-host" ref={host} aria-hidden="true">
      {failed && (
        <CompatibleGlobe
          cells={cells}
          geo={geo}
          layers={layers}
          rotating={rotating}
          zoom={zoom}
          resetKey={resetKey}
          onInspect={onInspect}
        />
      )}{" "}
      {textureFailed && (
        <span className="texture-notice">
          Textura no disponible · datos y mapa 2D operativos
        </span>
      )}
    </div>
  );
}

export function PeruMap({
  cells,
  geo,
  onInspect,
}: {
  cells: CellVoice[];
  geo: GeoCollection | null;
  onInspect: (cell: CellVoice) => void;
}) {
  const project = ([lon, lat]: number[]) => [
    48 + (lon + 82) * 25,
    25 + (0.5 - lat) * 25,
  ];
  return (
    <div className="map-wrap">
      <svg
        viewBox="0 0 430 520"
        role="img"
        aria-label={`Mapa de Perú: ${number(cells.length)} celdas con detecciones. La tabla ofrece los mismos datos.`}
      >
        <defs>
          <radialGradient id="mapglow">
            <stop stopColor={PALETTE.panelRaised} />
            <stop offset="1" stopColor={PALETTE.panel} />
          </radialGradient>
        </defs>
        <rect width="430" height="520" fill="none" />
        {geo?.features.map((f) => {
          const polys =
            f.geometry.type === "Polygon"
              ? [f.geometry.coordinates as number[][][]]
              : (f.geometry.coordinates as number[][][][]);
          return (
            <path
              key={f.properties.shapeName}
              d={polys
                .map((p) =>
                  p
                    .map(
                      (r) =>
                        r
                          .map(
                            (v, i) => `${i ? "L" : "M"}${project(v).join(" ")}`,
                          )
                          .join(" ") + "Z",
                    )
                    .join(" "),
                )
                .join(" ")}
              fill="url(#mapglow)"
              stroke={PALETTE.boundaries}
              strokeWidth=".65"
              fillRule="evenodd"
            />
          );
        })}
        {cells.map((c, i) => {
          const [cx, cy] = project([c.lon, c.lat]);
          return (
            <circle
              key={i}
              cx={cx}
              cy={cy}
              r={1.4 + Math.min(4, Math.log1p(c.count) * 0.45)}
              fill={LEVEL_COLOR[c.level]}
              fillOpacity=".85"
              onClick={() => onInspect(c)}
            >
              <title>
                {c.lat}, {c.lon}: {c.count} focos, z {c.z}
              </title>
            </circle>
          );
        })}
        <text
          x="14"
          y="245"
          fill={PALETTE.muted}
          fontSize="10"
          letterSpacing="3"
          transform="rotate(-75 14 245)"
        >
          OCÉANO PACÍFICO
        </text>
      </svg>
    </div>
  );
}
