import { rmSync } from "fs"
import { blue, green } from "./ansi.mjs"

console.warn(`${blue("●")} Removing node_modules...`)
rmSync("node_modules", { recursive: true, force: true })
console.warn(`${green("✔")} node_modules removed`)
