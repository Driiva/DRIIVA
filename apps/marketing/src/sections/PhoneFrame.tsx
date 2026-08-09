export function PhoneFrame() {
  return (
    <div className="phone-frame is-played" data-testid="phone-frame" aria-label="Driiva app preview">
      <div className="phone-glow" aria-hidden="true" />
      <img
        src="/brand/app-preview.png"
        alt="A hand holding a phone showing the Driiva app, AI-powered, community-driven insurance onboarding"
        className="phone-screen-img"
        loading="eager"
        decoding="async"
      />
    </div>
  );
}
