import React, { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Html, useTexture } from '@react-three/drei';
import { XR, useXR } from '@react-three/xr';
import * as THREE from 'three';

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

function SceneContent({ onHit, onXRSupport }) {
  const { camera, gl, scene } = useThree();
  const raycasterRef = useRef(new THREE.Raycaster());
  const pointerRef = useRef(new THREE.Vector2());
  const earthRef = useRef();

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

  // Click handler (raycast) to compute lat/lon
  const handlePointerDown = (e) => {
    // Stop orbit drag on click handling
    e.stopPropagation();

    const { x, y } = e.pointer || e;
    const canvas = gl.domElement;
    const rect = canvas.getBoundingClientRect();

    pointerRef.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    pointerRef.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    raycasterRef.current.setFromCamera(pointerRef.current, camera);
    const intersects = raycasterRef.current.intersectObjects(scene.children, true);

    if (intersects.length > 0) {
      // Find intersect with Earth sphere
      const hit = intersects.find((i) => i.object.geometry?.type === 'SphereGeometry') || intersects[0];
      if (hit && hit.point) {
        const { lat, lon } = vectorToLatLon(hit.point);
        onHit?.({ lat: Number(lat.toFixed(4)), lon: Number(lon.toFixed(4)) });
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
      {/* Placeholder group for day/night shader and weather overlays */}
      <group>
        <group ref={earthRef}>
          <Earth onPointerDown={handlePointerDown} />
        </group>
        {/* Placeholder: Day/Night terminator shader to be added */}
        {/* Placeholder: Weather overlay meshes/particles to be added */}
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
        Drag to orbit • Scroll to zoom • Click globe to get lat/lon
      </Html>
    </>
  );
}

/**
* Canvas container with WebXR wrapper. Exposes onHit and onXRSupport callbacks.
*/
// PUBLIC_INTERFACE
export default function GlobeCanvas({ onHit, onXRSupport }) {
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
          <SceneContent onHit={onHit} onXRSupport={onXRSupport} />
        </Canvas>
      </XR>
    </div>
  );
}
