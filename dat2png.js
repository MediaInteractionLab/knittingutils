#!/bin/sh

/**
 * script taken from https://akaspar.pages.cba.mit.edu/machine-knitting/images/dat2png.js
 * modified for up-to-date npm canvas package
 * originally created by Alexandre Kaspar http://w-x.ch/
 */

':' //; exec "$(command -v nodejs || command -v node)" --use_strict "$0" "$@"
"use strict";

// --- modules
const fs = require('fs');
const path = require('path');
const {createCanvas} = require('canvas');

let datFile = process.argv[2]; // input json file
if(!datFile){
  console.log('Usage: ./dat2png.js file.dat [file.png] [scale=1] [text=0]');
  process.exit(0);
}
let imageFile  = process.argv[3]; // reference image file
if(!imageFile){
  imageFile = datFile.replace(/.dat/i, '') + '.png';
}
try {
  if(fs.lstatSync(imageFile).isDirectory()){
    imageFile = path.join(imageFile, path.basename(datFile).replace(/.dat/i, '.png'));
  }
} catch(e){}
let scale = process.argv[4] || 1;
let text  = process.argv[5] || 0;

console.log('From ' + datFile + ' to ' + imageFile + ', scale=' + scale);

// read DAT file
let buffer  = fs.readFileSync(datFile);
let getU16 = function(byteIdx){
  return buffer.readInt16LE(byteIdx);
};
let minX = getU16(0x0); // header.getUint16(0x0, true);
let minY = getU16(0x2);
let maxX = getU16(0x4); 
let maxY = getU16(0x6);

let magic1 = getU16(0x8);
let magic2 = getU16(0x10);

console.log('x: ' + minX + ' -> ' + maxX);
console.log('y: ' + minY + ' -> ' + maxY);
console.log('magic: ' + magic1 + ' ' + magic2);

if(magic1 != 1000 || magic2 != 1000){
  console.error('Invalid magic numbers: ' + magic1 + ' and ' + magic2);
}

let width = maxX - minX + 1;
let height = maxY - minY + 1;
console.log('width: ' + width);
console.log('height: ' + height);

// palette data
let palette = new Uint8Array(buffer, 0x200, 0x300);
function byteSwap(arr, offset, length) {
  let ret = new Uint8Array(length);
  for (var i = 0; i < length; i += 2) {
    ret[i] = arr[offset+i+1];
    ret[i+1] = arr[offset+i];
  }
  return ret;
}
let paletteR = byteSwap(buffer, 0x200, 0x100);
let paletteG = byteSwap(buffer, 0x300, 0x100);
let paletteB = byteSwap(buffer, 0x400, 0x100);

// data = array of (index, length) pairs
let length = buffer.length - 0x600;

// create image
let canvas = createCanvas(width * scale, height * scale);
let ctx = canvas.getContext('2d');

let imgData = [];
if(scale == 1){
  imgData = ctx.createImageData(width, height);
} else {
  ctx.fillStyle = '#333'; // '#F0F';
  ctx.fillRect(0, 0, width * scale, height * scale);
}
let pointer = 0;
for(let i = 0; i < length; i += 2){
  let idx = buffer[0x600+i];
  let len = buffer[0x601+i];
  // console.log('idx: ' + idx + ', len: ' + len + ', or ' + buffer[0x600+i] + '/' + buffer[0x601+i]);
  // get color from palette
  let r = paletteR[idx];
  let g = paletteG[idx];
  let b = paletteB[idx]; 
  // draw len-times
  for(let c = 0; c < len; ++c, ++pointer){
    let x = pointer % width;
    let y = Math.floor(pointer / width);
    y = height - 1 - y; // reverse for indexing ImageData
    if(scale == 1){
      imgData.data[4 * (y * width + x) + 0] = r;
      imgData.data[4 * (y * width + x) + 1] = g;
      imgData.data[4 * (y * width + x) + 2] = b;
      imgData.data[4 * (y * width + x) + 3] = 0xFF; // alpha
    } else {
      ctx.fillStyle = 'rgba(' + r + ', ' + g + ', ' + b + ', 255)';
      ctx.fillRect(x * scale, y * scale, scale * 0.9, scale * 0.9);
    }
    if(scale > 1 && text){
      let factor = 2.1;
      ctx.fillStyle = 'rgba(' + Math.round(r / factor) + ', ' + Math.round(g / factor) + ', ' + Math.round(b / factor) + ', 255)';
      ctx.font = (4 * scale / 10) + 'pt sans-serif';
      ctx.fillText('' + idx, x * scale, y * scale + scale * 0.9 / 2);
    }
  }
}

// save image
if(scale == 1)
  ctx.putImageData(imgData, 0, 0);
fs.writeFileSync(imageFile, canvas.toBuffer());

