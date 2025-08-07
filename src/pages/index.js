import Head from 'next/head'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowRightIcon, ServerIcon, PlayIcon } from '@heroicons/react/solid'
import { ScaleIcon } from '@heroicons/react/outline'

export default function Home() {
	return (
		<div>
			<Head>
				<title>Annotate Image Data by Assignment - AIDA 3D</title>
			</Head>

			<header className="pt-8 overflow-hidden sm:pt-12 lg:relative lg:py-48">
				<div className="mx-auto max-w-md px-4 sm:max-w-3xl sm:px-6 lg:px-8 lg:max-w-7xl lg:grid lg:grid-cols-2 lg:gap-24">
					<div>
						<div className="mt-12">
							<div className="mt-6 sm:max-w-xl">
								<h1 className="text-4xl font-extrabold text-gray-900 tracking-tight sm:text-5xl">
									Explore 2D and 3D histology images with side-by-side
									interaction
								</h1>

								{/* Stats */}
								<div className="mt-6 text-gray-500 flex items-center">
									{/* License */}
									<ScaleIcon className="h-4 w-4 mr-2" aria-hidden="true" />
									MIT License
								</div>

								<p className="mt-6 text-xl text-gray-500">
									An{' '}
									<a
										href="https://github.com/alanaberdeen/AIDA-3D"
										className="hover:underline mx-1"
										target="_blank"
										rel="noreferrer"
									>
										open source
										<svg
											className="w-4 h-4 ml-1 mb-1 inline"
											viewBox="0 0 24 24"
										>
											<path
												fill="currentColor"
												d="M12,2A10,10 0 0,0 2,12C2,16.42 4.87,20.17 8.84,21.5C9.34,21.58 9.5,21.27 9.5,21C9.5,20.77 9.5,20.14 9.5,19.31C6.73,19.91 6.14,17.97 6.14,17.97C5.68,16.81 5.03,16.5 5.03,16.5C4.12,15.88 5.1,15.9 5.1,15.9C6.1,15.97 6.63,16.93 6.63,16.93C7.5,18.45 8.97,18 9.54,17.76C9.63,17.11 9.89,16.67 10.17,16.42C7.95,16.17 5.62,15.31 5.62,11.5C5.62,10.39 6,9.5 6.65,8.79C6.55,8.54 6.2,7.5 6.75,6.15C6.75,6.15 7.59,5.88 9.5,7.17C10.29,6.95 11.15,6.84 12,6.84C12.85,6.84 13.71,6.95 14.5,7.17C16.41,5.88 17.25,6.15 17.25,6.15C17.8,7.5 17.45,8.54 17.35,8.79C18,9.5 18.38,10.39 18.38,11.5C18.38,15.32 16.04,16.16 13.81,16.41C14.17,16.72 14.5,17.33 14.5,18.26C14.5,19.6 14.5,20.68 14.5,21C14.5,21.27 14.66,21.59 15.17,21.5C19.14,20.16 22,16.42 22,12A10,10 0 0,0 12,2Z"
											/>
										</svg>
									</a>{' '}
									web-based annotation tool built for exploring huge deep-zoom
									histology images alongside 3D segmentation.
								</p>
							</div>

							<div className="mt-4">
								<Link href="/demo" legacyBehavior>
									<a className="inline-flex items-center px-3 py-2 border border-transparent shadow-sm leading-4 font-medium rounded-md text-white bg-teal-600 hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500">
										<PlayIcon className="mr-2 h-4 w-4" aria-hidden="true" />
										Try a demo
										<ArrowRightIcon
											className="ml-2 -mr-0.5 h-4 w-4"
											aria-hidden="true"
										/>
									</a>
								</Link>
								<Link href="/local" legacyBehavior>
									<a className="inline-flex items-center ml-2 px-3 py-2 border border-transparent shadow-sm leading-4 font-medium rounded-md text-white bg-teal-600 hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500">
										<ServerIcon className="mr-2 h-4 w-4" aria-hidden="true" />
										Local server
										<ArrowRightIcon
											className="ml-2 -mr-0.5 h-4 w-4"
											aria-hidden="true"
										/>
									</a>
								</Link>
							</div>
						</div>
					</div>
				</div>

				<div className="sm:mx-auto sm:max-w-3xl sm:px-6">
					<div className="py-12 sm:relative sm:mt-12 sm:py-16 lg:absolute lg:inset-y-0 lg:right-0 lg:w-1/2">
						<div className="hidden sm:block">
							<div className="absolute inset-y-0 left-1/2 w-screen bg-gray-50 rounded-l-3xl lg:left-80 lg:right-0 lg:w-full" />
							<svg
								className="absolute top-8 right-1/2 -mr-3 lg:m-0 lg:left-0"
								width={404}
								height={392}
								fill="none"
								viewBox="0 0 404 392"
							>
								<defs>
									<pattern
										id="837c3e70-6c3a-44e6-8854-cc48c737b659"
										x={0}
										y={0}
										width={20}
										height={20}
										patternUnits="userSpaceOnUse"
									>
										<rect
											x={0}
											y={0}
											width={4}
											height={4}
											className="text-gray-200"
											fill="currentColor"
										/>
									</pattern>
								</defs>
								<rect
									width={404}
									height={392}
									fill="url(#837c3e70-6c3a-44e6-8854-cc48c737b659)"
								/>
							</svg>
						</div>
						<div className="pl-4 -mr-40 sm:mx-auto sm:max-w-3xl sm:px-0 lg:max-w-none lg:h-full lg:pl-12">
							<div className="grid grid-cols-1 place-content-center w-full h-full">
								<Image
									src="/images/aida-screenshot.png"
									alt="screenshot of AIDA interface"
									width={2014}
									height={1366}
									sizes="50vw"
									className="rounded-md shadow-xl"
								/>
							</div>
						</div>
					</div>
				</div>
			</header>

			<main className="bg-gray-50 flex justify-center md:mt-20 py-12 md:py-20">
				<div className="mx-auto max-w-md px-4 sm:max-w-3xl sm:px-6 lg:px-8 lg:max-w-7xl mm:pt-16">
					<div className="max-w-prose">
						<h2 className="text-2xl text-gray-900 font-semibold tracking-tight sm:text-3xl">
							What is AIDA?
						</h2>
						<div className="mt-4 text-gray-600 space-y-6 text-base leading-relaxed">
							<p>
								AIDA is an attempt to bring an open source web-based work-flow
								to image annotation.
							</p>
							<p>
								AIDA is a web interface that enables distributed teams of
								researchers to directly annotate images with easy to use on
								screen drawing tools. AIDA supports the creation of well defined
								annotation trials which include a series of high resolution
								images and a specific set of annotation tasks.
							</p>
							<p>
								For documentation and further information see the{' '}
								<a
									className="text-teal-600 hover:underline"
									href="https://github.com/alanaberdeen/AIDA"
								>
									AIDA repository
								</a>
								.
							</p>
						</div>
					</div>

					<div className="max-w-prose mt-20">
						<h2 className="text-2xl text-gray-900 font-semibold tracking-tight sm:text-3xl">
							What is AIDA-3D?
						</h2>
						<div className="mt-4 text-gray-600 space-y-6 text-base leading-relaxed">
							<p>
								AIDA-3D combines the 2D viewer from AIDA with a corresponding 3D
								viewer for semantic segmentation of tiled regions.
							</p>
						</div>
					</div>

					<div className="max-w-prose mt-20">
						<h2 className="text-2xl text-gray-900 font-semibold tracking-tight sm:text-3xl">
							License
						</h2>
						<div className="mt-4 text-gray-600 space-y-6 text-base leading-relaxed">
							<p>
								The software is published as Open Source under the permissive{' '}
								<a
									className="text-teal-600 hover:underline"
									href="https://github.com/alanaberdeen/AIDA-3D/blob/master/LICENSE"
								>
									MIT license
								</a>
								.
							</p>
						</div>
					</div>

					<div className="max-w-prose mt-20">
						<h2 className="text-2xl text-gray-900 font-semibold tracking-tight sm:text-3xl">
							About
						</h2>
						<div className="mt-4 text-gray-600 space-y-6 text-base leading-relaxed">
							<p>
								This is a project of{' '}
								<a
									className="text-teal-600 hover:underline"
									href="https://alanaberdeen.com"
								>
									Alan Aberdeen
								</a>{' '}
								with the support of{' '}
								<a
									className="text-teal-600 hover:underline"
									href="https://www.nih.gov/about-nih/what-we-do/nih-almanac/national-cancer-institute-nci"
								>
									NCI at NIH
								</a>{' '}
								and the{' '}
								<a
									className="text-teal-600 hover:underline"
									href="http://www.ludwig.ox.ac.uk/jens-rittscher-group-page"
								>
									Quantitative Biological Imaging Group
								</a>{' '}
								at The University of Oxford.
							</p>
						</div>
					</div>
				</div>
			</main>
		</div>
	)
}
