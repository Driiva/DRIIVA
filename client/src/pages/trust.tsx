/**
 * TRUST & COMPLIANCE HUB
 * ======================
 * FCA Consumer Duty / UK GDPR / Motor Insurance Act compliance page.
 * Designed to be trust-building and plain-language (Monzo-style, not HSBC).
 *
 * Sections:
 *   1. Data & Privacy Shield: what we collect, why, how long
 *   2. Your Rights: interactive GDPR accordion
 *   3. Regulatory Badges: FCA, ICO, GDPR, No Data Sold
 *   4. Underwriting Disclosure
 *   5. Consumer Duty Statement
 *   6. Financial Promotion Disclaimer
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation } from 'wouter';
import {
  ArrowLeft,
  ChevronDown,
  Download,
  Trash2,
  Mail,
  ExternalLink,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// SVG ICONS (inline for trust badges & shield)
// ---------------------------------------------------------------------------

function AnimatedLockIcon() {
  return (
    <div className="relative w-16 h-16 mx-auto mb-4">
      <div className="absolute inset-0 rounded-full bg-indigo-500/20 animate-ping" style={{ animationDuration: '3s' }} />
      <div className="relative w-16 h-16 rounded-full bg-indigo-500/10 border border-indigo-400/30 flex items-center justify-center">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="3" y="11" width="18" height="11" rx="2" stroke="var(--app-primary)" strokeWidth="2" />
          <path d="M7 11V7a5 5 0 0110 0v4" stroke="var(--app-primary)" strokeWidth="2" strokeLinecap="round" />
          <circle cx="12" cy="16" r="1.5" fill="var(--app-primary)" />
        </svg>
      </div>
    </div>
  );
}

function ShieldCheckSvg({ color = 'var(--app-primary)', size = 16 }: { color?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M12 2L3 7v5c0 5.25 3.75 10.15 9 11.25C17.25 22.15 21 17.25 21 12V7l-9-5z"
        stroke={color}
        strokeWidth="2"
        fill={`${color}20`}
      />
      <path d="M9 12l2 2 4-4" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// REGULATORY BADGE
// ---------------------------------------------------------------------------

function RegBadge({ label, color }: { label: string; color: string }) {
  return (
    <div
      className="flex items-center gap-1.5 px-3 py-1.5 border text-[13px] font-medium whitespace-nowrap"
      style={{
        borderRadius: 'var(--radius-md)',
        borderColor: 'rgba(var(--app-primary-rgb), 0.25)',
        color,
        backgroundColor: 'rgba(var(--app-primary-rgb), 0.06)',
      }}
    >
      <ShieldCheckSvg color={color} size={14} />
      {label}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ACCORDION ITEM
// ---------------------------------------------------------------------------

interface AccordionItemProps {
  title: string;
  children: React.ReactNode;
  isOpen: boolean;
  onToggle: () => void;
}

function AccordionItem({ title, children, isOpen, onToggle }: AccordionItemProps) {
  return (
    <div className="border-b border-white/[0.06] last:border-b-0">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between py-3.5 text-left min-h-[44px]"
      >
        <span className="text-[15px] font-medium text-white">{title}</span>
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronDown className="w-4 h-4 text-white/40" />
        </motion.div>
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="pb-4 text-[15px] text-white/70 leading-relaxed">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ---------------------------------------------------------------------------
// GLASS SECTION CARD
// ---------------------------------------------------------------------------

function GlassSection({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className={`backdrop-blur-xl bg-white/[0.04] border border-white/[0.08] rounded-2xl p-5 ${className}`}
    >
      {children}
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// DATA ITEMS
// ---------------------------------------------------------------------------

const DATA_COLLECTED = [
  { item: 'GPS location', detail: 'During active trips only, never in the background' },
  { item: 'Accelerometer & gyroscope', detail: 'To detect braking, acceleration, and cornering patterns' },
  { item: 'Speed & heading', detail: 'For safety scoring and route context' },
  { item: 'Trip metadata', detail: 'Start/end time, duration, distance' },
];

const GDPR_RIGHTS: { title: string; content: React.ReactNode }[] = [
  {
    title: 'Right of Access',
    content: (
      <div className="space-y-2">
        <p>You can request a full copy of your personal data at any time. We'll provide it in a machine-readable JSON format within 30 days.</p>
        <div className="flex items-center gap-2 text-[var(--app-primary)] text-[13px] font-medium">
          <Download className="w-3.5 h-3.5" />
          <span>Use "Export My Data" in Settings to download instantly</span>
        </div>
      </div>
    ),
  },
  {
    title: 'Right to Erasure',
    content: (
      <div className="space-y-2">
        <p>You can delete your account and all associated data. This is permanent and includes trip data, scores, and profile information, subject only to legal retention requirements (e.g. claims records).</p>
        <div className="flex items-center gap-2 text-[var(--err)] text-[13px] font-medium">
          <Trash2 className="w-3.5 h-3.5" />
          <span>Use "Delete Account" in Settings</span>
        </div>
      </div>
    ),
  },
  {
    title: 'Right to Data Portability',
    content: (
      <p>Your data export includes all trip data, scores, and profile information in a structured, machine-readable format (JSON). You can take this to another provider at any time.</p>
    ),
  },
  {
    title: 'Right to Object',
    content: (
      <div className="space-y-2">
        <p>You have the right to object to processing based on legitimate interests. If you object, we'll stop processing unless we have compelling grounds that override your rights.</p>
        <div className="flex items-center gap-2 text-[var(--ok)] text-[13px] font-medium">
          <Mail className="w-3.5 h-3.5" />
          <a href="mailto:info@driiva.co.uk" className="hover:underline">info@driiva.co.uk</a>
        </div>
      </div>
    ),
  },
];

// ---------------------------------------------------------------------------
// PAGE COMPONENT
// ---------------------------------------------------------------------------

export default function TrustPage() {
  const [, setLocation] = useLocation();
  const [openRight, setOpenRight] = useState<number | null>(null);

  return (
    <div className="min-h-screen flex flex-col items-center px-4 py-8 pb-16 text-white">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="max-w-2xl w-full space-y-5"
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Trust Centre</h1>
            <p className="text-white/50 text-[13px] mt-1">
              How Driiva protects you and your data
            </p>
          </div>
          <button
            onClick={() => window.history.back()}
            className="flex items-center gap-1.5 text-[var(--app-primary)] hover:text-[var(--app-primary)] transition-colors text-[15px] min-h-[44px]"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
        </div>

        {/* ── 1. Data & Privacy Shield ── */}
        <GlassSection>
          <AnimatedLockIcon />
          <h2 className="text-lg font-semibold text-center mb-1">Data &amp; Privacy Shield</h2>
          <p className="text-white/50 text-[13px] text-center mb-5">
            What we collect, why, and for how long
          </p>

          <div className="space-y-3 mb-5">
            {DATA_COLLECTED.map((d) => (
              <div key={d.item} className="flex items-start gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 mt-2 flex-shrink-0" />
                <div>
                  <span className="text-[15px] font-medium text-white">{d.item}</span>
                  <p className="text-[13px] text-white/50">{d.detail}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-4 space-y-2 mb-4">
            <h3 className="text-[13px] font-semibold text-[var(--app-primary)] uppercase tracking-wider">Retention</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-[15px] font-medium text-white">90 days</div>
                <div className="text-[13px] text-white/50">Raw GPS points (rolling window)</div>
              </div>
              <div>
                <div className="text-[15px] font-medium text-white">Policy lifetime</div>
                <div className="text-[13px] text-white/50">Aggregated scores &amp; trip summaries</div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 text-[13px] text-white/40">
            <ExternalLink className="w-3 h-3" />
            <button
              onClick={() => setLocation('/privacy')}
              className="hover:text-white/60 transition-colors underline underline-offset-2"
            >
              Read full Privacy Policy
            </button>
          </div>
        </GlassSection>

        {/* ── 2. Your Rights (GDPR Accordion) ── */}
        <GlassSection>
          <h2 className="text-lg font-semibold mb-1">Your Rights</h2>
          <p className="text-white/50 text-[13px] mb-4">
            Under UK GDPR, you have full control over your data
          </p>
          {GDPR_RIGHTS.map((right, idx) => (
            <AccordionItem
              key={right.title}
              title={right.title}
              isOpen={openRight === idx}
              onToggle={() => setOpenRight(openRight === idx ? null : idx)}
            >
              {right.content}
            </AccordionItem>
          ))}
          <p className="text-white/40 text-[13px] mt-3">
            To exercise any right, email <a href="mailto:info@driiva.co.uk" className="text-[var(--app-primary)] hover:underline">info@driiva.co.uk</a>. We respond within 30 days.
          </p>
        </GlassSection>

        {/* ── 3. Regulatory Badges ── */}
        <GlassSection>
          <h2 className="text-lg font-semibold mb-4">Regulatory Status</h2>
          <div className="flex flex-wrap gap-2">
            <RegBadge label="FCA Registered" color="var(--app-primary)" />
            <RegBadge label="UK GDPR Compliant" color="#10B981" />
            <RegBadge label="ICO Registered" color="var(--app-primary)" />
            <RegBadge label="No Data Sold" color="#10B981" />
          </div>
        </GlassSection>

        {/* ── 4. Underwriting Disclosure ── */}
        <GlassSection>
          <h2 className="text-lg font-semibold mb-2">Who Underwrites Your Policy</h2>
          <p className="text-[15px] text-white/70 leading-relaxed">
            Driiva is a technology and distribution platform. Insurance policies are
            underwritten by our capacity partner and are subject to their terms and
            conditions. <strong className="text-white">Driiva is not the insurer.</strong> Full
            underwriting details are provided in your policy documentation.
          </p>
        </GlassSection>

        {/* ── 5. Consumer Duty Statement ── */}
        <GlassSection>
          <h2 className="text-lg font-semibold mb-2">Our Commitment to You</h2>
          <p className="text-[13px] text-[var(--app-primary)] font-medium mb-3">FCA Consumer Duty</p>
          <p className="text-[15px] text-white/70 leading-relaxed">
            Driiva is built around the FCA's four Consumer Duty outcomes.
            We design <strong className="text-white">products that genuinely serve your needs</strong>,
            price them to deliver <strong className="text-white">fair value</strong>,
            communicate in <strong className="text-white">plain language you can act on</strong>,
            and provide <strong className="text-white">responsive, friction-free support</strong> whenever
            you need it. We monitor outcomes continuously and publish evidence, not just promises.
          </p>
        </GlassSection>

        {/* ── 6. Financial Promotion Disclaimer ── */}
        <GlassSection className="bg-white/[0.02]">
          <p className="text-white/55 text-[15px] leading-relaxed">
            <strong className="text-white/50">Financial promotion disclaimer:</strong> Refund
            amounts shown anywhere in the Driiva app are illustrative projections based on
            driving score performance. Actual refunds depend on community pool performance,
            claims experience, and underwriting criteria. Past performance is not a guarantee
            of future refunds. Driiva is a trading name of Driiva Ltd, authorised and
            regulated by the Financial Conduct Authority.
          </p>
        </GlassSection>

        {/* Footer links */}
        <div className="flex justify-center gap-6 text-[13px] text-white/30 pt-2">
          <button onClick={() => setLocation('/terms')} className="hover:text-white/50 transition-colors">
            Terms of Service
          </button>
          <button onClick={() => setLocation('/privacy')} className="hover:text-white/50 transition-colors">
            Privacy Policy
          </button>
          <a href="mailto:info@driiva.co.uk" className="hover:text-white/50 transition-colors">
            Contact
          </a>
        </div>
      </motion.div>
    </div>
  );
}
