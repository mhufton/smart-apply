"use client"

export default function ApplyForm() {
  return (
    <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>

      <div>
        <label htmlFor="full_name" className="block text-xs font-medium text-slate-700 mb-1">Full name <span className="text-red-400">*</span></label>
        <input
          id="full_name"
          name="full_name"
          type="text"
          required
          placeholder="Jane Smith"
          className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400"
        />
      </div>

      <div>
        <label htmlFor="email" className="block text-xs font-medium text-slate-700 mb-1">Email <span className="text-red-400">*</span></label>
        <input
          id="email"
          name="email"
          type="email"
          required
          placeholder="jane@example.com"
          className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400"
        />
      </div>

      <div>
        <label htmlFor="phone" className="block text-xs font-medium text-slate-700 mb-1">Phone</label>
        <input
          id="phone"
          name="phone"
          type="tel"
          placeholder="+44 7700 000000"
          className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400"
        />
      </div>

      <div>
        <label htmlFor="linkedin_url" className="block text-xs font-medium text-slate-700 mb-1">LinkedIn URL</label>
        <input
          id="linkedin_url"
          name="linkedin_url"
          type="url"
          placeholder="https://linkedin.com/in/yourname"
          className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400"
        />
      </div>

      <div>
        <label htmlFor="cover_letter" className="block text-xs font-medium text-slate-700 mb-1">Cover letter <span className="text-red-400">*</span></label>
        <textarea
          id="cover_letter"
          name="cover_letter"
          required
          rows={6}
          placeholder="Tell us why you're a great fit for this role..."
          className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400 resize-none"
        />
      </div>

      <div>
        <label htmlFor="right_to_work" className="block text-xs font-medium text-slate-700 mb-1">Right to work in the UK? <span className="text-red-400">*</span></label>
        <select
          id="right_to_work"
          name="right_to_work"
          required
          className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400"
        >
          <option value="">Select...</option>
          <option value="yes">Yes, I have the right to work</option>
          <option value="sponsorship">I require sponsorship</option>
        </select>
      </div>

      <div>
        <label htmlFor="notice_period" className="block text-xs font-medium text-slate-700 mb-1">Notice period</label>
        <input
          id="notice_period"
          name="notice_period"
          type="text"
          placeholder="e.g. 1 month"
          className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400"
        />
      </div>

      <button
        type="submit"
        className="w-full bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium py-2.5 rounded-lg transition-colors"
      >
        Submit application
      </button>

      <p className="text-[10px] text-slate-400 text-center leading-relaxed">
        This is a demo page for Smart Apply. No data is submitted anywhere.
      </p>
    </form>
  )
}
