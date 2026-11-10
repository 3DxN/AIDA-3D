const RETRYABLE = new Set(['ERR_MODULE_NOT_FOUND', 'ERR_UNSUPPORTED_DIR_IMPORT'])

// The app's TypeScript is ESM; say so instead of letting Node re-parse each file after a CommonJS attempt
const asModule = (resolved) =>
	resolved.url.endsWith('.ts') && !resolved.url.includes('/node_modules/')
		? { ...resolved, format: 'module-typescript' }
		: resolved

export async function resolve(specifier, context, nextResolve) {
	try {
		return asModule(await nextResolve(specifier, context))
	} catch (error) {
		if (!RETRYABLE.has(error?.code)) throw error
		for (const extension of ['.ts', '.js']) {
			try {
				return asModule(await nextResolve(specifier + extension, context))
			} catch {
				// try the next extension
			}
		}
		throw error
	}
}
