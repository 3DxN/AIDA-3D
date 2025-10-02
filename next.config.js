// Openlayers is not compatible with NodeJS and therefore throws an error on
// import because we're trying to use ES Modules in a NodeJS environment.
// In Next.js 15, use transpilePackages instead of next-transpile-modules
// See: https://github.com/openlayers/openlayers/issues/10470

module.exports = {
	// Use transpilePackages for Next.js 15 compatibility
	transpilePackages: ['ol'],
	typescript: {
		// !! WARN !!
		// Dangerously allow production builds to successfully complete even if
		// your project has type errors.
		// !! WARN !!
		ignoreBuildErrors: true,
	},
	eslint: {
		// Ignore ESLint errors during production builds
		ignoreDuringBuilds: true,
	},
}
