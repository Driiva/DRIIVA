export default function DriivaLogo({ className = "", size = "default" }: { 
  className?: string; 
  size?: "small" | "default" | "large" 
}) {
  const sizeClasses = {
    small: "text-xl tracking-tight",
    default: "text-2xl tracking-tight",
    large: "text-4xl tracking-tight"
  };

  return (
    <div className={`font-semibold ${sizeClasses[size]} ${className}`} style={{ fontFamily: 'var(--font-body)' }}>
      <span className="text-white relative" style={{ fontStyle: 'italic' }}>
        <span style={{ textTransform: 'uppercase', letterSpacing: '-0.02em' }}>D</span>riiva
      </span>
    </div>
  );
}