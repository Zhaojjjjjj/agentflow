"use client";

import dynamic from "next/dynamic";

/**
 * Client boundary for the Three.js hero: dynamic import with ssr:false
 * (not allowed directly inside a Server Component).
 */
const WorkflowHero = dynamic(() => import("./WorkflowHero"), {
  ssr: false,
  loading: () => (
    <div
      aria-hidden
      className="absolute inset-0"
      style={{ background: "#0A0A0F" }}
    />
  ),
});

export default function HeroCanvas() {
  return <WorkflowHero />;
}
