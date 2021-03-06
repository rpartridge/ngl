uniform sampler2D fontTexture;
uniform float opacity;

varying vec3 vViewPosition;
varying vec2 texCoord;

#include common
#include color_pars_fragment
#include fog_pars_fragment

#ifdef SDF
    const float smoothness = 16.0;
#else
    const float smoothness = 256.0;
#endif
const float gamma = 2.2;

void main(){

    // retrieve signed distance
    float sdf = texture2D( fontTexture, texCoord ).a;

    // perform adaptive anti-aliasing of the edges
    float w = clamp(
        smoothness * ( abs( dFdx( texCoord.x ) ) + abs( dFdy( texCoord.y ) ) ),
        0.0,
        0.5
    );
    float a = smoothstep( 0.5 - w, 0.5 + w, sdf );

    // gamma correction for linear attenuation
    a = pow( a, 1.0 / gamma );
    if( a < 0.2 ) discard;
    a *= opacity;

    vec3 outgoingLight = vColor;

    gl_FragColor = vec4( outgoingLight, a );

    #include premultiplied_alpha_fragment
    #include tonemapping_fragment
    #include encodings_fragment
    #include fog_fragment

}