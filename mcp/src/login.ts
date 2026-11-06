import { loginCloud } from './cloud'
import { readConfig, writeCloudToken } from './config'

function option(name: string): string | undefined {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : undefined
}

const config = readConfig()
const serverURL = option('--server') ?? config.cloudURL
const imported = option('--token')
if (imported) {
  await writeCloudToken(config.tokenFile, {
    serverURL,
    accessToken: imported,
    savedAt: new Date().toISOString()
  })
  console.log(`Saved the Cloud token to ${config.tokenFile}`)
} else {
  const token = await loginCloud(serverURL)
  await writeCloudToken(config.tokenFile, token)
  console.log(`Saved the Cloud token to ${config.tokenFile}`)
}
