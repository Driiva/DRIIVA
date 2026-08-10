import { motion, HTMLMotionProps } from "framer-motion";
import { ReactNode } from "react";
import { timing, microInteractions } from "@/lib/animations";

interface GlassCardProps extends Omit<HTMLMotionProps<"div">, "children"> {
  children: ReactNode;
  className?: string;
  interactive?: boolean;
}

export function GlassCard({ 
  children, 
  className = "", 
  interactive = true,
  ...props 
}: GlassCardProps) {
  return (
    <motion.div
      className={`instrument-card ${className}`}
      whileTap={interactive ? microInteractions.tap : undefined}
      whileHover={interactive ? microInteractions.hoverSubtle : undefined}
      transition={{ duration: timing.quick }}
      {...props}
    >
      {children}
    </motion.div>
  );
}
