import { Component } from 'react';
import { AlertTriangle, ArrowLeft, Home, LogIn, RotateCcw } from 'lucide-react';

export default class AppErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error) {
    // Keep production output privacy-safe; detailed stack traces stay out of
    // the rendered UI and can be collected by an external logger later.
    if (import.meta.env.DEV) console.error('Attendance Register render error:', error);
  }

  reset = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <main className="flex min-h-screen items-center justify-center bg-paper px-5 py-10 text-ink">
        <section className="w-full max-w-lg rounded-[28px] border border-ink/10 bg-white p-7 text-center shadow-[0_20px_60px_rgba(22,43,73,0.1)] sm:p-10" role="alert">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-light/50 text-amber">
            <AlertTriangle size={26} aria-hidden="true" />
          </div>
          <p className="mt-6 text-xs font-bold uppercase tracking-[0.18em] text-amber">Error</p>
          <h1 className="mt-2 font-display text-3xl font-semibold tracking-[-0.03em]">Page could not be loaded.</h1>
          <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-slate">Try again or return to the dashboard.</p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <button type="button" onClick={this.reset} className="inline-flex items-center gap-2 rounded-xl bg-ink px-4 py-2.5 text-sm font-semibold text-paper transition hover:bg-ink-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber">
              <RotateCcw size={15} aria-hidden="true" /> Try again
            </button>
            <a href="/hod" className="inline-flex items-center gap-2 rounded-xl border border-ink/15 bg-white px-4 py-2.5 text-sm font-semibold text-ink transition hover:bg-paper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber">
              <Home size={15} aria-hidden="true" /> Dashboard
            </a>
            <a href="/login" className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate transition hover:bg-paper hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber">
              <LogIn size={15} aria-hidden="true" /> Sign in
            </a>
          </div>
          <a href="/" className="mt-6 inline-flex items-center gap-1 text-xs font-semibold text-slate hover:text-ink"><ArrowLeft size={13} aria-hidden="true" /> Return to start</a>
        </section>
      </main>
    );
  }
}
