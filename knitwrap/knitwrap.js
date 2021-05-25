#!/usr/bin/env node

/*
v2
*/

"use strict";

const LEFT = -1;
const RIGHT = 1;

var KnitOutWrapper = function() {

    function getDirSign(dir) {
        return (dir == LEFT ? '-' : (dir == RIGHT ? '+' : undefined));
    }

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

    this.makeCarrier = function(name, stitchNumber = undefined){

        if(stitchNumber == undefined)
            stitchNumber = parseInt(name) + 10;
    
        let c = {
            name:   name,
            pos:    Infinity,
            stitchNumber: stitchNumber,
            courseCntr: 0,
            isIn:   false
        };
    
        return c;
    }

    this.initKnitout = function(machineDesc, position = "Keep") {

        if(machineDesc == undefined)
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

    this.inhook = function(c) {
        this.k.inhook(c.name);
        c.pos = this.machine.width; //TODO: doublecheck if this is reasonable to set
    }
    
    this.releasehook = function(c) {
        this.k.releasehook(c.name);
    }
    
    this.outhook = function(c) {
        this.k.outhook(c.name);
    }
    
    this.xfer = function(nOld, nNew) {
        this.k.xfer(nOld, nNew);
    }
    
    this.rack = function(offset) {
        this.k.rack(offset);
        this.machine.racking = offset;
    }
    
    this.tuck = function(dir, b, n, c) {
        this.k.tuck(getDirSign(dir), b + n, c.name);
    
        //TODO: add racking value if back bed needle
        //TODO: figure out if 0.5 is a reasonable value to add
        c.pos = n + dir * 0.5; 
    }
    
    this.knit = function(dir, b, n, c) {
        this.k.knit(getDirSign(dir), b + n, c.name);
    
        //TODO: add racking value if back bed needle
        //TODO: figure out if 0.5 is a reasonable value to add
        c.pos = n + dir * 0.5; 
    }
    
    this.miss = function(dir, b, n, c) {
        this.k.miss(getDirSign(dir), b + n, c.name);
    
        //TODO: add racking value if back bed needle
        //TODO: figure out if 0.5 is a reasonable value to add
        c.pos = n + dir * 0.5; 
    }
    
    this.drop = function(n) {
        this.k.drop(n);
    }
    
    this.setStitchNumber = function(nr) {
        this.k.stitchNumber(nr);
    }
    
    this.comment = function(text) {
        this.k.comment(text);
    }
    
    this.write = function(fileName) {
        this.k.write(fileName);
    }

    this.bringIn = function(c, l, r) {

        if(c.isIn) {
            console.warn("WARNING: carrier " + c.name + " already brought in -- skipping...");
            return;
        }
    
        this.comment("bringin carrier with name \"" + c.name + "\"");
    
        this.comment("knitting bringin-dummy for carrier " + c.name);
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
        
        this.bringInInfo = {
            left:   l,
            right:  r,
            cName:  c.name
        };
    
        this.comment("bringin done");
    }
    
    this.dropBringIn = function() {
    
        if(typeof this.bringInInfo === 'undefined') {
            return;
        }
    
        this.comment("dropping bringin of carrier " + this.bringInInfo.cName + " needles " + this.bringInInfo.left + " -> " + this.bringInInfo.right);
    
        for(let i = this.bringInInfo.left; i <= this.bringInInfo.right; i++)
            this.drop("f" + i);
    
        this.bringInInfo = undefined;
    }
    
    this.out = function(c) {
        if(!c.isIn) {
            console.warn("WARNING: carrier " + c.name + " was not in use -- skipping...");
            return;
        }
        this.outhook(c);
        //c.isIn = false;
        c.pos = Infinity;
    }

    this.castOff = function(c, l, r, frontBed = true, stitchNumber = undefined) {
    
        if(!stitchNumber)
            this.setStitchNumber(this.machine.stitchNumber);
    
        let bed = frontBed ? "f" : "b";
        let oppBed = frontBed ? "b" : "f";
    
        let cntr = 0;
        let center = (r + l) / 2;
    
        if(c.pos < center) {
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
}

// browser-compatibility
if(typeof(module) !== 'undefined'){
    module.exports.KnitOutWrapper = KnitOutWrapper;
	module.exports.LEFT = LEFT;
    module.exports.RIGHT = RIGHT;
}
