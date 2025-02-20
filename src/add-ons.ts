import { readFile } from 'node:fs/promises'
import { existsSync, readdirSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export type AddOn = {
  id: string
  type: 'add-on' | 'example'
  name: string
  description: string
  link: string
  main?: Array<{
    imports: Array<string>
    initialize: Array<string>
    providers: Array<{
      open: string
      close: string
    }>
  }>
  layout?: {
    imports: Array<string>
    jsx: string
  }
  routes: Array<{
    url: string
    name: string
  }>
  userUi?: {
    import: string
    jsx: string
  }
  directory: string
  packageAdditions: {
    dependencies?: Record<string, string>
    devDependencies?: Record<string, string>
    scripts?: Record<string, string>
  }
  command?: {
    command: string
    args?: Array<string>
  }
  readme?: string
  phase: 'setup' | 'add-on'
  shadcnComponents?: Array<string>
  warning?: string
  dependsOn?: Array<string>
}

function isDirectory(path: string): boolean {
  return statSync(path).isDirectory()
}

export async function getAllAddOns(): Promise<Array<AddOn>> {
  const addOns: Array<AddOn> = []

  for (const type of ['add-on', 'example']) {
    const addOnsBase = fileURLToPath(
      new URL(`../templates/${type}`, import.meta.url),
    )

    for (const dir of await readdirSync(addOnsBase).filter((file) =>
      isDirectory(resolve(addOnsBase, file)),
    )) {
      const filePath = resolve(addOnsBase, dir, 'info.json')
      const fileContent = await readFile(filePath, 'utf-8')

      let packageAdditions: Record<string, string> = {}
      if (existsSync(resolve(addOnsBase, dir, 'package.json'))) {
        packageAdditions = JSON.parse(
          await readFile(resolve(addOnsBase, dir, 'package.json'), 'utf-8'),
        )
      }

      let readme: string | undefined
      if (existsSync(resolve(addOnsBase, dir, 'README.md'))) {
        readme = await readFile(resolve(addOnsBase, dir, 'README.md'), 'utf-8')
      }

      addOns.push({
        id: dir,
        type,
        ...JSON.parse(fileContent),
        directory: resolve(addOnsBase, dir),
        packageAdditions,
        readme,
      })
    }
  }

  return addOns
}

// Turn the list of chosen add-on IDs into a final list of add-ons by resolving dependencies
export async function finalizeAddOns(
  chosenAddOnIDs: Array<string>,
): Promise<Array<AddOn>> {
  const finalAddOnIDs = new Set(chosenAddOnIDs)

  const addOns = await getAllAddOns()

  for (const addOnID of finalAddOnIDs) {
    const addOn = addOns.find((a) => a.id === addOnID)
    if (!addOn) {
      throw new Error(`Add-on ${addOnID} not found`)
    }

    for (const dependsOn of addOn.dependsOn || []) {
      const dep = addOns.find((a) => a.id === dependsOn)
      if (!dep) {
        throw new Error(`Dependency ${dependsOn} not found`)
      }
      finalAddOnIDs.add(dep.id)
    }
  }

  return [...finalAddOnIDs].map((id) => addOns.find((a) => a.id === id)!)
}
