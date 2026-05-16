import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  outputFileTracingExcludes: {
    '*': ['./public/**'],
  },
  async rewrites() {
    return [
      { source: '/en/calculator', destination: '/en/calculadora' },
      { source: '/en/analyzer', destination: '/en/analizador' },
    ]
  },
  async redirects() {
    return [
      { source: '/es/analyzer', destination: '/es/analizador', permanent: true },
    ]
  },
}

export default nextConfig
