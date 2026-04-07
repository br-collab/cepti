const testimonials = [
  {
    quote:
      "Cepti transformed our outdated platform into a modern, high-performing system. Revenue increased by 40% within six months of launch.",
    author: "Sarah Mitchell",
    role: "CEO, NovaTech Solutions",
    initials: "SM",
    color: "bg-indigo-600",
  },
  {
    quote:
      "The team delivered exactly what we needed — on time, on budget, and with exceptional quality. They've become an indispensable partner for us.",
    author: "James Okafor",
    role: "CTO, Bridgepoint Financial",
    initials: "JO",
    color: "bg-blue-600",
  },
  {
    quote:
      "Working with Cepti felt like having an in-house team. Their communication, expertise, and dedication to our success made all the difference.",
    author: "Priya Nair",
    role: "VP of Product, Luminary Health",
    initials: "PN",
    color: "bg-violet-600",
  },
  {
    quote:
      "Their digital strategy completely reshaped how we approach our customers. Organic traffic tripled and our conversion rates hit an all-time high.",
    author: "Carlos Rivera",
    role: "Marketing Director, Verde Retail",
    initials: "CR",
    color: "bg-teal-600",
  },
];

function StarRating() {
  return (
    <div className="flex gap-1 mb-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <svg key={i} className="w-5 h-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  );
}

export default function Testimonials() {
  return (
    <section id="testimonials" className="py-24 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <span className="inline-block px-4 py-1.5 mb-4 text-sm font-medium bg-indigo-100 text-indigo-700 rounded-full">
            Client Stories
          </span>
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
            Trusted by Industry Leaders
          </h2>
          <p className="text-lg text-gray-500 max-w-xl mx-auto">
            Don&apos;t just take our word for it — hear from the businesses we&apos;ve helped succeed.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {testimonials.map((t) => (
            <div
              key={t.author}
              className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100"
            >
              <StarRating />
              <p className="text-gray-700 leading-relaxed mb-6 text-[15px]">
                &ldquo;{t.quote}&rdquo;
              </p>
              <div className="flex items-center gap-4">
                <div
                  className={`w-11 h-11 rounded-full ${t.color} flex items-center justify-center text-white font-semibold text-sm flex-shrink-0`}
                >
                  {t.initials}
                </div>
                <div>
                  <div className="font-semibold text-gray-900 text-sm">{t.author}</div>
                  <div className="text-gray-500 text-xs mt-0.5">{t.role}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
