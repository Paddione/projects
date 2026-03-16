import React, { Suspense, useEffect, useState } from 'react'
import { Canvas } from '@react-three/fiber'

interface CharacterCanvasProps {
  children: React.ReactNode
  width?: number | string
  height?: number | string
  fallback?: React.ReactNode
}

const MOBILE_BREAKPOINT = 480

export const CharacterCanvas: React.FC<CharacterCanvasProps> = ({
  children,
  width = 300,
  height = 300,
  fallback = null,
}) => {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < MOBILE_BREAKPOINT)

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  if (isMobile && fallback) {
    return <>{fallback}</>
  }

  const canvasWidth = isMobile ? Math.min(typeof width === 'number' ? width : 300, 200) : width
  const canvasHeight = isMobile ? Math.min(typeof height === 'number' ? height : 300, 200) : height

  return (
    <div
      style={{
        width: typeof canvasWidth === 'number' ? `${canvasWidth}px` : canvasWidth,
        height: typeof canvasHeight === 'number' ? `${canvasHeight}px` : canvasHeight,
        display: 'inline-block',
      }}
    >
      <Canvas
        frameloop="always"
        shadows={!isMobile}
        gl={{ alpha: true, antialias: true }}
        style={{ width: '100%', height: '100%' }}
      >
        <Suspense fallback={null}>{children}</Suspense>
      </Canvas>
    </div>
  )
}
