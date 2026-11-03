/**
 * The demo content the listing screenshots stage on the Playground site, the
 * way the listing video staged it: WordPress's sample page becomes an About
 * page, and the "Hello world!" post becomes a short article that the settings
 * screen adds to the surf course.
 */

export const ABOUT_PAGE: { title: string; content: string } = {
	title: 'About',
	content: `<!-- wp:paragraph -->
<p>Coastline Tech Notes writes about the energy side of everyday computing: what laptops, browsers and habits really cost a battery, measured rather than guessed.</p>
<!-- /wp:paragraph -->`,
};

export const DEMO_POST: { title: string; content: string } = {
	title: 'Ten Ways to Squeeze More Life From Your Laptop',
	content: `<!-- wp:paragraph -->
<p>Most of a laptop's battery goes to three things: the screen, the processor and the radios. You can't swap the hardware, but you can change how hard you work it. These ten habits add up.</p>
<!-- /wp:paragraph -->

<!-- wp:list {"ordered":true} -->
<ol class="wp-block-list"><!-- wp:list-item -->
<li><strong>Dim the screen.</strong> The display is usually the biggest single draw, and a few notches of brightness go a long way.</li>
<!-- /wp:list-item -->

<!-- wp:list-item -->
<li><strong>Close the tabs you aren't reading.</strong> Background tabs keep running timers, animations and trackers.</li>
<!-- /wp:list-item -->

<!-- wp:list-item -->
<li><strong>Pause video you aren't watching.</strong> Decoding video keeps the processor and graphics busy for as long as it plays.</li>
<!-- /wp:list-item -->

<!-- wp:list-item -->
<li><strong>Turn on battery saver.</strong> Your operating system will rein in background work before you notice it.</li>
<!-- /wp:list-item -->

<!-- wp:list-item -->
<li><strong>Switch off the keyboard backlight</strong> when there's daylight to type by.</li>
<!-- /wp:list-item -->

<!-- wp:list-item -->
<li><strong>Turn off the radios you don't need.</strong> Bluetooth searching for a headset it will never find still costs power.</li>
<!-- /wp:list-item -->

<!-- wp:list-item -->
<li><strong>Unplug USB accessories.</strong> Drives, dongles and lights all draw from the same battery.</li>
<!-- /wp:list-item -->

<!-- wp:list-item -->
<li><strong>Trim your browser extensions.</strong> Each one can run code on every page you open.</li>
<!-- /wp:list-item -->

<!-- wp:list-item -->
<li><strong>Keep it cool.</strong> Heat spins up the fans and ages the battery faster.</li>
<!-- /wp:list-item -->

<!-- wp:list-item -->
<li><strong>Measure, don't guess.</strong> Benchmark before and after a change to see what it's really worth.</li>
<!-- /wp:list-item --></ol>
<!-- /wp:list -->`,
};
