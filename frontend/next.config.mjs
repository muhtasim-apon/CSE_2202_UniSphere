/** @type {import('next').NextConfig} */
const nextConfig = {
  // @react-three/fiber v8's WebGL context setup isn't safe under React 18
  // Strict Mode's double effect-invocation in dev — it causes "WebGL context
  // could not be created" on the auth pages' 3D canvas. Disabling here.
  reactStrictMode: false,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'www.du.ac.bd',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'ssl.du.ac.bd',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'duap.du.ac.bd',
        port: '',
        pathname: '/**',
      },
    ],
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://127.0.0.1:8000/api/:path*',
      },
    ]
  },
}

export default nextConfig
