import { useEffect, useRef, useState } from 'react';
import { useReveal } from '@/hooks/useReveal';
import { prefersReducedMotion } from '@/lib/motion';

export function BrandStatement() {
  const sectionRef = useReveal<HTMLElement>();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [armed, setArmed] = useState(false);

  // Lazy-mount the video source on intersect so it never loads above the
  // fold, and respect reduced motion by leaving it paused on the poster.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (typeof IntersectionObserver === 'undefined') {
      setArmed(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setArmed(true);
            if (!prefersReducedMotion()) {
              video.play().catch(() => undefined);
            }
            io.disconnect();
            break;
          }
        }
      },
      { threshold: 0.4 },
    );
    io.observe(video);
    return () => io.disconnect();
  }, []);

  return (
    <section ref={sectionRef} className="brand-statement" data-section="brand-statement">
      <div className="container">
        <div className="brand-statement-card reveal-init glass">
          <div className="brand-statement-video-wrap">
            <video
              ref={videoRef}
              className="brand-statement-video"
              muted
              playsInline
              loop
              preload="none"
              poster="/brand/logo-wordmark-gradient.png"
              aria-label="Driiva brand statement"
              {...(armed ? { autoPlay: true } : {})}
            >
              {armed && <source src="/brand/video/brand-statement-16x9.mp4" type="video/mp4" />}
            </video>
            <div className="brand-statement-frame" aria-hidden="true" />
          </div>
          <div className="brand-statement-body">
            <span className="eyebrow-mini">Brand voice</span>
            <h2>
              Drive well. <span className="hl">Get money back.</span>
            </h2>
            <p>
              We are building the first UK motor insurer where good behaviour is the product, not
              a marketing line. Every refund is mechanical. Every weighting is published. Every
              line of the scoring algorithm is open to challenge.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
