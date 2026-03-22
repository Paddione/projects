import React, { useEffect, useRef, useMemo } from 'react'
import { useFrame, useThree, useLoader } from '@react-three/fiber'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { clone as skeletonClone } from 'three/addons/utils/SkeletonUtils.js'
import * as THREE from 'three'
import { createLobbyLighting } from 'shared-3d'
import type { Player } from '../../types'

interface LobbyRoomSceneProps {
  players: Player[]
  hostId: string
}

/** Radius of the semicircle players are arranged in. */
const SEMICIRCLE_RADIUS = 2.5

function getSemicirclePosition(index: number, total: number): [number, number, number] {
  const angle = Math.PI * (index / Math.max(total - 1, 1)) - Math.PI / 2
  const x = Math.cos(angle) * SEMICIRCLE_RADIUS
  const z = Math.sin(angle) * SEMICIRCLE_RADIUS * 0.5
  return [x, 0, z]
}

const SceneLighting: React.FC<{ hostPosition: [number, number, number] | null }> = ({
  hostPosition,
}) => {
  const { scene } = useThree()

  useEffect(() => {
    const rig = createLobbyLighting()
    rig.lights.forEach((light) => scene.add(light))

    // Extra spotlight on host
    let hostSpot: THREE.SpotLight | null = null
    if (hostPosition) {
      hostSpot = new THREE.SpotLight(0xffd700, 1.5)
      hostSpot.position.set(hostPosition[0], 4, hostPosition[2])
      hostSpot.target.position.set(...hostPosition)
      hostSpot.angle = Math.PI / 8
      hostSpot.penumbra = 0.4
      scene.add(hostSpot)
      scene.add(hostSpot.target)
    }

    return () => {
      rig.lights.forEach((light) => scene.remove(light))
      rig.dispose()
      if (hostSpot) {
        scene.remove(hostSpot)
        scene.remove(hostSpot.target)
      }
    }
  }, [scene, hostPosition])

  return null
}

interface PlayerCharacterProps {
  characterId: string
  position: [number, number, number]
  isHost: boolean
}

const PlayerCharacter: React.FC<PlayerCharacterProps> = ({ characterId, position, isHost }) => {
  const url = `/assets/3d/characters/${characterId}.glb`
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

    // Play idle animation
    const idleClip =
      gltf.animations.find((c: THREE.AnimationClip) =>
        ['Idle', 'idle', 'Stand'].includes(c.name)
      ) ?? gltf.animations[0]

    if (idleClip) {
      mixer.clipAction(idleClip).play()
    }

    return () => {
      mixer.stopAllAction()
      mixer.uncacheRoot(clonedScene)
    }
  }, [clonedScene, gltf])

  useFrame((_state, delta) => {
    mixerRef.current?.update(delta)
    // Gentle idle bob
    if (groupRef.current) {
      groupRef.current.position.y = Math.sin(Date.now() * 0.001 + position[0]) * 0.03
    }
  })

  if (!clonedScene) return null

  return (
    <group ref={groupRef} position={position}>
      <primitive object={clonedScene} scale={[1, 1, 1]} />
      {isHost && (
        // Crown marker above host
        <mesh position={[0, 2.2, 0]}>
          <octahedronGeometry args={[0.12]} />
          <meshStandardMaterial color="#ffd700" emissive="#ffaa00" emissiveIntensity={0.5} />
        </mesh>
      )}
    </group>
  )
}

/** Placeholder capsule when no GLB is available. */
const PlaceholderPlayer: React.FC<{
  position: [number, number, number]
  isHost: boolean
  color: string
}> = ({ position, isHost, color }) => {
  const groupRef = useRef<THREE.Group>(null)

  useFrame(() => {
    if (groupRef.current) {
      groupRef.current.position.y = Math.sin(Date.now() * 0.001 + position[0]) * 0.05
    }
  })

  return (
    <group ref={groupRef} position={position}>
      <mesh>
        <capsuleGeometry args={[0.25, 0.6, 4, 8]} />
        <meshStandardMaterial color={color} roughness={0.5} />
      </mesh>
      {isHost && (
        <mesh position={[0, 1.2, 0]}>
          <octahedronGeometry args={[0.1]} />
          <meshStandardMaterial color="#ffd700" emissive="#ffaa00" emissiveIntensity={0.5} />
        </mesh>
      )}
    </group>
  )
}

const PLAYER_COLORS = [
  '#4488ff', '#ff6644', '#44cc88', '#cc44ff',
  '#ffcc44', '#44ccff', '#ff4488', '#88ff44',
]

class CharacterErrorBoundary extends React.Component<
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

export const LobbyRoomScene: React.FC<LobbyRoomSceneProps> = ({ players, hostId }) => {
  const total = players.length

  // Find host index to position spotlight
  const hostIndex = players.findIndex((p) => p.id === hostId)
  const hostPosition: [number, number, number] | null =
    total > 0 ? getSemicirclePosition(hostIndex >= 0 ? hostIndex : 0, total) : null

  return (
    <>
      <SceneLighting hostPosition={hostPosition} />

      {/* Floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0] as const} position={[0, -0.01, 0]}>
        <planeGeometry args={[8, 5]} />
        <meshStandardMaterial color="#1a1a2e" roughness={0.8} />
      </mesh>

      {players.map((player, index) => {
        const position = getSemicirclePosition(index, total)
        const isHost = player.id === hostId
        const color = PLAYER_COLORS[index % PLAYER_COLORS.length]!
        const characterId = player.character || 'student'

        return (
          <React.Suspense
            key={player.id}
            fallback={<PlaceholderPlayer position={position as [number, number, number]} isHost={isHost} color={color} />}
          >
            <CharacterErrorBoundary
              fallback={
                <PlaceholderPlayer position={position as [number, number, number]} isHost={isHost} color={color} />
              }
            >
              <PlayerCharacter
                characterId={characterId}
                position={position}
                isHost={isHost}
              />
            </CharacterErrorBoundary>
          </React.Suspense>
        )
      })}
    </>
  )
}
