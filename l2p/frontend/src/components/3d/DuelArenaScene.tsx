import React, { useEffect, useRef, useMemo } from 'react'
import { useFrame, useThree, useLoader } from '@react-three/fiber'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { clone as skeletonClone } from 'three/addons/utils/SkeletonUtils.js'
import * as THREE from 'three'
import { createQuizLighting } from 'shared-3d'

interface DuelPlayer {
  id: string
  username: string
  character: string
}

interface DuelArenaSceneProps {
  player1: DuelPlayer
  player2: DuelPlayer
  winner: string | null
}

const PLAYER1_POS: [number, number, number] = [-1.5, 0, 0]
const PLAYER2_POS: [number, number, number] = [1.5, 0, 0]

function findIdleClip(clips: THREE.AnimationClip[]): THREE.AnimationClip | null {
  const candidates = ['Idle', 'idle', 'Stand', 'stand']
  for (const name of candidates) {
    const clip = clips.find((c) => c.name.toLowerCase() === name.toLowerCase())
    if (clip) return clip
  }
  return clips[0] ?? null
}

function findVictoryClip(clips: THREE.AnimationClip[]): THREE.AnimationClip | null {
  const candidates = ['Victory', 'victory', 'Celebrate', 'celebrate', 'Dance']
  for (const name of candidates) {
    const clip = clips.find((c) => c.name.toLowerCase() === name.toLowerCase())
    if (clip) return clip
  }
  return findIdleClip(clips)
}

function findDefeatClip(clips: THREE.AnimationClip[]): THREE.AnimationClip | null {
  const candidates = ['Defeat', 'defeat', 'Death', 'HitReact', 'hit_react', 'Damage']
  for (const name of candidates) {
    const clip = clips.find((c) => c.name.toLowerCase() === name.toLowerCase())
    if (clip) return clip
  }
  return findIdleClip(clips)
}

const SceneLighting: React.FC<{ winner: string | null; player1Id: string; player2Id: string }> = ({
  winner,
  player1Id,
  player2Id,
}) => {
  const { scene } = useThree()

  useEffect(() => {
    const rig = createQuizLighting(0x220033)
    rig.lights.forEach((l) => scene.add(l))

    // Spotlight on player 1
    const spot1 = new THREE.SpotLight(0x4488ff, winner === player2Id ? 0.4 : winner === player1Id ? 2.0 : 1.2)
    spot1.position.set(PLAYER1_POS[0], 5, PLAYER1_POS[2] + 2)
    spot1.target.position.set(...PLAYER1_POS)
    spot1.angle = Math.PI / 8
    spot1.penumbra = 0.5
    scene.add(spot1)
    scene.add(spot1.target)

    // Spotlight on player 2
    const spot2 = new THREE.SpotLight(0xff4444, winner === player1Id ? 0.4 : winner === player2Id ? 2.0 : 1.2)
    spot2.position.set(PLAYER2_POS[0], 5, PLAYER2_POS[2] + 2)
    spot2.target.position.set(...PLAYER2_POS)
    spot2.angle = Math.PI / 8
    spot2.penumbra = 0.5
    scene.add(spot2)
    scene.add(spot2.target)

    // Center divider light
    const centerLight = new THREE.PointLight(0xffffff, 0.5, 4)
    centerLight.position.set(0, 2, 0)
    scene.add(centerLight)

    return () => {
      rig.lights.forEach((l) => scene.remove(l))
      rig.dispose()
      scene.remove(spot1)
      scene.remove(spot1.target)
      scene.remove(spot2)
      scene.remove(spot2.target)
      scene.remove(centerLight)
    }
  }, [scene, winner, player1Id, player2Id])

  return null
}

interface DuelCharacterProps {
  url: string
  position: [number, number, number]
  facingRight: boolean
  isWinner: boolean | null
}

const DuelCharacter: React.FC<DuelCharacterProps> = ({ url, position, facingRight, isWinner }) => {
  const gltf = useLoader(GLTFLoader as any, url)
  const groupRef = useRef<THREE.Group>(null)
  const mixerRef = useRef<THREE.AnimationMixer | null>(null)
  const actionRef = useRef<THREE.AnimationAction | null>(null)

  const clonedScene = useMemo(() => {
    if (!gltf?.scene) return null
    return skeletonClone(gltf.scene)
  }, [gltf])

  useEffect(() => {
    if (!clonedScene || !gltf?.animations?.length) return

    const mixer = new THREE.AnimationMixer(clonedScene)
    mixerRef.current = mixer

    let clip: THREE.AnimationClip | null
    if (isWinner === true) {
      clip = findVictoryClip(gltf.animations)
    } else if (isWinner === false) {
      clip = findDefeatClip(gltf.animations)
    } else {
      clip = findIdleClip(gltf.animations)
    }

    if (clip) {
      const action = mixer.clipAction(clip)
      action.play()
      actionRef.current = action
    }

    return () => {
      mixer.stopAllAction()
      mixer.uncacheRoot(clonedScene)
    }
  }, [clonedScene, gltf, isWinner])

  // Transition animation when winner is determined
  useEffect(() => {
    if (!mixerRef.current || !gltf?.animations?.length || isWinner === null) return

    let clip: THREE.AnimationClip | null
    if (isWinner === true) {
      clip = findVictoryClip(gltf.animations)
    } else {
      clip = findDefeatClip(gltf.animations)
    }
    if (!clip) return

    if (actionRef.current) {
      actionRef.current.fadeOut(0.3)
    }

    const newAction = mixerRef.current.clipAction(clip)
    newAction.reset().fadeIn(0.3).play()
    actionRef.current = newAction
  }, [isWinner, gltf])

  useFrame((_state, delta) => {
    mixerRef.current?.update(delta)
  })

  if (!clonedScene) return null

  return (
    <group
      ref={groupRef}
      position={position}
      rotation={[0, facingRight ? Math.PI / 2 : -Math.PI / 2, 0]}
    >
      <primitive object={clonedScene} scale={[1, 1, 1]} />
    </group>
  )
}

const PlaceholderDuelist: React.FC<{
  position: [number, number, number]
  color: string
  isWinner: boolean | null
}> = ({ position, color, isWinner }) => {
  const meshRef = useRef<THREE.Mesh>(null)

  useFrame((state) => {
    if (!meshRef.current) return
    if (isWinner === true) {
      meshRef.current.rotation.y = state.clock.elapsedTime * 2
      meshRef.current.position.y = Math.sin(state.clock.elapsedTime * 3) * 0.1
    } else if (isWinner === false) {
      meshRef.current.rotation.x = 0.5 // tilted back
    } else {
      // breathing idle
      const scale = 1 + Math.sin(state.clock.elapsedTime * 2) * 0.03
      meshRef.current.scale.set(scale, scale, scale)
    }
  })

  return (
    <mesh ref={meshRef} position={position}>
      <capsuleGeometry args={[0.3, 0.7, 4, 8]} />
      <meshStandardMaterial
        color={color}
        roughness={0.4}
        emissive={isWinner === true ? color : '#000000'}
        emissiveIntensity={isWinner === true ? 0.3 : 0}
      />
    </mesh>
  )
}

class DuelErrorBoundary extends React.Component<
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
  render() {
    return this.state.hasError ? this.props.fallback : this.props.children
  }
}

export const DuelArenaScene: React.FC<DuelArenaSceneProps> = ({ player1, player2, winner }) => {
  const p1IsWinner = winner === null ? null : winner === player1.id
  const p2IsWinner = winner === null ? null : winner === player2.id

  const url1 = `/assets/characters/3d/${player1.character || 'student'}.glb`
  const url2 = `/assets/characters/3d/${player2.character || 'student'}.glb`

  return (
    <>
      <SceneLighting winner={winner} player1Id={player1.id} player2Id={player2.id} />

      {/* Arena floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
        <planeGeometry args={[6, 4]} />
        <meshStandardMaterial color="#12001a" roughness={0.8} />
      </mesh>

      {/* Divider line */}
      <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.04, 3.8]} />
        <meshStandardMaterial color="#ff0055" emissive="#ff0055" emissiveIntensity={1} />
      </mesh>

      {/* Player 1 */}
      <React.Suspense
        fallback={<PlaceholderDuelist position={PLAYER1_POS} color="#4488ff" isWinner={p1IsWinner} />}
      >
        <DuelErrorBoundary
          fallback={<PlaceholderDuelist position={PLAYER1_POS} color="#4488ff" isWinner={p1IsWinner} />}
        >
          <DuelCharacter
            url={url1}
            position={PLAYER1_POS}
            facingRight={true}
            isWinner={p1IsWinner}
          />
        </DuelErrorBoundary>
      </React.Suspense>

      {/* Player 2 */}
      <React.Suspense
        fallback={<PlaceholderDuelist position={PLAYER2_POS} color="#ff4444" isWinner={p2IsWinner} />}
      >
        <DuelErrorBoundary
          fallback={<PlaceholderDuelist position={PLAYER2_POS} color="#ff4444" isWinner={p2IsWinner} />}
        >
          <DuelCharacter
            url={url2}
            position={PLAYER2_POS}
            facingRight={false}
            isWinner={p2IsWinner}
          />
        </DuelErrorBoundary>
      </React.Suspense>
    </>
  )
}
