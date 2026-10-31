// Renders every scene in shots.json into work/frames/, one after another (the
// supersampled scenes need the memory to themselves).
//   node src/tools/render-all.mjs [scene...]   → all scenes, or just the ones named
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const ROOT = new URL( '../../', import.meta.url ).pathname;
const T = JSON.parse( readFileSync( `${ ROOT }src/shots.json`, 'utf8' ) );
const only = process.argv.slice( 2 );
const scenes = T.scenes.map( ( s ) => s.name ).filter( ( n ) => ! only.length || only.includes( n ) );

for ( const name of scenes ) {
	const r = spawnSync( process.execPath, [ `${ ROOT }src/tools/render.mjs`, name ], { stdio: 'inherit' } );
	if ( r.status !== 0 ) {
		process.exit( r.status ?? 1 );
	}
}
