/**
 * Extruded 3D Numberling from Scratch digit SVGs.
 * Always face-front (counters the figure orbit) — no idle sway.
 */

import {
  Box3,
  ExtrudeGeometry,
  Group,
  Mesh,
  MeshPhysicalMaterial,
  Vector3,
  type Object3D,
  type Scene,
} from "three"
import { SVGLoader } from "three/addons/loaders/SVGLoader.js"
import type { NumberlingAsset } from "./numberling"

export type NumberlingAttachment = {
  /** Root of the extruded glyph(s); parented under the shape group. */
  root: Group
  dispose: () => void
  setVisible: (visible: boolean) => void
  /** Reparent onto the shared shape group (position follows the figure). */
  attachTo: (parent: Object3D | Scene) => void
  /**
   * Place above a region whose COM is `anchor` (grid units), while the
   * shape group is centred on `figureCom` (also grid units). Depth uses
   * `anchor.z` so the glyph sits on that region’s vertical axis.
   */
  placeAboveAnchor: (
    anchor: { x: number; y: number; z: number },
    topY: number,
    figureCom: { x: number; y: number; z: number },
    unit: number,
  ) => void
  /** Place on the whole figure’s COM axis (shape origin), just above `topY`. */
  placeAbove: (topY: number, comY: number, unit: number) => void
  /**
   * Keep the glyph face-front.
   * `cancelParentYaw` counters the figure’s orbit (`-root.rotation.y`).
   */
  tickFacing: (cancelParentYaw: number) => void
}

/** @deprecated Use {@link NumberlingAttachment}. */
export type NumberlingBillboard = NumberlingAttachment

/** World-space height of the Numberling (cube edge ≈ 1). */
const NUMBERLING_HEIGHT = 0.95
/** Extrusion depth as a fraction of glyph height (kept shallow; bevel stays). */
const DEPTH_RATIO = 0.084
/** Soft bevel relative to glyph height. */
const BEVEL_RATIO = 0.05

const _box = new Box3()
const _size = new Vector3()
const _center = new Vector3()

/**
 * Parse the composed Numberling SVG and extrude every path into a solid mesh.
 * Returns a group centred at the origin, standing ~{@link NUMBERLING_HEIGHT} tall.
 */
export function buildExtrudedNumberling(asset: NumberlingAsset): {
  root: Group
  material: MeshPhysicalMaterial
  geometries: ExtrudeGeometry[]
  depth: number
} {
  const loader = new SVGLoader()
  const data = loader.parse(asset.svg)
  const glyph = new Group()
  const geometries: ExtrudeGeometry[] = []

  const extrudeDepth = Math.max(0.08, asset.height * DEPTH_RATIO)
  const bevel = Math.max(0.015, asset.height * BEVEL_RATIO)

  const material = new MeshPhysicalMaterial({
    color: 0x111111,
    roughness: 0.36,
    metalness: 0.05,
    clearcoat: 0.45,
    clearcoatRoughness: 0.35,
  })

  for (const path of data.paths) {
    const shapes = path.toShapes(true)
    for (const shape of shapes) {
      const geometry = new ExtrudeGeometry(shape, {
        depth: extrudeDepth,
        bevelEnabled: true,
        bevelThickness: bevel,
        bevelSize: bevel * 0.85,
        bevelOffset: 0,
        bevelSegments: 2,
        curveSegments: 12,
      })
      // Centre extrusion on Z so the glyph straddles the local XY plane.
      geometry.translate(0, 0, -extrudeDepth / 2)
      geometries.push(geometry)
      glyph.add(new Mesh(geometry, material))
    }
  }

  if (glyph.children.length === 0) {
    material.dispose()
    throw new Error(`Numberling ${asset.value} produced no extruded shapes`)
  }

  // SVG is Y-down; Three.js is Y-up. Scale to target world height.
  glyph.scale.set(1, -1, 1)
  glyph.updateMatrixWorld(true)
  _box.setFromObject(glyph)
  _box.getSize(_size)
  const s = NUMBERLING_HEIGHT / Math.max(_size.y, 1e-6)
  glyph.scale.set(s, -s, s)

  glyph.updateMatrixWorld(true)
  _box.setFromObject(glyph)
  _box.getCenter(_center)
  glyph.position.sub(_center)

  const root = new Group()
  root.add(glyph)

  root.updateMatrixWorld(true)
  _box.setFromObject(root)
  _box.getSize(_size)

  return { root, material, geometries, depth: _size.z }
}

/**
 * Create an extruded Numberling that rides above the cubes and always
 * faces the camera (front view only).
 */
export async function createNumberlingBillboard(
  asset: NumberlingAsset,
  parent: Object3D | Scene,
): Promise<NumberlingAttachment> {
  const { root, material, geometries } = buildExtrudedNumberling(asset)
  parent.add(root)

  return {
    root,
    setVisible(visible) {
      root.visible = visible
    },
    attachTo(next) {
      if (root.parent !== next) next.add(root)
    },
    placeAboveAnchor(anchor, topY, figureCom, unit) {
      const y = (topY - figureCom.y) * unit + NUMBERLING_HEIGHT * 0.65 + 0.35
      root.position.set(
        (anchor.x - figureCom.x) * unit,
        y,
        (anchor.z - figureCom.z) * unit,
      )
    },
    placeAbove(topY, comY, unit) {
      // Whole-figure helper: shape origin is already the cube COM.
      root.position.set(
        0,
        (topY - comY) * unit + NUMBERLING_HEIGHT * 0.65 + 0.35,
        0,
      )
    },
    tickFacing(cancelParentYaw) {
      root.rotation.set(0, cancelParentYaw, 0)
    },
    dispose() {
      root.removeFromParent()
      for (const geometry of geometries) geometry.dispose()
      material.dispose()
    },
  }
}
