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

function Earth({ onPointerDown }) {
  // Placeholder Earth texture - using a basic color if texture fetch fails.
  const textureUrl = 'https://raw.githubusercontent.com/trekview/earth-assets/main/textures/8k_earth_daymap.jpg';
  const [earthTexture] = useTexture([textureUrl], (tex) => {
    if (tex && tex[0]) {
      tex[0].anisotropy = 8;
      tex[0].wrapS = tex[0].wrapT = THREE.ClampToEdgeWrapping;
    }
  });

  return (
    <mesh onPointerDown={onPointerDown}>
      <sphereGeometry args={[1, 64, 64]} />
      {earthTexture ? (
        <meshPhongMaterial map={earthTexture} />
      ) : (
        <meshPhongMaterial color="#3b82f6" />
      )}
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

function SceneContent({ onHit, onXRSupport, onCountrySelected }) {
  const { camera, gl, scene } = useThree();
  const raycasterRef = useRef(new THREE.Raycaster());
  const pointerRef = useRef(new THREE.Vector2());
  const earthRef = useRef();

  // Countries data / hit testing
  const { loaded, error, findCountryAt, getOutlineFor } = useCountries();
  const [selected, setSelected] = useState(null);

  const ambient = useMemo(() => new THREE.AmbientLight(0xffffff, 0.6), []);
  const dirLight = useMemo(() => {
    const d = new THREE.DirectionalLight(0xffffff, 0.8);
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

  // Animate slight rotation
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
          <Earth onPointerDown={handlePointerDown} />
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
export default function GlobeCanvas({ onHit, onXRSupport }) {
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
              // Also emit a user-facing hit with country iso/name via onHit if desired
              // Here we preserve existing onHit for lat/lon only and Overlay will be updated via props lifting in App if needed.
            }}
          />
        </Canvas>
      </XR>
    </div>
  );
}
