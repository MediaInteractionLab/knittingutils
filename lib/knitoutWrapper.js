#!/usr/bin/env node

/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) 2021 Media Interaction Lab
 *  Licensed under the MIT License. See LICENSE file in the package root for license information.
*/

"use strict";

const LEFT = -1;
const RIGHT = 1;
const NODIR = 0;

const SWG = 1;
const SINTRAL = 2;
//const KNITERATE = 3;

let backendToString = function(backend) {
    switch(backend) {
    case SWG:
        return "SWG";
    case SINTRAL:
        return "Sintral";
    // case KNITERATE:
    //     return "Kniterate";
    }
    throw Error("unknown backend: " + backend);
}

const DROPOFF_MOVEMENTS = 6;
//const CARRIERJUMP_MAX = 4;

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

var KnitoutWrapper = function(backend) {

    this.backend = backend;

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

    var validateNeedle = function(n) {
        if(n === undefined)
            throw Error("needle not defined!");
        if(!Number.isInteger(n))
            throw Error("invalid needle index: " + n);
        if(n < 1 || n > this.machine.width)
            throw Error("needle index " + n + " is off machine bed");
    }.bind(this);

    var validateBed = function(b) {
        if(b === undefined)
            throw Error("bed not defined!");
        if(!(b in this.machine.beds))
            throw Error("invalid bed: '" + b + "'");
    }.bind(this);

    var validateDir = function(dir) {
        if(dir !== LEFT && dir !== RIGHT)
            throw Error("dir is neither LEFT nor RIGHT");
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
    this.halfGauge = false;

    let k = undefined;
    let fixationInfo = undefined;

    var setPos = function(c, pos) {
        // if(c.pos !== this.machine.width) { // in this case, the carrier is parked (e.g. after "inhook"), so don't warn in this case
        //     let jump = Math.abs(c.pos - pos);
        //     if(jump > CARRIERJUMP_MAX)
        //         console.warn("WARNNIG: carrier '" + c.name + "' jumped by " + jump + " needles (" + c.pos + " to " + pos + ") at course #" + c.courseCntr);
        // }
        c.pos = pos;
    }.bind(this);

    var assertBackend = function(b, msg, warn = false) {
        if(this.backend !== b) {
            if(warn)
                console.warn("WARNING: " + msg + " (" + backendToString(this.backend) + ")");
            else
                throw Error(msg + " (" + backendToString(this.backend) + ")");

            return false;
        }

        return true;
    }.bind(this);

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
            isIn:   false,
            isHookReleased: false
        };
    
        return c;
    }

    //keeping track of what needles hold what loops
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


    //keeping track of what sliders hold what loops
    let setSliderLoops = function(b, n, names) {
        this.machine.beds[b].sliders[n - 1] = [];
        addSliderLoops(b, n, names);
    }.bind(this);

    let getSliderLoops = function(b, n) {
        return this.machine.beds[b].sliders[n - 1];
    }.bind(this);

    let addSliderLoops = function(b, n, names) {
        if(Array.isArray(names)) {
            names.forEach( name => { this.machine.beds[b].sliders[n - 1].push(name); });
        } else if(names !== undefined) {
            this.machine.beds[b].sliders[n - 1].push(names);
        }
    }.bind(this);

    /**
     * 
     * @param {*} machineDesc machine description
     * @param {String} position knitout pattern position, defaults to "Keep"
     * @param {Boolean} halfGauge set to true to generate knitout in half-gauge (only even needles are used)
     */
    this.initKnitout = function(machineDesc, position = "Keep", halfGauge = false) {

        if(machineDesc === undefined)
            machineDesc = defaultShima();

        let names = new Array(machineDesc.numCarriers);
        let cs = {};
        for(let i = 0; i < machineDesc.numCarriers; i++) {
            names[i] = (i + 1).toString();

            if(this.backend === SINTRAL)
                names[i] = "L" + names[i];

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

        this.halfGauge = halfGauge;

        const knitout = require('knitout');
        k = new knitout.Writer({ carriers: names });
    
        k.addHeader('Machine', this.machine.name);
        k.addHeader('Width', this.machine.width.toString());
        k.addHeader('Gauge', this.machine.gauge.toString());
        k.addHeader('Position', position);

        this.setFabricPresser(this.machine.presser, true);
        this.setStitchNumber(this.machine.stitchNumber, true);
        this.setSpeedNumber(this.machine.speedNumber, true);
    }

    /**
     * 
     * @param {*} c carrier object
     */
    this.in = function(c) {
        k.in(c.name);
        c.pos = 0;
        c.isIn = true;
        this.isHookReleased = true;
    }

    this.out = function(c) {
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

        k.out(c.name);
        c.isIn = false;
        c.pos = Infinity;

        if(prevRacking !== undefined) {
            this.rack(prevRacking);
        }
    }

    /**
     * 
     * @param {*} c carrier object
     */
    this.inhook = function(c) {
        if(!assertBackend(SWG, "'inhook' not supported, performing 'in' instead", true)) {
            this.in(c);
            return;
        }

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
        if(!assertBackend(SWG, "'releasehook' not supported, will be ignored", true)) {
            return;
        }

        k.releasehook(c.name);
        c.isHookReleased = true;
        //this.machine.hook = ...;  //TODO: unset yarn held by inserting hook(s?)
    }
    
    /**
     * 
     * @param {*} c carrier object
     */
    this.outhook = function(c) {
        if(!assertBackend(SWG, "'outhook' not supported, performing 'out' instead", true)) {
            this.out(c);
            return;
        }

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

            if(this.halfGauge) {
                let oa = Math.abs(offset);
                let iPart = Math.floor(oa);
                let fPart = (oa - iPart);
            
                offset = (iPart * 2 + fPart) * Math.sign(offset);
            }

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
        validateDir(dir);
        validateBed(b);

        if(this.halfGauge)
            n *= 2;

        validateNeedle(n);

        let arg = '';
        if(Array.isArray(cs)) {
            if(cs.length) {
                cs.forEach(c => {
                    arg += c.name + ' ';
                
                    //TODO: add racking value if back bed needle
                    //TODO: figure out if 0.5 is a reasonable value to add
                    setPos(c, n + dir * 0.5);
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
                setPos(cs, n + dir * 0.5);
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
        validateDir(dir);
        validateBed(b);

        if(this.halfGauge)
            n *= 2;

        validateNeedle(n);

        let str = '';
        if(Array.isArray(cs)) {
            cs.forEach(c => {
                str += c.name + ' ';
            
                //TODO: add racking value if back bed needle
                //TODO: figure out if 0.5 is a reasonable value to add
                setPos(c, n + dir * 0.5);
            });
            str = str.trim();
        } else {
            str = cs.name;

            //TODO: add racking value if back bed needle
            //TODO: figure out if 0.5 is a reasonable value to add
            setPos(cs, n + dir * 0.5);
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
        validateDir(dir);
        validateBed(b);

        if(this.halfGauge)
            n *= 2;

        validateNeedle(n);

        let str = '';
        if(Array.isArray(cs)) {
            cs.forEach(c => {
                str += c.name + ' ';
            
                //TODO: add racking value if back bed needle
                //TODO: figure out if 0.5 is a reasonable value to add
                setPos(c, n + dir * 0.5);
            });
            str = str.trim();
        } else {
            str = cs.name;

            //TODO: add racking value if back bed needle
            //TODO: figure out if 0.5 is a reasonable value to add
            setPos(cs, n + dir * 0.5);
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
     this.xfer = function(b0, n0, n1, fromSlider = false, toSlider = false) {

        //TODO: doublecheck if opposite slider is in use, warn otherwise

        validateBed(b0);

        if(this.halfGauge) {
            n0 *= 2;
            n1 *= 2;
        }

        validateNeedle(n0);
        validateNeedle(n1);

        let b1 = getOpposite(b0);

        if(fromSlider && toSlider)
            throw Error("cannot move from slider to slider (" + b0 + n0 + " -> " + b1 + n1 + ")");

        let b0ext = (fromSlider ? b0 + 's' : b0);
        let b1ext = (toSlider ? b1 + 's' : b1);

        if(b0 === 'f' && n0 - this.machine.racking !== n1)
            console.warn("xfer from " + b0ext + n0 + " to " + b1ext + n1 + " at racking " + this.machine.racking + " will fail -- needles not aligned");
        if(b0 === 'b' && n0 + this.machine.racking !== n1)
            console.warn("xfer from " + b0ext + n0 + " to " + b1ext + n1 + " at racking " + this.machine.racking + " will fail -- needles not aligned");

        k.xfer(b0ext + n0, b1ext + n1);

        let srcLoops = (fromSlider ? getSliderLoops(b0, n0) : getLoops(b0, n0));
        if(toSlider)
            addSliderLoops(b1, n1, srcLoops);
        else
            addLoops(b1, n1, srcLoops);

        if(fromSlider)
            setSliderLoops(b0, n0, []);
        else
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

        //TODO: doublecheck if opposite slider is in use, warn otherwise

        validateDir(dir);
        validateBed(b0);

        if(this.halfGauge) {
            n0 *= 2;
            n1 *= 2;
        }

        validateNeedle(n0);
        validateNeedle(n1);

        let b1 = getOpposite(b0);

        let str = '';
        if(Array.isArray(cs)) {
            cs.forEach(c => {
                str += c.name + ' ';
            
                //TODO: add racking value if back bed needle
                //TODO: figure out if 0.5 is a reasonable value to add
                setPos(c, n0 + dir * 0.5);
            });
            str = str.trim();
        } else {
            str = cs.name;

            //TODO: add racking value if back bed needle
            //TODO: figure out if 0.5 is a reasonable value to add
            setPos(cs, n0 + dir * 0.5);
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
        validateBed(b);

        if(this.halfGauge) {
            n *= 2;
        }

        validateNeedle(n);

        k.drop(b + n);

        setLoops(b, n, []);
    }

    /**
     * 
     * @param {*} presser 
     * @param {*} force 
     */
    this.setFabricPresser = function(presser, force = false) {
        if(!assertBackend(SWG, "stitchNumber not supported, will be ignored", true)) {
            return;
        }

        if(this.machine.presser !== presser || force) {
            k.fabricPresser(presser);
            this.machine.presser = presser;
        }
    }

    /**
     * 
     * @returns current stitch number set on the machine instance
     */
    this.getStitchNumber = function() {
        return this.machine.stitchNumber;
    }
    
    /**
     * 
     * @param {Number} nr stitch number to set (index into machine specific LUT)
     * @param {Boolean} force set to true if you want to skip redundancy-check
     */
    this.setStitchNumber = function(nr, force = false) {
        if(!assertBackend(SWG, "stitchNumber not supported, will be ignored", true)) {
            return;
        }

        if(this.machine.stitchNumber !== nr || force) {
            k.stitchNumber(nr);
            this.machine.stitchNumber = nr;
        }
    }

    /**
     * 
     * @returns current speed number set on the machine instance
     */
    this.getSpeedNumber = function() {
        return this.machine.speedNumber;
    }

    /**
     * 
     * @param {Number} nr speed number to set (index into machine specific LUT)
     * @param {Boolean} force set to true if you want to skip redundancy-check
     */
     this.setSpeedNumber = function(nr, force = false) {
        if(!assertBackend(SWG, "speedNumber not supported, will be ignored", true)) {
            return;
        }

        if(nr === 9 && this.backend === SWG) 
            throw Error("cannot use speed #9 with SWG -- is reserved for empty carriage movements");

        if(this.machine.speedNumber !== nr || force) {
            k.speedNumber(nr);
            this.machine.speedNumber = nr;
        }
    }

    /**
     * @param {*} state supported comb states: 'ready', 'up', 'reset'
     */
    this.setCombMode = function(state) {
        if(!assertBackend(SINTRAL, "comb not supported, will be ignored", true)) {
            return;
        }

        //TODO: store state and check for valid comb operations and/or warn/throw accordingly
        if(state === 'ready') {
            k.addRawOperation("x-comb-ready")
        } else if(state === 'up') {
            k.addRawOperation("x-comb-up")
        } else if(state === 'reset') {
            k.addRawOperation("x-comb-reset")
        } else {
            throw Error("unknown comb state '" + state + "'")
        }
    }

    /**
     * 
     * @param {*} c carrier object
     * @param {Number} fixL needle number for leftmost fixation loop (optional)
     * @param {Number} fixR needle number for rightmost fixation loop (optional)
     * @param {Number} stitchNumber 
     */
    this.bringIn = function(c, stitchNumber, fixL, fixR) {

        if(c.isIn) {
            console.warn("WARNING: carrier " + c.name + " already brought in -- skipping...");
            return;
        }
    
        this.comment("bringing in carrier with name \"" + c.name + "\"");

        if(this.backend === SWG) {
            this.inhook(c);
    
            if(fixL !== undefined && fixR !== undefined) {

                this.comment("knitting fixation for carrier " + c.name);
                if(stitchNumber)
                    this.setStitchNumber(stitchNumber);

                //have to start at the very right, otherwise I get Error 1381
                // YARN INSERTING HOOK AND NEEDLE INTERFERE.
                let pos = fixR;
                while(pos >= fixL) {
                    this.tuck(LEFT, 'f', pos, c);
                    pos -= 2;
                }
            
                if(pos + 2 === fixL) {
                    pos += 3;
                } else {
                    pos = fixL;
                }
            
                while(pos <= fixR) {
                    this.tuck(RIGHT, 'f', pos, c);
                    pos += 2;
                }
            
                pos = fixR;
                while(pos >= fixL) {
                    this.knit(LEFT, 'f', pos, c);
                    pos--;
                }
                
                this.releasehook(c);
                
                fixationInfo = {
                    left:   fixL,
                    right:  fixR,
                    cName:  c.name
                };
            } else if(fixL === undefined ^ fixR === undefined) {
                console.warn("WARNING: either fixL or fixR is undefined in bringIn -- fixation will not be knit!");
            }
        } else {
            this.in(c);

            let offset = 5;

            let pos = fixL;
            while(pos <= fixR) {
                this.tuck(RIGHT, 'b', pos, c);
                pos += offset;
            }

            fixationInfo = {
                left:   fixL,
                right:  fixR,
                offset: offset,
                cName:  c.name
            };
        }

        this.comment("bringin done");
    }
    
    /**
     * 
     */
    this.dropFixation = function() {
    
        if(typeof fixationInfo === 'undefined') {
            return;
        }
    
        this.comment("dropping fixation of carrier " + fixationInfo.cName + " needles " + fixationInfo.left + " -> " + fixationInfo.right);
    
        if(this.backend === SWG) {
            for(let i = fixationInfo.left; i <= fixationInfo.right; i++)
                this.drop("f", i);
        } else {
            for(let i = fixationInfo.left; i <= fixationInfo.right; i += fixationInfo.offset)
                this.drop("b", i);
        }
    
        fixationInfo = undefined;
    }

    /**
     * NOTE: caston needs to leave carrier on left position when done, by definition, knitSequence relies on this!
     * 
     * @param {*} c carrier object
     * @param {Number} l left needle
     * @param {Number} r right needle
     * @param {Number} speedNumber optional speednumber override for caston
     * @param {Number} stitchNumber optional stitchnumber override for caston
     * @param {*} beds array strings specifying beds (vales of either 'f' and/or 'b'), defaults is front bed
     * @param {Boolean} tube when both beds are specified, set to true when both beds should be kept separate; defauts to true
     */
    this.castOn = function(c, l, r, speedNumber = undefined, stitchNumber = undefined, beds = ['f'], tube = undefined) {

        if(beds.length === 0) {
            console.warn("possible error: passed no caston-beds, skipping cast-on")
            
            this.comment("skipping castOn");
            return;
        }

        beds.forEach( b => {
            validateBed(b);
        });

        validateNeedle(l);
        validateNeedle(r);

        if(l >= r)
            throw Error("left needle index greater than right needle index in castOn (l: " + l + "; r: " + r + ")!");

        for(let i = 0; i < beds.length; i++)
            if(beds[i] !== 'b' && beds[i] !== 'f')
                throw Error("invalid bed specified for castOn: '" + beds[i] + "'");

        this.comment("knitting cast on with carrier " + c.name);

        let stitchNumberBackup = this.getStitchNumber();
        let speedNumberBackup = this.getSpeedNumber();
        if(stitchNumber)
            this.setStitchNumber(stitchNumber);
        if(speedNumber)
            this.setSpeedNumber(speedNumber);

        if(beds.length === 2) {
            if(beds[0] === beds[1]) {
                console.warn("WARNING: specified castOn beds are identical, possible error? (" + beds.join(', '));
                beds = beds.slice(0, 1);
            } else {
                if(this.backend === SWG) {

                    let pos = r;

                    if(tube) {

                        let bed = beds[0];
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
        
                        for(pos = r; pos >= l; pos--) {
                            this.knit(LEFT, bed, pos, c);
                        }

                        bed = beds[1];

                        pos = l;
                        while(pos <= r) {
                            this.tuck(RIGHT, bed, pos, c);
                            pos += 2;
                        }

                        if(pos - 2 === r) {
                            pos -= 3;
                        } else {
                            pos = r;
                        }

                        while(pos >= l) {
                            this.tuck(LEFT, bed, pos, c);
                            pos -= 2;
                        }

                        for(pos = l; pos <= r; pos++) {
                            this.knit(RIGHT, bed, pos, c);
                        }

                        bed = beds[0];
                        for(pos = r; pos >= l; pos--) {
                            this.knit(LEFT, bed, pos, c);
                        }
                        
                    } else {
                        while(pos >= l) {
                            this.tuck(LEFT, beds[pos % 2], pos, c);
                            pos--;
                        }

                        pos++;
                        while(pos <= r) {
                            this.tuck(RIGHT, beds[(pos + 1) % 2], pos, c);
                            pos++;
                        }

                        let temp = this.machine.racking;
                        this.rack(0.25);
                        pos--;
                        while(pos >= l) {
                            this.knit(LEFT, 'b', pos, c);
                            this.knit(LEFT, 'f', pos, c);
                            pos--;
                        }
                        this.rack(temp);
                    }
                } else if(this.backend === SINTRAL) {
                    
                    let pos = l;

                    if(tube) {

                        //TODO: not sure if this is reasonable for Stoll machines -- just guessing here...
                        // doublecheck when you've to access to Stoll machines or -knitting folks
                        while(pos <= r) {
                            this.knit(RIGHT, beds[0], pos, c);
                            pos++;
                        }
                        pos--;

                        while(pos >= l) {
                            this.knit(LEFT, beds[0], pos, c);
                            pos--;
                        }
                        pos++;

                        while(pos <= r) {
                            this.knit(RIGHT, beds[1], pos, c);
                            pos++;
                        }
                        pos--;

                        while(pos >= l) {
                            this.knit(LEFT, beds[1], pos, c);
                            pos--;
                        }
                    } else {
                        while(pos <= r) {
                            this.knit(RIGHT, beds[pos % 2], pos, c);
                            pos++;
                        }
                        pos--;

                        while(pos >= l) {
                            this.knit(LEFT, beds[(pos + 1) % 2], pos, c);
                            pos--;
                        }
                    }
                } else {
                    throw Error("2-bed caston not implemented for backend '" + backendToString(this.backend) + "'");
                }
            }
        }

        if(beds.length === 1) {

            let bed = beds[0];

            if(this.backend === SWG) {
                //have to start at the very right, otherwise I get Error 1381
                // YARN INSERTING HOOK AND NEEDLE INTERFERE.
                let pos = r;
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

                for(pos = r; pos >= l; pos--) {
                    this.knit(LEFT, bed, pos, c);
                }

            } else if(this.backend === SINTRAL) {
                let o = getOpposite(bed);
                let pos = l;
                while(pos <= r) {
                    this.knit(RIGHT, pos % 2 ? bed : o, pos, c);
                    pos++;
                }
                pos--;

                while(pos >= l) {
                    this.knit(LEFT, pos % 2 ? o : bed, pos, c);
                    pos--;
                }
                pos++;

                let temp = this.machine.racking;
                this.rack(0);
                while(pos <= r) {
                    this.xfer(o, pos, pos);
                    pos++;
                }
                this.rack(temp);
            } else {
                throw Error("1-bed caston not implemented for backend '" + backendToString(this.backend) + "'");
            }
        }

        if(beds.length > 2) {
            throw Error("invalid number of beds specified for castOn: " + beds.length);
        }

        if(stitchNumber)
            this.setStitchNumber(stitchNumberBackup);
        if(speedNumber)
            this.setSpeedNumber(speedNumberBackup);

        this.comment("knitting castOn done");
    }

    /**
     * 
     * @param {*} c carrier object
     * @param {Number} l number of leftmost needle
     * @param {Number} r number of rightmost needle
     * @param {Number} speedNumber speed number to set (leave undefined keeps current stitch number)
     * @param {Number} stitchNumber stitch number to set (leave undefined keeps current stitch number)
     * @param {*} beds array strings specifying beds (vales of either 'f' and/or 'b'), defaults is front bed
     * @param {Number} chainLoops number of loops that make up the chain to be transferred to neighbouring needle
     * @param {Booelan} tube specify if tubular castoff should be performed
     */
    this.castOff = function(c, l, r, speedNumber = undefined, stitchNumber = undefined, beds = ['f'], chainLoops = 3, tube = undefined) {

        beds.forEach( b => {
            validateBed(b);
        });

        validateNeedle(l);
        validateNeedle(r);

        if(chainLoops < 1) {
            console.warn("chain must be at last 1 loop -- correcting value to 1");
            chainLoops = 1;
        }

        this.comment("cast off");

        let cntr = 0;
        let center = (r + l) / 2;
        if(this.halfGauge) {
            center *= 2;
        }

        let dir = undefined;
        let invDir = undefined;

        this.rack(0);

        if(tube) {

            if(beds.length != 2)
                throw Error("invalid bed count for tubular castoff: " + beds.length);

            if(c.pos < center) {
                 if(l <= (this.halfGauge ? 2 : 1))
                     throw Error("castoff not entirely possible -> shift pattern to right by another " + ((this.halfGauge ? 3 : 2) - l) + " needle(s)");

                dir = RIGHT;
                invDir = LEFT;

                let rck = dir;

                if(beds[0] === 'b')
                    rck *= -1;

                for(let i = l; i <= r; i++) {
                    this.knit(dir, beds[0], i, c);
                }
                for(let i = r; i >= l; i--) {
                    this.knit(invDir, beds[1], i, c);
                }

                let stitchNumberBackup = this.getStitchNumber();
                let speedNumberBackup = this.getSpeedNumber();
                if(stitchNumber)
                    this.setStitchNumber(stitchNumber);
                if(speedNumber)
                    this.setSpeedNumber(speedNumber);
        
                let cntr = 0;
                for(let i = l; i < r; i++) {
                    for(let j = 0; j < chainLoops; j++, cntr++)
                        this.knit((cntr % 2 ? invDir : dir), beds[0], i, c);

                    //NOTE: this miss is a workaround. adding it to prevent knitout-to-dat converter
                    // to kick current carrier out of the way after loop was handed to opposite slider, 
                    // which kinda *looks* reasonable to me, however produces an error in APEX which 
                    // complains that movement cannot be done as a slider is currently in use
                    // don't know how else to sail around this, but i think, that's a viable solution.
                    if(cntr % 2)
                        this.miss(dir, beds[0], i + dir, c)

                    this.xfer(beds[0], i, i, false, true);
                    this.rack(rck);
                    this.xfer(beds[1], i, i + rck, true, false);
                    this.rack(0);
                }

                for(let j = 0; j < chainLoops; j++, cntr++)
                    this.knit((cntr % 2 ? invDir : dir), beds[0], r, c);
                this.xfer(beds[0], r, r);

                for(let i = r; i >= l; i--) {
                    for(let j = 0; j < chainLoops; j++, cntr++)
                        this.knit((cntr % 2 ? invDir : dir), beds[1], i, c);

                    //NOTE: this miss is a workaround. adding it to prevent knitout-to-dat converter
                    // to kick current carrier out of the way after loop was handed to opposite slider, 
                    // which kinda *looks* reasonable to me, however produces an error in APEX which 
                    // complains that movement cannot be done as a slider is currently in use
                    // don't know how else to sail around this, but i think, that's a viable solution.
                    if(!(cntr % 2))
                        this.miss(invDir, beds[1], i + invDir, c)

                    this.xfer(beds[1], i, i, false, true);
                    this.rack(rck);
                    this.xfer(beds[0], i, i - rck, true, false);
                    this.rack(0);
                }

                for(let i = 0; i < 5; i++)
                    this.knit(invDir, beds[1], l - 1, c);

                if(stitchNumber)
                    this.setStitchNumber(stitchNumberBackup);
                if(speedNumber)
                    this.setSpeedNumber(speedNumberBackup);
            
                //NOTE: have to outhook *before* dropping, otherwise dropped textile hangs just on
                // the yarn and pulls on the yarn carrier, causing the bindoff to unravel/break.
                this.outhook(c);
                this.drop(beds[1], l - 1);

            } else {
                //TODO: figure out what the deal here is for tubular castoff
                // if(r >= this.machine.width)
                //     throw Error("castoff not entirely possible -> shift pattern to the left by another " + (r - this.machine.width + (this.halfGauge ? 2 : 1)) + " needle(s)");

                console.log("tubular castoff: right -> left");
                
                dir = LEFT;
                invDir = RIGHT;

                let rck = dir;

                for(let i = r; i >= l; i--) {
                    this.knit(dir, beds[1], i, c);
                }
                for(let i = l; i <= r; i++) {
                    this.knit(invDir, beds[0], i, c);
                }

                let stitchNumberBackup = this.getStitchNumber();
                let speedNumberBackup = this.getSpeedNumber();
                if(stitchNumber)
                    this.setStitchNumber(stitchNumber);
                if(speedNumber)
                    this.setSpeedNumber(speedNumber);
        
                let cntr = 0;
                for(let i = r; i > l; i--) {
                    for(let j = 0; j < chainLoops; j++, cntr++)
                        this.knit((cntr % 2 ? invDir : dir), beds[1], i, c);

                    //NOTE: this miss is a workaround. adding it to prevent knitout-to-dat converter
                    // to kick current carrier out of the way after loop was handed to opposite slider, 
                    // which kinda *looks* reasonable to me, however produces an error in APEX which 
                    // complains that movement cannot be done as a slider is currently in use
                    // don't know how else to sail around this, but i think, that's a viable solution.
                    if(cntr % 2)
                        this.miss(dir, beds[1], i + dir, c)

                    this.xfer(beds[1], i, i, false, true);
                    this.rack(-rck);
                    this.xfer(beds[0], i, i + rck, true, false);
                    this.rack(0);
                }

                for(let j = 0; j < chainLoops; j++, cntr++)
                    this.knit((cntr % 2 ? invDir : dir), beds[1], l, c);
                this.xfer(beds[1], l, l);

                for(let i = l; i <= r; i++) {
                    for(let j = 0; j < chainLoops; j++, cntr++)
                        this.knit((cntr % 2 ? invDir : dir), beds[0], i, c);

                    //NOTE: this miss is a workaround. adding it to prevent knitout-to-dat converter
                    // to kick current carrier out of the way after loop was handed to opposite slider, 
                    // which kinda *looks* reasonable to me, however produces an error in APEX which 
                    // complains that movement cannot be done as a slider is currently in use
                    // don't know how else to sail around this, but i think, that's a viable solution.
                    if(!(cntr % 2))
                        this.miss(invDir, beds[0], i + invDir, c)

                    this.xfer(beds[0], i, i, false, true);
                    this.rack(-rck);
                    this.xfer(beds[1], i, i - rck, true, false);
                    this.rack(0);
                }

                for(let i = 0; i < 5; i++)
                    this.knit(invDir, beds[0], r + 1, c);

                if(stitchNumber)
                    this.setStitchNumber(stitchNumberBackup);
                if(speedNumber)
                    this.setSpeedNumber(speedNumberBackup);

                //NOTE: have to outhook *before* dropping, otherwise dropped textile hangs just on
                // the yarn and pulls on the yarn carrier, causing the bindoff to unravel/break.
                this.outhook(c);
                this.drop(beds[0], r + 1);
            }

        } else {

            if(beds.length === 1) {

                let bed = beds[0];
                let oppBed = ( bed === 'f' ? 'b' : 'f' );

                //first, join loops of both beds
                for(let i = l; i <= r; i++) {
                    this.xfer(oppBed, i, i);
                }

                if(c.pos < center) {
                    if(l <= (this.halfGauge ? 2 : 1))
                        throw Error("castoff not entirely possible -> shift pattern to right by another " + ((this.halfGauge ? 3 : 2) - l) + " needle(s)");

                    dir = RIGHT;
                    invDir = LEFT;

                    for(let i = l; i <= r; i++) {
                        this.knit(dir, bed, i, c);
                    }

                    let stitchNumberBackup = this.getStitchNumber();
                    let speedNumberBackup = this.getSpeedNumber();
                    if(stitchNumber)
                        this.setStitchNumber(stitchNumber);
                    if(speedNumber)
                        this.setSpeedNumber(speedNumber);
            
                    dir *= -1;
                    invDir *= -1;
            
                    for(let i = r; i >= l; i--) {
                        for(let j = 0; j < chainLoops; j++, cntr++)
                            this.knit(cntr % 2 ? invDir : dir, bed, i, c)

                        if(cntr % 2)
                            this.miss(dir, bed, i - 1, c);

                        this.xfer(bed, i, i);
                        this.rack(-1);
                        this.xfer(oppBed, i, i - 1);
                        this.rack(0);
                    }

                    for(let i = 0; i < 5; i++)
                        this.knit(dir, bed, l - 1, c);

                    if(stitchNumber)
                        this.setStitchNumber(stitchNumberBackup);
                    if(speedNumber)
                        this.setSpeedNumber(speedNumberBackup);
    
                    //NOTE: have to outhook *before* dropping, otherwise dropped textile hangs just on
                    // the yarn and pulls on the yarn carrier, causing the bindoff to unravel/break.
                    this.outhook(c);
                    this.drop(bed, l - 1);
                } else {
                    if(r >= this.machine.width)
                        throw Error("castoff not entirely possible -> shift pattern to the left by another " + (r - this.machine.width + (this.halfGauge ? 2 : 1)) + " needle(s)");

                    dir = LEFT;
                    invDir = RIGHT;
            
                    for(let i = r; i >= l; i--) {
                        this.knit(dir, bed, i, c);
                    }

                    let stitchNumberBackup = this.getStitchNumber();
                    let speedNumberBackup = this.getSpeedNumber();
                    if(stitchNumber)
                        this.setStitchNumber(stitchNumber);
                    if(speedNumber)
                        this.setSpeedNumber(speedNumber);
            
                    dir *= -1;
                    invDir *= -1;

                    for(let i = l; i <= r; i++) {
                        for(let j = 0; j < chainLoops; j++, cntr++)
                            this.knit(cntr % 2 ? invDir : dir, bed, i, c);
                        
                        if(cntr % 2)
                            this.miss(dir, bed, i + 1, c);

                        this.xfer(bed, i, i);
                        this.rack(1);
                        this.xfer(oppBed, i, i + 1);
                        this.rack(0);
                    }

                    for(let i = 0; i < 5; i++)
                        this.knit(dir, bed, r + 1, c);

                    if(stitchNumber)
                        this.setStitchNumber(stitchNumberBackup);
                    if(speedNumber)
                        this.setSpeedNumber(speedNumberBackup);
    
                    //NOTE: have to outhook *before* dropping, otherwise dropped textile hangs just on
                    // the yarn and pulls on the yarn carrier, causing the bindoff to unravel/break.
                    this.outhook(c);
                    this.drop(bed, r + 1);
                }
            } else {
                //TODO: if both beds are specified, knit off both independently!!
                // you will most probably need one carrier specified for each bed, though?
                // (that's pretty much the point here, otherwise you don't have to do this
                // anyways)
                console.warn("WARNING: castoff on both beds independently not implemented!");
                this.outhook(c);
            }
        }
        this.rack(0);
    }

    /**
     * Knits a number of rows without yarn feeder so fabric comes out of machine easier. Should 
     * obviously be called when castoff was done.
     * @param {Number} l 
     * @param {Number} r 
     * @param {Number} movements 
     */
    this.dropOff = function(l, r, movements = DROPOFF_MOVEMENTS) {

        this.rack(0.25);
        this.comment(movements + " empty carrier movements");

        if(l === undefined) {
            l = Math.min(this.machine.beds.f.leftmost, this.machine.beds.b.leftmost);
            if(this.halfGauge) {
                l /= 2;
            }
        }
        if(r === undefined) {
            r = Math.max(this.machine.beds.f.rightmost, this.machine.beds.b.rightmost);
            if(this.halfGauge) {
                r /= 2;
            }
        }

        validateNeedle(l);
        validateNeedle(r);

        //TODO: find out what best option would actually be, figure out current carriage position?
        let d = LEFT; 

        for(let j = 0; j < movements; j++) {
            if(d === RIGHT) {
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

    this.getYarnHoldingHooks = function() {

        let ret = {
            f: [],
            b: []
        };

        for(let i = 0; i < this.machine.width; i++) {
            if(this.machine.beds.f.needles[i].length > 0) {
                ret.f.push(i + 1);
            }
            if(this.machine.beds.b.needles[i].length > 0) {
                ret.b.push(i + 1);
            }
        }

        return ret;
    }

    this.getYarnHoldingSliders = function() {

        let ret = {
            f: [],
            b: []
        };

        for(let i = 0; i < this.machine.width; i++) {
            if(this.machine.beds.f.sliders[i].length > 0) {
                ret.f.push(i + 1);
            }
            if(this.machine.beds.b.sliders[i].length > 0) {
                ret.b.push(i + 1);
            }
        }
        
        return ret;
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

    this.getCurrentKnittingRange = function( beds = ['f', 'b']) {

        beds.forEach( b => {
            validateBed(b);
        });

        let leftmost = Infinity;
        let rightmost = -Infinity;

        beds.forEach( b => {
            this.machine.beds[b].needles.forEach( function(n, i) { 
                if(n.length > 0) {
                    rightmost = i + 1;
                    if(leftmost === Infinity)
                        leftmost = i + 1;
                }
            });
        });

        if(leftmost === Infinity)
            return undefined;

        if(this.halfGauge) {
            if(leftmost % 2 || rightmost % 2)
                console.warn("WARNING: this does not seem right: leftmost and rightmost are odd numbers for half gauge knitting (" + leftmost + "/" + rightmost + ")");
            leftmost /= 2;
            rightmost /= 2;
        }

        return { l: leftmost, r: rightmost };
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

    this.printSliderStatus = function() {

        let prefix = "bed ";
        ['f', 'b'].forEach( b => {
            let leftmost = Infinity;
            let rightmost = -Infinity;

            let maxLoopCount = 0;

            this.machine.beds[b].sliders.forEach( function(s, i) { 
                if(s.length > 0) {
                    rightmost = i + 1;
                    if(leftmost === Infinity)
                        leftmost = i + 1;
                    maxLoopCount = Math.max(maxLoopCount, s.length);
                }
            } );

            if(maxLoopCount) {
                let descStr = prefix + b + ": sliders [" + leftmost + " thru " + rightmost + "]: ";

                for(let j = 0; j < maxLoopCount; j++) {
                    let sliderString = "";
                    for(let i = leftmost; i <= rightmost; i++) {
                        if(j < this.machine.beds[b].sliders[i - 1].length)
                            sliderString += this.machine.beds[b].sliders[i - 1][j] + ' ';
                        else
                            sliderString += '  ';
                    }

                    console.log(descStr + sliderString);
                    descStr = ' '.repeat(descStr.length);
                }
            } else {
                console.log(prefix + b + ": no sliders currently holding any yarn");
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
    module.exports.NODIR = NODIR;

    module.exports.SWG = SWG;
    module.exports.SINTRAL = SINTRAL;
    //module.exports.KNITERATE = KNITERATE;

    module.exports.backendToString = backendToString;
}
