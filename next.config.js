// Openlayers is not compatible with NodeJS and therefore throws an error on
// import because we're trying to use ES Modules in a NodeJS environment.
// This is the fix.
// See: https://github.com/openlayers/openlayers/issues/10470
const withTranspile = require('next-transpile-modules')(['ol'])

module.exports = withTranspile({
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
})
