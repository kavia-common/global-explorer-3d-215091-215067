import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Html, useTexture } from '@react-three/drei';
import { XR } from '@react-three/xr';
import * as THREE from 'three';
import { useCountries } from '../hooks/useCountries.js';

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
    // Real-time: a slow orbit around Y axis to simulate day-night cycle
    if (sunMode === 'real') {
      const speed = 0.05; // radians per second
      const a = t * speed;
      // Sun orbiting around equatorial plane
      uniforms.uSunDir.value.set(Math.cos(a), 0.2, Math.sin(a)).normalize();
    } else {
      // Fixed: gentle angled direction
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

function CountryHighlight({ feature, getOutlineFor }) {
  const lineRef = useRef();
  const glowRef = useRef();

  const geometry = useMemo(() => {
    if (!feature) return null;
    return getOutlineFor(feature);
  }, [feature, getOutlineFor]);

  if (!feature || !geometry) return null;

  return (
    <group>
      {/* Outline lines */}
      <lineSegments ref={lineRef} geometry={geometry}>
        <lineBasicMaterial color={'#F59E0B'} linewidth={2} transparent opacity={0.95} />
      </lineSegments>
      {/* Subtle glow using a slightly larger, translucent mesh */}
      <lineSegments geometry={geometry} ref={glowRef} scale={[1.005, 1.005, 1.005]}>
        <lineBasicMaterial color={'#F59E0B'} transparent opacity={0.35} />
      </lineSegments>
    </group>
  );
}

function SceneContent({ onHit, onXRSupport, onCountrySelected, sunMode }) {
  const { camera, gl, scene } = useThree();
  const raycasterRef = useRef(new THREE.Raycaster());
  const pointerRef = useRef(new THREE.Vector2());
  const earthRef = useRef();

  // Countries data / hit testing
  const { loaded, error, findCountryAt, getOutlineFor } = useCountries();
  const [selected, setSelected] = useState(null);

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

  // XR support check
  useEffect(() => {
    if (navigator.xr && navigator.xr.isSessionSupported) {
      navigator.xr.isSessionSupported('immersive-vr').then((supported) => {
        onXRSupport?.(supported);
      }).catch(() => onXRSupport?.(false));
    } else {
      onXRSupport?.(false);
    }
  }, [onXRSupport]);

  // Click handler (raycast) to compute lat/lon and country selection
  const handlePointerDown = (e) => {
    e.stopPropagation();

    const canvas = gl.domElement;
    const rect = canvas.getBoundingClientRect();
    pointerRef.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    pointerRef.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    raycasterRef.current.setFromCamera(pointerRef.current, camera);
    const intersects = raycasterRef.current.intersectObjects(scene.children, true);

    if (intersects.length > 0) {
      // Prefer the earth sphere
      const hit = intersects.find((i) => i.object.geometry?.type === 'SphereGeometry') || intersects[0];
      if (hit && hit.point) {
        const { lat, lon } = vectorToLatLon(hit.point);
        const rounded = { lat: Number(lat.toFixed(4)), lon: Number(lon.toFixed(4)) };

        // Country lookup
        let f = null;
        if (loaded && !error) {
          f = findCountryAt(rounded.lat, rounded.lon);
          setSelected(f || null);
          onCountrySelected?.(f || null);
        }

        // Emit to parent with country info (name/iso) if available
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
      }
    }
  };

  // Animate slight rotation (world rotation, shader uses world normals for consistent terminator)
  useFrame((_state, delta) => {
    if (earthRef.current) {
      earthRef.current.rotation.y += delta * 0.02;
    }
  });

  return (
    <>
      {/* Sky background color */}
      <color attach="background" args={['#0b1220']} />
      <group>
        <group ref={earthRef}>
          <Earth onPointerDown={handlePointerDown} sunMode={sunMode} />
        </group>

        {/* Country highlight overlay */}
        {selected && <CountryHighlight feature={selected} getOutlineFor={getOutlineFor} />}
      </group>

      <OrbitControls
        enableDamping
        dampingFactor={0.05}
        rotateSpeed={0.5}
        zoomSpeed={0.6}
        maxDistance={5}
        minDistance={1.3}
      />
      <Html position={[0, -1.4, 0]} center distanceFactor={16} style={{ color: 'white', opacity: 0.6 }}>
        Drag to orbit • Scroll to zoom • Click to select a country
      </Html>
    </>
  );
}

/**
* Canvas container with WebXR wrapper. Exposes onHit and onXRSupport callbacks.
*/
// PUBLIC_INTERFACE
export default function GlobeCanvas({ onHit, onXRSupport, sunMode = 'real' }) {
  const [selectedCountry, setSelectedCountry] = useState(null);

  return (
    <div className="canvas-wrap" aria-label="3D globe canvas">
      {/* XR wrapper enables WebXR; session will be started via button in VRToggle */}
      <XR>
        <Canvas
          shadows
          dpr={[1, 2]}
          camera={{ fov: 45, position: [0, 1.2, 2.2] }}
          resize={{ scroll: false, debounce: { scroll: 50, resize: 0 } }}
        >
          <SceneContent
            onHit={onHit}
            onXRSupport={onXRSupport}
            onCountrySelected={(f) => {
              setSelectedCountry(f);
            }}
            sunMode={sunMode}
          />
        </Canvas>
      </XR>
    </div>
  );
}
