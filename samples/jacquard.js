#!/usr/bin/env node

/*
v2
*/

let code = [
"                       ",
" xxxxxxx  x  x xxxxxxx ",
" x     x x  x  x     x ",
" x xxx x  x    x xxx x ",
" x xxx x x  x  x xxx x ",
" x xxx x   xxx x xxx x ",
" x     x xxx x x     x ",
" xxxxxxx x x x xxxxxxx ",
"           xxx         ",
" xxxxx xxxx  xx x x x  ",
"     xx   xx xxxxx   x ",
" x x x x  x x xx  xxx  ",
" x   x  x x   x xx xx  ",
"   x   x    x xx x  xx ",
"         xx xx  xxx  x ",
" xxxxxxx xx  x xx xxx  ",
" x     x  xxxxx xxxx x ",
" x xxx x x x x xx    x ",
" x xxx x xx  xx xxx    ",
" x xxx x x xx xx   x   ",
" x     x xx       xx   ",
" xxxxxxx x  x   x   x  ",
"                       "
];

"use strict";

let outFileName = 'out.k';
if(process.argv[2]) {
    outFileName = process.argv[2];
    let lcfn = outFileName.toLowerCase();
    if(!lcfn.endsWith(".k") && !lcfn.endsWith(".knitout")) {
        outFileName += ".k";
        console.warn("filename must end with '.k' or '.knitout', corrected to " + outFileName);
    }
}

function generateKnit(){

    let ku = require("../knittingutils.js");
    let ks = new ku.KnitSequence();

    let yarnPolyW =    ks.makeYarn("Polyester white");
    let yarnPolyB =    ks.makeYarn("Polyester black");

    let width = code[0].length;
    let height = code.length;

    let cpp = 5;
    let wpp = 3;

    let wales = width * wpp;
    let courses = height * cpp;

    ks.rack(0.25);

    for(let j = 0; j < courses; j++) {

        let lineW = "";
        let lineB = "";
        for(let i = 0; i < wales; i++) {
            if(code[Math.floor((courses - 1 - j) / cpp)][Math.floor(i / wpp)] === ' ') {
                lineW += (i % 2 ? 'k' : 'b');
                lineB += (i % 2 ? '-' : 'K');
            } else {
                lineW += (i % 2 ? 'K' : '-');
                lineB += (i % 2 ? 'b' : 'k');
            }
        }

        ks.newCourse(yarnPolyW);
        ks.insert(yarnPolyW, lineW);

        ks.newCourse(yarnPolyB);
        ks.insert(yarnPolyB, lineB);
    }

    //shift one to the right, otherwise cast-off from R to L does not fit
    ks.shift(1);

    ks.printAllMaps();
    ks.printOrder();

    ks.printSequence();

    ks.mapYarn(yarnPolyW, 3);
    ks.mapYarn(yarnPolyB, 5);

    ks.generate(outFileName, "QR code via birds eye jacquard");
}

generateKnit();