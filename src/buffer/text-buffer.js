/**
 * @file Text Buffer
 * @author Alexander Rose <alexander.rose@weirdbyte.de>
 * @private
 */


import { CanvasTexture } from "../../lib/three.es6.js";

import { Browser } from "../globals.js";
import { defaults } from "../utils.js";
import Buffer from "./buffer.js";
import QuadBuffer from "./quad-buffer.js";


function TextAtlas( params ){

    // adapted from https://github.com/unconed/mathbox
    // MIT License Copyright (C) 2013+ Steven Wittens and contributors

    var p = Object.assign( {}, params );

    this.font = defaults( p.font, [ 'sans-serif' ] );
    this.size = defaults( p.size, 36 );
    this.style = defaults( p.style, 'normal' );
    this.variant = defaults( p.variant, 'normal' );
    this.weight = defaults( p.weight, 'normal' );
    this.outline = defaults( p.outline, 0 );
    this.width = defaults( p.width, 1024 );
    this.height = defaults( p.height, 1024 );

    this.gamma = 1;
    if( typeof navigator !== 'undefined' ){
        var ua = navigator.userAgent;
        if( ua.match( /Chrome/ ) && ua.match( /OS X/ ) ){
            this.gamma = 0.5;
        }
    }

    this.mapped = {};
    this.scratchW = 0;
    this.scratchH = 0;
    this.currentX = 0;
    this.currentY = 0;

    this.build( p );

}

TextAtlas.prototype = {

    constructor: TextAtlas,

    build: function(){

        // Prepare line-height with room for outline and descenders/ascenders
        var lineHeight = this.size + 2 * this.outline + Math.round( this.size / 4 );
        var maxWidth = this.width / 4;

        // Prepare scratch canvas
        var canvas = document.createElement( "canvas" );
        canvas.width = maxWidth;
        canvas.height = lineHeight;

        // Font string
        var quote = function(str) {
            return "\"" + ( str.replace( /(['"\\])/g, "\\$1" ) ) + "\"";
        };
        var font = this.font.map( quote ).join( ", " );

        var ctx = canvas.getContext( "2d" );
        ctx.font = this.style + " " + this.variant + " " + this.weight + " " + this.size + "px " + this.font;
        ctx.fillStyle = "#FF0000";
        ctx.textAlign = "left";
        ctx.textBaseline = "bottom";
        ctx.lineJoin = "round";

        // document.body.appendChild( canvas );
        // canvas.setAttribute( "style", "position: absolute; top: 0; left: 0; z-index: 100; border: 1px solid red; background: rgba(255,0,255,.25);" );

        var colors = [];
        var dilate = this.outline * 3;
        for( var i = 0; i < dilate; ++i ){
            // 8 rgb levels = 1 step = .5 pixel increase
            var val = Math.max( 0, -i * 8 + 128 - ( !i ) * 8 );
            var hex = ( "00" + val.toString( 16 ) ).slice( -2 );
            colors.push( "#" + hex + hex + hex );
        }
        var scratch = new Uint8Array( maxWidth * lineHeight * 2 );

        this.canvas = canvas;
        this.context = ctx;
        this.lineHeight = lineHeight;
        this.maxWidth = maxWidth;
        this.colors = colors;
        this.scratch = scratch;

        this.data = new Uint8Array( this.width * this.height * 4 );

        this.canvas2 = document.createElement( 'canvas' );
        this.canvas2.width = this.width;
        this.canvas2.height = this.height;
        this.context2 = this.canvas2.getContext( '2d' );
        // document.body.appendChild( this.canvas2 );
        // this.canvas2.setAttribute( "style", "position: absolute; bottom: 0; right: 0; z-index: 100; border: 1px solid green; background: rgba(255,0,255,.25);" );

    },

    map: function( text ){

        if( this.mapped[ text ] === undefined ){

            this.draw( text );

            // ctx.drawImage(image, sx, sy, sWidth, sHeight, dx, dy, dWidth, dHeight);

            if( this.currentX + this.scratchW > this.width ){
                this.currentX = 0;
                this.currentY += this.scratchH;
            }
            if( this.currentY + this.scratchH > this.height ){
                console.warn( "canvas to small" );
            }

            this.mapped[ text ] = {
                x: this.currentX,
                y: this.currentY,
                w: this.scratchW,
                h: this.scratchH
            };

            this.context2.drawImage(
                this.canvas,
                0, 0,
                this.scratchW, this.scratchH,
                this.currentX, this.currentY,
                this.scratchW, this.scratchH
            );

            this.currentX += this.scratchW;

        }

        return this.mapped[ text ];

    },

    draw: function( text ){

        var h = this.lineHeight;
        var o = this.outline;
        var ctx = this.context;
        var dst = this.scratch;
        var max = this.maxWidth;
        var colors = this.colors;

        // Bottom aligned, take outline into account
        var x = o;
        var y = h - this.outline;

        // Measure text
        var m = ctx.measureText( text );
        var w = Math.min( max, Math.ceil( m.width + 2 * x + 1 ) );

        // Clear scratch area
        ctx.clearRect(0, 0, w, h);

        var i, il, j, imageData, data;

        if( this.outline === 0 ){

            ctx.fillText( text, x, y );
            imageData = ctx.getImageData( 0, 0, w, h );
            data = imageData.data;

            j = 3;  // Skip to alpha channel
            for( i = 0, il = data.length / 4; i < il; ++i ){
                dst[ i ] = data[ j ];
                j += 4;
            }

        }else{

            ctx.globalCompositeOperation = "source-over";
            // Draw strokes of decreasing width to create
            // nested outlines (absolute distance)
            for( i = o + 1; i > 0; --i ){
                // Eliminate odd strokes once past > 1px,
                // don't need the detail
                j = i > 1 ? i * 2 - 2 : i;
                ctx.strokeStyle = colors[ j - 1 ];
                ctx.lineWidth = j;
                ctx.strokeText( text, x, y );
            }
            ctx.globalCompositeOperation = "multiply";
            ctx.fillStyle = "#FF00FF";
            ctx.fillText( text, x, y );
            imageData = ctx.getImageData( 0, 0, w, h );
            data = imageData.data;

            j = 0;
            var gamma = this.gamma;
            for( i = 0, il = data.length / 4; i < il; ++i ){
                // Get value + mask
                var a = data[ j ];
                var mask = a ? data[ j + 1 ] / a : 1;
                if( gamma === 0.5 ){
                    mask = Math.sqrt( mask );
                }
                mask = Math.min( 1, Math.max( 0, mask ) );

                // Blend between positive/outside and negative/inside
                var b = 256 - a;
                var c = b + ( a - b ) * mask;

                // Clamp (slight expansion to hide errors around the transition)
                dst[ i ] = Math.max( 0, Math.min( 255, c + 2 ) );
                data[ j + 3 ] = dst[ i ];
                j += 4;
            }

        }

        ctx.putImageData( imageData, 0, 0 );
        this.scratchW = w;
        this.scratchH = h;

    },

    dispose: function(){

        // document.body.removeChild( this.canvas );
        // document.body.removeChild( this.canvas2 );

    }

};


/**
 * Text buffer parameter object.
 * @typedef {Object} TextBufferParameters - text buffer parameters
 *
 * @property {Float} opacity - translucency: 1 is fully opaque, 0 is fully transparent
 * @property {Integer} clipNear - position of camera near/front clipping plane
 *                                in percent of scene bounding box
 * @property {String} labelType - type of the label, one of:
 *                                 "atomname", "atomindex", "occupancy", "bfactor",
 *                                 "serial", "element", "atom", "resname", "resno",
 *                                 "res", "text", "qualified". When set to "text", the
 *                                 `labelText` list is used.
 * @property {String[]} labelText - list of label strings, must set `labelType` to "text"
 *                                   to take effect
 * @property {String} fontFamily - font family, one of: "sans-serif", "monospace", "serif"
 * @property {String} fontStyle - font style, "normal" or "italic"
 * @property {String} fontWeight - font weight, "normal" or "bold"
 * @property {Boolean} sdf - use "signed distance field"-based rendering for sharper edges
 * @property {Float} xOffset - offset in x-direction
 * @property {Float} yOffset - offset in y-direction
 * @property {Float} zOffset - offset in z-direction (i.e. in camera direction)
 */


/**
 * Text buffer
 * @class
 * @augments {Buffer}
 * @param {Float32Array} position - positions
 *                                  [x1,y1,z1, x2,y2,z2, ..., xN,yN,zN]
 * @param {Float32Array} size - sizes
 *                               [s1, s2, ..., sN]
 * @param {Float32Array} color - colors
 *                               [r1,g1,b1, r2,g2,b2, ..., rN,gN,bN]
 * @param {String[]} text - text strings
 *                               ["t1", "t2", ..., "tN"]
 * @param {TextBufferParameters} params - parameters object
 */
function TextBuffer( position, size, color, text, params ){

    var p = params || {};
    p.forceTransparent = true;

    this.fontFamily = defaults( p.fontFamily, "sans-serif" );
    this.fontStyle = defaults( p.fontStyle, "normal" );
    this.fontWeight = defaults( p.fontWeight, "bold" );
    this.fontSize = defaults( p.fontSize, 48 );
    this.sdf = defaults( p.sdf, Browser === "Chrome" );
    this.xOffset = defaults( p.xOffset, 0.0 );
    this.yOffset = defaults( p.yOffset, 0.0 );
    this.zOffset = defaults( p.zOffset, 0.5 );

    var n = position.length / 3;

    var charCount = 0;
    for( var i = 0; i < n; ++i ){
        charCount += text[ i ].length;
    }

    this.text = text;
    this.count = charCount;
    this.positionCount = n;

    this.vertexShader = "SDFFont.vert";
    this.fragmentShader = "SDFFont.frag";

    QuadBuffer.call( this, p );

    this.addUniforms( {
        "fontTexture": { value: null },
        "xOffset": { value: this.xOffset },
        "yOffset": { value: this.yOffset },
        "zOffset": { value: this.zOffset },
        "ortho": { value: 0.0 }
    } );

    this.addAttributes( {
        "inputTexCoord": { type: "v2", value: null },
        "inputSize": { type: "f", value: null },
    } );

    this.setAttributes( {
        "position": position,
        "size": size,
        "color": color
    } );

    this.makeTexture();
    this.makeMapping();

}

TextBuffer.prototype = Object.assign( Object.create(

    QuadBuffer.prototype ), {

    constructor: TextBuffer,

    type: "text",

    parameters: Object.assign( {

        fontFamily: { uniform: true },
        fontStyle: { uniform: true },
        fontWeight: { uniform: true },
        fontSize: { uniform: true },
        sdf: { updateShader: true, uniform: true },
        xOffset: { uniform: true },
        yOffset: { uniform: true },
        zOffset: { uniform: true }

    }, Buffer.prototype.parameters ),

    makeMaterial: function(){

        Buffer.prototype.makeMaterial.call( this );

        this.material.extensions.derivatives = true;
        this.material.lights = false;
        this.material.uniforms.fontTexture.value = this.tex;
        this.material.needsUpdate = true;

        this.wireframeMaterial.extensions.derivatives = true;
        this.wireframeMaterial.lights = false;
        this.wireframeMaterial.uniforms.fontTexture.value = this.tex;
        this.wireframeMaterial.needsUpdate = true;

        this.pickingMaterial.extensions.derivatives = true;
        this.pickingMaterial.lights = false;
        this.pickingMaterial.uniforms.fontTexture.value = this.tex;
        this.pickingMaterial.needsUpdate = true;

    },

    setAttributes: function( data ){

        var position, size, color;
        var aPosition, inputSize, aColor;

        var text = this.text;
        var attributes = this.geometry.attributes;

        if( data.position ){
            position = data.position;
            aPosition = attributes.position.array;
            attributes.position.needsUpdate = true;
        }

        if( data.size ){
            size = data.size;
            inputSize = attributes.inputSize.array;
            attributes.inputSize.needsUpdate = true;
        }

        if( data.color ){
            color = data.color;
            aColor = attributes.color.array;
            attributes.color.needsUpdate = true;
        }

        var n = this.positionCount;

        var i, j, o;
        var iCharAll = 0;
        var txt, iChar, nChar;

        for( var v = 0; v < n; v++ ) {

            o = 3 * v;
            txt = text[ v ];
            nChar = txt.length;

            for( iChar = 0; iChar < nChar; iChar++, iCharAll++ ) {

                i = iCharAll * 2 * 4;

                for( var m = 0; m < 4; m++ ) {

                    j = iCharAll * 4 * 3 + ( 3 * m );

                    if( position ){

                        aPosition[ j     ] = position[ o     ];
                        aPosition[ j + 1 ] = position[ o + 1 ];
                        aPosition[ j + 2 ] = position[ o + 2 ];

                    }

                    if( size ){

                        inputSize[ ( iCharAll * 4 ) + m ] = size[ v ];

                    }

                    if( color ){

                        aColor[ j     ] = color[ o     ];
                        aColor[ j + 1 ] = color[ o + 1 ];
                        aColor[ j + 2 ] = color[ o + 2 ];

                    }

                }

            }

        }

    },

    makeTexture: function(){

        if( this.tex ) this.tex.dispose();
        if( this.ta ) this.ta.dispose();

        var ta = new TextAtlas( {
            font: [ this.fontFamily ],
            style: this.fontStyle,
            weight: this.fontWeight,
            size: this.fontSize,
            outline: this.sdf ? 5 : 0
        } );

        for( var i = 0; i < 256; ++i ){
            ta.map( String.fromCharCode( i ) );
        }

        this.ta = ta;

        this.tex = new CanvasTexture( ta.canvas2 );
        this.tex.flipY = false;
        this.tex.needsUpdate = true;

    },

    makeMapping: function(){

        var ta = this.ta;
        var text = this.text;

        var inputTexCoord = this.geometry.attributes.inputTexCoord.array;
        var inputMapping = this.geometry.attributes.mapping.array;

        var n = this.positionCount;

        var c;
        var i, j, o;
        var iCharAll = 0;
        var txt, xadvance, iChar, nChar;

        for( var v = 0; v < n; v++ ) {

            o = 3 * v;
            txt = text[ v ];
            xadvance = 0;
            nChar = txt.length;

            for( iChar = 0; iChar < nChar; iChar++, iCharAll++ ) {

                c = ta.mapped[ txt[ iChar ] ];
                i = iCharAll * 2 * 4;

                // top left
                inputMapping[ i + 0 ] = xadvance - ta.outline;
                inputMapping[ i + 1 ] = c.h - ta.outline;
                // bottom left
                inputMapping[ i + 2 ] = xadvance - ta.outline;
                inputMapping[ i + 3 ] = 0 - ta.outline;
                // top right
                inputMapping[ i + 4 ] = xadvance + c.w - ta.outline;
                inputMapping[ i + 5 ] = c.h - ta.outline;
                // bottom right
                inputMapping[ i + 6 ] = xadvance + c.w - ta.outline;
                inputMapping[ i + 7 ] = 0 - ta.outline;

                var texWidth = ta.width;
                var texHeight = ta.height;

                var texCoords = [
                    c.x/texWidth, c.y/texHeight,             // top left
                    c.x/texWidth, (c.y+c.h)/texHeight,       // bottom left
                    (c.x+c.w)/texWidth, c.y/texHeight,       // top right
                    (c.x+c.w)/texWidth, (c.y+c.h)/texHeight  // bottom right
                ];
                inputTexCoord.set( texCoords, i );

                xadvance += c.w - 2 * ta.outline;

            }

        }

        this.geometry.attributes.inputTexCoord.needsUpdate = true;
        this.geometry.attributes.mapping.needsUpdate = true;

    },

    getDefines: function( type ){

        var defines = Buffer.prototype.getDefines.call( this, type );

        if( this.sdf ){
            defines.SDF = 1;
        }

        return defines;

    },

    setUniforms: function( data ){

        if( data && (
                data.fontFamily !== undefined ||
                data.fontStyle !== undefined ||
                data.fontWeight !== undefined ||
                data.fontSize !== undefined ||
                data.sdf !== undefined
            )
        ){

            this.makeTexture();
            this.makeMapping();
            data.fontTexture = this.tex;

        }

        Buffer.prototype.setUniforms.call( this, data );

    },

    dispose: function(){

        Buffer.prototype.dispose.call( this );

        if( this.tex ) this.tex.dispose();
        if( this.ta ) this.ta.dispose();

    }

} );


export default TextBuffer;
