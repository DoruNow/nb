import { createRequire } from "node:module"
import { pathToFileURL } from "node:url"
import { register } from "node:module"

// Load the TS source via vite-node-less: copy the functions by importing compiled? Use jszip directly.
import JSZip from "jszip"
import { readFile } from "node:fs/promises"

const sb3 = await readFile(
  new URL("../public/assets/Numberblocks Generator.sb3", import.meta.url),
)
const zip = await JSZip.loadAsync(sb3)
const project = JSON.parse(await zip.file("project.json").async("string"))

function costume(targetName, costumeName) {
  const target = project.targets.find((t) => t.name === targetName)
  if (!target) throw new Error("no target " + targetName)
  const c = target.costumes.find((x) => x.name === costumeName)
  if (!c) throw new Error("no costume " + costumeName + " on " + targetName)
  return c
}

async function svg(targetName, costumeName) {
  const c = costume(targetName, costumeName)
  return zip.file(c.md5ext).async("string")
}

function pathSummary(svgText, label) {
  const vb = svgText.match(/viewBox="([^"]+)"/)?.[1]
  const paths = [...svgText.matchAll(/<path\b([^>]*)>/gi)]
  console.log("\n==", label, "paths", paths.length, "viewBox", vb)
  for (const m of paths) {
    const fill = m[1].match(/fill="([^"]+)"/)?.[1]
    const d = m[1].match(/d="([^"]+)"/)?.[1] ?? ""
    console.log(" fill=", fill, " d0=", d.slice(0, 90), " len=", d.length)
  }
}

const one = await svg("assets//Official Numberblocks 0-100", "One")
pathSummary(one, "Official One raw")
console.log("\nOfficial One length", one.length)

const n1 = await svg("NBs//Ten + One", "n1")
pathSummary(n1, "generated n1")

const h1 = await svg("NBs//Hundreds", "n1")
pathSummary(h1, "hundreds n1")

const official = project.targets.find((t) => t.name === "assets//Official Numberblocks 0-100")
console.log(
  "\nOfficial costumes",
  official.costumes.map((c) => c.name).join(", "),
)
