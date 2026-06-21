'use client'

import { useState, useCallback } from 'react'
import Cropper from 'react-easy-crop'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Check, ZoomIn, ZoomOut } from 'lucide-react'

type CropArea = { x: number; y: number; width: number; height: number }

type Props = {
  src: string
  onDone: (file: File) => void
  onClose: () => void
}

async function getCroppedBlob(src: string, crop: CropArea): Promise<Blob> {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
  const canvas = document.createElement('canvas')
  const size = Math.min(crop.width, crop.height, 512) // cap at 512×512
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(image, crop.x, crop.y, crop.width, crop.height, 0, 0, size, size)
  return new Promise((resolve, reject) =>
    canvas.toBlob(b => b ? resolve(b) : reject(new Error('Canvas empty')), 'image/jpeg', 0.9)
  )
}

export default function ImageCropModal({ src, onDone, onClose }: Props) {
  const [crop, setCrop]   = useState({ x: 0, y: 0 })
  const [zoom, setZoom]   = useState(1)
  const [croppedArea, setCroppedArea] = useState<CropArea | null>(null)
  const [saving, setSaving] = useState(false)

  const onCropComplete = useCallback((_: unknown, croppedAreaPixels: CropArea) => {
    setCroppedArea(croppedAreaPixels)
  }, [])

  async function handleSave() {
    if (!croppedArea) return
    setSaving(true)
    try {
      const blob = await getCroppedBlob(src, croppedArea)
      const file = new File([blob], `avatar-${Date.now()}.jpg`, { type: 'image/jpeg' })
      onDone(file)
    } catch (e) { console.error(e) }
    finally { setSaving(false) }
  }

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center z-[60]"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      >
        <div className="w-full max-w-sm flex flex-col gap-4 px-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <span className="text-white text-sm font-medium">Crop avatar</span>
            <button onClick={onClose} className="text-white/60 hover:text-white transition-colors">
              <X size={18} />
            </button>
          </div>

          {/* Crop area */}
          <div className="relative w-full rounded-2xl overflow-hidden bg-black" style={{ height: 320 }}>
            <Cropper
              image={src}
              crop={crop}
              zoom={zoom}
              aspect={1}
              cropShape="round"
              showGrid={false}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
              style={{
                containerStyle: { borderRadius: '1rem' },
                cropAreaStyle: { border: '2px solid #fff', color: 'rgba(0,0,0,0.5)' },
              }}
            />
          </div>

          {/* Zoom slider */}
          <div className="flex items-center gap-3">
            <ZoomOut size={15} className="text-white/60 flex-shrink-0" />
            <input
              type="range"
              min={1} max={3} step={0.05}
              value={zoom}
              onChange={e => setZoom(Number(e.target.value))}
              className="flex-1 accent-white"
            />
            <ZoomIn size={15} className="text-white/60 flex-shrink-0" />
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-white/20 text-white text-sm hover:bg-white/10 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 py-2.5 rounded-xl bg-white text-black text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center justify-center gap-2"
            >
              {saving ? 'Saving…' : <><Check size={15} /> Use photo</>}
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
