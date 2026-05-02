import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  outputFileTracingExcludes: {
    '*': ['./public/**'],
  },
  async rewrites() {
    return [
      { source: '/en/calculator', destination: '/en/calculadora' },
    ]
  },
}

export default nextConfig
