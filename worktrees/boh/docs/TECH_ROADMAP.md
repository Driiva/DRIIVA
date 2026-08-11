# DRIIVA Technical Roadmap
### MVP Beta -- February 2026

---

## Executive Summary

Driiva is a telematics-based insurance platform that tracks driving behaviour via GPS, calculates a personalised driving score, and uses that score to offer fairer insurance premiums. Safe drivers pay less and earn refunds from a community pool.

This document provides a complete picture of what has been built, what was updated in the latest sprint, and what remains before the product meets industry standard for a regulated insurtech beta.

---

## What's Been Built (Current State)

### Core Product -- COMPLETE

| Feature | Status | Description |
|---------|--------|-------------|
| User registration & login | Live | Email/password + Google Sign-In via Firebase Auth |
| Onboarding flow | Live | 4-step guided setup (permissions, vehicle, preferences) |
| GPS trip recording | Live | Real-time location tracking, accelerometer & gyroscope data |
| Driving score engine | Live | 0-100 score based on speed, braking, acceleration, cornering |
| Trip history | Live | All completed trips stored in Firestore with full metrics |
| Dashboard | Live | Real-time score, recent trips, pool status, policy info |
| Leaderboard | Live | Weekly, monthly, all-time rankings across all drivers |
| Community pool | Live | Shared premium pool -- safe drivers earn refunds |
| AI trip analysis | Live | Claude Sonnet 4 analyses each trip and provides coaching |
| GDPR compliance | Live | Data export, account deletion, UK-compliant privacy policy |
| Security rules | Live | Every user can only see their own data (Firestore RLS) |

### Infrastructure -- COMPLETE

| Component | Technology | Status |
|-----------|-----------|--------|
| Frontend | React + TypeScript + Vite | Built |
| Styling | Tailwind CSS + Framer Motion | Built |
| Authentication | Firebase Auth | Configured |
| Database | Cloud Firestore (NoSQL) | Schema complete, rules written |
| Backend logic | Firebase Cloud Functions (Node.js) | 15+ functions written |
| AI engine | Anthropic Claude Sonnet 4 | Integrated, feature-flagged |
| Insurance API | Root Platform | Scaffolded (needs credentials) |
| Maps | Leaflet | Integrated |
| Mobile support | Progressive Web App (manifest) | Partial |

---

## Latest Sprint Updates (February 2026)

These changes were made in the current development cycle:

### 1. Cloud Functions Build Fixed
**What:** Two code errors were preventing the entire backend from being deployed to Firebase. Both are now fixed and the backend compiles cleanly.

**Why it matters:** Without this fix, no trip processing, no scoring, no AI analysis, and no pool calculations would work in production. This was the single biggest blocker.

### 2. Trips Page Wired to Real Data
**What:** The "Recent Trips" screen was previously showing 4 fake/demo trips. It now pulls real trip data from Firestore -- the actual database.

**Why it matters:** Users will see their real driving history with real scores, distances, and event counts. Previously it was a static mockup.

### 3. AI Insights Feature Flag
**What:** Added an on/off switch for the AI coaching feature. It can be disabled with a single environment variable (`FEATURE_AI_INSIGHTS=false`).

**Why it matters:** AI analysis costs money per trip (Anthropic API usage). During beta, this lets us control spend. It also means if the AI service has issues, we can turn it off without redeploying code.

**Where the flag lives:**
- Client side: `VITE_FEATURE_AI_INSIGHTS` in `.env`
- Server side: `FEATURE_AI_INSIGHTS` in Cloud Functions environment

### 4. Root Platform Insurance Integration
**What:** Built the connection between Driiva and Root Platform (rootplatform.com), which is an insurance infrastructure API. Three new Cloud Functions:
- **Get Quote** -- sends driving score to Root, gets back a premium price
- **Accept Quote** -- binds a policy through Root's system
- **Sync Policy** -- keeps our records up to date with Root's

**Why it matters:** This is how Driiva will actually issue real insurance policies. Root handles the regulatory/underwriting side; we provide the telematics data and scores.

**What's needed:** Root Platform partner agreement and API credentials (sandbox key for testing, production key for launch).

---

## What's NOT Done Yet (Gaps to Close)

### CRITICAL -- Must Have Before Any Beta Users

| Gap | Risk | Effort | Detail |
|-----|------|--------|--------|
| Firebase deployment | **Blocking** | 1 hour | Cloud Functions, security rules, and indexes need to be deployed. Requires `firebase login` and deploy commands. |
| Anthropic API key | **Blocking** | 15 min | Need to create an account at console.anthropic.com, generate a key, and set it as a Firebase secret. Without this, AI trip coaching won't work. |
| Root Platform credentials | **Blocking** | Business | Need to sign partner agreement with Root Platform and obtain sandbox API key. Without this, insurance quotes/policies won't work. |
| Automated testing | **Critical** | 2-3 weeks | Zero automated tests exist. No unit tests, no integration tests, no end-to-end tests. Industry standard for fintech is 80%+ code coverage. |
| CI/CD pipeline | **Critical** | 1 week | No automated deployment pipeline. Every release requires manual commands. Need GitHub Actions to run tests, build, and deploy automatically. |
| Error monitoring | **Critical** | 2 days | No Sentry, no DataDog, no error tracking. If the app crashes for users, we won't know until they tell us. |
| Password reset | **Critical** | 1 day | Users cannot reset forgotten passwords. Basic auth feature that's missing. |

### HIGH PRIORITY -- Must Have Before Public Beta

| Gap | Risk | Effort | Detail |
|-----|------|--------|--------|
| Stripe payment processing | **High** | 1-2 weeks | Stripe dependencies are installed but no payment endpoints are built. Users can't actually pay premiums yet. |
| Push notifications | **High** | 3-5 days | Token storage exists but no notification sending logic. Users won't get alerts about trip scores, policy updates, etc. |
| Analytics | **High** | 2-3 days | Firebase Analytics dependency exists but isn't initialised. We can't measure user behaviour, retention, or feature usage. |
| Service worker (offline) | **High** | 3-5 days | PWA manifest exists but no service worker. App won't work offline or be installable on mobile home screens. |
| CORS lockdown | **High** | 1 hour | Server currently accepts requests from any website (`*`). Must restrict to driiva.com and localhost only. |
| Content Security Policy | **High** | 1 day | No CSP headers. Leaves the app vulnerable to cross-site scripting attacks. |
| Email verification | **Medium** | 1-2 days | Users can sign up with any email without verifying they own it. |

### MEDIUM PRIORITY -- Should Have for Credibility

| Gap | Risk | Effort | Detail |
|-----|------|--------|--------|
| Phone usage detection | **Medium** | 1-2 weeks | Score component exists but always returns 100. Need actual phone pickup detection. |
| Trip route visualisation | **Medium** | 3-5 days | Map shows current location but doesn't draw the route line for completed trips. |
| Achievements backend | **Medium** | 1 week | Achievement UI exists with demo data. Backend logic to unlock/track achievements not implemented. |
| Rewards system | **Medium** | 1-2 weeks | Rewards page is entirely mock data. No points economy or reward claiming. |
| Profile page data | **Medium** | 2-3 days | Profile page shows static placeholder data instead of real user info. |
| Documentation | **Medium** | 1 week | No README, no architecture document, no API docs. |

---

## Industry Standard Checklist (Insurtech / Fintech)

For a product handling personal driving data and insurance premiums, these are the regulatory and industry requirements:

### Regulatory Compliance

| Requirement | Status | Notes |
|------------|--------|-------|
| FCA registration | Not started | Financial Conduct Authority approval needed to sell insurance in the UK. Can operate under Root Platform's licence initially. |
| UK GDPR compliance | Partial | Privacy policy exists, data export & deletion work. Need cookie consent banner, data processing records, and DPO appointment. |
| ICO registration | Not started | Must register with the Information Commissioner's Office as a data controller. |
| PCI DSS | Not applicable yet | Not handling card data directly (Stripe handles it). If we ever handle card numbers, this becomes mandatory. |

### Security (Pre-Launch Audit)

| Requirement | Status | Priority |
|------------|--------|----------|
| Penetration testing | Not done | **Must do** before public beta |
| Security audit (code) | Not done | **Must do** before public beta |
| Data encryption at rest | Covered by Firebase | Firestore encrypts at rest by default |
| Data encryption in transit | Covered by HTTPS | All Firebase services use TLS |
| API key restrictions | Documented | Firebase key restricted, but need to verify in GCP console |
| Secret management | Partial | Using Firebase secrets, but Anthropic key not yet set |
| Rate limiting | Exists | Auth: 5/15min, API: 100/15min, Webhooks: 10/min |
| Input sanitisation | Exists | Strips HTML tags, trims inputs |
| SQL injection | Not applicable | Using Firestore (NoSQL), not SQL |

### Operational Readiness

| Requirement | Status | Priority |
|------------|--------|----------|
| Uptime monitoring | Not set up | Need 99.9% SLA for insurance product |
| Error alerting | Not set up | Need PagerDuty or similar for on-call |
| Database backups | Automatic (Firebase) | Firestore handles backups |
| Disaster recovery plan | Not documented | Need documented DR procedures |
| Load testing | Not done | Must test with expected user volumes |
| Staging environment | Not set up | Need separate Firebase project for staging |

---

## Recommended Sprint Plan

### Sprint 1 (Week 1-2): "Make It Real"
> Goal: Deploy what exists and make the app functional end-to-end

- [ ] Create Anthropic account and set API key as Firebase secret
- [ ] Run `firebase login` and authenticate
- [ ] Deploy Cloud Functions (`firebase deploy --only functions`)
- [ ] Deploy Firestore rules and indexes
- [ ] Contact Root Platform for sandbox credentials
- [ ] Fix CORS (restrict to driiva.com)
- [ ] Add password reset flow
- [ ] Test full flow: signup -> onboarding -> record trip -> see score -> see AI insights

### Sprint 2 (Week 3-4): "Make It Safe"
> Goal: Security, monitoring, and testing foundation

- [ ] Set up Sentry for error monitoring (frontend + Cloud Functions)
- [ ] Add Content Security Policy headers
- [ ] Set up GitHub Actions CI/CD pipeline
- [ ] Write first batch of tests (auth flow, scoring algorithm, trip processing)
- [ ] Set up staging Firebase project
- [ ] Add Firebase Analytics initialisation
- [ ] Implement email verification

### Sprint 3 (Week 5-6): "Make It Payable"
> Goal: Money flows through the system

- [ ] Build Stripe checkout for premium payments
- [ ] Build Stripe webhook handlers (payment success, subscription changes)
- [ ] Wire premium payments to community pool contributions
- [ ] Test Root Platform quote -> accept -> policy flow end-to-end
- [ ] Add premium amount display on policy page

### Sprint 4 (Week 7-8): "Make It Polished"
> Goal: Production-quality experience

- [ ] Add push notifications (trip complete, score update, payment due)
- [ ] Build service worker for offline/PWA support
- [ ] Wire up profile page to real data
- [ ] Implement trip route visualisation on map
- [ ] Phone usage detection for scoring
- [ ] Build achievements backend

### Sprint 5 (Week 9-10): "Make It Auditable"
> Goal: Ready for regulatory review and security audit

- [ ] Commission penetration test
- [ ] Commission code security audit
- [ ] Run load testing (simulate 1,000+ concurrent users)
- [ ] Document architecture and API endpoints
- [ ] Create incident response procedures
- [ ] Register with ICO
- [ ] Begin FCA regulatory discussions (or confirm Root Platform licence coverage)

---

## Key Metrics to Track

| Metric | Target | How |
|--------|--------|-----|
| App crash rate | < 0.1% | Sentry |
| API response time (p95) | < 500ms | Firebase monitoring |
| Trip recording accuracy | > 95% GPS fix rate | Custom analytics |
| Score calculation consistency | Deterministic (same input = same output) | Automated tests |
| User signup -> first trip | < 5 minutes | Firebase Analytics funnel |
| Monthly active users | Track growth | Firebase Analytics |
| AI insight generation time | < 10 seconds | Anthropic usage tracking (already built) |
| Cloud Functions cold start | < 3 seconds | Firebase monitoring |

---

## Technology Stack Summary

```
Frontend:        React 18 + TypeScript + Vite + Tailwind CSS
Animations:      Framer Motion
Routing:         Wouter (lightweight React router)
State:           React Context + TanStack Query
Maps:            Leaflet (OpenStreetMap)
Auth:            Firebase Authentication
Database:        Cloud Firestore (NoSQL, real-time)
Backend Logic:   Firebase Cloud Functions (Node.js 18)
AI Engine:       Anthropic Claude Sonnet 4
Insurance API:   Root Platform (scaffolded)
Payments:        Stripe (dependencies installed, not wired)
Analytics:       Firebase Analytics (not initialised)
Hosting:         Firebase Hosting (configured)
```

---

## Glossary

| Term | Meaning |
|------|---------|
| **Telematics** | Using phone sensors (GPS, accelerometer, gyroscope) to measure driving behaviour |
| **Driving Score** | A number from 0-100 reflecting how safely someone drives. Higher = safer. |
| **Community Pool** | A shared pot of premium money. Safe drivers get refunds from it at the end of each period. |
| **Cloud Functions** | Backend code that runs on Google's servers (no server to manage). Triggered by events like "new trip created". |
| **Firestore** | Google's NoSQL database. Stores all user data, trips, scores, policies. |
| **Root Platform** | Third-party insurance infrastructure. Handles the regulatory/underwriting side of issuing policies. |
| **Claude Sonnet 4** | Anthropic's AI model. Analyses each trip and provides personalised driving coaching. |
| **Feature Flag** | An on/off switch for a feature. Lets us enable/disable features without deploying new code. |
| **CI/CD** | Continuous Integration / Continuous Deployment. Automated process that tests and deploys code changes. |
| **PWA** | Progressive Web App. Makes the website behave like a native mobile app (installable, works offline). |
| **FCA** | Financial Conduct Authority. UK regulator for financial services including insurance. |
| **ICO** | Information Commissioner's Office. UK regulator for data protection. |
| **GDPR** | General Data Protection Regulation. UK/EU law governing how personal data is collected and used. |
| **Penetration Test** | A simulated cyber attack to find security vulnerabilities before real attackers do. |
| **Sentry** | Error monitoring tool. Captures crashes, errors, and performance issues in real time. |

---

*Last updated: 7 February 2026*
*Document owner: Engineering*
