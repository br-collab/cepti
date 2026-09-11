import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  turbopack: {
    root: process.cwd(),
  },
  outputFileTracingExcludes: {
    '*': ['./public/**'],
  },
  async rewrites() {
    return [
      { source: '/en/calculator', destination: '/en/calculadora' },
      { source: '/en/analyzer', destination: '/en/analizador' },
      { source: '/en/privacy', destination: '/en/privacidad' },
    ]
  },
  async redirects() {
    return [
      { source: '/es/analyzer', destination: '/es/analizador', permanent: true },
    ]
  },
}

export default nextConfig
