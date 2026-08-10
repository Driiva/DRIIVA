import { LegalPage } from './LegalPage';

export function Complaints() {
  return (
    <LegalPage title="Complaints" updated="2026-05-19">
      <p className="legal-lede">
        We want to hear about it if something has gone wrong. This page sets out how to raise a
        complaint and what to expect from us. When Driiva is through the FCA regulatory sandbox and able to sell motor
        insurance, the Financial Ombudsman Service route below will apply to any policy-related
        complaint.
      </p>

      <h2>1. How to raise a complaint</h2>
      <p>
        Email{' '}
        <a href="mailto:hello@driiva.co.uk?subject=Complaint">hello@driiva.co.uk</a> with
        "Complaint" in the subject line. Tell us what happened, what you would like us to do, and
        when it happened. If it relates to the waitlist signup, include the email you used.
      </p>

      <h2>2. Our process</h2>
      <ul>
        <li>We acknowledge every complaint within 5 working days.</li>
        <li>
          We aim to resolve complaints within 4 weeks. If we need longer (up to 8 weeks under FCA
          rules once we are authorised), we will tell you.
        </li>
        <li>
          Our written response will set out our decision, the reasons, and the next steps
          available to you.
        </li>
      </ul>

      <h2>3. Escalation (post-authorisation)</h2>
      <p>
        Once Driiva is authorised to sell insurance and your complaint relates to a regulated
        activity, you will have the right to escalate to the Financial Ombudsman Service if you
        are unhappy with our final response or if we have not resolved your complaint within 8
        weeks.
      </p>
      <ul>
        <li>
          <strong>Financial Ombudsman Service:</strong>{' '}
          <a href="https://www.financial-ombudsman.org.uk" rel="noopener noreferrer">
            financial-ombudsman.org.uk
          </a>
        </li>
        <li>Phone: 0800 023 4567</li>
        <li>Address: Exchange Tower, London E14 9SR</li>
      </ul>

      <h2>4. Pre-authorisation complaints</h2>
      <p>
        Until we are through the FCA regulatory sandbox, the FOS route is not yet available. For any matter relating
        to the marketing site or the waitlist, the Information Commissioner's Office (data
        matters) and the Advertising Standards Authority (marketing claims) remain available
        alongside our internal process.
      </p>
    </LegalPage>
  );
}
