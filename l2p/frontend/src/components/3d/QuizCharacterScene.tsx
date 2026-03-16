import React, { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useLoader } from '@react-three/fiber'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import * as THREE from 'three'
import { createQuizLighting } from 'shared-3d'

export type QuizAnimation = 'idle' | 'thinking' | 'victory' | 'hit_react' | 'celebrate'

interface QuizCharacterSceneProps {
  characterId: string
  animation: QuizAnimation
  characterColor?: number | string
}

/** Maps character IDs to GLB asset paths. Update when models are available. */
function getCharacterUrl(characterId: string): string {
  return `/assets/characters/3d/${characterId}.glb`
}

/** Maps animation names to GLB clip names (adjust to match actual rig). */
const ANIMATION_CLIP_MAP: Record<QuizAnimation, string[]> = {
  idle: ['Idle', 'idle', 'Stand'],
  thinking: ['Thinking', 'thinking', 'Idle'],
  victory: ['Victory', 'victory', 'Celebrate'],
  hit_react: ['HitReact', 'hit_react', 'Damage', 'Hit'],
  celebrate: ['Celebrate', 'celebrate', 'Dance', 'Victory'],
}

function findClip(
  clips: THREE.AnimationClip[],
  candidates: string[]
): THREE.AnimationClip | null {
  for (const name of candidates) {
    const clip = clips.find(
      (c) => c.name.toLowerCase() === name.toLowerCase()
    )
    if (clip) return clip
  }
  return clips[0] ?? null
}

interface CharacterModelProps {
  url: string
  animation: QuizAnimation
}

const CharacterModel: React.FC<CharacterModelProps> = ({ url, animation }) => {
  const gltf = useLoader(GLTFLoader as any, url)
  const mixerRef = useRef<THREE.AnimationMixer | null>(null)
  const actionRef = useRef<THREE.AnimationAction | null>(null)

  useEffect(() => {
    if (!gltf || !gltf.scene) return

    const mixer = new THREE.AnimationMixer(gltf.scene)
    mixerRef.current = mixer

    return () => {
      mixer.stopAllAction()
      mixer.uncacheRoot(gltf.scene)
    }
  }, [gltf])

  useEffect(() => {
    if (!mixerRef.current || !gltf?.animations) return

    const candidates = ANIMATION_CLIP_MAP[animation] ?? ['Idle']
    const clip = findClip(gltf.animations, candidates)
    if (!clip) return

    // Fade out old action
    if (actionRef.current) {
      actionRef.current.fadeOut(0.3)
    }

    const action = mixerRef.current.clipAction(clip)
    action.reset().fadeIn(0.3).play()
    actionRef.current = action
  }, [animation, gltf])

  useFrame((_state, delta) => {
    mixerRef.current?.update(delta)
  })

  if (!gltf?.scene) return null

  return <primitive object={gltf.scene} scale={[1, 1, 1]} position={[0, -1, 0]} />
}

/** Placeholder mesh shown when no GLB is available. */
const PlaceholderCharacter: React.FC<{ animation: QuizAnimation }> = ({ animation }) => {
  const meshRef = useRef<THREE.Mesh>(null)

  useFrame((state) => {
    if (!meshRef.current) return
    // Animate based on state
    if (animation === 'victory' || animation === 'celebrate') {
      meshRef.current.rotation.y = state.clock.elapsedTime * 2
      meshRef.current.position.y = Math.sin(state.clock.elapsedTime * 4) * 0.15
    } else if (animation === 'thinking') {
      meshRef.current.rotation.z = Math.sin(state.clock.elapsedTime) * 0.1
    } else if (animation === 'hit_react') {
      meshRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 8) * 0.05
    } else {
      // Idle: gentle bob
      meshRef.current.position.y = Math.sin(state.clock.elapsedTime) * 0.05
    }
  })

  const color =
    animation === 'victory' || animation === 'celebrate'
      ? '#ffd700'
      : animation === 'hit_react'
        ? '#ff4444'
        : animation === 'thinking'
          ? '#44aaff'
          : '#88cc88'

  return (
    <mesh ref={meshRef} position={[0, 0, 0]}>
      <capsuleGeometry args={[0.4, 0.8, 4, 8]} />
      <meshStandardMaterial color={color} roughness={0.4} metalness={0.1} />
    </mesh>
  )
}

const SceneLighting: React.FC<{ rimColor: number | string }> = ({ rimColor }) => {
  const { scene } = useThree()

  useEffect(() => {
    const rig = createQuizLighting(rimColor)
    rig.lights.forEach((light) => scene.add(light))
    return () => {
      rig.lights.forEach((light) => scene.remove(light))
      rig.dispose()
    }
  }, [scene, rimColor])

  return null
}

export const QuizCharacterScene: React.FC<QuizCharacterSceneProps> = ({
  characterId,
  animation,
  characterColor = 0x4466ff,
}) => {
  const url = getCharacterUrl(characterId)

  return (
    <>
      <SceneLighting rimColor={characterColor} />
      <React.Suspense fallback={<PlaceholderCharacter animation={animation} />}>
        <ModelWithFallback url={url} animation={animation} />
      </React.Suspense>
    </>
  )
}

/** Tries to load the GLB; falls back to placeholder on error. */
const ModelWithFallback: React.FC<CharacterModelProps> = ({ url, animation }) => {
  // useLoader throws a promise (Suspense) or an error.
  // We wrap in an error boundary via a simple try approach using ErrorBoundary pattern.
  return (
    <ErrorBoundaryFallback fallback={<PlaceholderCharacter animation={animation} />}>
      <CharacterModel url={url} animation={animation} />
    </ErrorBoundaryFallback>
  )
}

interface ErrorBoundaryFallbackProps {
  children: React.ReactNode
  fallback: React.ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
}

class ErrorBoundaryFallback extends React.Component<
  ErrorBoundaryFallbackProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryFallbackProps) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true }
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback
    }
    return this.props.children
  }
}
