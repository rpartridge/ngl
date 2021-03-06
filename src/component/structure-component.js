/**
 * @file Sturucture Component
 * @author Alexander Rose <alexander.rose@weirdbyte.de>
 * @private
 */


import Component from "./component.js";
import TrajectoryComponent from "./trajectory-component.js";
import { makeTrajectory } from "../trajectory/trajectory-utils.js";
import Selection from "../selection.js";
import StructureView from "../structure/structure-view.js";
import { superpose } from "../align/align-utils.js";


/**
 * {@link Signal}, dispatched when the default assembly is changed
 * @example
 * structureComponent.signals.defaultAssemblyChanged( function( value ){ ... } );
 * @event StructureComponent#defaultAssemblyChanged
 * @type {String}
 */


/**
 * Component wrapping a Structure object
 * @class
 * @extends Component
 * @param {Stage} stage - stage object the component belongs to
 * @param {Structure} structure - structure object to wrap
 * @param {ComponentParameters} params - component parameters
 */
function StructureComponent( stage, structure, params ){

    var p = params || {};
    p.name = p.name !== undefined ? p.name : structure.name;

    Component.call( this, stage, p );

    /**
     * The wrapped structure
     * @alias StructureComponent#structure
     * @member {Structure}
     */
    this.structure = structure;

    this.trajList = [];
    this.initSelection( p.sele );
    this.setDefaultAssembly( p.assembly || "" );

}

StructureComponent.prototype = Object.assign( Object.create(

    Component.prototype ), {

    constructor: StructureComponent,

    /**
     * Component type
     * @alias StructureComponent#type
     * @constant
     * @type {String}
     * @default
     */
    type: "structure",

    signals: Object.assign( {

        trajectoryAdded: null,
        trajectoryRemoved: null,
        defaultAssemblyChanged: null

    }, Component.prototype.signals ),

    /**
     * Initialize selection
     * @private
     * @param {String} string - selection string
     */
    initSelection: function( sele ){

        /**
         * Selection for {@link StructureComponent#structureView}
         * @alias StructureComponent#selection
         * @private
         * @member {Selection}
         */
        this.selection = new Selection( sele );

        /**
         * View on {@link StructureComponent#structure}.
         * Change its selection via {@link StructureComponent#setSelection}.
         * @alias StructureComponent#structureView
         * @member {StructureView}
         */
        this.structureView = new StructureView(
            this.structure, this.selection
        );

        this.selection.signals.stringChanged.add( function( string ){

            this.structureView.setSelection( this.selection );

            this.rebuildRepresentations();
            this.rebuildTrajectories();

        }, this );

    },

    /**
     * Set selection of {@link StructureComponent#structureView}
     * @alias StructureComponent#setSelection
     * @param {String} string - selection string
     */
    setSelection: function( string ){

        this.selection.setString( string );

        return this;

    },

    /**
     * Set the default assembly
     * @alias StructureComponent#setDefaultAssembly
     * @fires StructureComponent#defaultAssemblyChanged
     * @param {String} value - assembly name
     */
    setDefaultAssembly: function( value ){

        this.defaultAssembly = value;
        this.rebuildRepresentations();
        this.signals.defaultAssemblyChanged.dispatch( value );

    },

    /**
     * Rebuild all representations
     * @alias StructureComponent#rebuildRepresentations
     */
    rebuildRepresentations: function(){

        this.reprList.forEach( function( repr ){

            var p = repr.getParameters();
            p.defaultAssembly = this.defaultAssembly;

            repr.build( p );

        }, this );

    },

    /**
     * Rebuild all trajectories
     * @alias StructureComponent#rebuildTrajectories
     */
    rebuildTrajectories: function(){

        this.trajList.slice().forEach( function( trajComp ){
            trajComp.trajectory.setStructure( this.structureView );
        }, this );

    },

    /**
     * Add a new structure representation to the component
     * @alias StructureComponent#addRepresentation
     * @fires Component#representationAdded
     * @param {String} type - the name of the representation, one of:
     *                        axes, backbone, ball+stick, base, cartoon, contact,
     *                        distance, helixorient, hyperball, label, licorice, line
     *                        surface, ribbon, rocket, rope, spacefill, trace, tube,
     *                        unitcell.
     * @param {StructureRepresentationParameters} params - representation parameters
     * @return {RepresentationComponent} the created representation wrapped into
     *                                   a representation component object
     */
    addRepresentation: function( type, params ){

        var p = params || {};
        p.defaultAssembly = this.defaultAssembly;

        return Component.prototype.addRepresentation.call(
            this, type, this.structureView, p
        );

    },

    addTrajectory: function( trajPath, sele, i ){

        var params = { "i": i };

        var traj = makeTrajectory(
            trajPath, this.structureView, sele
        );

        traj.signals.frameChanged.add( function( value ){
            this.updateRepresentations( { "position": true } );
        }, this );

        var trajComp = new TrajectoryComponent( this.stage, traj, params, this );
        this.trajList.push( trajComp );
        this.signals.trajectoryAdded.dispatch( trajComp );

        return trajComp;

    },

    removeTrajectory: function( traj ){

        var idx = this.trajList.indexOf( traj );
        if( idx !== -1 ){
            this.trajList.splice( idx, 1 );
        }

        traj.dispose();

        this.signals.trajectoryRemoved.dispatch( traj );

    },

    dispose: function(){

        // copy via .slice because side effects may change trajList
        this.trajList.slice().forEach( function( traj ){
            traj.dispose();
        } );

        this.trajList.length = 0;
        this.structure.dispose();

        Component.prototype.dispose.call( this );

    },

    centerView: function( zoom, sele ){

        zoom = zoom !== undefined ? zoom : true;

        var center = this.getCenter( sele );

        if( zoom ){

            var bb;

            if( sele ){
                bb = this.structureView.getBoundingBox( new Selection( sele ) );
            }else{
                bb = this.structureView.boundingBox;
            }

            var bbSize = bb.size();
            var maxSize = Math.max( bbSize.x, bbSize.y, bbSize.z );
            var minSize = Math.min( bbSize.x, bbSize.y, bbSize.z );
            // var avgSize = ( bbSize.x + bbSize.y + bbSize.z ) / 3;
            zoom = Math.max( 1, maxSize + ( minSize / 2 ) );  // object size

            // zoom = bb.size().length();

        }

        this.viewer.centerView( zoom, center );

        return this;

    },

    getCenter: function( sele ){

        if( sele ){

            return this.structure.atomCenter( new Selection( sele ) );

        }else{

            return this.structure.center;

        }

    },

    superpose: function( component, align, sele1, sele2, xsele1, xsele2 ){

        // FIXME does not account for structure.atomSet

        superpose(
            this.structureView, component.structureView,
            align, sele1, sele2, xsele1, xsele2
        );

        this.updateRepresentations( { "position": true } );

        return this;

    },

    setVisibility: function( value ){

        Component.prototype.setVisibility.call( this, value );

        this.trajList.forEach( function( traj ){

            // FIXME ???
            traj.setVisibility( value );

        } );

        return this;

    },

} );


export default StructureComponent;
