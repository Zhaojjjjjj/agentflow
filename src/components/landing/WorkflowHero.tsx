"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

/**
 * Landing hero background: a slowly drifting "workflow graph" particle network.
 * Purple glowing nodes + faint links on near-black (#0A0A0F), with mouse parallax.
 *
 * Pure three.js inside useEffect (no react-three-fiber). Loaded via
 * next/dynamic with ssr:false so it never touches the console bundle.
 * Degrades to a static CSS gradient when WebGL is unavailable.
 */

const BG = 0x0a0a0f;
const NODE_COUNT = 130;
const LINK_DIST = 115;
const MAX_LINKS = 1000;

function makeGlowTexture(): THREE.Texture {
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return new THREE.Texture();
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.35, "rgba(255,255,255,0.5)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(canvas);
}

export default function WorkflowHero() {
  const mountRef = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let renderer: THREE.WebGLRenderer | null = null;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "low-power" });
    } catch {
      setFailed(true);
      return;
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(BG, 1);

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(BG, 0.0014);
    const camera = new THREE.PerspectiveCamera(60, 1, 1, 2500);
    camera.position.set(0, 0, 640);
    camera.lookAt(0, 0, 0);

    const group = new THREE.Group();
    scene.add(group);

    // ---- nodes ----
    const W = 980;
    const H = 560;
    const D = 340;
    const positions = new Float32Array(NODE_COUNT * 3);
    const velocities = new Float32Array(NODE_COUNT * 3);
    const colors = new Float32Array(NODE_COUNT * 3);
    const palette = ["#8B5CF6", "#7C3AED", "#A78BFA", "#6D28D9"].map((c) => new THREE.Color(c));
    for (let i = 0; i < NODE_COUNT; i++) {
      positions[i * 3] = (Math.random() - 0.5) * W;
      positions[i * 3 + 1] = (Math.random() - 0.5) * H;
      positions[i * 3 + 2] = (Math.random() - 0.5) * D;
      velocities[i * 3] = (Math.random() - 0.5) * 7;
      velocities[i * 3 + 1] = (Math.random() - 0.5) * 7;
      velocities[i * 3 + 2] = (Math.random() - 0.5) * 4;
      const c = palette[(Math.random() * palette.length) | 0];
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }
    const nodeGeo = new THREE.BufferGeometry();
    nodeGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    nodeGeo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    const glowTex = makeGlowTexture();
    const nodeMat = new THREE.PointsMaterial({
      size: 10,
      map: glowTex,
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    });
    const points = new THREE.Points(nodeGeo, nodeMat);
    points.frustumCulled = false;
    group.add(points);

    // ---- links ----
    const linkGeo = new THREE.BufferGeometry();
    const linkPos = new Float32Array(MAX_LINKS * 6);
    linkGeo.setAttribute("position", new THREE.BufferAttribute(linkPos, 3));
    const linkMat = new THREE.LineBasicMaterial({
      color: 0x7c3aed,
      transparent: true,
      opacity: 0.15,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const lines = new THREE.LineSegments(linkGeo, linkMat);
    lines.frustumCulled = false;
    group.add(lines);

    mount.appendChild(renderer.domElement);
    renderer.domElement.style.position = "absolute";
    renderer.domElement.style.inset = "0";
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";

    const mouse = { x: 0, y: 0 };
    const onMouse = (e: MouseEvent) => {
      const r = mount.getBoundingClientRect();
      mouse.x = ((e.clientX - r.left) / r.width - 0.5) * 2;
      mouse.y = ((e.clientY - r.top) / r.height - 0.5) * 2;
    };
    window.addEventListener("mousemove", onMouse, { passive: true });

    const resize = () => {
      const w = mount.clientWidth || 1;
      const h = mount.clientHeight || 1;
      renderer?.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(mount);

    const clock = new THREE.Clock();
    let raf = 0;
    let running = true;
    const onVis = () => {
      running = document.visibilityState === "visible";
    };
    document.addEventListener("visibilitychange", onVis);

    const LINK2 = LINK_DIST * LINK_DIST;
    function tick() {
      raf = requestAnimationFrame(tick);
      if (!running || !renderer) return;
      const dt = Math.min(clock.getDelta(), 0.05);
      const t = clock.elapsedTime;

      const posAttr = nodeGeo.attributes.position as THREE.BufferAttribute;
      const arr = posAttr.array as Float32Array;
      for (let i = 0; i < NODE_COUNT; i++) {
        let x = arr[i * 3] + velocities[i * 3] * dt;
        let y = arr[i * 3 + 1] + velocities[i * 3 + 1] * dt;
        let z = arr[i * 3 + 2] + velocities[i * 3 + 2] * dt;
        if (x > W / 2 || x < -W / 2) velocities[i * 3] *= -1;
        if (y > H / 2 || y < -H / 2) velocities[i * 3 + 1] *= -1;
        if (z > D / 2 || z < -D / 2) velocities[i * 3 + 2] *= -1;
        // gentle wobble so the graph feels alive, not mechanical
        posAttr.setXYZ(
          i,
          x + Math.sin(t * 0.6 + i * 1.3) * 0.12,
          y + Math.cos(t * 0.5 + i * 1.7) * 0.12,
          z
        );
      }
      posAttr.needsUpdate = true;

      let li = 0;
      for (let i = 0; i < NODE_COUNT && li < MAX_LINKS; i++) {
        const ix = i * 3;
        for (let j = i + 1; j < NODE_COUNT && li < MAX_LINKS; j++) {
          const jx = j * 3;
          const dx = arr[ix] - arr[jx];
          const dy = arr[ix + 1] - arr[jx + 1];
          const dz = arr[ix + 2] - arr[jx + 2];
          if (dx * dx + dy * dy + dz * dz < LINK2) {
            const o = li * 6;
            linkPos[o] = arr[ix];
            linkPos[o + 1] = arr[ix + 1];
            linkPos[o + 2] = arr[ix + 2];
            linkPos[o + 3] = arr[jx];
            linkPos[o + 4] = arr[jx + 1];
            linkPos[o + 5] = arr[jx + 2];
            li++;
          }
        }
      }
      linkGeo.setDrawRange(0, li * 2);
      (linkGeo.attributes.position as THREE.BufferAttribute).needsUpdate = true;

      // mouse parallax — slow and restrained
      group.rotation.y += (mouse.x * 0.1 - group.rotation.y) * 0.035;
      group.rotation.x += (-mouse.y * 0.07 - group.rotation.x) * 0.035;

      renderer.render(scene, camera);
    }

    if (reduced) {
      renderer.render(scene, camera);
    } else {
      tick();
    }

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("mousemove", onMouse);
      document.removeEventListener("visibilitychange", onVis);
      ro.disconnect();
      nodeGeo.dispose();
      linkGeo.dispose();
      nodeMat.dispose();
      linkMat.dispose();
      glowTex.dispose();
      renderer?.dispose();
      if (renderer && renderer.domElement.parentElement === mount) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, []);

  if (failed) {
    return (
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(1000px 520px at 50% 18%, #1e1b4b 0%, #0A0A0F 62%)",
        }}
      />
    );
  }
  return <div ref={mountRef} aria-hidden className="absolute inset-0 overflow-hidden" />;
}
