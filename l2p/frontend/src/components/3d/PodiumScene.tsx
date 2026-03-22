import React, { useEffect, useRef, useMemo } from 'react'
import { useFrame, useThree, useLoader } from '@react-three/fiber'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { clone as skeletonClone } from 'three/addons/utils/SkeletonUtils.js'
import * as THREE from 'three'
import { createQuizLighting } from 'shared-3d'
import type { GameResult } from '../../stores/gameStore'

interface PodiumSceneProps {
  winners: GameResult[]
}

/** Animation mapped to podium position. */
type PodiumAnimation = 'victory' | 'wave' | 'clap'

const PODIUM_CONFIGS: Array<{
  position: [number, number, number]
  height: number
  color: string
  animation: PodiumAnimation
  rank: number
}> = [
  { rank: 1, position: [0, 0, 0], height: 0.8, color: '#ffd700', animation: 'victory' },
  { rank: 2, position: [-2, 0, 0], height: 0.5, color: '#c0c0c0', animation: 'clap' },
  { rank: 3, position: [2, 0, 0], height: 0.3, color: '#cd7f32', animation: 'wave' },
]

/** Maps animation names to GLB clip name candidates. */
const ANIM_CLIPS: Record<PodiumAnimation, string[]> = {
  victory: ['Victory', 'victory', 'Celebrate', 'celebrate', 'Dance'],
  clap: ['Clapping', 'clap', 'Applause', 'Celebrate', 'Idle'],
  wave: ['Wave', 'wave', 'Waving', 'Idle'],
}

function findClip(
  clips: THREE.AnimationClip[],
  candidates: string[]
): THREE.AnimationClip | null {
  for (const name of candidates) {
    const clip = clips.find((c) => c.name.toLowerCase() === name.toLowerCase())
    if (clip) return clip
  }
  return clips[0] ?? null
}

const SceneLighting: React.FC = () => {
  const { scene } = useThree()

  useEffect(() => {
    const rig = createQuizLighting(0x8844ff)
    rig.lights.forEach((l) => scene.add(l))

    // Spotlights on each podium
    const spots = PODIUM_CONFIGS.map((cfg) => {
      const spot = new THREE.SpotLight(cfg.color === '#ffd700' ? '#fff8e0' : '#ffffff', 1.2)
      spot.position.set(cfg.position[0], 5, cfg.position[2] + 1)
      spot.target.position.set(...cfg.position)
      spot.angle = Math.PI / 10
      spot.penumbra = 0.5
      scene.add(spot)
      scene.add(spot.target)
      return spot
    })

    return () => {
      rig.lights.forEach((l) => scene.remove(l))
      rig.dispose()
      spots.forEach((s) => {
        scene.remove(s)
        scene.remove(s.target)
      })
    }
  }, [scene])

  return null
}

interface PodiumBlockProps {
  position: [number, number, number]
  height: number
  color: string
}

const PodiumBlock: React.FC<PodiumBlockProps> = ({ position, height, color }) => (
  <mesh position={[position[0], height / 2 - 0.01, position[2]]}>
    <boxGeometry args={[1.2, height, 1.2]} />
    <meshStandardMaterial color={color} roughness={0.3} metalness={0.4} />
  </mesh>
)

interface WinnerCharacterProps {
  url: string
  animation: PodiumAnimation
  position: [number, number, number]
  podiumHeight: number
}

const WinnerCharacter: React.FC<WinnerCharacterProps> = ({
  url,
  animation,
  position,
  podiumHeight,
}) => {
  const gltf = useLoader(GLTFLoader as any, url)
  const groupRef = useRef<THREE.Group>(null)
  const mixerRef = useRef<THREE.AnimationMixer | null>(null)

  const clonedScene = useMemo(() => {
    if (!gltf?.scene) return null
    return skeletonClone(gltf.scene)
  }, [gltf])

  useEffect(() => {
    if (!clonedScene || !gltf?.animations?.length) return

    const mixer = new THREE.AnimationMixer(clonedScene)
    mixerRef.current = mixer

    const candidates = ANIM_CLIPS[animation]
    const clip = findClip(gltf.animations, candidates)
    if (clip) mixer.clipAction(clip).play()

    return () => {
      mixer.stopAllAction()
      mixer.uncacheRoot(clonedScene)
    }
  }, [clonedScene, gltf, animation])

  useFrame((_state, delta) => {
    mixerRef.current?.update(delta)
  })

  if (!clonedScene) return null

  const standY = podiumHeight
  return (
    <group ref={groupRef} position={[position[0], standY, position[2]]}>
      <primitive object={clonedScene} scale={[1, 1, 1]} />
    </group>
  )
}

const PlaceholderWinner: React.FC<{
  position: [number, number, number]
  podiumHeight: number
  color: string
  animation: PodiumAnimation
}> = ({ position, podiumHeight, color, animation }) => {
  const meshRef = useRef<THREE.Mesh>(null)

  useFrame((state) => {
    if (!meshRef.current) return
    if (animation === 'victory') {
      meshRef.current.rotation.y = state.clock.elapsedTime * 2
      meshRef.current.position.y = podiumHeight + 0.4 + Math.sin(state.clock.elapsedTime * 4) * 0.1
    } else {
      meshRef.current.position.y = podiumHeight + 0.4 + Math.sin(state.clock.elapsedTime * 1.5 + position[0]) * 0.04
    }
  })

  return (
    <mesh ref={meshRef} position={[position[0], podiumHeight + 0.4, position[2]]}>
      <capsuleGeometry args={[0.25, 0.5, 4, 8]} />
      <meshStandardMaterial color={color} roughness={0.4} />
    </mesh>
  )
}

class WinnerErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode; fallback: React.ReactNode }) {
    super(props)
    this.state = { hasError: false }
  }
  static getDerivedStateFromError() {
    return { hasError: true }
  }
  override render() {
    return this.state.hasError ? this.props.fallback : this.props.children
  }
}

export const PodiumScene: React.FC<PodiumSceneProps> = ({ winners }) => {
  const topThree = winners.slice(0, 3)

  return (
    <>
      <SceneLighting />

      {/* Floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
        <planeGeometry args={[10, 6]} />
        <meshStandardMaterial color="#0f0f1a" roughness={0.9} />
      </mesh>

      {topThree.map((player, index) => {
        const cfg = PODIUM_CONFIGS[index]
        if (!cfg) return null

        const characterUrl = `/assets/3d/characters/${player.character || 'student'}.glb`

        return (
          <React.Fragment key={player.id}>
            <PodiumBlock
              position={cfg.position}
              height={cfg.height}
              color={cfg.color}
            />
            <React.Suspense
              fallback={
                <PlaceholderWinner
                  position={cfg.position}
                  podiumHeight={cfg.height}
                  color={cfg.color}
                  animation={cfg.animation}
                />
              }
            >
              <WinnerErrorBoundary
                fallback={
                  <PlaceholderWinner
                    position={cfg.position}
                    podiumHeight={cfg.height}
                    color={cfg.color}
                    animation={cfg.animation}
                  />
                }
              >
                <WinnerCharacter
                  url={characterUrl}
                  animation={cfg.animation}
                  position={cfg.position}
                  podiumHeight={cfg.height}
                />
              </WinnerErrorBoundary>
            </React.Suspense>
          </React.Fragment>
        )
      })}
    </>
  )
}
