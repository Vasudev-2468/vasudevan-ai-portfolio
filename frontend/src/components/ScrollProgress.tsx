"use client";

import { motion, useScroll, useSpring } from "framer-motion";

export default function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  const x = useSpring(scrollYProgress, { stiffness: 120, damping: 24, mass: 0.3 });

  return (
    <motion.div
      style={{ scaleX: x, transformOrigin: "0% 50%" }}
      className="fixed inset-x-0 top-0 z-50 h-[2px] bg-gradient-to-r from-accent via-plum to-rose"
    />
  );
}
