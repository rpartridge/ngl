
import XmlParser from "../../../src/parser/xml-parser.js";
import { autoLoad } from "../../../src/loader/loader-utils.js";


describe('parser/xml-parser', function() {


describe('parsing', function () {
    it('basic async', function () {
        var path = "../../data/3dqbInfo.xml";
        var sampleText = "Moin world!";
        return autoLoad( path ).then( function( xml ){
            var descr = xml.data.root;
            var pdb = descr.children[ 0 ];
            var id = pdb.attributes.structureId;
            assert.equal( "3DQB", id, "Passed!" );
        } );
    });
});


});
