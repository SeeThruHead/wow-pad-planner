const domainFile = /^domains\/([^/]+)\/([^/.]+)\.ts$/

const extraServices = new Set(["identity/Passwords", "identity/Secrets", "notifications/WebPush"])

const isServiceName = (domain: string, name: string): boolean => {
  if (name.endsWith("Repo")) return true
  if (name === "migrations") return true
  if (name.toLowerCase() === domain) return true

  return extraServices.has(`${domain}/${name}`)
}

export const isServerOnlyDomainFile = (path: string): boolean => {
  const match = domainFile.exec(path)
  if (match === null) return false

  return isServiceName(match[1] ?? "", match[2] ?? "")
}

export const isPureDomainModule = (path: string): boolean => domainFile.test(path) && !isServerOnlyDomainFile(path)

const sharedDomains = new Set(["catalogue", "tracking", "dashboards"])

export const isSharedService = (path: string): boolean => {
  const match = domainFile.exec(path)
  if (match === null) return false
  if (!sharedDomains.has(match[1] ?? "")) return false

  return match[2] !== "migrations"
}
