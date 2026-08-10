import { motion } from "framer-motion";

interface InfiniteScrollIndicatorProps {
  currentPage: number;
  totalPages: number;
  pageNames: string[];
}

export default function InfiniteScrollIndicator({ currentPage, totalPages, pageNames }: InfiniteScrollIndicatorProps) {
  return (
    <div className="fixed top-16 right-4 z-40">
      <div className="glass-morphism rounded-xl p-2" style={{
        background: 'rgba(255, 255, 255, 0.08)',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        backdropFilter: 'blur(16px)',
      }}>
        <div className="flex flex-col space-y-1">
          {Array.from({ length: totalPages }).map((_, index) => (
            <motion.div
              key={index}
              className={`w-2 h-2 rounded-full transition-all duration-300 ${
                index === currentPage 
                  ? 'bg-white shadow-md shadow-white/30' 
                  : 'bg-white/30'
              }`}
              animate={{
                scale: index === currentPage ? 1.2 : 1,
                opacity: index === currentPage ? 1 : 0.6,
              }}
              transition={{
                type: "spring",
                stiffness: 300,
                damping: 30,
              }}
            />
          ))}
        </div>
        
        {/* Page name indicator */}
        <div className="mt-2 text-xs text-white text-center font-medium" style={{
          fontFamily: 'var(--font-body)',
          textShadow: '1px 1px 2px rgba(0,0,0,0.6)',
        }}>
          {pageNames[currentPage]}
        </div>
      </div>
    </div>
  );
}