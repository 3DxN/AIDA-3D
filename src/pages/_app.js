import 'tailwindcss/tailwind.css'
import './styles/common.css'
import './overview.css'
import Head from 'next/head'

import { ZarrStoreProvider } from '../lib/contexts/ZarrStoreContext'
import { Viewer2DDataProvider } from '../lib/contexts/Viewer2DDataContext'
import { NucleusSelectionProvider } from '../lib/contexts/NucleusSelectionContext'
import { NucleusColorProvider } from '../lib/contexts/NucleusColorContext'


function MyApp({ Component, pageProps }) {
	return (
		<>
			<Head>
				<link rel="icon" href="/favicon/favicon.ico" />
			</Head>
			<ZarrStoreProvider>
				<Viewer2DDataProvider>
					<NucleusSelectionProvider>
						<NucleusColorProvider>
							<Component {...pageProps} />
						</NucleusColorProvider>
					</NucleusSelectionProvider>
				</Viewer2DDataProvider>
			</ZarrStoreProvider>
		</>
	)
}

export default MyApp