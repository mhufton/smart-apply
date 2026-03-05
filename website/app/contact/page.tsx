import Link from "next/link"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Contact — Smart Apply",
}

export default function Contact() {
  return (
    <div className="min-h-screen bg-[#0f1117] text-slate-200">
      <nav className="border-b border-white/5 bg-[#16181f]/80 backdrop-blur sticky top-0 z-50">
        <div className="max-w-3xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="text-sm font-semibold text-indigo-400 tracking-wide">Smart Apply</Link>
          <Link href="/" className="text-xs text-slate-500 hover:text-slate-300 transition-colors">← Back</Link>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-6 py-16">
        <h1 className="text-2xl font-bold text-white mb-2">Contact</h1>
        <p className="text-xs text-slate-500 mb-10">Nerd Labs Ltd</p>

        <div className="space-y-8 text-sm text-slate-400 leading-relaxed">

          <section>
            <h2 className="text-base font-semibold text-white mb-2">Get in touch</h2>
            <p>
              For general enquiries, feedback, or press:{" "}
              <a
                href="mailto:contact@nerdlabsltd.com"
                className="text-indigo-400 hover:text-indigo-300 transition-colors"
              >
                contact@nerdlabsltd.com
              </a>
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white mb-2">Bug reports &amp; feature requests</h2>
            <p>
              Smart Apply is open source. The best place to report bugs or suggest features is{" "}
              <a
                href="https://github.com/mhufton/smart-apply/issues"
                target="_blank"
                rel="noopener noreferrer"
                className="text-indigo-400 hover:text-indigo-300 transition-colors"
              >
                GitHub Issues
              </a>
              {" "}— it keeps everything visible and trackable.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white mb-2">Privacy &amp; legal</h2>
            <p>
              For privacy or data-related queries, see the{" "}
              <Link href="/privacy" className="text-indigo-400 hover:text-indigo-300 transition-colors">
                Privacy Policy
              </Link>
              {" "}or email{" "}
              <a
                href="mailto:contact@nerdlabsltd.com"
                className="text-indigo-400 hover:text-indigo-300 transition-colors"
              >
                contact@nerdlabsltd.com
              </a>.
            </p>
          </section>

        </div>
      </main>
    </div>
  )
}
