"use client";

import { motion, useScroll, useSpring } from "framer-motion";

/** 导航栏底部滚动进度线（品牌紫，随页面滚动生长） */
export default function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 120, damping: 26, mass: 0.4 });
  return (
    <motion.div
      aria-hidden
      style={{ scaleX }}
      className="absolute inset-x-0 bottom-0 h-[2px] origin-left bg-[#7C3AED]"
    />
  );
}
