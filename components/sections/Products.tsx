const productKeys = ['pinturas', 'ladriflex', 'papelex', 'granito', 'arena', 'primer'] as const

const productIcons: Record<string, string> = {
  pinturas: '🎨',
  ladriflex: '🧱',
  papelex: '📄',
  granito: '🪨',
  arena: '🏖️',
  primer: '🪣',
}

type ProductsDict = {
  title: string
  sub: string
  items: Record<string, { name: string; desc: string }>
}

export default function Products({ dict }: { dict: ProductsDict }) {
  return (
    <section id="productos" className="py-20 sm:py-28 bg-stone-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-14">
          <h2 className="text-3xl sm:text-4xl font-bold text-stone-900 mb-3">{dict.title}</h2>
          <p className="text-stone-500 text-lg">{dict.sub}</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {productKeys.map((key) => {
            const product = dict.items[key]
            return (
              <div
                key={key}
                className="bg-white rounded-2xl p-6 shadow-sm border border-stone-100 hover:shadow-md hover:border-cepti-red/20 transition-all group"
              >
                <div className="text-3xl mb-4">{productIcons[key]}</div>
                <h3 className="text-lg font-semibold text-stone-900 mb-2 group-hover:text-cepti-red transition-colors">
                  {product.name}
                </h3>
                <p className="text-stone-500 text-sm leading-relaxed">{product.desc}</p>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
