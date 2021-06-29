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

    let ku = require("./knittingutils.js");
    let ks = new ku.KnitSequence();

    let yarnPoly0 =    ks.makeYarn("Polyester0");
    let yarnPoly1 =    ks.makeYarn("Polyester1");

    let courses = 100;
    let wales = 50;

    let intarsiaCourses = 50;
    let intarsiaWales = 30;

    let marginCourses = Math.round((courses - intarsiaCourses) / 2);
    let marginWales = Math.round((wales - intarsiaWales) / 2);

    ks.comment("lower margin area");
    for(let j = 0; j < marginCourses; j++) {

        ks.newCourse(yarnPoly0);
        ks.insert(yarnPoly0, "k", wales);
    }

    ks.comment("knitting intarsia area");
    for(let j = 0; j < intarsiaCourses; j++) {
        ks.newCourse(yarnPoly1, marginWales - 1);
        ks.insert(yarnPoly1, "t");
        ks.insert(yarnPoly1, "k", intarsiaWales);
        ks.insert(yarnPoly1, "t");

        ks.newCourse(yarnPoly0);
        ks.insert(yarnPoly0, "k", marginWales);
        ks.insert(yarnPoly0, "---t", intarsiaWales, j);
        ks.insert(yarnPoly0, "k", marginWales);
    }

    ks.comment("upper margin area");
    for(let j = 0; j < marginCourses; j++) {

        ks.newCourse(yarnPoly0);
        ks.insert(yarnPoly0, "k", wales);
    }

    ks.printAllMaps();
    ks.printOrder();

    ks.printSequence();

    ks.mapYarn(yarnPoly0, 3);
    ks.mapYarn(yarnPoly1, 4);

    ks.generate(outFileName, "intarsia in single jersey");
}

generateKnit();