# Knitting Utils

[NodeJS](https://nodejs.org/en/) based utilities for generating knitout files using [CMU knitout library](https://textiles-lab.github.io/posts/2017/11/27/kout1/). Files are in particular targeted for Shima Seiki SWG N2 backend.

## dependencies

- knitout [npm package](https://www.npmjs.com/package/knitout)

## Links

- knitout [specification](https://textiles-lab.github.io/knitout/knitout.html)
- knitout [Shima Seiki SWG N2 extensions](https://textiles-lab.github.io/knitout/extensions.html) (incomplete)

## Todo

- KnitWrap: extensive error checking (validity of arguments and current machine/carrier/hook states, etc.)
- KnitPattern: come up with good idea for how to specify plating
- KnitWrap: generate cast-on (similar to how we did it in our early samples)
- KnitPattern: find way to specify 2nd stitch (make extension for knitout and converter?)
