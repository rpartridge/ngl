/**
 * @file Surface Representation
 * @author Alexander Rose <alexander.rose@weirdbyte.de>
 * @private
 */


import { Vector3, Box3 } from "../../lib/three.es6.js";

import { defaults } from "../utils.js";
import Representation from "./representation.js";
import Volume from "../surface/volume.js";
import SurfaceBuffer from "../buffer/surface-buffer.js";
import DoubleSidedBuffer from "../buffer/doublesided-buffer";


function SurfaceRepresentation( surface, viewer, params ){

    Representation.call( this, surface, viewer, params );

    if( surface instanceof Volume ){
        this.surface = undefined;
        this.volume = surface;
    }else{
        this.surface = surface;
        this.volume = undefined;
    }

    this.boxCenter = new Vector3();
    this.__boxCenter = new Vector3();
    this.box = new Box3();
    this.__box = new Box3();

    this.setBox = ( function(){
        var position = new Vector3();
        return function(){
            var target = viewer.controls.target;
            var group = viewer.rotationGroup.position;
            position.copy( group ).negate().add( target );
            if( !position.equals( this.boxCenter ) ){
                this.setParameters( { "boxCenter": position } );
            }
        }.bind( this );
    }.bind( this ) )();

    this.viewer.signals.orientationChanged.add(
        this.setBox
    );

    this.build();

}

SurfaceRepresentation.prototype = Object.assign( Object.create(

    Representation.prototype ), {

    constructor: SurfaceRepresentation,

    type: "surface",

    parameters: Object.assign( {

        isolevelType: {
            type: "select", options: {
                "value": "value", "sigma": "sigma"
            }
        },
        isolevel: {
            type: "number", precision: 2, max: 1000, min: -1000
        },
        smooth: {
            type: "integer", precision: 1, max: 10, min: 0
        },
        background: {
            type: "boolean", rebuild: true  // FIXME
        },
        opaqueBack: {
            type: "boolean", buffer: true
        },
        boxSize: {
            type: "integer", precision: 1, max: 100, min: 0
        },
        useWorker: {
            type: "boolean", rebuild: true
        }

    }, Representation.prototype.parameters ),

    init: function( params ){

        var p = params || {};
        p.colorScheme = defaults( p.colorScheme, "uniform" );
        p.colorValue = defaults( p.colorValue, 0xDDDDDD );

        this.isolevelType  = defaults( p.isolevelType, "sigma" );
        this.isolevel = defaults( p.isolevel, 2.0 );
        this.smooth = defaults( p.smooth, 0 );
        this.background = defaults( p.background, false );
        this.opaqueBack = defaults( p.opaqueBack, true );
        this.boxSize = defaults( p.boxSize, 0 );
        this.useWorker = defaults( p.useWorker, true );

        Representation.prototype.init.call( this, p );

    },

    attach: function( callback ){

        this.bufferList.forEach( function( buffer ){

            this.viewer.add( buffer );

        }, this );

        this.setVisibility( this.visible );

        callback();

    },

    prepare: function( callback ){

        if( this.volume ){

            var isolevel;

            if( this.isolevelType === "sigma" ){
                isolevel = this.volume.getValueForSigma( this.isolevel );
            }else{
                isolevel = this.isolevel;
            }

            if( !this.surface ||
                this.__isolevel !== isolevel ||
                this.__smooth !== this.smooth ||
                this.__boxSize !== this.boxSize ||
                ( this.boxSize > 0 &&
                    !this.__boxCenter.equals( this.boxCenter ) )
            ){
                this.__isolevel = isolevel;
                this.__smooth = this.smooth;
                this.__boxSize = this.boxSize;
                this.__boxCenter.copy( this.boxCenter );
                this.__box.copy( this.box );

                var onSurfaceFinish = function( surface ){
                    this.surface = surface;
                    callback();
                }.bind( this );

                if( this.useWorker ){
                    this.volume.getSurfaceWorker(
                        isolevel, this.smooth, this.boxCenter, this.boxSize,
                        onSurfaceFinish
                    );
                }else{
                    onSurfaceFinish(
                        this.volume.getSurface(
                            isolevel, this.smooth, this.boxCenter, this.boxSize
                        )
                    );
                }
            }else{
                callback();
            }

        }else{
            callback();
        }

    },

    create: function(){

        var surfaceBuffer = new SurfaceBuffer(
            this.surface.getPosition(),
            this.surface.getColor( this.getColorParams() ),
            this.surface.getIndex(),
            this.surface.getNormal(),
            undefined,  // this.surface.getPickingColor( this.getColorParams() ),
            this.getBufferParams( {
                background: this.background,
                opaqueBack: this.opaqueBack,
                dullInterior: false,
            } )
        );
        var doubleSidedBuffer = new DoubleSidedBuffer( surfaceBuffer );

        this.bufferList.push( doubleSidedBuffer );

    },

    update: function( what ){

        if( this.bufferList.length === 0 ) return;

        what = what || {};

        var surfaceData = {};

        if( what.position ){
            surfaceData.position = this.surface.getPosition();
        }

        if( what.color ){
            surfaceData.color = this.surface.getColor(
                this.getColorParams()
            );
        }

        if( what.index ){
            surfaceData.index = this.surface.getIndex();
        }

        if( what.normal ){
            surfaceData.normal = this.surface.getNormal();
        }

        this.bufferList.forEach( function( buffer ){
            buffer.setAttributes( surfaceData );
        } );

    },

    setParameters: function( params, what, rebuild ){

        if( params && params.isolevelType !== undefined &&
            this.volume
        ){

            if( this.isolevelType === "value" &&
                params.isolevelType === "sigma"
            ){

                this.isolevel = this.volume.getSigmaForValue(
                    this.isolevel
                );

            }else if( this.isolevelType === "sigma" &&
                params.isolevelType === "value"
            ){

                this.isolevel = this.volume.getValueForSigma(
                    this.isolevel
                );

            }

            this.isolevelType = params.isolevelType;

        }

        if( params && params.boxCenter ){
            this.boxCenter.copy( params.boxCenter );
            delete params.boxCenter;
        }

        Representation.prototype.setParameters.call(
            this, params, what, rebuild
        );

        if( this.volume ){
            this.volume.getBox( this.boxCenter, this.boxSize, this.box );
        }

        if( this.surface && (
                params.isolevel !== undefined ||
                params.smooth !== undefined ||
                params.boxSize !== undefined ||
                ( this.boxSize > 0 &&
                    !this.__box.equals( this.box ) )
            )
        ){
            this.build( {
                "__update": {
                    "position": true,
                    "color": true,
                    "index": true,
                    "normal": true
                }
            } );
        }

        return this;

    },

    dispose: function(){

        this.viewer.signals.orientationChanged.remove(
            this.setBox
        );

        Representation.prototype.dispose.call( this );

    }

} );


export default SurfaceRepresentation;
