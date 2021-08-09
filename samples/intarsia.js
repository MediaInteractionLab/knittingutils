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

    //create yarn descriptors for two different yarns
    let yarnPoly0 =    ks.makeYarn("Polyester0");
    let yarnPoly1 =    ks.makeYarn("Polyester1");

    let courses = 100;
    let wales = 50;

    let intarsiaCourses = 50;
    let intarsiaWales = 30;

    let marginCourses = Math.round((courses - intarsiaCourses) / 2);
    let marginWales = Math.round((wales - intarsiaWales) / 2);

    //knit lower end with only poly0
    ks.comment("lower margin area");
    for(let j = 0; j < marginCourses; j++) {

        //create new poly0 course
        ks.newCourse(yarnPoly0);

        //fill course with operations 'k' for front knit operation
        // fill _wales_ needles with repeat pattern "k"
        ks.insert(yarnPoly0, "k", wales);
    }

    ks.comment("knitting intarsia area");
    for(let j = 0; j < intarsiaCourses; j++) {

        //create new poly1 course
        // start course at (margin-1)
        ks.newCourse(yarnPoly1, marginWales - 1);
        //insert a single 't' for a front tuck
        ks.insert(yarnPoly1, "t");
        //insert 'k' for front knit
        // fill _intarsiaWales_ needles with repeat pattern "k"
        ks.insert(yarnPoly1, "k", intarsiaWales);
        //insert a single 't' for a front tuck
        ks.insert(yarnPoly1, "t");

        //create new poly0 course
        ks.newCourse(yarnPoly0);
        //insert 'k' for front knit
        // fill _marginWales_ needles with repeat pattern "k"
        ks.insert(yarnPoly0, "k", marginWales);
        //insert '-' and 't', specify a repeat of three misses and one front tuck
        // fill _marginWales_ needles with repeat pattern "---t"
        // pass alternating repeat pattern offste for every course (0, 1, 2, 3, 0, 1, 2, 3...) to get somewhat balanced inlay
        ks.insert(yarnPoly0, "---t", intarsiaWales, j % 4);
        //insert 'k' for front knit
        // fill _marginWales_ needles with repeat pattern "k"
        ks.insert(yarnPoly0, "k", marginWales);
    }

    //knit lower end with only poly0
    ks.comment("upper margin area");
    for(let j = 0; j < marginCourses; j++) {

        //create new poly0 course
        ks.newCourse(yarnPoly0);

        //fill course with operations 'k' for front knit operation
        // fill _wales_ needles with repeat pattern "k"
        ks.insert(yarnPoly0, "k", wales);
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
    ks.mapYarn(yarnPoly0, 3);
    ks.mapYarn(yarnPoly1, 4);

    //create knitout and write file
    ks.generate(outFileName, "intarsia in single jersey");
}

generateKnit();