"use client";

import { useRef, type ReactNode } from "react";
import { motion, useMotionValue, useSpring, useTransform, useReducedMotion } from "framer-motion";

/** 轻微 3D 视差：面板随指针小幅倾斜（最大 ~4°），离开时弹簧回正。触屏/减动效时不启用。 */
export default function TiltPanel({ children }: { children: ReactNode }) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const mx = useMotionValue(0.5);
  const my = useMotionValue(0.5);
  const rotateX = useSpring(useTransform(my, [0, 1], [3.5, -3.5]), { stiffness: 180, damping: 22 });
  const rotateY = useSpring(useTransform(mx, [0, 1], [-4.5, 4.5]), { stiffness: 180, damping: 22 });

  const onMove = (e: React.PointerEvent) => {
    if (reduce || e.pointerType !== "mouse") return;
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    mx.set((e.clientX - r.left) / r.width);
    my.set((e.clientY - r.top) / r.height);
  };
  const onLeave = () => {
    mx.set(0.5);
    my.set(0.5);
  };

  return (
    <div style={{ perspective: 1100 }}>
      <motion.div
        ref={ref}
        onPointerMove={onMove}
        onPointerLeave={onLeave}
        style={{ rotateX, rotateY, transformStyle: "preserve-3d" }}
        className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xl shadow-slate-200/60"
      >
        {children}
      </motion.div>
    </div>
  );
}
