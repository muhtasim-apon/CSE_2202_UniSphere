'use client'

import { useState } from 'react'
import type { MouseEvent } from 'react'

type RippleSpot = { x: number; y: number; size: number; id: number }

/**
 * Hook that returns ripple spots + a pointerdown handler to spread over
 * any element with the `ripple-container` class.
 */
export function useRipple() {
  const [ripples, setRipples] = useState<RippleSpot[]>([])

  function onPointerDown(event: MouseEvent<HTMLElement>) {
    const target = event.currentTarget
    const rect = target.getBoundingClientRect()
    const size = Math.max(rect.width, rect.height)
    const spot: RippleSpot = {
      x: event.clientX - rect.left - size / 2,
      y: event.clientY - rect.top - size / 2,
      size,
      id: Date.now(),
    }
    setRipples((current) => [...current, spot])
    window.setTimeout(() => {
      setRipples((current) => current.filter((r) => r.id !== spot.id))
    }, 550)
  }

  const rippleElements = ripples.map((r) => (
    <span
      key={r.id}
      className="ripple"
      style={{ left: r.x, top: r.y, width: r.size, height: r.size }}
      aria-hidden="true"
    />
  ))

  return { onPointerDown, rippleElements }
}
