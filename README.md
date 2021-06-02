# Knitting Utils

[NodeJS](https://nodejs.org/en/) based utilities for generating knitout files using [CMU knitout library](https://textiles-lab.github.io/posts/2017/11/27/kout1/). Files are in particular targeted for Shima Seiki SWG N2 backend.

## dependencies

- knitout-frontend-js [npm package](https://www.npmjs.com/package/knitout)
- for using the preconfigured "convert to DAT" task, you need to create an environment variable ```KNITOUT_BACKEND_SWG``` pointing to the path containing your ```knitout-to-dat.js``` converter script file.
- the script [dat2png.js](./dat2png.js) requires the node-canvas [npm package](https://www.npmjs.com/package/canvas) (tested with 2.8.0).

## Links

- knitout [specification](https://textiles-lab.github.io/knitout/knitout.html)
- knitout [Shima Seiki SWG N2 extensions](https://textiles-lab.github.io/knitout/extensions.html) (incomplete)

## Todo

- KnitWrap: extensive error checking (validity of arguments and current machine/carrier/hook states, etc.)
- KnitPattern: find way to specify 2nd stitch (make extension for knitout and converter?)
