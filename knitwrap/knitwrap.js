#!/usr/bin/env node

/*
v2
*/

"use strict";

const knitout = require('knitout');

let _name = undefined;
let _wales = undefined;
let _courses = undefined;
let _left = undefined;
let _right = undefined;

let _bringInOffset = 2;
let _bringInWales = 6;

let _bringInInfo = undefined;

const LEFT = -1;
const RIGHT = 1;

let k = undefined;

function getDirSign(dir) {
    return (dir == LEFT ? '-' : (dir == RIGHT ? '+' : undefined));
}

exports.createBed = function(needles) {
    let bed = {};

    bed.needles = ' '.repeat(needles);
    bed.sliders = ' '.repeat(needles);
    bed.needleStatus = new Array(needles);
    bed.sliderStatus = new Array(needles);
    for(let i = 0; i < needles; i++) {
        bed.needleStatus[i] = undefined;
        bed.sliderStatus[i] = undefined;
    }

    return bed;
}

let _machine = undefined;
exports.createMachine = function(name, needles, gauge, numCarriers, defaultStitchNumber = 70, position = 'Keep', presser = 'auto') {
    
    let cn = new Array(numCarriers);
    for(let i = 0; i < numCarriers; i++)
        cn[i] = (i + 1).toString();

    _machine = {
        name: name,
        width: needles,
        gauge: gauge,
        presser: presser,
        position: position,
        stitchNumber: defaultStitchNumber,
        carrierNames: cn,
        racking: 0,
        beds: {
            f: this.createBed(needles),
            b: this.createBed(needles)
        }
    };
}

exports.initKnit = function(name, wales, courses, left = 1) {
    _name = name;
    _wales = wales;
    _courses = courses;
    _left = left;
    _right = left + wales;
}

exports.writeHeader = function() {

    k.addHeader('Machine', _machine.name);
    k.addHeader('Width', _machine.width.toString());
    k.addHeader('Gauge', _machine.gauge.toString());
    k.addHeader('Position', _machine.position);
    k.fabricPresser(_machine.presser);
    k.stitchNumber(_machine.stitchNumber);
}

exports.inhook = function(c) {
    k.inhook(c.desc);
    c.pos = _machine.width; //TODO: doublecheck if this is reasonable to set
}

exports.releasehook = function(c) {
    k.releasehook(c.desc);
}

exports.outhook = function(c) {
    k.outhook(c.desc);
}

exports.xfer = function(nOld, nNew) {
    k.xfer(nOld, nNew);
}

exports.rack = function(offset) {
    k.rack(offset);
    _machine.racking = offset;
}

exports.tuck = function(dir, b, n, c) {
    k.tuck(getDirSign(dir), b + n, c.desc);

    //TODO: add racking value if back bed needle
    //TODO: figure out if 0.5 is a reasonable value to add
    c.pos = n + dir * 0.5; 
}

exports.knit = function(dir, b, n, c) {
    k.knit(getDirSign(dir), b + n, c.desc);

    //TODO: add racking value if back bed needle
    //TODO: figure out if 0.5 is a reasonable value to add
    c.pos = n + dir * 0.5; 
}

exports.miss = function(dir, b, n, c) {
    k.miss(getDirSign(dir), b + n, c.desc);

    //TODO: add racking value if back bed needle
    //TODO: figure out if 0.5 is a reasonable value to add
    c.pos = n + dir * 0.5; 
}

exports.drop = function(n) {
    k.drop(n);
}

exports.setStitchNumber = function(nr) {
    k.stitchNumber(nr);
}

exports.comment = function(text) {
    k.comment(text);
}

exports.createKnitout = function() {
    k = new knitout.Writer({ carriers: _machine.carrierNames });
    this.writeHeader();
}

exports.writeKnitout = function(fileName) {
    k.write(fileName);
}

exports.makeCarrier = function(carrierID, carrierName, stitchNumber = undefined){

    let desc = carrierID.toString();

    let found = _machine.carrierNames.find(element => element == desc);
    if(!found)
        console.warn("WARNING: carrier with name '" + carrierName + "' not found in machine");

    if(stitchNumber == undefined)
        stitchNumber = parseInt(carrierID) + 10;

    let c = {
        ID:     carrierID,
        desc:   desc,
        name:   carrierName,
        //isLeft: false,
        pos:    Infinity,
        stitchNumber: stitchNumber,
        courseCntr: 0,
        isIn:   false
    };

    this.comment("carrier #" + c.ID + " ('" + c.desc + "') \"" + c.name + "\" w/ default stitch number " + c.stitchNumber);

    return c;
}

exports.bringIn = function(c, l = _right + _bringInOffset, r = _right + _bringInOffset + _bringInWales) {

    if(c.isIn) {
        console.warn("WARNING: carrier " + c.desc + " already brought in -- skipping...");
        return;
    }

    this.comment("bringin carrier with name \"" + c.name + "\"");

    this.comment("knitting bringin-dummy for carrier " + c.desc);
    this.inhook(c);

    let pos = Math.floor( r / 2 ) * 2;    
    while(pos >= l) {
        this.tuck(LEFT, 'f', pos, c);
        pos -= 2;
    }

    if(pos + 2 == l) {
        pos += 3;
    } else {
        pos = l;
    }

    while(pos <= r) {
        this.tuck(RIGHT, 'f', pos, c);
        pos += 2;
    }

    pos = r;
    while(pos >= l) {
        this.knit(LEFT, 'f', pos, c);
        pos--;
    }
    
    this.releasehook(c);
    
    //c.isIn = true;
    _bringInInfo = {
        left:   l,
        right:  r,
        cID:    c.ID
    };

    this.comment("bringin done");
}

exports.dropBringIn = function() {

    if(typeof _bringInInfo === 'undefined') {
        return;
    }

    this.comment("dropping bringin of carrier " + _bringInInfo.cID + " needles " + _bringInInfo.left + " -> " + _bringInInfo.right);

    for(let i = _bringInInfo.left; i <= _bringInInfo.right; i++)
        this.drop("f" + i);

    _bringInInfo = undefined;
}

exports.out = function(c) {
    if(!c.isIn) {
        console.warn("WARNING: carrier " + c.desc + " was not in use -- skipping...");
        return;
    }
    this.outhook(c);
    //c.isIn = false;
    c.pos = Infinity;
}
/*
exports.knitCourse = function(c, execFunc, l = _left, r = _right, turn = true, stitchNumberOverride = undefined) {
    if(typeof(stitchNumberOverride)==='undefined')
        k.stitchNumber(c.stitchNumber);
    else
        k.stitchNumber(stitchNumberOverride);

    if(c.isLeft) {
        for(let i = l; i <= r; i++) {
            execFunc(c, i,'+');
        }
    } else {
        for(let i = r; i >= l; i--) {
            execFunc(c, i,'-');
        }
    }
    if(turn) {
        c.isLeft = !c.isLeft;
        c.courseCntr++;
    }
}
*/
exports.castOff = function(c, l = _left, r = _right, stitchNumber = _machine.stitchNumber, frontBed = true) {
    
    this.setStitchNumber(stitchNumber);

    let bed = frontBed ? "f" : "b";
    let oppBed = frontBed ? "b" : "f";

    let cntr = 0;

    let center = (r + l) / 2;

    if(c.pos < center) {
    //if(c.isLeft) {
        let dir = RIGHT;
        let invDir = LEFT;

        for(let i = l; i < r; i++) {
            this.rack(0);
            if(cntr % 2)
                this.knit(invDir, bed, i, c);
            else {
                this.knit(dir, bed, i, c);
                this.miss(dir, bed, (i + 1), c);
            }
            this.xfer(bed + i, oppBed + i);
            this.rack(1);
            this.xfer(oppBed + i, bed + (i + 1));
        }
        this.knit(cntr % 2 ? invDir : dir, bed, r, c);
        this.drop(bed + r);
        this.rack(0);
    } else {
        let dir = LEFT;
        let invDir = RIGHT;

        for(let i = r; i > l; i--, cntr++) {
            this.rack(0);
            if(cntr % 2)
                this.knit(invDir, bed, i, c);
            else {
                this.knit(dir, bed, i, c);
                this.miss(dir, bed, (i - 1), c);
            }
            this.xfer(bed + i, oppBed + i);
            this.rack(-1);
            this.xfer(oppBed + i, bed + (i - 1));
        }
        this.knit(cntr % 2 ? invDir : dir, bed, l, c);
        this.drop(bed + l);
        this.rack(0);
    }
}
