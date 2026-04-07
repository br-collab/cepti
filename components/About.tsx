const values = [
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    title: "Quality First",
    description: "We never cut corners. Every deliverable meets our high standard of excellence.",
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
    title: "Client Partnership",
    description: "We work alongside you as a true partner, not just a vendor.",
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
      </svg>
    ),
    title: "Results Driven",
    description: "Our success is measured by your outcomes, not just project completion.",
  },
];

export default function About() {
  return (
    <section id="about" className="py-24 bg-white overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          {/* Left column */}
          <div>
            <span className="inline-block px-4 py-1.5 mb-4 text-sm font-medium bg-indigo-100 text-indigo-700 rounded-full">
              About Cepti
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-6 leading-tight">
              We Help Businesses Thrive in the Digital World
            </h2>
            <p className="text-gray-500 text-lg leading-relaxed mb-6">
              Founded in 2014, Cepti has grown from a small consultancy into a
              full-service digital agency trusted by hundreds of companies worldwide.
              We combine deep industry knowledge with technical expertise to deliver
              solutions that make a real difference.
            </p>
            <p className="text-gray-500 leading-relaxed mb-10">
              Our diverse team of designers, engineers, strategists, and business
              analysts work together to ensure every project not only meets but
              exceeds expectations.
            </p>

            <div className="space-y-5">
              {values.map((v) => (
                <div key={v.title} className="flex gap-4">
                  <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                    {v.icon}
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900">{v.title}</h4>
                    <p className="text-gray-500 text-sm mt-0.5">{v.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right column */}
          <div className="relative">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-4">
                <div className="rounded-2xl bg-indigo-600 p-8 text-white">
                  <div className="text-4xl font-bold mb-1">10+</div>
                  <div className="text-indigo-200 text-sm">Years in Business</div>
                </div>
                <div className="rounded-2xl bg-gray-50 p-8">
                  <div className="text-4xl font-bold text-gray-900 mb-1">150+</div>
                  <div className="text-gray-500 text-sm">Team Members</div>
                </div>
              </div>
              <div className="space-y-4 mt-8">
                <div className="rounded-2xl bg-gray-50 p-8">
                  <div className="text-4xl font-bold text-gray-900 mb-1">500+</div>
                  <div className="text-gray-500 text-sm">Projects Delivered</div>
                </div>
                <div className="rounded-2xl bg-blue-600 p-8 text-white">
                  <div className="text-4xl font-bold mb-1">30+</div>
                  <div className="text-blue-200 text-sm">Countries Served</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
