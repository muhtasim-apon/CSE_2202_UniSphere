'use client'

import dynamic from 'next/dynamic'
import type { ReactNode } from 'react'

const VolumetricBeamsFullScreen = dynamic(
  () => import('@/components/ui/volumetric-beams'),
  { ssr: false }
)

type AuthShellProps = {
  children: ReactNode
}

export default function AuthShell({ children }: AuthShellProps) {
  return (
    <main className="relative min-h-screen overflow-hidden bg-black font-sans">
      <VolumetricBeamsFullScreen
        className="fixed inset-0 bg-black"
        dpr={[1, 1.75]}
        title=""
        subtitle=""
        speed={2.95}
        autoRotateSpeed={0.035}
        mouseInfluence={0.35}
        pointerSmoothing={0.28}
        cameraRadius={4.8}
        fov={1.25}
        beamCount={5}
        beamHalfAngle={0.065}
        beamEdgeSoft={0.045}
        beamRotation={0.7}
        twistDepth={0.95}
        density={0.95}
        falloff={0.15}
        anisotropy={0.86}
        lightIntensity={1.4}
        lightColor={[0.54, 0.74, 1.0]}
        tint={[0.55, 0.38, 0.95]}
        stripeFreq={800.0}
        stripeAmp={0.07}
        stripeSharp={0.08}
        stripeSpeed={0.102}
        stripeJitter={0.91}
        volSteps={190}
        stepMin={0.05}
        stepMax={0.1}
        maxDist={3.0}
        bgColor={[0.04, 0.035, 0.06]}
        grainAmount={0.005}
        vignette={0.95}
        exposure={0.5}
        gamma={2.0}
      />

      <div className="pointer-events-none relative z-10 flex min-h-screen flex-col items-center justify-center px-4 py-10">
        <div className="pointer-events-auto mb-6 flex items-center gap-2.5">
          <img
            src="https://mftrlabicbiixlgprdbi.supabase.co/storage/v1/object/public/logos/logo_dark.png"
            alt=""
            aria-hidden="true"
            className="h-10 w-10 rounded-lg object-cover"
          />
          <span className="font-display text-2xl font-semibold tracking-tight text-white">
            UniSphere
          </span>
        </div>

        <div className="pointer-events-auto w-full max-w-md rounded-card border border-white/10 bg-card/95 p-8 shadow-2xl backdrop-blur-xl">
          {children}
        </div>
      </div>
    </main>
  )
}
