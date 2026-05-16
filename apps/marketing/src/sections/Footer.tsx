export function Footer() {
  return (
    <footer
      data-section="footer"
      className="relative mx-auto w-full max-w-6xl px-6 pb-16 pt-24"
    >
      <div className="flex flex-col gap-12 border-t border-hairline pt-12 md:flex-row md:items-start md:justify-between">
        <div className="flex flex-col gap-6">
          <img
            src="/brand/driiva-wordmark.png"
            alt="driiva"
            className="block h-auto w-[160px] select-none"
            draggable={false}
          />
          <p className="mono text-xs leading-relaxed text-text-3 max-w-md">
            Driiva Ltd is a UK company. Insurance products are pending FCA
            authorisation and are not yet available to consumers.
          </p>
        </div>

        <nav aria-label="Footer" className="flex flex-col gap-3 md:items-end">
          <a
            href="https://x.com/driivaco"
            className="mono text-xs uppercase tracking-widest text-text-3 transition-colors hover:text-text-1"
            rel="noopener noreferrer"
          >
            x
          </a>
          <a
            href="https://www.linkedin.com/company/driiva"
            className="mono text-xs uppercase tracking-widest text-text-3 transition-colors hover:text-text-1"
            rel="noopener noreferrer"
          >
            linkedin
          </a>
          <a
            href="mailto:hello@driiva.co.uk"
            className="mono text-xs uppercase tracking-widest text-text-3 transition-colors hover:text-text-1"
          >
            hello@driiva.co.uk
          </a>
        </nav>
      </div>

      <p className="mono mt-12 text-[0.6875rem] uppercase tracking-widest text-text-3">
        © driiva 2026, Built in London.
      </p>
    </footer>
  );
}
