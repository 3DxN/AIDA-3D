// Lets Node's test runner load the app's TypeScript modules directly (Node >= 22.18 / 23.6 strips types).
// The app imports without file extensions, as webpack allows; the hook retries with .ts and .js.
import { register } from 'node:module'

register('./resolveExtensions.mjs', import.meta.url)
