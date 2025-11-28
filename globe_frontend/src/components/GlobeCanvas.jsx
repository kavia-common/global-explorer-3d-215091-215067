import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Html, useTexture } from '@react-three/drei';
import { XR, useXR } from '@react-three/xr';
import * as THREE from 'three';
import { useCountries } from '../hooks/useCountries.js';
import HighlightLayers from './HighlightLayers.jsx';
import useGestureWS from '../hooks/useGestureWS.js';

/**
 * Convert a 3D point on a unit sphere to latitude/longitude.
 */
function vectorToLatLon(v) {
  const normalized = v.clone().normalize();
  const lat = Math.asin(normalized.y) * (180 / Math.PI);
  const lon = Math.atan2(normalized.z, normalized.x) * (180 / Math.PI);
  return { lat, lon };
}

/**
 * Build a custom shader material for Earth with day/night terminator and optional city lights.
 * We compute N (normal) in world space and dot with sunDir for light factor.
 */
function useEarthShaderMaterial(dayMap, nightMap) {
  const materialRef = useRef();

  const uniforms = useMemo(
    () => ({
      uSunDir: { value: new THREE.Vector3(1, 0, 0) }, // world-space sun direction (normalized)
      uNightDim: { value: 0.35 }, // base dim level for night side
      uSoftness: { value: 0.15 }, // smoothstep width for terminator
      uUseNightTex: { value: nightMap ? 1.0 : 0.0 },
      uTime: { value: 0.0 },
      map: { value: dayMap || null },
      uNightTex: { value: nightMap || null },
    }),
    [dayMap, nightMap]
  );

  // Shader chunks: basic lambertian day, dim night, optional nightTex blend on night side.
  const vertexShader = `
    varying vec3 vWorldNormal;
    varying vec2 vUv;
    void main() {
      vUv = uv;
      // world-space normal
      vWorldNormal = normalize(mat3(modelMatrix) * normal);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `;

  const fragmentShader = `
    uniform vec3 uSunDir;
    uniform float uNightDim;
    uniform float uSoftness;
    uniform float uUseNightTex;
    uniform sampler2D uNightTex;
    uniform sampler2D map;
    varying vec3 vWorldNormal;
    varying vec2 vUv;

    // Smoothstep-like soft terminator between day and night
    float softTerminator(float ndotl, float k) {
      float x = clamp((ndotl + k) / (2.0 * k), 0.0, 1.0);
      return smoothstep(0.0, 1.0, x);
    }

    void main() {
      // base albedo from day texture or fallback color
      vec4 dayColor = texture2D(map, vUv);
      if (dayColor.a == 0.0) {
        dayColor = vec4(0.231, 0.510, 0.965, 1.0); // fallback blue-ish
      }

      float ndotl = dot(normalize(vWorldNormal), normalize(uSunDir)); // [-1..1]
      float daylight = softTerminator(ndotl, max(0.001, uSoftness)); // [0..1], 0=night, 1=day
      float nightFactor = 1.0 - daylight;

      // Base lighting mix: dayColor lit fully on day side, dimmed on night side
      vec3 baseLit = dayColor.rgb * mix(uNightDim, 1.0, daylight);

      // Optional city lights: added subtly on night side only
      vec3 nightTex = vec3(0.0);
      if (uUseNightTex > 0.5) {
        vec3 tex = texture2D(uNightTex, vUv).rgb;
        // emphasize lights but keep subtlety
        nightTex = tex * 1.2;
      }

      // blend night lights by nightFactor and attenuate by ndotl smoothness (more at deep night)
      float deepNight = smoothstep(0.0, 0.5, nightFactor) * smoothstep(0.0, 0.2, 1.0 - max(ndotl, 0.0));
      vec3 color = baseLit + nightTex * deepNight * 0.6;

      gl_FragColor = vec4(color, dayColor.a);
    }
  `;

  const mat = useMemo(() => {
    const m = new THREE.ShaderMaterial({
      uniforms,
      vertexShader,
      fragmentShader,
      transparent: false,
      depthWrite: true,
    });
    m.defines = { USE_UV: '' };
    return m;
  }, [uniforms, vertexShader, fragmentShader]);

  materialRef.current = mat;
  return { material: mat, uniforms, materialRef };
}

function Earth({ onPointerDown, sunMode }) {
  // Textures: day map remote, night lights local (optional)
  const dayUrl = 'https://raw.githubusercontent.com/trekview/earth-assets/main/textures/8k_earth_daymap.jpg';
  const lightsUrl = '/textures/earth_lights.jpg';

  const [dayTex, lightsTex] = useTexture([dayUrl, lightsUrl], (tex) => {
    if (tex && tex[0]) {
      tex[0].anisotropy = 8;
      tex[0].wrapS = tex[0].wrapT = THREE.ClampToEdgeWrapping;
    }
    if (tex && tex[1]) {
      tex[1].anisotropy = 2;
      tex[1].wrapS = tex[1].wrapT = THREE.RepeatWrapping;
    }
  });

  // If lights texture fails to load, use undefined gracefully
  const nightMap = useMemo(() => (lightsTex && lightsTex.image ? lightsTex : undefined), [lightsTex]);
  const dayMap = useMemo(() => (dayTex && dayTex.image ? dayTex : undefined), [dayTex]);

  const { material, uniforms } = useEarthShaderMaterial(dayMap, nightMap);

  // Update sunDirection each frame
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (sunMode === 'real') {
      const speed = 0.05;
      const a = t * speed;
      uniforms.uSunDir.value.set(Math.cos(a), 0.2, Math.sin(a)).normalize();
    } else {
      uniforms.uSunDir.value.set(1, 0.2, 0.6).normalize();
    }
    uniforms.uTime.value = t;
  });

  return (
    <mesh onPointerDown={onPointerDown}>
      <sphereGeometry args={[1, 128, 128]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
}

function Reticle({ position }) {
  if (!position) return null;
  return (
    <mesh position={position}>
      <sphereGeometry args={[0.008, 16, 16]} />
      <meshBasicMaterial color={'#F59E0B'} transparent opacity={0.9} />
    </mesh>
  );
}

function ControllerRay({ controller }) {
  const ref = useRef();
  useFrame(() => {
    if (!controller?.controller?.visible) return;
  });
  return (
    <line ref={ref}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          array={new Float32Array([0, 0, 0, 0, 0, -1.5])}
          count={2}
          itemSize={3}
        />
      </bufferGeometry>
      <lineBasicMaterial color={'#F59E0B'} linewidth={1} transparent opacity={0.7} />
    </line>
  );
}

function SceneContent({ onHit, onXRSupport, onCountrySelected, sunMode }) {
  const { camera, gl, scene } = useThree();
  const raycasterRef = useRef(new THREE.Raycaster());
  const pointerRef = useRef(new THREE.Vector2());
  const earthRef = useRef();

  // XR hooks (safe: only active if wrapped in <XR>)
  const { isPresenting, inputSources } = useXR();

  // Gesture WebSocket
  const { gestureStateRef } = useGestureWS({ enabledDefault: true });

  // Countries data / hit testing
  const { loaded, error, findCountryAt, getOutlineFor } = useCountries();
  const [selected, setSelected] = useState(null);
  const [lastHitState, setLastHitState] = useState(null);

  const ambient = useMemo(() => new THREE.AmbientLight(0xffffff, 0.6), []);
  const dirLight = useMemo(() => {
    const d = new THREE.DirectionalLight(0xffffff, 0.3);
    d.position.set(5, 3, 5);
    return d;
  }, []);

  useEffect(() => {
    scene.add(ambient);
    scene.add(dirLight);
    return () => {
      scene.remove(ambient);
      scene.remove(dirLight);
    };
  }, [scene, ambient, dirLight]);

  // XR support check with guard for non-WebXR environments
  useEffect(() => {
    const xr = globalThis?.navigator?.xr;
    if (xr && typeof xr.isSessionSupported === 'function') {
      xr.isSessionSupported('immersive-vr')
        .then((supported) => onXRSupport?.(!!supported))
        .catch(() => onXRSupport?.(false));
    } else {
      onXRSupport?.(false);
    }
  }, [onXRSupport]);

  // Shared selection computation from a ray (origin, direction)
  const computeSelectionFromRay = useCallback((ray) => {
    if (!ray) return false;
    raycasterRef.current.ray.copy(ray);
    const intersects = raycasterRef.current.intersectObjects(scene.children, true);
    if (!intersects.length) return false;

    const hit = intersects.find((i) => i.object.geometry?.type === 'SphereGeometry') || intersects[0];
    if (!hit?.point) return false;

    const { lat, lon } = vectorToLatLon(hit.point);
    const rounded = { lat: Number(lat.toFixed(4)), lon: Number(lon.toFixed(4)) };

    let f = null;
    if (loaded && !error) {
      f = findCountryAt(rounded.lat, rounded.lon);
      setSelected(f || null);
      onCountrySelected?.(f || null);
    }
    const payload = {
      ...rounded,
      country: f
        ? {
            name: f.properties?.NAME_EN || f.properties?.ADMIN || 'Unknown',
            iso: f.properties?.ISO_A3 || '—',
          }
        : null,
    };
    onHit?.(payload);
    setLastHitState(payload);
    return true;
  }, [scene.children, loaded, error, findCountryAt, onCountrySelected, onHit]);

  // Click handler (desktop)
  const handlePointerDown = (e) => {
    e.stopPropagation();

    const canvas = gl.domElement;
    const rect = canvas.getBoundingClientRect();
    pointerRef.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    pointerRef.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    raycasterRef.current.setFromCamera(pointerRef.current, camera);
    computeSelectionFromRay(raycasterRef.current.ray);
  };

  // Reticle state (VR)
  const [reticlePos, setReticlePos] = useState(null);
  const tmpRay = useMemo(() => new THREE.Ray(), []);
  const tmpDir = useMemo(() => new THREE.Vector3(), []);
  const tmpPos = useMemo(() => new THREE.Vector3(), []);

  // Orbit controls reference for manual control
  const orbitRef = useRef(null);

  // Update controller reticle each frame while presenting
  useFrame(() => {
    if (!isPresenting) {
      if (reticlePos) setReticlePos(null);
      return;
    }
    const ctrl = inputSources.find((s) => s.handedness === 'right') || inputSources[0];
    if (!ctrl?.object) {
      if (reticlePos) setReticlePos(null);
      return;
    }

    const obj = ctrl.object;
    tmpDir.set(0, 0, -1).applyQuaternion(obj.quaternion).normalize();
    tmpPos.copy(obj.position);

    tmpRay.origin.copy(tmpPos);
    tmpRay.direction.copy(tmpDir);

    raycasterRef.current.ray.copy(tmpRay);
    const intersects = raycasterRef.current.intersectObjects(scene.children, true);
    if (intersects.length) {
      const hit = intersects.find((i) => i.object.geometry?.type === 'SphereGeometry') || intersects[0];
      if (hit?.point) {
        if (!reticlePos || !reticlePos.equals(hit.point)) {
          setReticlePos(hit.point.clone());
        }
        return;
      }
    }
    if (reticlePos) setReticlePos(null);
  });

  // Handle controller primary select (trigger)
  useEffect(() => {
    if (!isPresenting || !inputSources?.length) return;

    const onSelect = (ev) => {
      const src = inputSources.find((s) => s.handedness === 'right') || ev?.target || inputSources[0];
      const obj = src?.object;
      if (!obj) return;

      tmpDir.set(0, 0, -1).applyQuaternion(obj.quaternion).normalize();
      tmpPos.copy(obj.position);
      tmpRay.origin.copy(tmpPos);
      tmpRay.direction.copy(tmpDir);
      computeSelectionFromRay(tmpRay);
    };

    inputSources.forEach((s) => {
      s.object?.addEventListener?.('select', onSelect);
    });

    return () => {
      inputSources.forEach((s) => {
        s.object?.removeEventListener?.('select', onSelect);
      });
    };
  }, [isPresenting, inputSources, computeSelectionFromRay, tmpDir, tmpPos, tmpRay]);

  // Slight rotation animation
  useFrame((_state, delta) => {
    if (earthRef.current) {
      earthRef.current.rotation.y += delta * 0.02;
    }
  });

  // Consume gesture buffer each frame
  useFrame((_state, delta) => {
    const buf = gestureStateRef.current.buffer;
    if (!buf || buf.length === 0) return;

    const applyZoomDelta = (dz) => {
      const cam = camera;
      const forward = new THREE.Vector3();
      cam.getWorldDirection(forward);
      cam.position.addScaledVector(forward, dz);
      const dist = cam.position.length();
      const min = 1.3;
      const max = 5.0;
      if (dist < min) cam.position.setLength(min);
      if (dist > max) cam.position.setLength(max);
    };

    const applyOrbitDelta = (dyaw, dpitch) => {
      const pos = camera.position.clone();
      const sph = new THREE.Spherical();
      sph.setFromVector3(pos);
      sph.theta += dyaw;
      sph.phi = Math.min(Math.max(0.01, sph.phi + dpitch), Math.PI - 0.01);
      const newPos = new THREE.Vector3().setFromSpherical(sph);
      camera.position.copy(newPos);
      camera.lookAt(0, 0, 0);
    };

    for (let i = 0; i < buf.length; i++) {
      const { name, phase, data } = buf[i];
      if (name === 'thumbs_up' && (phase === 'start' || phase === 'hold')) {
        applyZoomDelta(-0.06);
      } else if (name === 'thumbs_down' && (phase === 'start' || phase === 'hold')) {
        applyZoomDelta(0.06);
      } else if (name === 'pinch_in' && (phase === 'start' || phase === 'hold')) {
        const factor = typeof data?.zoom_factor === 'number' ? data.zoom_factor : (typeof data?.score === 'number' ? data.score : 0.5);
        const step = -0.12 * Math.max(0.1, Math.min(1.0, factor));
        applyZoomDelta(step);
      } else if (name === 'fist' && phase === 'start') {
        applyZoomDelta(0.15);
      } else if (name === 'rotate') {
        const yaw = typeof data?.yaw === 'number' ? data.yaw : 0;
        const pitch = typeof data?.pitch === 'number' ? data.pitch : 0;
        const scale = 0.4;
        applyOrbitDelta(yaw * scale * delta, pitch * scale * delta);
      }
    }
    buf.length = 0;
  });

  const outlineGeometry = useMemo(() => {
    if (!selected) return null;
    return getOutlineFor(selected);
  }, [selected, getOutlineFor]);

  return (
    <>
      <color attach="background" args={['#0b1220']} />
      <group>
        <group ref={earthRef}>
          <Earth onPointerDown={handlePointerDown} sunMode={sunMode} />
        </group>

        {selected && outlineGeometry && (
          <HighlightLayers
            feature={selected}
            outlineGeometry={outlineGeometry}
            lastHit={lastHitState}
            accent="#F59E0B"
          />
        )}

        {isPresenting && (
          <>
            {inputSources?.map((s, idx) =>
              s.object ? (
                <group key={idx} position={s.object.position} quaternion={s.object.quaternion}>
                  <ControllerRay controller={s} />
                </group>
              ) : null
            )}
            <Reticle position={reticlePos} />
          </>
        )}
      </group>

      {!isPresenting && (
        <OrbitControls
          ref={orbitRef}
          enableDamping
          dampingFactor={0.05}
          rotateSpeed={0.5}
          zoomSpeed={0.6}
          maxDistance={5}
          minDistance={1.3}
        />
      )}
      <Html position={[0, -1.4, 0]} center distanceFactor={16} style={{ color: 'white', opacity: 0.6 }}>
        {isPresenting ? 'Point a controller ray and press trigger to select a country' : 'Drag to orbit • Scroll to zoom • Click to select a country'}
      </Html>
    </>
  );
}

/**
* Canvas container with WebXR wrapper. Exposes onHit and onXRSupport callbacks.
* We render <XR> only after Canvas mounts and the renderer (gl) exists, to avoid undefined renderer errors.
*/
export default function GlobeCanvas({ onHit, onXRSupport, sunMode = 'real' }) {
  const [glReady, setGlReady] = useState(false);
  const [xrAvailable, setXrAvailable] = useState(false);

  // Runtime guard for XR availability
  useEffect(() => {
    const xr = globalThis?.navigator?.xr;
    setXrAvailable(!!xr);
  }, []);

  const onCreated = useCallback((state) => {
    // state.gl is guaranteed here
    const r = state?.gl;
    // Enable XR only if available and renderer exists
    if (r && r.xr) {
      // react-three-fiber manages WebXR via THREE.WebGLRenderer; do not call setWebXRManager manually.
      r.xr.enabled = !!xrAvailable;
    }
    // Mark renderer ready so we can safely wrap with XR
    setGlReady(true);
  }, [xrAvailable]);

  // Render Canvas; wrap contents with XR after renderer is ready. This avoids calling XR manager on undefined gl.
  return (
    <div className="canvas-wrap" aria-label="3D globe canvas">
      <Canvas
        shadows
        dpr={[1, 2]}
        camera={{ fov: 45, position: [0, 1.2, 2.2] }}
        resize={{ scroll: false, debounce: { scroll: 50, resize: 0 } }}
        onCreated={onCreated}
      >
        {glReady && xrAvailable ? (
          <XR>
            <SceneContent
              onHit={onHit}
              onXRSupport={onXRSupport}
              onCountrySelected={() => {}}
              sunMode={sunMode}
            />
          </XR>
        ) : (
          <SceneContent
            onHit={onHit}
            onXRSupport={onXRSupport}
            onCountrySelected={() => {}}
            sunMode={sunMode}
          />
        )}
      </Canvas>
    </div>
  );
}
