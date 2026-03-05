import Link from "next/link"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Terms of Service — Smart Apply",
}

export default function Terms() {
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
        <h1 className="text-2xl font-bold text-white mb-2">Terms of Service</h1>
        <p className="text-xs text-slate-500 mb-10">Last updated: {updated}</p>

        <div className="space-y-8 text-sm text-slate-400 leading-relaxed">

          <section>
            <h2 className="text-base font-semibold text-white mb-2">1. Acceptance</h2>
            <p>By installing or using Smart Apply, you agree to these terms. If you do not agree, do not use the extension.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white mb-2">2. What Smart Apply is</h2>
            <p>Smart Apply is a browser extension that assists you in preparing job application documents. It uses the Anthropic API (accessed with your own API key) to analyse job postings and generate tailored CVs and cover letters. It is a productivity tool — not a recruitment service, employment agency, or career advisor.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white mb-2">3. Your responsibilities</h2>
            <ul className="list-disc list-inside space-y-1.5">
              <li>You are responsible for providing accurate information in your profile</li>
              <li>You are responsible for reviewing all generated content before submitting it to any employer</li>
              <li>You must comply with Anthropic&apos;s <a href="https://www.anthropic.com/legal/consumer-terms" target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:text-indigo-300">usage policies</a> when using your API key</li>
              <li>You must not use Smart Apply to generate misleading, false, or fraudulent application materials</li>
              <li>You must comply with the terms of service of any job platform you scrape</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white mb-2">4. API costs</h2>
            <p>Smart Apply uses your Anthropic API key. Any costs incurred from API usage are your responsibility. We have no visibility into or control over your API usage or billing.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white mb-2">5. No warranties</h2>
            <p>Smart Apply is provided &quot;as is&quot; without warranty of any kind. We make no guarantees about the accuracy, quality, or suitability of generated content. Generated CVs and cover letters are a starting point — always review and edit before use.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white mb-2">6. Limitation of liability</h2>
            <p>To the maximum extent permitted by law, Nerd Labs Ltd shall not be liable for any direct, indirect, incidental, or consequential damages arising from your use of Smart Apply, including but not limited to rejected job applications, API costs, or data loss.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white mb-2">7. Open source</h2>
            <p>Smart Apply is open source software released under the MIT licence. The source code is available at <a href="https://github.com/mhufton/smart-apply" target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:text-indigo-300">github.com/mhufton/smart-apply</a>. You are free to fork, modify, and distribute it in accordance with the licence terms.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white mb-2">8. Changes</h2>
            <p>We may update these terms from time to time. Material changes will be noted in the extension&apos;s release notes. Continued use of Smart Apply after changes constitutes acceptance of the updated terms.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white mb-2">9. Contact</h2>
            <p>Questions or concerns? Open an issue on <a href="https://github.com/mhufton/smart-apply" target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:text-indigo-300">GitHub</a>.</p>
          </section>

        </div>
      </main>
    </div>
  )
}
