import { useEffect, useRef, useState } from 'react'
import type { Canvas, Textbox } from 'fabric'

type DesignCanvasProps = {
  shirtColor: string
  text: string
  textColor: string
  position: { left: number; top: number; scaleX: number; scaleY: number }
  onPositionChange: (position: { left: number; top: number; scaleX: number; scaleY: number }) => void
}

const shirtPath = 'M135 65 L174 24 L210 24 L249 65 L304 84 L279 139 L249 119 L249 393 L135 393 L135 119 L105 139 L80 84 Z'

export function ShirtArtwork({ color }: { color: string }) {
  return (
    <svg className="shirt-art" viewBox="0 0 384 420" aria-label="T-shirt preview">
      <path d={shirtPath} fill={color} stroke="rgba(20,20,20,.14)" strokeWidth="2" />
      <path d="M174 25 Q192 75 210 25" fill="none" stroke="rgba(20,20,20,.16)" strokeWidth="2" />
      <path d="M135 120 L148 130 M249 120 L236 130" fill="none" stroke="rgba(20,20,20,.1)" strokeWidth="1.5" />
    </svg>
  )
}

export function DesignCanvas({ shirtColor, text, textColor, position, onPositionChange }: DesignCanvasProps) {
  const elementRef = useRef<HTMLCanvasElement>(null)
  const fabricRef = useRef<Canvas | null>(null)
  const textboxRef = useRef<Textbox | null>(null)
  const designRef = useRef({ text, textColor, position })
  const positionChangeRef = useRef(onPositionChange)
  const [canvasError, setCanvasError] = useState('')

  useEffect(() => {
    designRef.current = { text, textColor, position }
  }, [text, textColor, position])

  useEffect(() => {
    positionChangeRef.current = onPositionChange
  }, [onPositionChange])

  useEffect(() => {
    if (!elementRef.current) return
    let activeCanvas: Canvas | null = null
    let disposed = false
    void import('fabric').then(({ Canvas: FabricCanvas, Textbox: FabricTextbox }) => {
      if (disposed || !elementRef.current) return
      const canvas = new FabricCanvas(elementRef.current, { width: 384, height: 420, selection: false, preserveObjectStacking: true })
      const textbox = new FabricTextbox('', {
        left: designRef.current.position.left,
        top: designRef.current.position.top,
        width: 140,
        scaleX: designRef.current.position.scaleX,
        scaleY: designRef.current.position.scaleY,
        fontSize: 24,
        fontFamily: 'Arial',
        fontWeight: 'bold',
        fill: designRef.current.textColor,
        textAlign: 'center',
        editable: false,
        selectable: true,
        hasControls: true,
        lockScalingFlip: true,
      })
      const currentDesign = designRef.current
      textbox.set({
        text: currentDesign.text,
        fill: currentDesign.textColor,
        visible: Boolean(currentDesign.text.trim()),
        left: currentDesign.position.left,
        top: currentDesign.position.top,
        scaleX: currentDesign.position.scaleX,
        scaleY: currentDesign.position.scaleY,
      })
      activeCanvas = canvas
      fabricRef.current = canvas
      textboxRef.current = textbox
      canvas.add(textbox)
      canvas.on('object:moving', ({ target }) => {
        if (target !== textbox) return
        const width = textbox.getScaledWidth()
        const height = textbox.getScaledHeight()
        textbox.set({
          left: Math.max(0, Math.min(textbox.left ?? 0, canvas.getWidth() - width)),
          top: Math.max(0, Math.min(textbox.top ?? 0, canvas.getHeight() - height)),
        })
      })
      canvas.on('object:modified', ({ target }) => {
        if (target === textbox) {
          positionChangeRef.current({
            left: textbox.left ?? designRef.current.position.left,
            top: textbox.top ?? designRef.current.position.top,
            scaleX: textbox.scaleX ?? 1,
            scaleY: textbox.scaleY ?? 1,
          })
        }
      })
    }).catch((error: unknown) => {
      console.error('Could not load the T-shirt design canvas:', error)
      if (!disposed) setCanvasError('The design canvas could not be loaded. You can still add a plain tee or refresh to try again.')
    })
    return () => {
      disposed = true
      if (activeCanvas) void activeCanvas.dispose()
      fabricRef.current = null
      textboxRef.current = null
    }
  }, [])

  useEffect(() => {
    const canvas = fabricRef.current
    const textbox = textboxRef.current
    if (!canvas || !textbox) return
    textbox.set({
      text,
      fill: textColor,
      visible: Boolean(text.trim()),
      left: position.left,
      top: position.top,
      scaleX: position.scaleX,
      scaleY: position.scaleY,
    })
    canvas.requestRenderAll()
  }, [text, textColor, position, shirtColor])

  return (
    <div className="shirt-stage" style={{ backgroundColor: '#f0efeb' }}>
      <ShirtArtwork color={shirtColor} />
      <canvas ref={elementRef} aria-label="Editable T-shirt design canvas" />
      {!text && <span className="canvas-hint">Your design goes here</span>}
      {canvasError && <span className="canvas-error" role="alert">{canvasError}</span>}
    </div>
  )
}
