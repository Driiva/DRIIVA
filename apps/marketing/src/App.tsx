import { Route, Switch } from 'wouter';
import { Analytics } from '@vercel/analytics/react';
import { useLenis } from '@/hooks/useLenis';
import { useRouteMeta } from '@/hooks/useRouteMeta';
import { Nav } from '@/sections/Nav';
import { Footer } from '@/sections/Footer';
import { StickyCta } from '@/components/StickyCta';
import { DriivaShaderBackground } from '@/components/DriivaShaderBackground';
import { Home } from '@/routes/Home';
import { Privacy } from '@/routes/Privacy';
import { Terms } from '@/routes/Terms';
import { Cookies } from '@/routes/Cookies';
import { Complaints } from '@/routes/Complaints';
import { Survey } from '@/routes/Survey';
import { LegalPage } from '@/routes/LegalPage';

function NotFound() {
  return (
    <LegalPage title="Not found">
      <p className="legal-lede">
        We could not find that page. The map is roughly: <strong>home</strong>,{' '}
        <strong>privacy</strong>, <strong>terms</strong>, <strong>cookies</strong>,{' '}
        <strong>complaints</strong>, <strong>uk-survey</strong>.
      </p>
    </LegalPage>
  );
}

export default function App() {
  useLenis();
  useRouteMeta();
  return (
    <>
      <DriivaShaderBackground />
      {/* First thing in the tab order. Without it a keyboard user crosses the
          fixed nav and, on the home route, five FAQ controls before reaching
          anything they came for. */}
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <Nav />
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/privacy" component={Privacy} />
        <Route path="/terms" component={Terms} />
        <Route path="/cookies" component={Cookies} />
        <Route path="/complaints" component={Complaints} />
        <Route path="/uk-survey" component={Survey} />
        <Route component={NotFound} />
      </Switch>
      <Footer />
      <StickyCta />
      <Analytics />
    </>
  );
}
