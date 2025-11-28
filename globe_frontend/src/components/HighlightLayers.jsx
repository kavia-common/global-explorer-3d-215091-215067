import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';

/**
 * Utility: convert lat/lon degrees to a 3D vector on a sphere radius r.
 */
function latLonToVector3(latDeg, lonDeg, r = 1.001) {
  const lat = (latDeg * Math.PI) / 180;
  const lon = (lonDeg * Math.PI) / 180;
  const x = Math.cos(lat) * Math.cos(lon);
  const y = Math.sin(lat);
  const z = Math.cos(lat) * Math.sin(lon);
  return new THREE.Vector3(x, y, z).multiplyScalar(r);
}

/**
 * Compute a simple centroid for a Polygon/MultiPolygon in lon/lat space,
 * weighted by ring vertex count as a fallback; not area-accurate but acceptable here.
 */
function computeCentroidLonLat(geometry) {
  let sumLon = 0;
  let sumLat = 0;
  let count = 0;

  const accumulateRing = (ring) => {
    for (let i = 0; i < ring.length; i++) {
      const [lon, lat] = ring[i];
      sumLon += lon;
      sumLat += lat;
      count++;
    }
  };

  if (!geometry) return null;

  if (geometry.type === 'Polygon') {
    const rings = geometry.coordinates;
    if (!rings || !rings.length) return null;
    accumulateRing(rings[0]); // outer ring only
  } else if (geometry.type === 'MultiPolygon') {
    for (const poly of geometry.coordinates || []) {
      if (poly && poly.length) {
        accumulateRing(poly[0]); // outer ring only
      }
    }
  } else {
    return null;
  }

  if (count === 0) return null;
  return { lon: sumLon / count, lat: sumLat / count };
}

/**
 * Build mesh geometry (triangulated) for filled polygon on sphere.
 * We do a simplistic triangulation by forming a triangle fan from vertex 0 of the outer ring.
 * This is not hole-aware and may fail for concave shapes, but is performant and adequate for many countries.
 * If a ring is concave, visual artifacts may appear; we accept this trade-off to avoid external deps.
 */
function buildFilledGeometry(geometry, radius = 1.0015) {
  const positions = [];
  const pushFan = (ring) => {
    if (ring.length < 3) return;
    const v0 = latLonToVector3(ring[0][1], ring[0][0], radius);
    for (let i = 1; i < ring.length - 1; i++) {
      const v1 = latLonToVector3(ring[i][1], ring[i][0], radius);
      const v2 = latLonToVector3(ring[i + 1][1], ring[i + 1][0], radius);
      positions.push(
        v0.x, v0.y, v0.z,
        v1.x, v1.y, v1.z,
        v2.x, v2.y, v2.z
      );
    }
  };

  if (geometry.type === 'Polygon') {
    const rings = geometry.coordinates;
    if (!rings || !rings.length) return null;
    pushFan(rings[0]);
  } else if (geometry.type === 'MultiPolygon') {
    for (const poly of geometry.coordinates || []) {
      if (!poly || !poly.length) continue;
      pushFan(poly[0]);
    }
  } else {
    return null;
  }

  if (positions.length === 0) return null;

  const geom = new THREE.BufferGeometry();
  const pos = new Float32Array(positions);
  geom.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geom.computeVertexNormals();
  return geom;
}

/**
 * Small location pin using simple geometry: sphere + cone,
 * placed at a given lat/lon on the sphere, with a subtle bobbing animation.
 */
function LocationPin({ lat, lon, accent = '#F59E0B', radius = 1.006 }) {
  const groupRef = useRef();
  const yBase = 0;
  const timeRef = useRef(0);

  const position = useMemo(() => latLonToVector3(lat, lon, radius), [lat, lon, radius]);

  // Orient pin so its local +Y faces away from the globe center
  const upQuat = useMemo(() => {
    const dir = position.clone().normalize();
    const quat = new THREE.Quaternion();
    const from = new THREE.Vector3(0, 1, 0);
    quat.setFromUnitVectors(from, dir);
    return quat;
  }, [position]);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    timeRef.current = t;
    if (groupRef.current) {
      // gentle bobbing
      const bob = Math.sin(t * 2.0) * 0.01;
      groupRef.current.position.copy(position).addScaledVector(position.clone().normalize(), bob);
      // subtle opacity pulse handled via material emissiveIntensity or opacity on parent components if needed
    }
  });

  return (
    <group ref={groupRef} quaternion={upQuat}>
      {/* Small sphere head */}
      <mesh>
        <sphereGeometry args={[0.012, 16, 16]} />
        <meshStandardMaterial
          color={accent}
          emissive={accent}
          emissiveIntensity={0.25}
          metalness={0.2}
          roughness={0.6}
        />
      </mesh>
      {/* Cone pointer pointing along +Y (aligned to radial via quaternion above) */}
      <mesh position={[0, -0.03, 0]} rotation={[Math.PI, 0, 0]}>
        <coneGeometry args={[0.01, 0.03, 16]} />
        <meshStandardMaterial
          color={accent}
          emissive={accent}
          emissiveIntensity={0.2}
          metalness={0.1}
          roughness={0.8}
        />
      </mesh>
    </group>
  );
}

/**
 * Animated glow around the outline by scaling a duplicate outline and pulsing its opacity.
 * Uses line material with time-based opacity changes. Kept lightweight for performance.
 */
function AnimatedGlow({ geometry, color = '#F59E0B' }) {
  const glowRef = useRef();
  useFrame(({ clock }) => {
    if (!glowRef.current) return;
    const t = clock.getElapsedTime();
    const pulse = 0.5 + 0.5 * Math.sin(t * 2.2);
    glowRef.current.material.opacity = 0.15 + 0.25 * pulse;
    const s = 1.003 + 0.002 * pulse;
    glowRef.current.scale.set(s, s, s);
  });
  return (
    <lineSegments ref={glowRef} geometry={geometry}>
      <lineBasicMaterial color={color} transparent opacity={0.3} />
    </lineSegments>
  );
}

/**
 * PUBLIC_INTERFACE
 * HighlightLayers renders:
 * - Filled semi-transparent polygon of the selected country, lifted to avoid z-fighting.
 * - Animated glow as a pulsing, slightly scaled duplicate outline.
 * - Location pin placed at last hit lat/lon, or centroid fallback if unavailable.
 *
 * Props:
 * - feature: GeoJSON feature of the selected country (required for fill/outline).
 * - outlineGeometry: BufferGeometry for country outline lines (prebuilt) to avoid allocations.
 * - lastHit: { lat, lon, ... } with last interaction point; optional.
 * - accent: color string for accent (default Ocean Professional secondary).
 */
export default function HighlightLayers({
  feature,
  outlineGeometry,
  lastHit,
  accent = '#F59E0B',
}) {
  const fillRef = useRef(null);

  // Filled geometry built only when feature changes; disposed when unmounted/changed
  const filledGeometry = useMemo(() => {
    if (!feature) return null;
    return buildFilledGeometry(feature.geometry, 1.0018);
  }, [feature]);

  useEffect(() => {
    return () => {
      if (filledGeometry) filledGeometry.dispose();
    };
  }, [filledGeometry]);

  if (!feature || !outlineGeometry) return null;

  // Determine pin location: use lastHit lat/lon if provided; otherwise centroid fallback
  let pinLat = null;
  let pinLon = null;
  if (lastHit && typeof lastHit.lat === 'number' && typeof lastHit.lon === 'number') {
    pinLat = lastHit.lat;
    pinLon = lastHit.lon;
  } else {
    const c = computeCentroidLonLat(feature.geometry);
    if (c) {
      pinLat = c.lat;
      pinLon = c.lon;
    }
  }

  return (
    <group renderOrder={2}>
      {/* Outline (existing) */}
      <lineSegments geometry={outlineGeometry}>
        <lineBasicMaterial color={accent} linewidth={2} transparent opacity={0.95} />
      </lineSegments>

      {/* Animated glow */}
      <AnimatedGlow geometry={outlineGeometry} color={accent} />

      {/* Filled semi-transparent polygon raised slightly to avoid z-fighting */}
      {filledGeometry && (
        <mesh
          ref={fillRef}
          geometry={filledGeometry}
          renderOrder={1}
        >
          <meshBasicMaterial
            color={accent}
            transparent
            opacity={0.3}
            depthWrite={false}
            polygonOffset
            polygonOffsetFactor={-1}
            polygonOffsetUnits={-1}
          />
        </mesh>
      )}

      {/* Location pin */}
      {typeof pinLat === 'number' && typeof pinLon === 'number' && (
        <LocationPin lat={pinLat} lon={pinLon} accent={accent} radius={1.008} />
      )}
    </group>
  );
}
