import driivaLogoPath from '@/assets/logo-wordmark-white-v3.png';

interface DriivaLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export const DriivaLogo: React.FC<DriivaLogoProps> = ({ size = 'lg' }) => {
  const sizeConfig = {
    sm: { width: 100 },
    md: { width: 140 },
    lg: { width: 180 },
    xl: { width: 240 },
  };
  
  const config = sizeConfig[size];
  
  return (
    <div 
      style={{ 
        marginTop: 28,
        marginBottom: 12,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <img 
        src={driivaLogoPath}
        alt="Driiva"
        style={{ 
          width: config.width,
          height: 'auto',
          objectFit: 'contain',
        }}
      />
    </div>
  );
};
