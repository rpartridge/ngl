/**
 * @file Atom Proxy
 * @author Alexander Rose <alexander.rose@weirdbyte.de>
 * @private
 */


import THREE from "../../lib/three.js";

import {
    ProteinType, RnaType, DnaType, WaterType, IonType, SaccharideType, UnknownType,
    ProteinBackboneType, RnaBackboneType, DnaBackboneType, UnknownBackboneType,
    CgProteinBackboneType, CgRnaBackboneType, CgDnaBackboneType
} from "../structure/structure-constants.js";


function AtomProxy( structure, index ){

    this.structure = structure;
    this.chainStore = structure.chainStore;
    this.residueStore = structure.residueStore;
    this.atomStore = structure.atomStore;
    this.residueMap = structure.residueMap;
    this.atomMap = structure.atomMap;
    this.index = index;

}

AtomProxy.prototype = {

    constructor: AtomProxy,
    type: "AtomProxy",

    structure: undefined,
    chainStore: undefined,
    residueStore: undefined,
    atomStore: undefined,
    index: undefined,

    get modelIndex () {
        return this.chainStore.modelIndex[ this.chainIndex ];
    },
    get chainIndex () {
        return this.residueStore.chainIndex[ this.residueIndex ];
    },
    get residue () {
        console.warn( "residue - might be expensive" );
        return this.structure.getResidueProxy( this.residueIndex, false );
    },

    get residueIndex () {
        return this.atomStore.residueIndex[ this.index ];
    },
    set residueIndex ( value ) {
        this.atomStore.residueIndex[ this.index ] = value;
    },

    //

    get sstruc () {
        return this.residueStore.getSstruc( this.residueIndex );
    },
    get inscode () {
        return this.residueStore.getInscode( this.residueIndex );
    },
    get resno () {
        return this.residueStore.resno[ this.residueIndex ];
    },
    get chainname () {
        return this.chainStore.getChainname( this.chainIndex );
    },

    //

    get residueType () {
        return this.residueMap.get( this.residueStore.residueTypeId[ this.residueIndex ] );
    },
    get atomType () {
        return  this.atomMap.get( this.atomStore.atomTypeId[ this.index ] );
    },

    //

    get resname () {
        return this.residueType.resname;
    },
    get hetero () {
        return this.residueType.hetero;
    },

    //

    get atomname () {
        return this.atomType.atomname;
    },
    get element () {
        return this.atomType.element;
    },
    get vdw () {
        return this.atomType.vdw;
    },
    get covalent () {
        return this.atomType.covalent;
    },

    //

    get x () {
        return this.atomStore.x[ this.index ];
    },
    set x ( value ) {
        this.atomStore.x[ this.index ] = value;
    },

    get y () {
        return this.atomStore.y[ this.index ];
    },
    set y ( value ) {
        this.atomStore.y[ this.index ] = value;
    },

    get z () {
        return this.atomStore.z[ this.index ];
    },
    set z ( value ) {
        this.atomStore.z[ this.index ] = value;
    },

    get serial () {
        return this.atomStore.serial[ this.index ];
    },
    set serial ( value ) {
        this.atomStore.serial[ this.index ] = value;
    },

    get bfactor () {
        return this.atomStore.bfactor[ this.index ];
    },
    set bfactor ( value ) {
        this.atomStore.bfactor[ this.index ] = value;
    },

    get occupancy () {
        return this.atomStore.occupancy[ this.index ];
    },
    set occupancy ( value ) {
        this.atomStore.occupancy[ this.index ] = value;
    },

    // get bonds () {
    //     return this.atomStore.bonds[ this.index ];
    // },
    // set bonds ( value ) {
    //     this.atomStore.bonds[ this.index ] = value;
    // },

    get altloc () {
        return this.atomStore.getAltloc( this.index );
    },
    set altloc ( value ) {
        this.atomStore.setAltloc( this.index, value );
    },

    //

    isBackbone: function(){
        var backboneIndexList = this.residueType.backboneIndexList;
        // console.log(backboneIndexList)
        if( backboneIndexList.length > 0 ){
            var atomOffset = this.residueStore.atomOffset[ this.residueIndex ];
            return backboneIndexList.indexOf( this.index - atomOffset ) !== -1;
        }else{
            return false;
        }
    },

    isPolymer: function(){
        var moleculeType = this.residueType.moleculeType;
        return (
            moleculeType === ProteinType ||
            moleculeType === RnaType ||
            moleculeType === DnaType
        );
    },

    isSidechain: function(){
        return this.isPolymer() && !this.isBackbone();
    },

    isCg: function(){
        var backboneType = this.residueType.backboneType;
        return (
            backboneType === CgProteinBackboneType ||
            backboneType === CgRnaBackboneType ||
            backboneType === CgDnaBackboneType
        );
    },

    isHetero: function(){
        return this.residueType.hetero === 1;
    },

    isProtein: function(){
        return this.residueType.moleculeType === ProteinType;
    },

    isNucleic: function(){
        var moleculeType = this.residueType.moleculeType;
        return (
            moleculeType === RnaType ||
            moleculeType === DnaType
        );
    },

    isRna: function(){
        return this.residueType.moleculeType === RnaType;
    },

    isDna: function(){
        return this.residueType.moleculeType === DnaType;
    },

    isWater: function(){
        return this.residueType.moleculeType === WaterType;
    },

    isIon: function(){
        return this.residueType.moleculeType === IonType;
    },

    isSaccharide: function(){
        return this.residueType.moleculeType === SaccharideType;
    },

    distanceTo: function( atom ){
        var taa = this.atomStore;
        var aaa = atom.atomStore;
        var ti = this.index;
        var ai = atom.index;
        var x = taa.x[ ti ] - aaa.x[ ai ];
        var y = taa.y[ ti ] - aaa.y[ ai ];
        var z = taa.z[ ti ] - aaa.z[ ai ];
        var distSquared = x * x + y * y + z * z;
        return Math.sqrt( distSquared );
    },

    connectedTo: function( atom ){

        var taa = this.atomStore;
        var aaa = atom.atomStore;
        var ti = this.index;
        var ai = atom.index;

        if( taa.altloc && aaa.altloc ){
            var ta = taa.altloc[ ti ];  // use Uint8 value to compare
            var aa = aaa.altloc[ ai ];  // no need to convert to char
            // 0 is the Null character, 32 is the space character
            if( !( ta === 0 || aa === 0 || ta === 32 || aa === 32 || ( ta === aa ) ) ) return false;
        }

        var x = taa.x[ ti ] - aaa.x[ ai ];
        var y = taa.y[ ti ] - aaa.y[ ai ];
        var z = taa.z[ ti ] - aaa.z[ ai ];

        var distSquared = x * x + y * y + z * z;

        // if( this.residue.isCg() ) console.log( this.qualifiedName(), Math.sqrt( distSquared ), distSquared )
        if( distSquared < 64.0 && this.isCg() ) return true;

        if( isNaN( distSquared ) ) return false;

        var d = this.covalent + atom.covalent;
        var d1 = d + 0.3;
        var d2 = d - 0.5;

        return distSquared < ( d1 * d1 ) && distSquared > ( d2 * d2 );

    },

    positionFromArray: function( array, offset ){

        if( offset === undefined ) offset = 0;

        this.x = array[ offset + 0 ];
        this.y = array[ offset + 1 ];
        this.z = array[ offset + 2 ];

        return this;

    },

    positionToArray: function( array, offset ){

        if( array === undefined ) array = [];
        if( offset === undefined ) offset = 0;

        array[ offset + 0 ] = this.x;
        array[ offset + 1 ] = this.y;
        array[ offset + 2 ] = this.z;

        return array;

    },

    positionToVector3: function( v ){

        if( v === undefined ) v = new THREE.Vector3();

        v.x = this.x;
        v.y = this.y;
        v.z = this.z;

        return v;

    },

    positionFromVector3: function( v ){

        this.x = v.x;
        this.y = v.y;
        this.z = v.z;

        return this;

    },

    //

    qualifiedName: function( noResname ){
        var name = "";
        if( this.resname && !noResname ) name += "[" + this.resname + "]";
        if( this.resno !== undefined ) name += this.resno;
        if( this.inscode ) name += "^" + this.inscode;
        if( this.chainname ) name += ":" + this.chainname;
        if( this.atomname ) name += "." + this.atomname;
        if( this.altloc ) name += "%" + this.altloc;
        name += "/" + this.modelIndex;
        return name;
    },

    clone: function(){

        return new this.constructor( this.structure, this.index );

    },

    toObject: function(){

        return {
            index: this.index,
            residueIndex: this.residueIndex,

            atomno: this.atomno,
            resname: this.resname,
            x: this.x,
            y: this.y,
            z: this.z,
            element: this.element,
            chainname: this.chainname,
            resno: this.resno,
            serial: this.serial,
            vdw: this.vdw,
            covalent: this.covalent,
            hetero: this.hetero,
            bfactor: this.bfactor,
            altloc: this.altloc,
            atomname: this.atomname,
            modelindex: this.modelindex
        };

    }

};


export default AtomProxy;
