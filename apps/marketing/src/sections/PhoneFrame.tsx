export function PhoneFrame() {
  return (
    <div className="phone-frame is-played" data-testid="phone-frame" aria-label="Driiva app preview">
      <div className="phone-glow" aria-hidden="true" />
      <div className="phone-body">
        <div className="phone-notch" aria-hidden="true" />
        <div className="phone-screen phone-screen-image">
          <img
            src="/brand/app-preview.png"
            alt="Driiva app showing AI-powered, community-driven insurance onboarding"
            className="phone-screen-img"
            loading="eager"
            decoding="async"
          />
        </div>
      </div>
    </div>
  );
}
