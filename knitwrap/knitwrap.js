#!/usr/bin/env node

/*
v2
*/

"use strict";

const LEFT = -1;
const RIGHT = 1;

const DROPOFF_MOVEMENTS = 6;

var KnitOutWrapper = function() {

    /**
     * 
     * @param {Number} dir use LEFT or RIGHT const values
     * @returns String '-' for LEFT and '+' for RIGHT, undefined otherwise
     */
    function getDirSign(dir) {
        return (dir === LEFT ? '-' : (dir === RIGHT ? '+' : undefined));
    }

    /**
     * 
     * @param {String} b bed specifier (use 'b' or 'f')
     * @returns String specifier of opposite bed ('f' or 'b'); returns undefined when b has invalid value
     */
    function getOpposite(b) {
        return (b === 'b' ? 'f' : (b === 'f' ? 'b' : undefined));
    }

    /**
     * 
     * @param {Number} needles needle count of bed
     * @returns newly created bed object
     */
    var createBed = function(needles) {
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
    this.k = undefined;

    this.bringInInfo = undefined;

    /**
     * 
     * @param {String} name carrier identifier
     * @param {Number} stitchNumber default stitch number when using this carrier
     * @returns 
     */
    this.makeCarrier = function(name){

        let c = {
            name:   name,
            pos:    Infinity,
            courseCntr: 0,
            isIn:   false
        };
    
        return c;
    }

    /**
     * 
     * @param {*} machineDesc machine description
     * @param {String} position knitout pattern position, defaults to "Keep"
     */
    this.initKnitout = function(machineDesc, position = "Keep") {

        if(machineDesc === undefined)
            machineDesc = defaultShima();

        let cn = new Array(machineDesc.numCarriers);
        let c = {};
        for(let i = 0; i < machineDesc.numCarriers; i++) {
            cn[i] = (i + 1).toString();
            c[cn[i]] = this.makeCarrier(cn[i]);
        }
    
        this.machine = {
            name: machineDesc.name,
            width: machineDesc.width,
            gauge: machineDesc.gauge,
            presser: machineDesc.presser,
            //hook: undefined,  //TODO: set and unset yarn held by inserting hook(s?)
            stitchNumber: machineDesc.defaultStitchNumber,
            racking: 0,
            beds: {
                f: createBed(machineDesc.width),
                b: createBed(machineDesc.width)
            },
            carriers: c
        };

        const knitout = require('knitout');
        this.k = new knitout.Writer({ carriers: cn });
    
        this.k.addHeader('Machine', this.machine.name);
        this.k.addHeader('Width', this.machine.width.toString());
        this.k.addHeader('Gauge', this.machine.gauge.toString());
        this.k.addHeader('Position', position);
        this.k.fabricPresser(this.machine.presser);
        this.k.stitchNumber(this.machine.stitchNumber);
    }

    /**
     * 
     * @param {*} c carrier object
     */
    this.inhook = function(c) {
        this.k.inhook(c.name);
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
        this.k.releasehook(c.name);
        c.isHookReleased = true;

        //this.machine.hook = ...;  //TODO: unset yarn held by inserting hook(s?)
    }
    
    /**
     * 
     * @param {*} c carrier object
     */
    this.outhook = function(c) {

        //apparently, racking needs to be 0 (quater-pitch also allowed?)
        // for outhook, otherwise KnitPaint generates an error -- set to 
        // 0, temporarily and restore afert outhook
        let prevRacking = undefined;
        if(this.machine.racking != 0) {
            this.rack(0);
        }

        this.k.outhook(c.name);
        c.isIn = false;

        if(prevRacking !== undefined) {
            this.rack(prevRacking);
        }
    }
    
    /**
     * 
     * @param {String} b0 bed identifier of old position ('b' or 'f')
     * @param {Number} n0 needle number of old position
     * @param {Number} n1 needle number of new position
     */
    this.xfer = function(b0, n0, n1) {
        this.k.xfer(b0 + n0, getOpposite(b0) + n1);
    }
    
    /**
     * 
     * @param {Number} offset racking offset, specified in needle pitch
     */
    this.rack = function(offset) {
        this.k.rack(offset);
        this.machine.racking = offset;
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

        this.k.tuck(getDirSign(dir), b + n, str);
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

        if(arg)
            this.k.knit(getDirSign(dir), b + n, arg);
        else
            this.k.knit(getDirSign(dir), b + n);
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

        this.k.miss(getDirSign(dir), b + n, str);
    }
    
    /**
     * 
     * @param {String} b bed identifier ('b' or 'f')
     * @param {Number} n needle number
     */
    this.drop = function(b, n) {
        this.k.drop(b + n);
    }

    /**
     * 
     * @param {Number} dir use LEFT or RIGHT const values
     * @param {*} b0 
     * @param {*} n0 
     * @param {*} n1 
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

        this.k.split(getDirSign(dir), b0 + n0, b1 + n1, str);
    }
    
    /**
     * 
     * @param {Number} nr stitch number to set (index into machine specific LUT)
     */
    this.setStitchNumber = function(nr) {
        this.k.stitchNumber(nr);
    }

    /**
     * 
     * @param {*} c carrier object
     * @param {Number} l needle number for leftmost bringin loop
     * @param {Number} r needle number for rightmost bringin loop
     * @returns 
     */
    this.bringIn = function(c, l, r) {

        if(c.isIn) {
            console.warn("WARNING: carrier " + c.name + " already brought in -- skipping...");
            return;
        }
    
        this.comment("bringin carrier with name \"" + c.name + "\"");
    
        this.comment("knitting bringin-dummy for carrier " + c.name);
        this.inhook(c);
    
        if(l !== undefined && r !== undefined) {
            let pos = Math.floor( r / 2 ) * 2;    
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
            
            this.bringInInfo = {
                left:   l,
                right:  r,
                cName:  c.name
            };
        }
    
        this.comment("bringin done");
    }
    
    /**
     * 
     * @returns 
     */
    this.dropBringIn = function() {
    
        if(typeof this.bringInInfo === 'undefined') {
            return;
        }
    
        this.comment("dropping bringin of carrier " + this.bringInInfo.cName + " needles " + this.bringInInfo.left + " -> " + this.bringInInfo.right);
    
        for(let i = this.bringInInfo.left; i <= this.bringInInfo.right; i++)
            this.drop("f", i);
    
        this.bringInInfo = undefined;
    }
    
    /**
     * 
     * @param {*} c carrier object
     * @returns 
     */
    this.out = function(c) {
        if(!c.isIn) {
            console.warn("WARNING: carrier " + c.name + " was not in use -- skipping...");
            return;
        }
        this.outhook(c);
        c.pos = Infinity;
    }

    /**
     * 
     * @param {*} c carrier object
     * @param {Number} l number of leftmost needle
     * @param {Number} r number of rightmost needle
     * @param {Boolean} frontBed specify if front bed is used
     * @param {Number} stitchNumber stitch nuber to set (leave undefined keeps current stitch number)
     */
    this.castOff = function(c, l, r, frontBed = true, stitchNumber = undefined) {

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

            this.out(c);
            this.drop(bed, l - 1);
        } else {
            dir = LEFT;
            invDir = RIGHT;
    
            for(let i = r; i >= l; i--) {
                this.knit(dir, 'f', i, c);
            }

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

            this.out(c);
            this.drop(bed, r + 1);
        }
        this.rack(0);
    }

    this.dropOff = function(l, r, movements = DROPOFF_MOVEMENTS) {
        this.rack(0.25);
        this.comment(movements + " empty carrier movements");

        //TODO: find out what best option would actually be, figure out current carriage position?
        let d = LEFT; 

        for(let j = 0; j < movements; j++) {
            if(d == RIGHT) {
                for(let i = l; i <= r; i++) {
                    this.knit(d, 'f', i);
                    this.knit(d, 'b', i);
                }
            } else {
                for(let i = r; i >= l; i--) {
                    this.knit(d, 'b', i);
                    this.knit(d, 'f', i);
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
        this.k.comment(text);
    }
    
    /**
     * 
     * @param {String} fileName filename or path to file
     */
    this.write = function(fileName) {
        this.k.write(fileName);
    }
}

// browser-compatibility
if(typeof(module) !== 'undefined'){
    module.exports.KnitOutWrapper = KnitOutWrapper;
	module.exports.LEFT = LEFT;
    module.exports.RIGHT = RIGHT;
}
