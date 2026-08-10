import { useReveal } from '@/hooks/useReveal';
import { useWaitlistForm } from '@/hooks/useWaitlistForm';
import { useWaitlistCount } from '@/hooks/useWaitlistCount';

// Distinct from the hero's: this page renders both forms, and two elements
// cannot share an id that aria-describedby has to resolve.
const STATUS_ID = 'cta-waitlist-status';

export function FinalCTA() {
  const ref = useReveal<HTMLElement>();
  const waitlistCount = useWaitlistCount();
  const {
    message, inputRef, buttonRef, handleSubmit, inputProps, buttonProps, buttonLabel, statusProps,
  } = useWaitlistForm({ source: 'final-cta', statusId: STATUS_ID });

  return (
    <section ref={ref} id="cta-final" data-section="cta-final" className="cta-final">
      <div className="container">
        <div className="reveal-init">
          <h2>Ready to get paid for driving safely? Sign up now - early access is limited.</h2>
          <p>
            {waitlistCount === null
              ? 'Join the waitlist for the first refund-first motor insurance that means it.'
              : `Join the ${waitlistCount.toLocaleString('en-GB')} UK drivers on the waitlist for the first refund-first motor insurance that means it.`}
          </p>
          <form onSubmit={handleSubmit} noValidate className="waitlist-form" data-testid="cta-form">
            <input ref={inputRef} {...inputProps} />
            <button ref={buttonRef} {...buttonProps}>
              {buttonLabel}
            </button>
          </form>
          <div {...statusProps}>{message}</div>
        </div>
      </div>
    </section>
  );
}
