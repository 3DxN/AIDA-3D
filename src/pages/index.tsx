import { useState } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import Image from 'next/image'
import { 
    ArrowRightIcon, ServerIcon, PlayIcon, FolderOpenIcon,
    CursorClickIcon, CollectionIcon, CubeTransparentIcon, PuzzleIcon
} from '@heroicons/react/solid'
import { ScaleIcon } from '@heroicons/react/outline'

import StoreLoader from '../components/loader'
import { ZarrStoreProvider } from '../lib/contexts/ZarrStoreContext'


export default function Home() {
    const [showLoader, setShowLoader] = useState(false)

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
                                    viewer for exploring 2D and 3D histology images.
                                </p>

                                {/* Action buttons */}
                                <div className="mt-8 space-y-4">
                                    <button
                                        onClick={() => setShowLoader(true)}
                                        className="inline-flex items-center px-6 py-3 border border-transparent shadow-sm text-base font-medium rounded-md text-white bg-teal-600 hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500"
                                    >
                                        <PlayIcon className="mr-2 h-5 w-5" aria-hidden="true" />
                                        Load Project
                                        <ArrowRightIcon className="ml-2 -mr-0.5 h-5 w-5" aria-hidden="true" />
                                    </button>

                                    <div className="flex space-x-4">
                                        <Link href="/demo" legacyBehavior>
                                            <a className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500">
                                                <ServerIcon className="mr-2 h-4 w-4" aria-hidden="true" />
                                                View Demo
                                            </a>
                                        </Link>

                                        <Link href="/local" legacyBehavior>
                                            <a className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500">
                                                <FolderOpenIcon className="mr-2 h-4 w-4" aria-hidden="true" />
                                                Local Dashboard
                                            </a>
                                        </Link>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="mt-12 sm:mt-16 lg:mt-0">
                        <div className="pl-4 -mr-48 sm:pl-6 md:-mr-16 lg:px-0 lg:m-0 lg:relative lg:h-full">
                            <Image
                                className="w-full rounded-xl shadow-xl ring-1 ring-black ring-opacity-5 lg:absolute lg:left-0 lg:h-full lg:w-auto lg:max-w-none"
                                src="/images/aida-screenshot.png"
                                alt="AIDA 3D Screenshot"
                                width={800}
                                height={600}
                                priority
                            />
                        </div>
                    </div>
                </div>
            </header>


            {/* Features section */}
            <section className="py-16 bg-gray-50 overflow-hidden">
            <div className="relative max-w-xl mx-auto px-4 sm:px-6 lg:px-8 lg:max-w-7xl">
                <div className="relative">
                <h2 className="text-center text-3xl leading-8 font-extrabold tracking-tight text-gray-900 sm:text-4xl">
                    Features
                </h2>
                <p className="mt-4 max-w-3xl mx-auto text-center text-xl text-gray-500">
                    Powerful tools for analyzing histology data
                </p>
                </div>

                <div className="relative mt-12 lg:mt-24 lg:grid lg:grid-cols-2 lg:gap-14 lg:items-start">
                    <div className="relative flex flex-col h-full">
                        <h3 className="text-2xl font-extrabold text-gray-900 tracking-tight sm:text-3xl">
                        Multi-format Support
                        </h3>
                        <p className="mt-3 text-lg text-gray-500">
                        Load and explore various image formats including OME-Zarr, DeepZoom, and TIFF files.
                        </p>

                        <dl className="mt-10 space-y-16">
                        <div className="relative">
                            <dt>
                            <div className="absolute flex items-center justify-center h-12 w-12 rounded-md bg-teal-500 text-white">
                                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 1.79 4 4 4h8c0-1.1.9-2 2-2h2c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2h-2c-1.1 0-2-.9-2-2H8c-1.1 0-2 .9-2 2z" />
                                </svg>
                            </div>
                            <p className="ml-16 text-lg leading-6 font-medium text-gray-900">Multi-Scale Image Support</p>
                            </dt>
                            <dd className="mt-2 ml-16 text-base text-gray-500">
                            Native support for datasets with multiple resolutions for efficient loading and exploration.
                            </dd>
                        </div>
                        

                        <div className="relative">
                            <dt>
                            <div className="absolute flex items-center justify-center h-12 w-12 rounded-md bg-teal-500 text-white">
                                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0-2-2z" />
                                </svg>
                            </div>
                            <p className="ml-16 text-lg leading-6 font-medium text-gray-900">3D Visualization</p>
                            </dt>
                            <dd className="mt-2 ml-16 text-base text-gray-500">
                            Interactive 3D models with synchronized 2D/3D selection and annotation.
                            </dd>
                        </div>

                        {/* --- NEW SEMI-FEATURE --- */}
                        <div className="relative">
                            <dt>
                            <div className="absolute flex items-center justify-center h-12 w-12 rounded-md bg-teal-500 text-white">
                                <PuzzleIcon className="h-6 w-6" aria-hidden="true" />
                            </div>
                            <p className="ml-16 text-lg leading-6 font-medium text-gray-900">Tiled and Stitched Images</p>
                            </dt>
                            <dd className="mt-2 ml-16 text-base text-gray-500">
                            Efficiently view massive, gigapixel-sized images by loading only the visible tiles, perfect for stitched whole-slide images.
                            </dd>
                        </div>
                        </dl>

                    </div>

                    {/* Bespoke Annotations */}
                    <div className="relative mt-10 -mx-4 lg:mt-0 flex flex-col h-full" aria-hidden="true">
                        <h3 className="text-2xl font-extrabold text-gray-900 tracking-tight sm:text-3xl">
                            Bespoke Annotations
                        </h3>
                        <p className="mt-3 text-lg text-gray-500">
                            Go beyond simple viewing. Create, edit, and analyze regions of interest directly on your 2D and 3D images with a suite of powerful, custom-built annotation tools.
                        </p>

                        <dl className="mt-10 space-y-16">
                            <div className="relative">
                                <dt>
                                    <div className="absolute flex items-center justify-center h-12 w-12 rounded-md bg-teal-500 text-white">
                                        <CursorClickIcon className="h-6 w-6" aria-hidden="true" />
                                    </div>
                                    <p className="ml-16 text-lg leading-6 font-medium text-gray-900">Interactive Region Selection</p>
                                </dt>
                                <dd className="mt-2 ml-16 text-base text-gray-500">
                                    Draw and manipulate selection frames directly on the viewer. Resize, move, and see your changes reflected in other viewers instantly.
                                </dd>
                            </div>

                            <div className="relative">
                                <dt>
                                    <div className="absolute flex items-center justify-center h-12 w-12 rounded-md bg-teal-500 text-white">
                                        <CollectionIcon className="h-6 w-6" aria-hidden="true" />
                                    </div>
                                    <p className="ml-16 text-lg leading-6 font-medium text-gray-900">Multi-Layer Analysis</p>
                                </dt>
                                <dd className="mt-2 ml-16 text-base text-gray-500">
                                    Overlay segmentation masks, feature heatmaps, or other analytical data. Toggle layers to compare your annotations with computational results.
                                </dd>
                            </div>

                            <div className="relative">
                                <dt>
                                    <div className="absolute flex items-center justify-center h-12 w-12 rounded-md bg-teal-500 text-white">
                                        <CubeTransparentIcon className="h-6 w-6" aria-hidden="true" />
                                    </div>
                                    <p className="ml-16 text-lg leading-6 font-medium text-gray-900">3D Annotations</p>
                                </dt>
                                <dd className="mt-2 ml-16 text-base text-gray-500">
                                    Define volumetric regions of interest in the 3D space. Synchronize your 3D selections with the 2D cross-sectional views for precise analysis.
                                </dd>
                            </div>
                        </dl>
                    </div>
                </div>
            </div>
            </section>


            {/* Additional Info Sections from old index.js, now styled as cards */}
            <section className="py-16 bg-gradient-to-b from-white to-gray-50">
              <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-2 gap-10">
                {/* What is AIDA? */}
                <div className="bg-white rounded-2xl shadow-lg p-8 flex flex-col border border-gray-100 transition-all duration-200 hover:shadow-2xl hover:scale-105 focus-within:shadow-2xl focus-within:scale-105">
                  <h2 className="text-2xl text-gray-900 font-bold tracking-tight sm:text-3xl mb-4 flex items-center">
                    <span className="inline-block w-2 h-6 bg-teal-500 rounded-full mr-3"></span>
                    What is AIDA?
                  </h2>
                  <div className="text-gray-600 space-y-4 text-base leading-relaxed">
                    <p>
                      AIDA is an attempt to bring an open source web-based work-flow to image annotation.
                    </p>
                    <p>
                      AIDA is a web interface that enables distributed teams of researchers to directly annotate images with easy to use on screen drawing tools. AIDA supports the creation of well defined annotation trials which include a series of high resolution images and a specific set of annotation tasks.
                    </p>
                    <p>
                      For documentation and further information see the{' '}
                      <a
                        className="text-teal-600 hover:underline font-medium"
                        href="https://github.com/alanaberdeen/AIDA"
                        target="_blank"
                        rel="noreferrer"
                      >
                        AIDA repository
                      </a>
                      .
                    </p>
                  </div>
                </div>

                {/* What is AIDA-3D? */}
                <div className="bg-white rounded-2xl shadow-lg p-8 flex flex-col border border-gray-100 transition-all duration-200 hover:shadow-2xl hover:scale-105 focus-within:shadow-2xl focus-within:scale-105">
                  <h2 className="text-2xl text-gray-900 font-bold tracking-tight sm:text-3xl mb-4 flex items-center">
                    <span className="inline-block w-2 h-6 bg-teal-500 rounded-full mr-3"></span>
                    What is AIDA-3D?
                  </h2>
                  <div className="text-gray-600 space-y-4 text-base leading-relaxed">
                    <p>
                      AIDA-3D combines the 2D viewer from AIDA with a corresponding 3D viewer for semantic segmentation of tiled regions.
                    </p>
                  </div>
                </div>

                {/* License */}
                <div className="bg-white rounded-2xl shadow-lg p-8 flex flex-col border border-gray-100 transition-all duration-200 hover:shadow-2xl hover:scale-105 focus-within:shadow-2xl focus-within:scale-105">
                  <h2 className="text-2xl text-gray-900 font-bold tracking-tight sm:text-3xl mb-4 flex items-center">
                    <span className="inline-block w-2 h-6 bg-teal-500 rounded-full mr-3"></span>
                    License
                  </h2>
                  <div className="text-gray-600 space-y-4 text-base leading-relaxed">
                    <p>
                      The software is published as Open Source under the permissive{' '}
                      <a
                        className="text-teal-600 hover:underline font-medium"
                        href="https://github.com/alanaberdeen/AIDA-3D/blob/master/LICENSE"
                        target="_blank"
                        rel="noreferrer"
                      >
                        MIT license
                      </a>
                      .
                    </p>
                  </div>
                </div>

                {/* About */}
                <div className="bg-white rounded-2xl shadow-lg p-8 flex flex-col border border-gray-100 transition-all duration-200 hover:shadow-2xl hover:scale-105 focus-within:shadow-2xl focus-within:scale-105">
                  <h2 className="text-2xl text-gray-900 font-bold tracking-tight sm:text-3xl mb-4 flex items-center">
                    <span className="inline-block w-2 h-6 bg-teal-500 rounded-full mr-3"></span>
                    About
                  </h2>
                  <div className="text-gray-600 space-y-4 text-base leading-relaxed">
                    <p>
                      This is a project of{' '}
                      <a
                        className="text-teal-600 hover:underline font-medium"
                        href="https://alanaberdeen.com"
                        target="_blank"
                        rel="noreferrer"
                      >
                        Alan Aberdeen
                      </a>{' '}
                      with the support of{' '}
                      <a
                        className="text-teal-600 hover:underline font-medium"
                        href="https://www.nih.gov/about-nih/what-we-do/nih-almanac/national-cancer-institute-nci"
                        target="_blank"
                        rel="noreferrer"
                      >
                        NCI at NIH
                      </a>{' '}
                      and the{' '}
                      <a
                        className="text-teal-600 hover:underline font-medium"
                        href="http://www.ludwig.ox.ac.uk/jens-rittscher-group-page"
                        target="_blank"
                        rel="noreferrer"
                      >
                        Quantitative Biological Imaging Group
                      </a>{' '}
                      at The University of Oxford.
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* Modal Overlay */}
            {showLoader && (
                <>
                    <div 
                        className="fixed inset-0 bg-black bg-opacity-70 z-50"
                        onClick={() => setShowLoader(false)}
                    />
                    <ZarrStoreProvider>
                        <StoreLoader 
                            onClose={() => setShowLoader(false)}
                        />
                    </ZarrStoreProvider>
                </>
            )}
        </div>
    )
}
