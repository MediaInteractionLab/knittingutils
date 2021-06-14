#!/usr/bin/env node

/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) 2021 Media Interaction Lab
 *  Licensed under the MIT License. See LICENSE file in the package root for license information.
*/

"use strict";

const LEFT = -1;
const RIGHT = 1;

const DROPOFF_MOVEMENTS = 6;

var getNames = function(cs) {
    let names = [];
    if(Array.isArray(cs)) {
        cs.forEach( c => { names.push(c.name); });
    } else {
        if(cs)
            names.push(cs.name);
    }
    return names;
}

var KnitoutWrapper = function() {

    /**
     * 
     * @param {Number} dir use LEFT or RIGHT const values
     * @returns String '-' for LEFT and '+' for RIGHT, undefined otherwise
     */
     var getDirSign = function(dir) {
        return (dir === LEFT ? '-' : (dir === RIGHT ? '+' : undefined));
    }

    /**
     * 
     * @param {String} b bed specifier (use 'b' or 'f')
     * @returns String specifier of opposite bed ('f' or 'b'); returns undefined when b has invalid value
     */
    var getOpposite = function(b) {
        return (b === 'b' ? 'f' : (b === 'f' ? 'b' : undefined));
    }

    /**
     * 
     * @param {Number} needles needle count of bed
     * @returns newly created bed object
     */
    var createBed = function(needles) {
        let bed = {};

        bed.needles = new Array(needles);
        bed.sliders = new Array(needles);
        for(let i = 0; i < needles; i++) {
            bed.needles[i] = [];
            bed.sliders[i] = [];
        }
        bed.leftmost = Infinity;
        bed.rightmost = -Infinity;

        return bed;
    }

    /**
     * 
     * @returns Shima N2 description
     */
    var defaultShima = function() {
        return {
            name: 'SWG061N2',
            width: 360, 
            gauge: 15, 
            numCarriers: 10,
            defaultStitchNumber: 1,
            presser: 'auto'
        };
    }

    this.machine = undefined;

    let k = undefined;
    let bringInInfo = undefined;

    /**
     * 
     * @param {String} name carrier identifier
     * @param {Number} stitchNumber default stitch number when using this carrier
     * @returns instance of newly created carrier object
     */
    var makeCarrier = function(name){

        let c = {
            name:   name,
            pos:    Infinity,
            courseCntr: 0,
            isIn:   false
        };
    
        return c;
    }

    let setLoops = function(b, n, names) {
        this.machine.beds[b].needles[n - 1] = [];
        addLoops(b, n, names);
    }.bind(this);

    let getLoops = function(b, n) {
        return this.machine.beds[b].needles[n - 1];
    }.bind(this);

    let addLoops = function(b, n, names) {
        if(Array.isArray(names)) {
            names.forEach( name => { this.machine.beds[b].needles[n - 1].push(name); });
        } else if(names !== undefined) {
            this.machine.beds[b].needles[n - 1].push(names);
        }
    }.bind(this);

    /**
     * 
     * @param {*} machineDesc machine description
     * @param {String} position knitout pattern position, defaults to "Keep"
     */
    this.initKnitout = function(machineDesc, position = "Keep") {

        if(machineDesc === undefined)
            machineDesc = defaultShima();

        let names = new Array(machineDesc.numCarriers);
        let cs = {};
        for(let i = 0; i < machineDesc.numCarriers; i++) {
            names[i] = (i + 1).toString();
            cs[names[i]] = makeCarrier(names[i]);
        }
    
        this.machine = {
            name: machineDesc.name,
            width: machineDesc.width,
            gauge: machineDesc.gauge,
            presser: machineDesc.presser,
            //hook: undefined,  //TODO: set and unset yarn held by inserting hook(s?)
            stitchNumber: machineDesc.defaultStitchNumber,
            speedNumber: 0,
            racking: 0,
            beds: {
                f: createBed(machineDesc.width),
                b: createBed(machineDesc.width)
            },
            carriers: cs
        };

        const knitout = require('knitout');
        k = new knitout.Writer({ carriers: names });
    
        k.addHeader('Machine', this.machine.name);
        k.addHeader('Width', this.machine.width.toString());
        k.addHeader('Gauge', this.machine.gauge.toString());
        k.addHeader('Position', position);
        k.fabricPresser(this.machine.presser);
        k.stitchNumber(this.machine.stitchNumber);
        k.speedNumber(this.machine.speedNumber);
    }

    /**
     * 
     * @param {*} c carrier object
     */
    this.inhook = function(c) {
        k.inhook(c.name);
        c.pos = this.machine.width; //TODO: doublecheck if this is reasonable to set
        //this.machine.hook = ...;  //TODO: set yarn held by inserting hook(s?)
        c.isIn = true;
        c.isHookReleased = false;
    }
    
    /**
     * 
     * @param {*} c carrier object
     */
    this.releasehook = function(c) {
        k.releasehook(c.name);
        c.isHookReleased = true;

        //this.machine.hook = ...;  //TODO: unset yarn held by inserting hook(s?)
    }
    
    /**
     * 
     * @param {*} c carrier object
     */
    this.outhook = function(c) {

        if(!c.isIn) {
            console.warn("WARNING: carrier " + c.name + " was not in use -- skipping...");
            return;
        }

        //apparently, racking needs to be 0 (quater-pitch also allowed?)
        // for outhook, otherwise KnitPaint generates an error -- set to 
        // 0, temporarily and restore afert outhook
        let prevRacking = undefined;
        if(this.machine.racking != 0) {
            k.comment("racking to 0 for outhook");
            prevRacking = this.machine.racking;
            this.rack(0);            
        }

        k.outhook(c.name);
        c.isIn = false;
        c.pos = Infinity;

        if(prevRacking !== undefined) {
            this.rack(prevRacking);
        }
    }
    
    /**
     * 
     * @param {Number} offset racking offset, specified in needle pitch
     * @param {Boolean} force set to true if you want to skip redundancy-check
     */
    this.rack = function(offset, force = false) {
        if(this.machine.racking !== offset || force) {
            k.rack(offset);
            this.machine.racking = offset;
        }
    }
    
    /**
     * 
     * @param {Number} dir use LEFT or RIGHT const values
     * @param {String} b bed identifier ('b' or 'f')
     * @param {Number} n needle number
     * @param {*} cs single carrier object or carrier set (for plating; pass as array of carrier objects)
     */
    this.knit = function(dir, b, n, cs) {
        let arg = '';
        if(Array.isArray(cs)) {
            if(cs.length) {
                cs.forEach(c => {
                    arg += c.name + ' ';
                
                    //TODO: add racking value if back bed needle
                    //TODO: figure out if 0.5 is a reasonable value to add
                    c.pos = n + dir * 0.5; 
                });
                arg = arg.trim();
            } else {
                arg = undefined;
            }
        } else {
            if(cs) {
                arg = cs.name;

                //TODO: add racking value if back bed needle
                //TODO: figure out if 0.5 is a reasonable value to add
                cs.pos = n + dir * 0.5; 
            } else {
                arg = undefined;
            }
        }

        this.machine.beds[b].leftmost = Math.min(this.machine.beds[b].leftmost, n);
        this.machine.beds[b].rightmost = Math.max(this.machine.beds[b].rightmost, n);
 
        if(arg)
            k.knit(getDirSign(dir), b + n, arg);
        else
            k.knit(getDirSign(dir), b + n);

        setLoops(b, n, getNames(cs));
    }
    
    /**
     * 
     * @param {Number} dir use LEFT or RIGHT const values
     * @param {String} b bed identifier ('b' or 'f')
     * @param {Number} n needle number
     * @param {*} cs single carrier object or carrier set (for plating; pass as array of carrier objects)
     */
    this.tuck = function(dir, b, n, cs) {
        let str = '';
        if(Array.isArray(cs)) {
            cs.forEach(c => {
                str += c.name + ' ';
            
                //TODO: add racking value if back bed needle
                //TODO: figure out if 0.5 is a reasonable value to add
                c.pos = n + dir * 0.5; 
            });
            str = str.trim();
        } else {
            str = cs.name;

            //TODO: add racking value if back bed needle
            //TODO: figure out if 0.5 is a reasonable value to add
            cs.pos = n + dir * 0.5; 
        }

        this.machine.beds[b].leftmost = Math.min(this.machine.beds[b].leftmost, n);
        this.machine.beds[b].rightmost = Math.max(this.machine.beds[b].rightmost, n);

        k.tuck(getDirSign(dir), b + n, str);

        addLoops(b, n, getNames(cs));
    }
    
    /**
     * 
     * @param {Number} dir use LEFT or RIGHT const values
     * @param {String} b bed identifier ('b' or 'f')
     * @param {Number} n needle number
     * @param {*} cs single carrier object or carrier set (for plating; pass as array of carrier objects)
     */
    this.miss = function(dir, b, n, cs) {
        let str = '';
        if(Array.isArray(cs)) {
            cs.forEach(c => {
                str += c.name + ' ';
            
                //TODO: add racking value if back bed needle
                //TODO: figure out if 0.5 is a reasonable value to add
                c.pos = n + dir * 0.5; 
            });
            str = str.trim();
        } else {
            str = cs.name;

            //TODO: add racking value if back bed needle
            //TODO: figure out if 0.5 is a reasonable value to add
            cs.pos = n + dir * 0.5; 
        }

        this.machine.beds[b].leftmost = Math.min(this.machine.beds[b].leftmost, n);
        this.machine.beds[b].rightmost = Math.max(this.machine.beds[b].rightmost, n);
 
        k.miss(getDirSign(dir), b + n, str);
    }
    
    /**
     * 
     * @param {String} b0 bed identifier of old position ('b' or 'f')
     * @param {Number} n0 needle number of old position
     * @param {Number} n1 needle number of new position
     */
     this.xfer = function(b0, n0, n1) {
        let b1 = getOpposite(b0);
        k.xfer(b0 + n0, b1 + n1);

        addLoops(b1, n1, getLoops(b0, n0));
        setLoops(b0, n0, []);
    }

    /**
     * 
     * @param {Number} dir use LEFT or RIGHT const values
     * @param {String} b0 
     * @param {Number} n0 
     * @param {Number} n1 
     * @param {*} cs 
     */
    this.split = function(dir, b0, n0, n1, cs) {

        let b1 = getOpposite(b0);

        let str = '';
        if(Array.isArray(cs)) {
            cs.forEach(c => {
                str += c.name + ' ';
            
                //TODO: add racking value if back bed needle
                //TODO: figure out if 0.5 is a reasonable value to add
                c.pos = n0 + dir * 0.5; 
            });
            str = str.trim();
        } else {
            str = cs.name;

            //TODO: add racking value if back bed needle
            //TODO: figure out if 0.5 is a reasonable value to add
            cs.pos = n0 + dir * 0.5; 
        }

        this.machine.beds[b0].leftmost = Math.min(this.machine.beds[b0].leftmost, n0, n1);
        this.machine.beds[b0].rightmost = Math.max(this.machine.beds[b0].rightmost, n0, n1);

        k.split(getDirSign(dir), b0 + n0, b1 + n1, str);

        addLoops(b1, n1, getLoops(b0, n0));
        setLoops(b0, n0, getNames(cs));
    }
    
    /**
     * 
     * @param {String} b bed identifier ('b' or 'f')
     * @param {Number} n needle number
     */
    this.drop = function(b, n) {
        k.drop(b + n);

        setLoops(b, n, []);
    }
    
    /**
     * 
     * @param {Number} nr stitch number to set (index into machine specific LUT)
     * @param {Boolean} force set to true if you want to skip redundancy-check
     */
    this.setStitchNumber = function(nr, force = false) {
        if(this.machine.stitchNumber !== nr || force) {
            k.stitchNumber(nr);
            this.machine.stitchNumber = nr;
        }
    }

    /**
     * 
     * @param {Number} nr speed number to set (index into machine specific LUT)
     * @param {Boolean} force set to true if you want to skip redundancy-check
     */
     this.setSpeedNumber = function(nr, force = false) {
        if(this.machine.speedNumber !== nr || force) {
            k.speedNumber(nr);
            this.machine.speedNumber = nr;
        }
    }

    /**
     * 
     * @param {*} c carrier object
     * @param {Number} l needle number for leftmost bringin loop
     * @param {Number} r needle number for rightmost bringin loop
     * @param {Number} stitchNumber 
     */
    this.bringIn = function(c, stitchNumber, l, r) {

        if(c.isIn) {
            console.warn("WARNING: carrier " + c.name + " already brought in -- skipping...");
            return;
        }
    
        this.comment("bringin carrier with name \"" + c.name + "\"");
    
        this.comment("knitting bringin-dummy for carrier " + c.name);
    
        if(stitchNumber)
            this.setStitchNumber(stitchNumber);

        this.inhook(c);
    
        if(l !== undefined && r !== undefined) {

            let pos = r;
            while(pos >= l) {
                this.tuck(LEFT, 'f', pos, c);
                pos -= 2;
            }
        
            if(pos + 2 === l) {
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
            
            bringInInfo = {
                left:   l,
                right:  r,
                cName:  c.name
            };
        }
    
        this.comment("bringin done");
    }
    
    /**
     * 
     */
    this.dropBringIn = function() {
    
        if(typeof bringInInfo === 'undefined') {
            return;
        }
    
        this.comment("dropping bringin of carrier " + bringInInfo.cName + " needles " + bringInInfo.left + " -> " + bringInInfo.right);
    
        for(let i = bringInInfo.left; i <= bringInInfo.right; i++)
            this.drop("f", i);
    
        bringInInfo = undefined;
    }

    /**
     * 
     * @param {*} c carrier object
     * @param {Number} l left needle
     * @param {Number} r right needle
     * @param {Number} stitchNumber optional stitchnumber override for caston
     * @param {Boolean} frontBed set true to cast on at front bed, set false to cast on at back bed
     */
    this.castOn = function(c, l, r, stitchNumber = undefined, frontBed = true) {

        this.comment("knitting cast on with carrier " + c.name);

        let bed = (frontBed ? 'f' : 'b');
    
        if(stitchNumber)
            this.setStitchNumber(stitchNumber);
    
        let pos = Math.floor(r / 2) * 2;    
        while(pos >= l) {
            this.tuck(LEFT, bed, pos, c);
            pos -= 2;
        }
    
        if(pos + 2 === l) {
            pos += 3;
        } else {
            pos = l;
        }
    
        while(pos <= r) {
            this.tuck(RIGHT, bed, pos, c);
            pos += 2;
        }
    }

    /**
     * 
     * @param {*} c carrier object
     * @param {Number} l number of leftmost needle
     * @param {Number} r number of rightmost needle
     * @param {Boolean} frontBed specify if front bed is used
     * @param {Number} stitchNumber stitch nuber to set (leave undefined keeps current stitch number)
     */
    this.castOff = function(c, l, r, stitchNumber = undefined, frontBed = true) {

        this.comment("cast off");
    
        if(stitchNumber)
            this.setStitchNumber(stitchNumber);
    
        let bed = frontBed ? "f" : "b";
        let oppBed = frontBed ? "b" : "f";
    
        let cntr = 0;
        let center = (r + l) / 2;

        let dir = undefined;
        let invDir = undefined;

        this.rack(0);
        for(let i = l; i <= r; i++) {
            this.xfer('b', i, i);
        }

        if(c.pos < center) {
            dir = RIGHT;
            invDir = LEFT;

            for(let i = l; i <= r; i++) {
                this.knit(dir, 'f', i, c);
            }

            dir *= -1;
            invDir *= -1;
    
            this.knit(dir, bed, r, c);
            for(let i = r; i >= l; i--, cntr++) {
                this.rack(0);
                if(cntr % 2)
                    this.knit(invDir, bed, i, c);
                else {
                    this.knit(dir, bed, i, c);
                    this.miss(dir, bed, (i - 1), c);
                }
                this.xfer(bed, i, i);
                this.rack(-1);
                this.xfer(oppBed, i, (i - 1));
            }
            this.knit(cntr % 2 ? invDir : dir, bed, l - 1, c);
            for(let i = 0; i < 5; i++)
                this.knit(cntr % 2 ? dir : invDir, bed, l - 1, c);

            //NOTE: have to outhook *before* dropping, otherwise dropped textile hangs just on
            // the yarn and pulls on the yarn carrier, causing the bindoff to unravel/break.
            this.outhook(c);
            this.drop(bed, l - 1);
        } else {
            dir = LEFT;
            invDir = RIGHT;
    
            for(let i = r; i >= l; i--) {
                this.knit(dir, 'f', i, c);
            }

            dir *= -1;
            invDir *= -1;

            this.knit(dir, bed, l, c);
            for(let i = l; i <= r; i++, cntr++) {
                this.rack(0);
                if(cntr % 2)
                    this.knit(invDir, bed, i, c);
                else {
                    this.knit(dir, bed, i, c);
                    this.miss(dir, bed, (i + 1), c);
                }
                this.xfer(bed, i, i);
                this.rack(1);
                this.xfer(oppBed, i, (i + 1));
            }
            this.knit(cntr % 2 ? invDir : dir, bed, r + 1, c);
            for(let i = 0; i < 5; i++)
                this.knit(cntr % 2 ? dir : invDir, bed, r + 1, c);

            //NOTE: have to outhook *before* dropping, otherwise dropped textile hangs just on
            // the yarn and pulls on the yarn carrier, causing the bindoff to unravel/break.
            this.outhook(c);
            this.drop(bed, r + 1);
        }
        this.rack(0);
    }

    /**
     * Knits a number of rows without yarn feeder so fabric comes out of machine easier. Should 
     * obviously be called when castoff was done.
     * @param {*} l 
     * @param {*} r 
     * @param {*} movements 
     */
    this.dropOff = function(l, r, movements = DROPOFF_MOVEMENTS) {
        this.rack(0.25);
        this.comment(movements + " empty carrier movements");

        if(l === undefined)
            l = Math.min(this.machine.beds.f.leftmost, this.machine.beds.b.leftmost);
        if(r === undefined)
            r = Math.max(this.machine.beds.f.rightmost, this.machine.beds.b.rightmost);

        //TODO: find out what best option would actually be, figure out current carriage position?
        let d = LEFT; 

        for(let j = 0; j < movements; j++) {
            if(d == RIGHT) {
                for(let i = l; i <= r; i++) {
                    this.knit(d, 'f', i, undefined);
                    this.knit(d, 'b', i, undefined);
                }
            } else {
                for(let i = r; i >= l; i--) {
                    this.knit(d, 'b', i, undefined);
                    this.knit(d, 'f', i, undefined);
                }
            }
            d *= -1;
        }
        this.rack(0);
    }

    /**
     * 
     * @param {String} text comment to write to file
     */
    this.comment = function(text) {
        k.comment(text);
    }

    /**
     * 
     * @param {*} comment 
     */
    this.pause = function(comment) {
        k.pause(comment);
    }
    
    /**
     * 
     * @param {String} fileName filename or path to file
     */
    this.write = function(fileName) {
        k.write(fileName);
    }

    this.printNeedleStatus = function() {

        let prefix = "bed ";
        ['f', 'b'].forEach( b => {
            let leftmost = Infinity;
            let rightmost = -Infinity;

            let maxLoopCount = 0;

            this.machine.beds[b].needles.forEach( function(n, i) { 
                if(n.length > 0) {
                    rightmost = i + 1;
                    if(leftmost === Infinity)
                        leftmost = i + 1;
                    maxLoopCount = Math.max(maxLoopCount, n.length);
                }
            } );

            if(maxLoopCount) {
                let descStr = prefix + b + ": needles [" + leftmost + " thru " + rightmost + "]: ";

                for(let j = 0; j < maxLoopCount; j++) {
                    let needleString = "";
                    for(let i = leftmost; i <= rightmost; i++) {
                        if(j < this.machine.beds[b].needles[i - 1].length)
                            needleString += this.machine.beds[b].needles[i - 1][j] + ' ';
                        else
                            needleString += '  ';
                    }

                    console.log(descStr + needleString);
                    descStr = ' '.repeat(descStr.length);
                }
            } else {
                console.log(prefix + b + ": no needles currently holding any yarn");
            }
            prefix = "    ";
        });
    }
}

// browser-compatibility
if(typeof(module) !== 'undefined'){
    module.exports.KnitoutWrapper = KnitoutWrapper;
	module.exports.LEFT = LEFT;
    module.exports.RIGHT = RIGHT;
}