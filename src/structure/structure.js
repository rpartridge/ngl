/**
 * @file Structure
 * @author Alexander Rose <alexander.rose@weirdbyte.de>
 * @private
 */


import { Vector3, Box3 } from "../../lib/three.es6.js";
import Signal from "../../lib/signals.es6.js";

import { Debug, Log, GidPool, ColorMakerRegistry } from "../globals.js";
import { defaults } from "../utils.js";
import { copyWithin } from "../math/array-utils.js";
import Bitset from "../utils/bitset.js";
import RadiusFactory from "../utils/radius-factory.js";
import { Matrix, principalAxes } from "../math/matrix-utils.js";
import Selection from "../selection.js";
// import StructureView from "./structure-view.js";
import Unitcell from "../symmetry/unitcell.js";
import Assembly from "../symmetry/assembly.js";

import BondStore from "../store/bond-store.js";
import AtomStore from "../store/atom-store.js";
import ResidueStore from "../store/residue-store.js";
import ChainStore from "../store/chain-store.js";
import ModelStore from "../store/model-store.js";

import AtomMap from "../store/atom-map.js";
import ResidueMap from "../store/residue-map.js";

import BondProxy from "../proxy/bond-proxy.js";
import AtomProxy from "../proxy/atom-proxy.js";
import ResidueProxy from "../proxy/residue-proxy.js";
import ChainProxy from "../proxy/chain-proxy.js";
import ModelProxy from "../proxy/model-proxy.js";


/**
 * {@link Signal}, dispatched when Structure.refresh() is called
 * @example
 * structure.signals.refreshed( function(){ ... } );
 * @event Structure#refreshed
 */

/**
 * Bond iterator callback
 * @callback bondCallback
 * @param {BondProxy} bondProxy - current bond proxy
 */

/**
 * Atom iterator callback
 * @callback atomCallback
 * @param {AtomProxy} atomProxy - current atom proxy
 */

/**
 * Residue iterator callback
 * @callback residueCallback
 * @param {ResidueProxy} residueProxy - current residue proxy
 */

/**
 * Residue-list iterator callback
 * @callback residueListCallback
 * @param {ResidueProxy[]} residueProxyList - list of current residue proxies
 */

/**
 * Polymer iterator callback
 * @callback polymerCallback
 * @param {Polymer} polymer - current polymer object
 */

/**
 * Chain iterator callback
 * @callback chainCallback
 * @param {ChainProxy} chainProxy - current chain proxy
 */

/**
 * Model iterator callback
 * @callback modelCallback
 * @param {ModelProxy} modelProxy - current model proxy
 */


/**
 * Structure
 * @class
 * @param {String} name - structure name
 * @param {String} path - source path
 */
function Structure( name, path ){

    this.signals = {
        refreshed: new Signal(),
    };

    this.name = name;
    this.path = path;
    this.title = "";
    this.id = "";

    this.atomSetCache = {};
    this.atomSetDict = {};
    this.biomolDict = {};
    this.helices = [];
    this.sheets = [];
    this.unitcell = undefined;

    this.frames = [];
    this.boxes = [];

    this.bondStore = new BondStore( 0 );
    this.backboneBondStore = new BondStore( 0 );
    this.rungBondStore = new BondStore( 0 );
    this.atomStore = new AtomStore( 0 );
    this.residueStore = new ResidueStore( 0 );
    this.chainStore = new ChainStore( 0 );
    this.modelStore = new ModelStore( 0 );

    this.atomMap = new AtomMap( this );
    this.residueMap = new ResidueMap( this );

    this.atomSet = this.getAtomSet();
    this.bondSet = this.getBondSet();

    this.center = new Vector3();
    this.boundingBox = new Box3();

    GidPool.addObject( this );

    this._ap = this.getAtomProxy();
    this._rp = this.getResidueProxy();
    this._cp = this.getChainProxy();

}

Structure.prototype = {

    constructor: Structure,
    type: "Structure",

    /**
     * Updates atomSets and bondSets. Updates GidPool entry.
     * @fires Structure#refreshed
     */
    refresh: function(){

        if( Debug ) Log.time( "Structure.refresh" );

        this.atomSetCache = {};

        this.atomSet = this.getAtomSet();
        this.bondSet = this.getBondSet();

        for( var name in this.atomSetDict ){
            var as = this.atomSetDict[ name ];
            var as2 = this.getAtomSet( false );
            this.atomSetCache[ "__" + name ] = as2.intersection( as );
        }

        this.atomCount = this.atomSet.size();
        this.bondCount = this.bondSet.size();

        this.boundingBox = this.getBoundingBox();
        this.center = this.boundingBox.center();

        GidPool.updateObject( this );

        if( Debug ) Log.timeEnd( "Structure.refresh" );

        this.signals.refreshed.dispatch();

    },

    //

    getBondProxy: function( index ){

        return new BondProxy( this, index );

    },

    getAtomProxy: function( index, tmp ){

        if( tmp ){
            if( this.__tmpAtomProxy === undefined ){
                this.__tmpAtomProxy = new AtomProxy( this, index );
            }
            return this.__tmpAtomProxy;
        }else{
            return new AtomProxy( this, index );
        }

    },

    getResidueProxy: function( index, tmp ){

        if( tmp ){
            if( this.__tmpResidueProxy === undefined ){
                this.__tmpResidueProxy = new ResidueProxy( this, index );
            }
            return this.__tmpResidueProxy;
        }else{
            return new ResidueProxy( this, index );
        }

    },

    getChainProxy: function( index ){

        return new ChainProxy( this, index );

    },

    getModelProxy: function( index ){

        return new ModelProxy( this, index );

    },

    //

    getBondSet: function( selection ){

        // TODO implement selection parameter

        if( Debug ) Log.time( "Structure.getBondSet" );

        var n = this.bondStore.count;
        var bs = new Bitset( n );
        var as = this.atomSet;

        if( as ){

            var bp = this.getBondProxy();

            for( var i = 0; i < n; ++i ){
                bp.index = i;
                if( as.has( bp.atomIndex1 ) && as.has( bp.atomIndex2 ) ){
                    bs.add_unsafe( bp.index );
                }
            }

        }else{

            bs.set_all( true );

        }

        if( Debug ) Log.timeEnd( "Structure.getBondSet" );

        return bs;

    },

    getBackboneBondSet: function( selection ){

        // TODO implement selection parameter

        if( Debug ) Log.time( "Structure.getBackboneBondSet" );

        var n = this.backboneBondStore.count;
        var bs = new Bitset( n );
        var as = this.atomSetCache.__backbone;

        if( as ){

            var bp = this.getBondProxy();
            bp.bondStore = this.backboneBondStore;

            for( var i = 0; i < n; ++i ){
                bp.index = i;
                if( as.has( bp.atomIndex1 ) && as.has( bp.atomIndex2 ) ){
                    bs.add_unsafe( bp.index );
                }
            }

        }else{

            bs.set_all( true );

        }

        if( Debug ) Log.timeEnd( "Structure.getBackboneBondSet" );

        return bs;

    },

    getRungBondSet: function( selection ){

        // TODO implement selection parameter

        if( Debug ) Log.time( "Structure.getRungBondSet" );

        var n = this.rungBondStore.count;
        var bs = new Bitset( n );
        var as = this.atomSetCache.__rung;

        if( as ){

            var bp = this.getBondProxy();
            bp.bondStore = this.rungBondStore;

            for( var i = 0; i < n; ++i ){
                bp.index = i;
                if( as.has( bp.atomIndex1 ) && as.has( bp.atomIndex2 ) ){
                    bs.add_unsafe( bp.index );
                }
            }

        }else{

            bs.set_all( true );

        }

        if( Debug ) Log.timeEnd( "Structure.getRungBondSet" );

        return bs;

    },

    getAtomSet: function( selection ){

        if( Debug ) Log.time( "Structure.getAtomSet" );

        var as;
        var n = this.atomStore.count;

        if( selection === false ){

            as = new Bitset( n );

        }else if( selection === true ){

            as = new Bitset( n );
            as.set_all( true );

        }else if( selection && selection.test ){

            var seleString = selection.string;

            if( seleString in this.atomSetCache ){

                as = this.atomSetCache[ seleString ];

            }else{

                as = new Bitset( n );
                this.eachAtom( function( ap ){
                    as.add_unsafe( ap.index );
                }, selection );
                this.atomSetCache[ seleString ] = as;

            }

        }else{

            as = new Bitset( n );
            as.set_all( true );

        }

        if( Debug ) Log.timeEnd( "Structure.getAtomSet" );

        return as;

    },

    //

    getSelection: function(){

        return false;

    },

    getStructure: function(){

        return this;

    },

    /**
     * Bond iterator
     * @param  {bondCallback} callback - the callback
     * @param  {Selection} [selection] - the selection
     */
    eachBond: function( callback, selection ){

        var bp = this.getBondProxy();
        var bs = this.bondSet;

        if( selection && selection.test ){
            if( bs ){
                bs = bs.new_intersection( this.getBondSet( selection ) );
            }else{
                bs = this.getBondSet( selection );
            }
        }

        if( bs ){
            bs.forEach( function( index ){
                bp.index = index;
                callback( bp );
            } );
        }else{
            var n = this.bondStore.count;
            for( var i = 0; i < n; ++i ){
                bp.index = i;
                callback( bp );
            }
        }

    },

    /**
     * Atom iterator
     * @param  {atomCallback} callback - the callback
     * @param  {Selection} [selection] - the selection
     */
    eachAtom: function( callback, selection ){

        if( selection && selection.test ){
            this.eachModel( function( mp ){
                mp.eachAtom( callback, selection );
            }, selection );
        }else{
            var an = this.atomStore.count;
            var ap = this.getAtomProxy();
            for( var i = 0; i < an; ++i ){
                ap.index = i;
                callback( ap );
            }
        }

    },

    /**
     * Residue iterator
     * @param  {residueCallback} callback - the callback
     * @param  {Selection} [selection] - the selection
     */
    eachResidue: function( callback, selection ){

        var i;
        if( selection && selection.test ){
            var mn = this.modelStore.count;
            var mp = this.getModelProxy();
            if( selection.modelOnlyTest ){
                var modelOnlyTest = selection.modelOnlyTest;
                for( i = 0; i < mn; ++i ){
                    mp.index = i;
                    if( modelOnlyTest( mp ) ){
                        mp.eachResidue( callback, selection );
                    }
                }
            }else{
                for( i = 0; i < mn; ++i ){
                    mp.index = i;
                    mp.eachResidue( callback, selection );
                }
            }
        }else{
            var rn = this.residueStore.count;
            var rp = this.getResidueProxy();
            for( i = 0; i < rn; ++i ){
                rp.index = i;
                callback( rp );
            }
        }

    },

    /**
     * Multi-residue iterator
     * @param {Integer} n - window size
     * @param  {residueListCallback} callback - the callback
     */
    eachResidueN: function( n, callback ){

        var i, j;
        var rn = this.residueStore.count;
        if( rn < n ) return;
        var array = new Array( n );

        for( i = 0; i < n; ++i ){
            array[ i ] = this.getResidueProxy( i );
        }
        callback.apply( this, array );

        for( j = n; j < rn; ++j ){
            for( i = 0; i < n; ++i ){
                array[ i ].index += 1;
            }
            callback.apply( this, array );
        }

    },

    /**
     * Polymer iterator
     * @param  {polymerCallback} callback - the callback
     * @param  {Selection} [selection] - the selection
     */
    eachPolymer: function( callback, selection ){

        if( selection && selection.modelOnlyTest ){

            var modelOnlyTest = selection.modelOnlyTest;

            this.eachModel( function( mp ){
                if( modelOnlyTest( mp ) ){
                    mp.eachPolymer( callback, selection );
                }
            } );

        }else{

            this.eachModel( function( mp ){
                mp.eachPolymer( callback, selection );
            } );

        }

    },

    /**
     * Chain iterator
     * @param  {chainCallback} callback - the callback
     * @param  {Selection} [selection] - the selection
     */
    eachChain: function( callback, selection ){

        if( selection && selection.test ){
            this.eachModel( function( mp ){
                mp.eachChain( callback, selection );
            } );
        }else{
            var cn = this.chainStore.count;
            var cp = this.getChainProxy();
            for( var i = 0; i < cn; ++i ){
                cp.index = i;
                callback( cp );
            }
        }

    },

    /**
     * Model iterator
     * @param  {modelCallback} callback - the callback
     * @param  {Selection} [selection] - the selection
     */
    eachModel: function( callback, selection ){

        var i;
        var n = this.modelStore.count;
        var mp = this.getModelProxy();

        if( selection && selection.test ){
            var modelOnlyTest = selection.modelOnlyTest;
            if( modelOnlyTest ){
                for( i = 0; i < n; ++i ){
                    mp.index = i;
                    if( modelOnlyTest( mp ) ){
                        callback( mp, selection );
                    }
                }
            }else{
                for( i = 0; i < n; ++i ){
                    mp.index = i;
                    callback( mp, selection );
                }
            }
        }else{
            for( i = 0; i < n; ++i ){
                mp.index = i;
                callback( mp );
            }
        }

    },

    //

    getAtomData: function( params ){

        var p = Object.assign( {}, params );
        if( p.colorParams ) p.colorParams.structure = this.getStructure();

        var what = p.what;
        var atomSet = defaults( p.atomSet, this.atomSet );

        var radiusFactory, colorMaker, pickingColorMaker;
        var position, color, pickingColor, radius, index;

        var atomData = {};
        var ap = this.getAtomProxy();
        var atomCount = atomSet.size();

        if( !what || what.position ){
            position = new Float32Array( atomCount * 3 );
            atomData.position = position;
        }
        if( !what || what.color ){
            color = new Float32Array( atomCount * 3 );
            atomData.color = color;
            colorMaker = ColorMakerRegistry.getScheme( p.colorParams );
        }
        if( !what || what.pickingColor ){
            pickingColor = new Float32Array( atomCount * 3 );
            atomData.pickingColor = pickingColor;
            var pickingColorParams = Object.assign( p.colorParams, { scheme: "picking" } );
            pickingColorMaker = ColorMakerRegistry.getScheme( pickingColorParams );
        }
        if( !what || what.radius ){
            radius = new Float32Array( atomCount );
            atomData.radius = radius;
            radiusFactory = new RadiusFactory( p.radiusParams.radius, p.radiusParams.scale );
        }
        if( !what || what.index ){
            index = new Float32Array( atomCount );
            atomData.index = index;
        }

        atomSet.forEach( function( idx, i ){
            var i3 = i * 3;
            ap.index = idx;
            if( position ){
                ap.positionToArray( position, i3 );
            }
            if( color ){
                colorMaker.atomColorToArray( ap, color, i3 );
            }
            if( pickingColor ){
                pickingColorMaker.atomColorToArray( ap, pickingColor, i3 );
            }
            if( radius ){
                radius[ i ] = radiusFactory.atomRadius( ap );
            }
            if( index ){
                index[ i ] = idx;
            }
        } );
        return atomData;

    },

    getBondData: function( params ){

        var p = Object.assign( {}, params );
        if( p.colorParams ) p.colorParams.structure = this.getStructure();

        var what = p.what;
        var bondSet = defaults( p.bondSet, this.bondSet );
        var multipleBond = defaults( p.multipleBond, false );
        var bondSpacing = defaults( p.bondSpacing, 0.85 );

        var radiusFactory, colorMaker, pickingColorMaker;
        var position1, position2, color1, color2, pickingColor1, pickingColor2, radius1, radius2;

        var bondData = {};
        var bp = this.getBondProxy();
        if( p.bondStore ) bp.bondStore = p.bondStore;
        var ap1 = this.getAtomProxy();
        var ap2 = this.getAtomProxy();
        var bondCount;
        if( multipleBond ){
            var storeBondOrder = bp.bondStore.bondOrder;
            bondCount = 0;
            bondSet.forEach( function( index ){
                bondCount += storeBondOrder[ index ];
            } );
        }else{
            bondCount = bondSet.size();
        }

        if( !what || what.position ){
            position1 = new Float32Array( bondCount * 3 );
            position2 = new Float32Array( bondCount * 3 );
            bondData.position1 = position1;
            bondData.position2 = position2;
        }
        if( !what || what.color ){
            color1 = new Float32Array( bondCount * 3 );
            color2 = new Float32Array( bondCount * 3 );
            bondData.color1 = color1;
            bondData.color2 = color2;
            colorMaker = ColorMakerRegistry.getScheme( p.colorParams );
        }
        if( !what || what.pickingColor ){
            pickingColor1 = new Float32Array( bondCount * 3 );
            pickingColor2 = new Float32Array( bondCount * 3 );
            bondData.pickingColor1 = pickingColor1;
            bondData.pickingColor2 = pickingColor2;
            var pickingColorParams = Object.assign( p.colorParams, { scheme: "picking" } );
            pickingColorMaker = ColorMakerRegistry.getScheme( pickingColorParams );
        }
        if( !what || what.radius || ( multipleBond && what.position ) ){
            radiusFactory = new RadiusFactory( p.radiusParams.radius, p.radiusParams.scale );
        }
        if( !what || what.radius ){
            radius1 = new Float32Array( bondCount );
            if( p.radius2 ){
                radius2 = new Float32Array( bondCount );
                bondData.radius1 = radius1;
                bondData.radius2 = radius2;
            }else{
                bondData.radius = radius1;
            }
        }

        var i = 0;
        var j, i3, k, bondOrder, radius;

        var vt = new Vector3();
        var vShift = new Vector3();
        bondSet.forEach( function( index ){
            i3 = i * 3;
            bp.index = index;
            ap1.index = bp.atomIndex1;
            ap2.index = bp.atomIndex2;
            bondOrder = bp.bondOrder;
            if( position1 ){
                if( multipleBond && bondOrder > 1 ){
                    var radius = radiusFactory.atomRadius( ap1 );
                    var multiRadius = radius / bondOrder * bondSpacing;
                    // Get shift Vector:
                    bp.calculateShiftDir( vShift );
                    vShift.multiplyScalar( radius - multiRadius );
                    if( bondOrder === 2 ){
                        vt.addVectors( ap1, vShift ).toArray( position1, i3 );
                        vt.subVectors( ap1, vShift ).toArray( position1, i3 + 3 );
                        vt.addVectors( ap2, vShift ).toArray( position2, i3 );
                        vt.subVectors( ap2, vShift ).toArray( position2, i3 + 3 );
                    }else if( bondOrder === 3 ){
                        ap1.positionToArray( position1, i3 );
                        vt.addVectors( ap1, vShift ).toArray( position1, i3 + 3 );
                        vt.subVectors( ap1, vShift ).toArray( position1, i3 + 6 );
                        ap2.positionToArray( position2, i3 );
                        vt.addVectors( ap2, vShift ).toArray( position2, i3 + 3 );
                        vt.subVectors( ap2, vShift ).toArray( position2, i3 + 6 );
                    }else{
                        // todo, better fallback
                        ap1.positionToArray( position1, i3 );
                        ap2.positionToArray( position2, i3 );
                    }
                }else{
                    ap1.positionToArray( position1, i3 );
                    ap2.positionToArray( position2, i3 );
                }
            }
            if( color1 ){
                colorMaker.bondColorToArray( bp, 1, color1, i3 );
                colorMaker.bondColorToArray( bp, 0, color2, i3 );
                if( multipleBond && bondOrder > 1 ){
                    for( j = 1; j < bondOrder; ++j ){
                        k = j * 3 + i3;
                        copyWithin( color1, i3, k, 3 );
                        copyWithin( color2, i3, k, 3 );
                    }
                }
            }
            if( pickingColor1 ){
                pickingColorMaker.bondColorToArray( bp, 1, pickingColor1, i3 );
                pickingColorMaker.bondColorToArray( bp, 0, pickingColor2, i3 );
                if( multipleBond && bondOrder > 1 ){
                    for( j = 1; j < bondOrder; ++j ){
                        k = j * 3 + i3;
                        copyWithin( pickingColor1, i3, k, 3 );
                        copyWithin( pickingColor2, i3, k, 3 );
                    }
                }
            }
            if( radius1 ){
                radius1[ i ] = radiusFactory.atomRadius( ap1 );
                if( multipleBond && bondOrder > 1 ){
                    radius1[ i ] /= bondOrder * 1 / bondSpacing;
                    for( j = 1; j < bondOrder; ++j ){
                        radius1[ i + j ] = radius1[ i ];
                    }
                }
            }
            if( radius2 ){
                radius2[ i ] = radiusFactory.atomRadius( ap2 );
                if( multipleBond && bondOrder > 1 ){
                    radius2[ i ] = bondOrder * 1 / bondSpacing;
                    for( j = 1; j < bondOrder; ++j ){
                        radius2[ i + j ] = radius2[ i ];
                    }
                }
            }

            i += multipleBond ? bondOrder : 1;

        } );

        return bondData;

    },

    getBackboneAtomData: function( params ){

        params = Object.assign( {
            atomSet: this.atomSetCache.__backbone,
        }, params );

        return this.getAtomData( params );

    },

    getBackboneBondData: function( params ){

        params = Object.assign( {
            bondSet: this.getBackboneBondSet(),
            bondStore: this.backboneBondStore
        }, params );

        return this.getBondData( params );

    },

    getRungAtomData: function( params ){

        params = Object.assign( {
            atomSet: this.atomSetCache.__rung,
        }, params );

        return this.getAtomData( params );

    },

    getRungBondData: function( params ){

        params = Object.assign( {
            bondSet: this.getRungBondSet(),
            bondStore: this.rungBondStore
        }, params );

        return this.getBondData( params );

    },

    //

    getBoundingBox: function( selection ){

        if( Debug ) Log.time( "getBoundingBox" );

        var box = new Box3();

        var minX = +Infinity;
        var minY = +Infinity;
        var minZ = +Infinity;

        var maxX = -Infinity;
        var maxY = -Infinity;
        var maxZ = -Infinity;

        this.eachAtom( function( ap ){

            var x = ap.x;
            var y = ap.y;
            var z = ap.z;

            if( x < minX ) minX = x;
            if( y < minY ) minY = y;
            if( z < minZ ) minZ = z;

            if( x > maxX ) maxX = x;
            if( y > maxY ) maxY = y;
            if( z > maxZ ) maxZ = z;

        }, selection );

        box.min.set( minX, minY, minZ );
        box.max.set( maxX, maxY, maxZ );

        if( Debug ) Log.timeEnd( "getBoundingBox" );

        return box;

    },

    getPrincipalAxes: function( selection ){

        console.time( "getPrincipalAxes" );

        var i = 0;
        var coords = new Matrix( 3, this.atomCount );
        var cd = coords.data;

        this.eachAtom( function( a ){
            cd[ i + 0 ] = a.x;
            cd[ i + 1 ] = a.y;
            cd[ i + 2 ] = a.z;
            i += 3;
        }, selection );

        console.timeEnd( "getPrincipalAxes" );

        return principalAxes( coords );

    },

    atomCenter: function( selection ){

        if( selection ){
            return this.getBoundingBox( selection ).center();
        }else{
            return this.center.clone();
        }

    },

    getSequence: function( selection ){

        var seq = [];
        var rp = this.getResidueProxy();

        this.eachAtom( function( ap ){
            rp.index = ap.residueIndex;
            if( ap.index === rp.traceAtomIndex ){
                seq.push( rp.getResname1() );
            }
        }, selection );

        return seq;

    },

    getAtomIndices: function( selection ){

        var indices;

        if( selection && selection.string ){

            indices = [];
            this.eachAtom( function( ap ){
                indices.push( ap.index );
            }, selection );

        }else{

            var p = { what: { index: true } };
            indices = this.getAtomData( p ).index;

        }

        return indices;

    },

    //

    updatePosition: function( position ){

        var i = 0;

        this.eachAtom( function( ap ){
            ap.positionFromArray( position, i );
            i += 3;
        } );

    },

    /**
     * Removes structure from the GidPool. Calls dispose() method of property objects.
     * Unsets properties to help garbage collection.
     */
    dispose: function(){

        GidPool.removeObject( this );

        if( this.frames ) this.frames.length = 0;
        if( this.boxes ) this.boxes.length = 0;

        this.bondStore.dispose();
        this.backboneBondStore.dispose();
        this.rungBondStore.dispose();
        this.atomStore.dispose();
        this.residueStore.dispose();
        this.chainStore.dispose();
        this.modelStore.dispose();

        delete this.bondStore;
        delete this.atomStore;
        delete this.residueStore;
        delete this.chainStore;
        delete this.modelStore;

        delete this.frames;
        delete this.boxes;
        delete this.cif;

        delete this.bondSet;
        delete this.atomSet;

    }

};


export default Structure;
