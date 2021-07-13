#!/usr/bin/env node

/*
v2
*/


//map code (basically, a binary image) to a knit
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

    //create yarn descriptors
    let yarnPolyW =    ks.makeYarn("Polyester white");
    let yarnPolyB =    ks.makeYarn("Polyester black");

    let width = code[0].length;
    let height = code.length;

    let cpp = 5;    //courses per pixel
    let wpp = 3;    //wales per pixel

    let wales = width * wpp;
    let courses = height * cpp;

    //rack back bad for front/back knitting
    ks.rack(0.25);

    for(let j = 0; j < courses; j++) {

        //create strings, supposed to hold the patterns for both yarns, as courses cannot be written, alternatingly
        let lineW = "";
        let lineB = "";
        //create birds eye jacquard pattern from code (or binary image)
        // front bed is knit according to image content
        // back bed must be knit alternatingly with black/white
        for(let i = 0; i < wales; i++) {
            if(code[Math.floor((courses - 1 - j) / cpp)][Math.floor(i / wpp)] === ' ') {
                lineW += (i % 2 ? 'k' : 'b');
                lineB += (i % 2 ? '-' : 'K');
            } else {
                lineW += (i % 2 ? 'K' : '-');
                lineB += (i % 2 ? 'b' : 'k');
            }
        }

        //now write patterns to courses
        //create new course with white yarn
        ks.newCourse(yarnPolyW);
        ks.insert(yarnPolyW, lineW);

        //create new course with black yarn
        ks.newCourse(yarnPolyB);
        ks.insert(yarnPolyB, lineB);
    }

    //shift entire pattern one needle to the right, otherwise castOff 
    // would need to access negative needle indices, when done from
    // right-to-left
    ks.shift(1);

    //print all maps to console
    ks.printAllMaps();

    //print command order to console
    ks.printOrder();

    //print entire interlaced knitting sequence to console
    ks.printSequence();

    //map yarns to carriers
    ks.mapYarn(yarnPolyW, 3);
    ks.mapYarn(yarnPolyB, 5);

    //create knitout and write file
    ks.generate(outFileName, "QR code via birds eye jacquard");
}

generateKnit();