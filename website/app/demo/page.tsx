import type { Metadata } from "next"
import Link from "next/link"
import ApplyForm from "./ApplyForm"

export const metadata: Metadata = {
  title: "Senior Full Stack Engineer — Meridian · Smart Apply Demo",
  robots: { index: false, follow: false },
}

export default function DemoPage() {
  return (
    <div className="min-h-screen bg-white text-slate-800">

      {/* Portal nav */}
      <nav className="border-b border-slate-200 bg-white">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded bg-violet-600 flex items-center justify-center">
              <span className="text-white text-xs font-bold">M</span>
            </div>
            <span className="text-sm font-semibold text-slate-800">Meridian</span>
            <span className="text-slate-300 text-sm">|</span>
            <span className="text-xs text-slate-400">Careers</span>
          </div>
          <div className="text-xs text-slate-400 bg-amber-50 border border-amber-200 text-amber-700 px-3 py-1 rounded-full">
            Smart Apply demo page — not a real job
          </div>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-6 py-10 grid lg:grid-cols-[1fr_340px] gap-10">

        {/* Main content */}
        <main>
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center gap-2 text-xs text-slate-400 mb-3">
              <Link href="/demo" className="hover:text-slate-600">Jobs</Link>
              <span>/</span>
              <span>Engineering</span>
            </div>
            <h1 className="text-2xl font-bold text-slate-900 mb-2">Senior Full Stack Engineer</h1>
            <div className="flex flex-wrap items-center gap-4 text-sm text-slate-500">
              <span>Meridian</span>
              <span>·</span>
              <span>London, UK (Hybrid)</span>
              <span>·</span>
              <span>Full-time</span>
              <span>·</span>
              <span className="text-emerald-600 font-medium">£70,000 – £90,000</span>
            </div>
          </div>

          {/* Description */}
          <div className="prose prose-sm prose-slate max-w-none space-y-6 text-slate-600 leading-relaxed">

            <section>
              <h2 className="text-base font-semibold text-slate-900 mb-2">About Meridian</h2>
              <p>
                Meridian builds infrastructure tooling for climate-tech companies — helping them track, report, and reduce their carbon footprint across complex supply chains. We&apos;re a Series B company of 60 people, backed by leading European climate investors, and growing fast.
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-slate-900 mb-2">The role</h2>
              <p>
                We&apos;re looking for a Senior Full Stack Engineer to join our core product team. You&apos;ll own features end-to-end — from designing data models to shipping polished UI — and have a real say in how we build. This is a hands-on, high-autonomy role with a clear path to Staff Engineer.
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-slate-900 mb-2">What you&apos;ll do</h2>
              <ul className="list-disc list-inside space-y-1.5">
                <li>Design and build product features across the full stack (TypeScript, React, Node.js, PostgreSQL)</li>
                <li>Own the technical design and delivery of medium-to-large features with minimal oversight</li>
                <li>Work closely with product and design to shape requirements before a line of code is written</li>
                <li>Improve engineering standards — code review, testing, observability, deployment pipelines</li>
                <li>Mentor junior and mid-level engineers through pairing and structured feedback</li>
                <li>Contribute to architecture decisions as the product scales to enterprise customers</li>
              </ul>
            </section>

            <section>
              <h2 className="text-base font-semibold text-slate-900 mb-2">What we&apos;re looking for</h2>
              <ul className="list-disc list-inside space-y-1.5">
                <li>5+ years of professional software engineering experience</li>
                <li>Strong TypeScript/JavaScript skills, both frontend (React) and backend (Node.js)</li>
                <li>Experience with relational databases — query optimisation, migrations, data modelling</li>
                <li>A track record of shipping user-facing features in a fast-moving product team</li>
                <li>Comfort with ambiguity — you can take a fuzzy problem and break it into deliverable work</li>
                <li>Experience with cloud infrastructure (AWS or GCP) is a plus</li>
                <li>Familiarity with data pipelines or ESG reporting is interesting but not required</li>
              </ul>
            </section>

            <section>
              <h2 className="text-base font-semibold text-slate-900 mb-2">The stack</h2>
              <div className="flex flex-wrap gap-2">
                {["TypeScript","React","Node.js","PostgreSQL","Prisma","AWS","Docker","GitHub Actions","Datadog"].map(t => (
                  <span key={t} className="text-xs bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full">{t}</span>
                ))}
              </div>
            </section>

            <section>
              <h2 className="text-base font-semibold text-slate-900 mb-2">Benefits</h2>
              <ul className="list-disc list-inside space-y-1.5">
                <li>£70,000 – £90,000 base salary depending on experience</li>
                <li>Meaningful equity in a high-growth climate-tech company</li>
                <li>25 days holiday + bank holidays</li>
                <li>Hybrid working — 2 days/week in our London Bridge office</li>
                <li>£1,500/year learning budget</li>
                <li>Private health insurance (Bupa)</li>
                <li>Enhanced parental leave (26 weeks fully paid)</li>
              </ul>
            </section>

          </div>
        </main>

        {/* Apply sidebar */}
        <aside>
          <div className="sticky top-6 bg-slate-50 border border-slate-200 rounded-xl p-6">
            <h2 className="text-sm font-semibold text-slate-900 mb-5">Apply for this role</h2>
            <ApplyForm />
          </div>
        </aside>

      </div>
    </div>
  )
}
