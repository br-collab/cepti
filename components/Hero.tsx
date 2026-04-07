export default function Hero() {
  return (
    <section className="relative min-h-screen flex items-center bg-gradient-to-br from-indigo-950 via-indigo-900 to-blue-900 overflow-hidden">
      {/* Background decorative elements */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-blue-400/10 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-28 md:py-36">
        <div className="max-w-3xl">
          <span className="inline-block px-4 py-1.5 mb-6 text-sm font-medium bg-indigo-500/20 text-indigo-200 rounded-full border border-indigo-400/30">
            Digital Solutions for Modern Business
          </span>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold text-white leading-tight mb-6">
            Grow Your Business with{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-300 to-blue-300">
              Smarter Solutions
            </span>
          </h1>
          <p className="text-lg sm:text-xl text-indigo-100/80 mb-10 max-w-2xl leading-relaxed">
            Cepti helps businesses like yours achieve more with innovative digital
            strategies, cutting-edge technology, and a team that truly cares about
            your success.
          </p>
          <div className="flex flex-col sm:flex-row gap-4">
            <a
              href="#contact"
              className="inline-flex items-center justify-center px-8 py-4 bg-indigo-500 hover:bg-indigo-400 text-white font-semibold rounded-xl transition-colors shadow-lg shadow-indigo-900/50 text-base"
            >
              Start Your Journey
              <svg className="ml-2 w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </a>
            <a
              href="#services"
              className="inline-flex items-center justify-center px-8 py-4 bg-white/10 hover:bg-white/20 text-white font-semibold rounded-xl transition-colors border border-white/20 text-base"
            >
              Explore Services
            </a>
          </div>

          {/* Stats */}
          <div className="mt-16 grid grid-cols-3 gap-6 max-w-md">
            {[
              { value: "500+", label: "Clients Served" },
              { value: "98%", label: "Satisfaction Rate" },
              { value: "10+", label: "Years Experience" },
            ].map((stat) => (
              <div key={stat.label}>
                <div className="text-2xl sm:text-3xl font-bold text-white">{stat.value}</div>
                <div className="text-sm text-indigo-200/70 mt-0.5">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
