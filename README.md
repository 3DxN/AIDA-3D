# AIDA 3D
test`:
## What is AIDA-3D?

AIDA-3D combines the 2D viewer from [AIDA](https://github.com/alanaberdeen/AIDA) with a corresponding 3D viewer for semantic segmentation of tiled regions. [Play with a live demo here](https://aida-3d.vercel.app/demo).

## What is AIDA

AIDA is an attempt to bring an open source web-based work-flow to image annotation.

AIDA is a web interface that enables distributed teams of researchers to directly annotate images with easy to use on screen drawing tools. AIDA supports the creation of well defined annotation trials which include a series of high resolution images and a specific set of annotation tasks.

For documentation and further information see the [AIDA repository](https://github.com/alanaberdeen/AIDA).

## How has it been implemented?

The user interface is a React [NextJS](https://nextjs.org/) Single Page Application.

The 2D viewer is built on [OpenLayers](https://openlayers.org/) to provide the images and drawing functionality. The 3D viewer is built on [three.js](https://threejs.org/).

## License

The software is published as Open Source under the permissive [MIT license](https://github.com/alanaberdeen/AIDA/blob/master/LICENSE).

## Run Locally

You can use AIDA-3D on your local machine. The only requirement [NodeJS](https://nodejs.org/en/).

1. Clone the repository
2. Edit the aida.config.js file at project root to specify a path to serve your image data from, the default is `/local/data/`. [optional]
3. Install the dependencies via [NPM](https://www.npmjs.com/) `npm install`
4. Run the build script `npm run build`
5. Add the images and their corresponding 3D segmentation to the data directory (default `/local/data/`), or to the alternative location if you specified an alternative in step 2.
6. Create a .json project file in the data directory with two properties 'image' the local path to the 2D image and 'tiles' the local path to the 3D segmentation.
7. Run the local server application via `npm run start`
8. Navigate to the localhost webserver specified in the console.

## Example local sever data directory

```text
local
|  local.ts
|  tsconfig.json
|  ...
|
|  └──data
|    | README.md
|    | image.json             // AIDA project file (see below for example content)
|    
|    └──image-dz              // DeepZoom format 2D image
|    |   |  image.dzi
|    |   
|    |   └──image_files
|    |   |   
|    |   |   └──0
|    |   |      |  0_0.jpeg
|    |   |      |  0_1.jpeg
|    |   |      |  ...
|    |   |
|    |   |   └───1
|    |   |      |  0_0.jpeg
|    |   |      |  0_1.jpeg
|    |   |      |  ...
|    |   |
|    |   |   └───...  
|    |   
|    └──image-tiles         // Segmentation tiles produced by the analysis pipeline. GLTF format.
|        |  tile__H000_V000.tif__.bin
|        |  tile__H000_V000.tif__.gltf
|        |  tile__H000_V000.tif__.json
|        |  ...
```

image.json defines the combination of 2D image and 3D segmentation tiles.
`images` should contain the path of the dzi file(s) to show. If the list contains more than 1 dzi, the images would be overlay on each other.

```json
{
  "images": ["image-dz/image.dzi", "image-dz/image2.dzi", "..."],
  "tiles": "image-tiles"
}
```

## Develop

Requirement [NodeJS](https://nodejs.org/en/).
Example work-flow:

1. Clone the repository
2. Install dependencies via `npm install`
3. For development: start a hot-reloading dev server with `npm run start`
4. For deployment: bundle together with `npm run build`

## Support for tiled images, International Image Interoperability Framework (IIIF)

This removes the requirement for DZI file formats and replaces it with a web-server. At this point it is still a bit experimental.

- Deploy Cantaloupe IIIF server as described [here](https://cantaloupe-project.github.io/).
- Edit the Cantaloupe configuration file so that `FilesystemSource.BasicLookupStrategy.path_prefix` points to `/local/data`.
- Cataloupe server must be running at 'localhost:8182'
- Currently only TIFF files are supported.

## Creating .dzi files

We recommend using [libvips](https://github.com/libvips/libvips) and the `vips` command to convert Tiff files to `.dzi`

On MacOS:

```bash
brew install vips
vips dzsave input.tif output_folder --suffix .jpg
```

[Full instructions and Windows binaries can be found on the libvips page](https://github.com/libvips/libvips?tab=readme-ov-file#install). 

## About

This application was built by [Alan Aberdeen](https://github.com/alanaberdeen) with the support of [NCI at NIH](https://www.nih.gov/about-nih/what-we-do/nih-almanac/national-cancer-institute-nci) and the [Quantitative Biological Imaging Group](http://www.ludwig.ox.ac.uk/jens-rittscher-group-page), The University of Oxford.
