#!/usr/bin/env node

/*
v2
*/

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

    //create yarn descriptor
    let yarnCotton =    ks.makeYarn("Cotton");

    let courses = 40;
    let wales = 50;

    ks.comment("basic double jersey 2nd stitch");

    //rack back bad for front/back knitting
    ks.rack(0.25);

    for(let j = 0; j < courses / 4; j++) {

        //create new cotton course
        ks.newCourse(yarnCotton);

        //fill course with operations 'b' for both (front + back)
        // fill _wales_ needles with repeat pattern "b"
        ks.insert(yarnCotton, "b", wales);
    }

    for(let j = 0; j < courses / 4; j++) {

        //create new cotton course
        ks.newCourse(yarnCotton);

        //fill course with operations 'b' for both (front + back)
        // fill _wales_ needles with repeat pattern "b"
        //using 2nd stitch feature to generate loops that 
        // selectively use stitch settings set at the machine at 
        // #33, (instead of default of 13 in this case, since 
        // default is 10 + carrierNr and carrier is mapped to 3
        // below). the 2nd stitch repeat pattern specifies four
        // needles to use regular stitch settings (i.e. 13 here),
        // the next two use 2nd stitch, which is specified as 33.
        // just like other string-encoded repeats, this repeat 
        // is also repeated throughout the whole course.
        ks.insert(yarnCotton, "b", wales, 0, "....22", 33);
    }

    for(let j = 0; j < courses / 4; j++) {

        //create new cotton course
        ks.newCourse(yarnCotton);

        //fill course with operations 'b' for both (front + back)
        // fill _wales_ needles with repeat pattern "b"
        ks.insert(yarnCotton, "b", wales);
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

    //map yarn to carrier #3
    ks.mapYarn(yarnCotton, 3);

    //create knitout and write file
    ks.generate(outFileName, "double jersey fabric");
}

generateKnit();