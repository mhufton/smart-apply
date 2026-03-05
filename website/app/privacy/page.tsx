import Link from "next/link"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Privacy Policy — Smart Apply",
}

export default function Privacy() {
  const updated = "5 March 2026"

  return (
    <div className="min-h-screen bg-[#0f1117] text-slate-200">
      <nav className="border-b border-white/5 bg-[#16181f]/80 backdrop-blur sticky top-0 z-50">
        <div className="max-w-3xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="text-sm font-semibold text-indigo-400 tracking-wide">Smart Apply</Link>
          <Link href="/" className="text-xs text-slate-500 hover:text-slate-300 transition-colors">← Back</Link>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-6 py-16">
        <h1 className="text-2xl font-bold text-white mb-2">Privacy Policy</h1>
        <p className="text-xs text-slate-500 mb-10">Last updated: {updated}</p>

        <div className="space-y-8 text-sm text-slate-400 leading-relaxed">

          <section>
            <h2 className="text-base font-semibold text-white mb-2">The short version</h2>
            <p>Smart Apply stores everything locally on your device. We collect nothing. We operate no servers. We have no access to your data.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white mb-2">What data Smart Apply stores</h2>
            <p>Smart Apply stores the following data locally in your browser using IndexedDB (via Dexie.js) and <code className="text-indigo-400 text-xs">chrome.storage.local</code>:</p>
            <ul className="list-disc list-inside mt-3 space-y-1.5">
              <li>Your profile — name, email, phone, location, work history, skills, projects, and context notes</li>
              <li>Your Anthropic API key</li>
              <li>Scraped job postings and fit analysis results</li>
              <li>Generated CVs and cover letters (document history)</li>
            </ul>
            <p className="mt-3">This data never leaves your browser except as described below.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white mb-2">Third-party services</h2>
            <p>Smart Apply makes direct API calls to <strong className="text-slate-300">Anthropic</strong> (<a href="https://www.anthropic.com/privacy" target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:text-indigo-300">privacy policy</a>) from your browser. This means:</p>
            <ul className="list-disc list-inside mt-3 space-y-1.5">
              <li>Your profile data and job descriptions are sent to Anthropic to generate CVs, cover letters, and fit analyses</li>
              <li>Your API key is sent directly to Anthropic&apos;s API as an authentication header</li>
              <li>Anthropic&apos;s privacy policy governs how they handle that data</li>
            </ul>
            <p className="mt-3">No other third-party services are contacted. There is no analytics, no crash reporting, and no telemetry of any kind.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white mb-2">What we do not collect</h2>
            <ul className="list-disc list-inside space-y-1.5">
              <li>We do not collect any personal data</li>
              <li>We do not use cookies</li>
              <li>We do not track usage</li>
              <li>We operate no servers that receive your data</li>
              <li>We have no user accounts</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white mb-2">Data deletion</h2>
            <p>All data can be deleted at any time by uninstalling the extension or clearing the extension&apos;s storage via Chrome&apos;s developer tools. There is nothing to delete on our end because we hold nothing.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white mb-2">Changes to this policy</h2>
            <p>If we make material changes, we will update the date at the top of this page and note the change in the extension&apos;s release notes.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white mb-2">Contact</h2>
            <p>Questions? Open an issue on <a href="https://github.com/mhufton/smart-apply" target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:text-indigo-300">GitHub</a>.</p>
          </section>

        </div>
      </main>
    </div>
  )
}
