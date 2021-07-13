# Knitting Utils

[NodeJS](https://nodejs.org/en/) based utilities for generating knitout files using [CMU knitout library](https://textiles-lab.github.io/posts/2017/11/27/kout1/). Files are in particular targeted for Shima Seiki SWG N2 backend.

## dependencies

- [knitout-frontend-js](https://www.npmjs.com/package/knitout) npm package
- for using the preconfigured "convert to DAT" task, you need to create an environment variable ```KNITOUT_BACKEND_SWG``` pointing to the path containing your ```knitout-to-dat.js``` converter script file.
- the script [dat2png.js](./dat2png.js) requires the node-canvas [npm package](https://www.npmjs.com/package/canvas) (tested with 2.8.0).
- [min-document](https://www.npmjs.com/package/min-document) npm package is required by the sample scripts for command line argument parsing.

## Usage

Clone the repository and, in the repository root folder, run ```npm link``` to create a symlink in the global npm package folder. In order to use the package in some other location, call ```npm link knittingutils``` in the respective directory. See [npm-link documentation](https://docs.npmjs.com/cli/v7/commands/npm-link) for more details.

See the included samples scripts for basic usage of the package. When used from other location, import main file ```knittingutils.js``` and use, e.g. ```KnitSequence``` constructor like this:

```
let ku = require("knittingutils");
let ks = new ku.KnitSequence();
```

## Links

Further informations about knitout format and extensions can be found here:
- knitout [specification](https://textiles-lab.github.io/knitout/knitout.html)
- knitout [Shima Seiki SWG N2 extensions](https://textiles-lab.github.io/knitout/extensions.html) (incomplete)

A (slightly modified) copy of the CMU Textiles Lab's [knitout live visualizer](https://textiles-lab.github.io/knitout-live-visualizer/) is also hosted on the Media Interaction Lab webspace [here](https://mi-lab.org/files/utils/knitout-live-visualizer/visualizer.html), with added drag'n'drop functionality for knitout files from file explorer, and yarn coloring analog to the color scheme used in Shima Seiki KnitPaint, making it easier to read for folks with a heavy KnitPaint-background.

## Notes

When used with knitout npm package 1.0.2 and below, for the speed-number feature to work, the code requires a slight modification of the file ```knitout.js```: the safety check in line 348 (function ```speedNumber```), i.e. the check for ```value > 0``` needs to be changed to ```value >= 0```, to allow the default value ```0```.

## Todo

- ```knitoutWrapper.js```: extensive error checking (validity of arguments and current machine/carrier/hook states, etc.)
- ```knitSequence.js```: sliders still not implemented
- ```knitSequence.js```: find way to specify 2nd stitch (make extension for knitout and converter?)
- ```knitSequence.js```: cast-on is skipped if first course is (usually by accient?) empty -- find a way to make this up later
