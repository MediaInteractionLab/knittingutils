# Knitting Utils

[NodeJS](https://nodejs.org/en/) based utilities for generating knitout files using [CMU knitout library](https://textiles-lab.github.io/posts/2017/11/27/kout1/). Files are in particular targeted for Shima Seiki SWG N2 backend.

## dependencies

- [knitout-frontend-js](https://www.npmjs.com/package/knitout) npm package
- [os](https://nodejs.org/api/os.html) npm package
- for using the preconfigured "convert to DAT" Visual Studio Code task, you need to create an environment variable ```KNITOUT_BACKEND_SWG``` pointing to the path containing your ```knitout-to-dat.js``` converter script file.
- the script [dat2png.js](./dat2png.js) requires the node-canvas [npm package](https://www.npmjs.com/package/canvas) (tested with 2.8.0).
- [min-document](https://www.npmjs.com/package/min-document) npm package is required by the sample scripts for command line argument parsing.

## Usage

Clone the repository and, in the repository root folder, run ```npm link``` to create a symlink in the global npm package folder. In order to use the package in some other location, call ```npm link knittingutils``` in the respective directory. See [npm-link documentation](https://docs.npmjs.com/cli/v7/commands/npm-link) for more details.

See the included [samples scripts](./samples/) for basic usage of the package. When used from a different location, import the main file ```knittingutils.js``` and use, e.g. ```KnitSequence``` constructor like this:

```js
let ku = require("knittingutils");
```

### knitOutWrapper.js

The script [knitoutWrapper.js](./lib/knioutWrapper.js) is basically exactly this, a wrapper around the knitout library, providing some convenience functions such as ```bringIn```, ```castOn```, and ```castOff```, automatic handling of half gauging, and always keeping track of current machine status (racking status, current speed and stitch numbers, what needles are currently in use, what loops of what carrier(s) and in what order do needles currently hold, etc.), and performing extended error checking.

### knitSequence.js

[knitSequence.js](./lib/knitSequence.js) is a convenience script making use of ```knitOutWrapper.js```. The idea is to construct a knitting program by providing knit commands on a base of either courses for each yarn, without having to worry much about current carrier positions and directions. Cast-on and cast-off/linking is automatically taken care of, as well as off-knit yarn fixations (right hand side of the knit) when a yarn is first used. 

First, a ```KnitSequence``` object must be created and used yarns need to be specified, e.g.

```js
let ks = new ku.KnitSequence();

//create yarn descriptor
let yarnCotton = ks.makeYarn("Cotton");
```

Beginnings of new courses have to explicitly specified by calling ```ks.newCourse```. Subsequently, knitting instructions can be inserted (left-to-right) to specify a course:

```js
ks.newCourse(yarnCotton);           //create new cotton course
ks.insert(yarnCotton, "k", 20);     //inserts 'front knit' for 20 needles
    //resulting course: "kkkkkkkkkkkkkkkkkkkk"
    //                   ^                  ^
    //                   needle #1          needle #20
```

Finally, yarns have to be mapped to machine carriers and the knitout file has to be generated:

```js
//map yarn to carrier #3
ks.mapYarn(yarnCotton, 3);

//create knitout and write file
ks.generate(outFileName, "single jersey fabric");
```

Supported commands are the following:

| specifier | needle operation       |
| --------- | -----------------------|
|  ```.```  | no operation           |
|  ```k```  | knit front             |
|  ```K```  | knit back              |
|  ```b```  | knit front+back        |
|  ```t```  | tuck front             |
|  ```T```  | tuck back              |
|  ```B```  | tuck front + back      |
|  ```x```  | knit front + tuck back |
|  ```X```  | tuck front + knit back |
|  ```-```  | explicit miss front    |
|  ```_```  | explicit miss back     |
|  ```y```  | split front to back    |
|  ```Y```  | split back to front    |

The instruction-strings can hold a sequence of knitting instructions, which can be repeated, e.g.

```js
ks.newCourse(yarnCotton);           //create new cotton course
ks.insert(yarnCotton, "kkkt", 20);  //inserts sequence of 3 front knits, followed by 1 tuck, repeated for 20 needles
    //resulting course: "kkktkkktkkktkkktkkkt"
    //                   ^                  ^
    //                   needle #1          needle #20
```

The reason a course has to be specified explicitly is you are able to construct your courses by concatenating sequences like the following:

```js
ks.newCourse(yarnCotton);           //create new cotton course
ks.insert(yarnCotton, "kK", 14);    //inserts 1x1 rib sequence for 14 needles (left hand wales)
ks.insert(yarnCotton, "tT");        //inserts front and back tuck
ks.insert(yarnCotton, "kK", 14);    //inserts 1x1 rib sequence for 14 needles (right hand courses)
    //resulting course: "kKkKkKkKkKkKkKtTkKkKkKkKkKkKkK"
    //                   ^             ^              ^
    //                   needle #1     needle #15     needle #30
```

Note in the second call of ```insert``` in the example above, you can just skip the ```needleCount``` argument, in which case the instruction-string is just inserted as-is. One more handy argument is ```repeatOffset```, which specifies what index of the pattern should be used for the left hand needle. This can be used to shift the pattern depending on, e.g., a counter:

```js
for(let i = 0; i < 4; i++) {
    ks.newCourse(yarnCotton);               //create new cotton course
    ks.insert(yarnCotton, "kkk-", 20, i);   //insert sequence of three front knits and one miss for 20 needles
}
    //resulting courses: "kkk-kkk-kkk-kkk-kkk-"
    //                   "kk-kkk-kkk-kkk-kkk-k"
    //                   "k-kkk-kkk-kkk-kkk-kk"
    //                   "-kkk-kkk-kkk-kkk-kkk"
    //                    ^                  ^
    //                    needle #1          needle #20
```

By creating multiple yarns, more complex structures can be created with a few lines of code. For instance, the following script generates a basic spacer fabric:

```js
let ku = require("knittingutils");
let ks = new ku.KnitSequence();

let yarnPoly0 =    ks.makeYarn("Poly0");
let yarnPoly1 =    ks.makeYarn("Poly1");
let yarnNylon =    ks.makeYarn("Nylon");

ks.comment("spacer fabric");
for(let j = 0; j < 40; j++) {

    if(j) { //skip filler for first course
        ks.newCourse(yarnNylon);
        ks.insert(yarnNylon, "tT", 40);
    }

    ks.newCourse(yarnPoly0);
    ks.insert(yarnPoly0, "k", 40);

    ks.newCourse(yarnPoly1);
    ks.insert(yarnPoly1, "K", 40);
}

ks.mapYarn(yarnPoly0, 3);
ks.mapYarn(yarnPoly1, 4);
ks.mapYarn(yarnNylon, 8, false);  //skip fixation field for nylon filler

ks.generate(outFileName, "spacer fabric");
```

The result is the following knitting program, including 
- cast-on (currently only front-bed: one course of ```t-```, followed by one course of ```-t```, followed by one course of ```k```)
- setting of stitch numbers for each carrier
- setting of speed numbers for each carrier (optional)
- inserting in-hooks,  
    - including knitting fixation fields at first use of yarns (optional)
- inserting out-hooks at last use of yarns
- cast-off/linking performed with the last yarn in use
- automatic alignment of beds when transfer or split commands are performed (optional)

![spacer-fabric](./images/spacer-knitout.png)

More documentation will follow, e.g. on how to perform transfers, splits, and pleating; in the meantime, please refer to the provided samples for further usage. In particular, look up [purl.js](./samples/purl.js) and [pleating.js](./samples/pleating.js) for transfers and pleating. In general, they are mostly carried out in a similar way as needle operations, e.g.

```js
// ffffff
ks.transfer("x", 6);        //transfer needles 1-6 front-to-back
// xxxxxx
// bbbbbb
ks.transfer("X.", 6);       //transfer needles 1, 3, 5 back-to-front ('.' => nop)
// X.X.X.
// fbfbfb
ks.transfer("x.x..X");      //transfer needles 1, 3 font-to-back, transfer needle 6 back-to-front
// x.x..X
// bbbbff
ks.transferAt(4, "x", 2);   //starting with an offset of 4 needles, transfer 2 needles front-to-back
//     xx
// bbbbbb
```

for transfer, and similarly for drop:

```js
ks.drop("ddDDaa");      //drop at needles f1, f2, b3, b4, as well as both front and back f5, b5, f6, b6
ks.dropAt(10, "d", 6);  //starting with an offset of 10 needles, drop at 6 front needles (i.e. f10 thru f16)
```

Supported commands for transfer:

| specifier | operation                 |
| --------- | --------------------------|
| ```x```   | front hook to back hook   |
| ```X```   | back hook to front hook   |
| ```s```   | front hook to back slider |
| ```S```   | back hook to front slider |
| ```r```   | front slider to back hook |
| ```R```   | back slider to front hook |

Supported commands for drop:

| specifier | operation                        |
| --------- | ---------------------------------|
| ```.```   | no operation                     |
| ```d```   | drop front needle                |
| ```D```   | drop back needle                 |
| ```a```   | drop both front and back needles |

***Notes for Knitting on the Machine***

Lacking access to other machines, the library is created with Shima Seiki SWG in mind, and is therefore using the related [knitout extensions for SWG](https://textiles-lab.github.io/knitout/extensions.html). 

The following convention is used for stitch numbers: before knitting with a carrier of ID ```x```, the stitch number index is set to ```x + 10```, i.e., carrier #2 is always associated with stitch number #12 in the lookup-table of the machine. Stitch numbers can be overwritten by the library user by calling ```stitchNumberOverride```, though. Since cast-on and cast-off/linking require independent stitching settings in most cases, stitch number #2 (cast-on) and #3 (cast-off/linking) are set respectively, regardless of what carrier is used for knitting.

Speed numbers can optionally be set for each yarn, by passing the desired machine index as the ```speedNumber``` argument when mapping the yarn to a carrier using ```mapYarn```.

Note in the image above, that since a commonly used composite command for linking (#61 and #71 in Shima Seiki KnitPaint, "front knit + move 1P left" and "front knit + move 1P right") are not yet supported in knitout or the converter, linking is emulated with the commands available and not 100% as efficient on the machine.

## Building Samples

The code is being developed in [Visual Studio Code](https://code.visualstudio.com/), therefore the repository provides task configurations in [tasks.json](./.vscode/tasks.json), for running the sample scripts via NodeJS:
- run script: runs NodeJS on the JS currently open in the editor, generating a knitout file of the script's file name.
- convert to DAT: runs NodeJS on the knitout SWG backend. Make sure you set an environment variable ```KNITOUT_BACKEND_SWG``` containing the path to a copy of the ```knitout-to-dat.js``` converter script. The filename for input ```.k``` and output ```.dat``` is taken from the file currently opened in the editor.
- DAT to PNG: creates a ```PNG``` image file from the previously generated ```.dat``` file, generating a schematic of the knitting program, as displayed in Shima Seiki KnitPaint, for quick visual verification. The filename is again set from the file currently opened in the editor.
- generate all: runs all the above.
- run all sample scripts: runs the shell script [buildAll.cmd](./samples/buildAll.cmd), which re-builds knitout files for all provided [sample scripts](./samples/).


## Step-by-step getting started using VS Code

This section contains a step-by-step guide for using knittingutils with VS Code scripts, and making use of ```tasks.json```, aka. the recommended workflow (on Windows, at least), since it handy to use the task configurations file also for your own workflow. 
1) locate your ```knitout-to-dat.js``` and add an environment variable, that points to the containing folder, e.g., ```C:\knitout-backend-swg```
    - check if it already exists by entering ```set KNITOUT``` into a command prompt.
    - if no, add it with, e.g., ```setx KNITOUT_BACKEND_SWG C:\knitout-backend-swg``` (be sure to use ```setx```, not ```set```!) or use [Rapid Environment Editor](https://www.rapidee.com/en/about).
    - To set up Sintral conversion, do the same with the variable name ```KNITOUT_BACKEND_SINTRAL``` and the location of your ```knitout-to-sintral.js``` script.
1) clone this repository to your disk using Git and switch to the branch you require, e.g., using [TortoiseGit](https://tortoisegit.org/), or by opening a Git Bash and entering
    > git clone https://github.com/MediaInteractionLab/knittingutils.git \
    > git checkout dev
1) in a command prompt (Win+R > "cmd"), change into the directory containing your knittingutils clone and enter ```npm link```.
1) change into your VS Code workspace directory and enter ```npm link knittingutils``` (see above, section _Usage_).<br> _NOTE:_ due to a [bug in npm](https://github.com/npm/cli/issues/2380), linking packages clears all installed packages in your current workspace, meaning you have to re-install all previously added packages. So it is recommended to first link knittingutils, then install all required dependencies afterwards.
1) in the VS Code workspace directory, enter ```code .``` to run VS Code here (mind the "```.```", otherwise the directories are not set up right).
1) copy [tasks.json](./.vscode/tasks.json) into the ```.vscode``` folder of your workspace (or copy the contained tasks if you already have one). Note that the directory may not be created yet, in that case it is safe to just do this manually.
1) the ```run``` task in ```tasks.json``` is set up so the file currently opened in VS Code is run with ```node <thefile> <cwd>```, with the VS Code workspace folder specified as current working directory ("cwd"). It is furthermore set up as default "build task", so you can also use the shortcut Ctrl+Shift+B. If your script requires further arguments, you may add them to the ```args``` array in the ```run``` task. You can also use the VS Code command palette (F1 or Ctrl+Shift+P), then type/select ```Tasks: Run Task``` (or use shortcut the Ctrl+Alt+T) to list all available tasks, then select the task "run".
1) to convert knitout to DAT or Sintral, select "convert to DAT" or "convert to SIN" from the tasks list (Ctrl+Alt+T). The tasks expand to ```node <env-variable-path-to-converter>/<converterscript> <knitoutIn> <convertedOut>```. <br> Note that both tasks are set up to look for a knitout file _corresponding to the name of the currently opend file_ (without extension!) _in the directory of the currently opened file_ as an input. The resulting converted files will be placed next to this input file. This is because general practice here was that scripts generate knitout files with equal name, and the point was to not having manually switch to the knitout output first, for performing the conversion. E.g., if the open file is the knitout "interlock.k", it will use exactly this as input and try to convert it to "interlock.dat" (or "interlock.sin", for Sintral). If the script is called "interlock.js", and the task is run with the script file opened, it will also try to convert "interlock.k", which is the point of all this. However if you've corrently working on a script called "generate.js" in the editor, it will try to convert a file of name "generate.k" to "generate.dat" (or "generate.sin", for Sintral). 

## Links

Further information about knitout format and extensions can be found here:
- knitout [specification](https://textiles-lab.github.io/knitout/knitout.html)
- knitout [Shima Seiki SWG N2 extensions](https://textiles-lab.github.io/knitout/extensions.html) (incomplete)

A (slightly modified) copy of the CMU Textiles Lab's [knitout live visualizer](https://textiles-lab.github.io/knitout-live-visualizer/) is also hosted on the Media Interaction Lab webspace [here](https://mi-lab.org/files/utils/knitout-live-visualizer/visualizer.html), with added drag'n'drop functionality for knitout files from file explorer, and yarn coloring analog to the color scheme used in Shima Seiki KnitPaint, making it easier to read for folks with a heavy KnitPaint-background.

## Notes

When used with knitout npm package 1.0.2 and below, for the speed-number feature to work, the code requires a slight modification of the file ```knitout.js```: the safety check in line 348 (function ```speedNumber```), i.e. the check for ```value > 0``` needs to be changed to ```value >= 0```, to allow the default value ```0```.

Kniterate-specifics are not yet supported. Als be informed that Kniterate conversion was never tested and the Sintral converter is at an early stage.

## Todo

- extend README.md to include a few basic examples of usage in form of script snippets
- provide API documentation
- ```knitoutWrapper.js```: extensive error checking (validity of arguments and current machine/carrier/hook states, etc.)
- ```knitSequence.js```: maybe think of a more intelligent way of deciding which way a carrier will have to travel
- ```knitSequence.js```: find way to specify 2nd stitch (make extension for knitout and converter?)
- ```knitSequence.js```: cast-on is skipped if first course is (usually by accident?) empty
- provide a way to entirely skip caston
