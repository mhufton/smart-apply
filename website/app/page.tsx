import Link from "next/link"

const FEATURES = [
  {
    icon: "⚡",
    title: "Scrape any job posting",
    body: "One click captures the role title, company, description, and salary from any job site — LinkedIn, Greenhouse, Lever, Workday, Amazon, and more.",
  },
  {
    icon: "🎯",
    title: "Fit analysis",
    body: "Get an honest 0–100 fit score with green flags, gaps, and suggested angles to lean into before you write a single word.",
  },
  {
    icon: "📄",
    title: "Tailored CV + cover letter",
    body: "Claude Sonnet writes a targeted CV and cover letter in seconds, grouped by company, respecting your progression, and keeping it to two pages.",
  },
  {
    icon: "💬",
    title: "Refine in chat",
    body: "Not happy with a section? Chat with Claude to rewrite bullets, adjust tone, or remove anything — changes flow back into your documents live.",
  },
  {
    icon: "📋",
    title: "Fill application forms",
    body: "Detected form fields are mapped from your profile — name, email, LinkedIn, cover letter — injected directly into the page.",
  },
  {
    icon: "🔒",
    title: "100% private",
    body: "Your profile, documents, and API key live in IndexedDB on your machine. Nothing touches our servers. Nothing is synced anywhere.",
  },
]

const STEPS = [
  { n: "1", title: "Add your Anthropic key", body: "Paste your key in Settings. That's the only setup required." },
  { n: "2", title: "Scrape the job", body: "Open any job listing and click Scrape — Smart Apply reads the page for you." },
  { n: "3", title: "Generate documents", body: "Review your fit score, then generate a tailored CV, cover letter, or both." },
  { n: "4", title: "Apply", body: "Export to PDF, copy to clipboard, or let Smart Apply fill the form fields directly." },
]

export default function Home() {
  return (
    <div className="min-h-screen bg-[#0f1117] text-slate-200">

      {/* WIP banner */}
      <div className="bg-amber-500/10 border-b border-amber-500/20 text-amber-400 text-xs text-center py-2 px-4">
        Smart Apply is a work in progress — expect rough edges. Feedback welcome on{" "}
        <a href="https://github.com/mhufton/smart-apply/issues" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-amber-300">GitHub</a>.
      </div>

      {/* Nav */}
      <nav className="border-b border-white/5 bg-[#16181f]/80 backdrop-blur sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <span className="text-sm font-semibold text-indigo-400 tracking-wide">Smart Apply</span>
          <div className="flex items-center gap-6 text-xs text-slate-400">
            <Link href="/privacy" className="hover:text-slate-200 transition-colors">Privacy</Link>
            <Link href="/terms" className="hover:text-slate-200 transition-colors">Terms</Link>
            <Link href="/contact" className="hover:text-slate-200 transition-colors">Contact</Link>
            <a href="https://github.com/mhufton/smart-apply" target="_blank" rel="noopener noreferrer" className="hover:text-slate-200 transition-colors">GitHub</a>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-5xl mx-auto px-6 pt-24 pb-20 text-center">
        <div className="inline-flex items-center gap-2 text-xs text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 rounded-full px-3 py-1 mb-8">
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
          Bring your own API key — ~5 cents per application, no subscription
        </div>
        <h1 className="text-4xl sm:text-5xl font-bold text-white tracking-tight leading-tight mb-5">
          Job applications that<br />
          <span className="text-indigo-400">actually fit the role</span>
        </h1>
        <p className="text-slate-400 text-lg max-w-xl mx-auto mb-10 leading-relaxed">
          Smart Apply is a Chrome extension that does the research and drafting for you — then keeps you in the loop before anything goes out. Not a bot. Not a blank page. Something better.
        </p>
        <div className="flex items-center justify-center gap-4 flex-wrap">
          <a
            href="#"
            className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors"
          >
            Add to Chrome — it&apos;s free
          </a>
          <a
            href="https://github.com/mhufton/smart-apply"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-slate-400 hover:text-slate-200 text-sm border border-white/10 hover:border-white/20 px-5 py-2.5 rounded-lg transition-colors"
          >
            View source
          </a>
        </div>
      </section>

      {/* Philosophy */}
      <section className="max-w-5xl mx-auto px-6 pb-20">
        <div className="grid sm:grid-cols-3 gap-px bg-white/5 rounded-2xl overflow-hidden border border-white/5">
          <div className="bg-[#0f1117] p-6">
            <p className="text-xs font-semibold text-red-400 uppercase tracking-widest mb-3">The spray-and-pray approach</p>
            <p className="text-xs text-slate-500 leading-relaxed">AI blasts out hundreds of generic applications in your name. Recruiters spot it instantly. Your reputation takes the hit.</p>
          </div>
          <div className="bg-indigo-500/5 p-6 border-x border-white/5">
            <p className="text-xs font-semibold text-indigo-400 uppercase tracking-widest mb-3">The Smart Apply approach</p>
            <p className="text-xs text-slate-300 leading-relaxed">AI does the research and drafting. You review, refine, and decide what goes out. Every application is deliberate and genuinely tailored.</p>
          </div>
          <div className="bg-[#0f1117] p-6">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">The fully manual approach</p>
            <p className="text-xs text-slate-500 leading-relaxed">Hours rewriting the same CV for each role. Inconsistent quality, hard to maintain, and exhausting at scale.</p>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-5xl mx-auto px-6 pb-24">
        <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-widest text-center mb-10">Everything you need to apply smarter</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map(f => (
            <div key={f.title} className="bg-[#16181f] border border-white/5 rounded-xl p-5">
              <div className="text-2xl mb-3">{f.icon}</div>
              <h3 className="text-sm font-semibold text-white mb-1.5">{f.title}</h3>
              <p className="text-xs text-slate-400 leading-relaxed">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="border-t border-white/5 bg-[#16181f]">
        <div className="max-w-5xl mx-auto px-6 py-24">
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-widest text-center mb-12">How it works</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {STEPS.map(s => (
              <div key={s.n} className="flex flex-col gap-3">
                <span className="w-8 h-8 rounded-full bg-indigo-500/15 border border-indigo-500/25 text-indigo-400 text-sm font-bold flex items-center justify-center">
                  {s.n}
                </span>
                <h3 className="text-sm font-semibold text-white">{s.title}</h3>
                <p className="text-xs text-slate-400 leading-relaxed">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* BYOK callout */}
      <section className="max-w-5xl mx-auto px-6 py-24">
        <div className="bg-indigo-500/5 border border-indigo-500/15 rounded-2xl p-8 sm:p-12 text-center">
          <h2 className="text-2xl font-bold text-white mb-3">Your key, your data, your control</h2>
          <p className="text-slate-400 text-sm max-w-lg mx-auto leading-relaxed mb-6">
            Smart Apply never sees your data. Your Anthropic API key, your profile, your documents — everything is stored locally in your browser. The only external calls go directly from your machine to Anthropic&apos;s API.
          </p>
          <div className="flex items-center justify-center gap-8 text-xs text-slate-500 flex-wrap">
            <span>✓ No account required</span>
            <span>✓ No server</span>
            <span>✓ No tracking</span>
            <span>✓ Open source</span>
            <span>✓ ~5 cents per application</span>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 bg-[#16181f]">
        <div className="max-w-5xl mx-auto px-6 py-8 flex items-center justify-between gap-4 flex-wrap">
          <span className="text-xs text-slate-500">© {new Date().getFullYear()} Nerd Labs Ltd. Smart Apply.</span>
          <div className="flex items-center gap-6 text-xs text-slate-500">
            <Link href="/privacy" className="hover:text-slate-300 transition-colors">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-slate-300 transition-colors">Terms of Service</Link>
            <Link href="/contact" className="hover:text-slate-300 transition-colors">Contact</Link>
            <a href="https://github.com/mhufton/smart-apply" target="_blank" rel="noopener noreferrer" className="hover:text-slate-300 transition-colors">GitHub</a>
          </div>
        </div>
      </footer>

    </div>
  )
}
