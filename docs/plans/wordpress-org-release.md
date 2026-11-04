# WordPress.org release

**Status: submitted on 2026-11-04 and awaiting review; deploy postponed.** Battery Surf Bench 1.0.0 is in WordPress.org's review queue (see "Submitted" below). Until it's approved there is no SVN repository to deploy to and no credentials to deploy with. The deploy part of this plan records how releases will work once the plugin is approved. Implement it then, and delete this file in the PR that adds the deploy workflow.

## Already in place

- **`.wordpress-org/`** holds the directory artwork and screenshots: the icon, the banner, and `screenshot-1.png` to `screenshot-5.png`, captioned by the `== Screenshots ==` list in `readme.txt`. None of it ships in the plugin zip. Nothing else may live in the folder: the deploy action mirrors it into the SVN `assets/` directory and deletes anything that isn't there. `docs/images/wordpress-org/` holds the icon and banner sources, and its README explains how `pnpm screenshots` retakes the screenshots.
- **`composer zip:production`** builds `zip/battery-surf-bench.zip`: `composer check` (every lint, type check and unit test), the production bundles without the dev-tools panel, a production-only `vendor/`, the plugin assembled in `dist/battery-surf-bench/`, the zip, then `pnpm package:verify -- --production`. The zip holds the plugin in one top-level `battery-surf-bench/` folder, so installing it by hand puts the plugin in `wp-content/plugins/battery-surf-bench/`. A zip with its files at the root would install into a randomly named folder, which WordPress.org updates never reach. `composer serve:production` runs the same build and serves it on a fresh local Playground site, to try the production plugin before uploading it.
- **`pnpm package:verify`** (rules in `bin/PackageRules.mts`) fails the zip scripts, and with them CI, when a zip has an entry outside its one top-level `battery-surf-bench/` folder, an entry at the top of that folder outside the allowed list, a hidden file or folder outside `vendor/`, a translation source, a missing required entry, or a `vendor/` without `composer.json`. A production zip also fails on any dev-tools file and on any script that still carries dev-tools code; a development zip fails without the dev-tools files. Every zip gets the checks WordPress.org's upload form runs before anything else: no version-control folder and no `.zip`, `.gz`, `.tgz`, `.rar`, `.tar`, `.7z`, `.phar` or `.sh` file anywhere in the zip, `vendor/` included. A production zip must also stay under 10 MB.
- **Plugin Check in CI.** The `plugin-check` job in `.github/workflows/checks.yml` runs `composer zip:production`, then WordPress.org's Plugin Check Action on the plugin folder that zip holds, with the upload form's settings, on every pull request and every push to `master`. Like the form, it fails on errors only and shows warnings as annotations.
- **`readme.txt`** carries the release version, `1.0.0`, matching `Version:` in `battery-surf-bench.php`; `Tested up to: 7.1`; an External services section on the bundled course's YouTube video, which plays in YouTube's privacy-enhanced embed; a Third-party resources section that credits every bundled font, icon and library with its license; and a Source code section that links the repository and lists the build commands.
- **Prefixes reviewers accept.** Everything the plugin stores, registers or exposes globally is prefixed `bsbench`, `battery-surf-bench` or `battery_surf_bench`, never the three-letter `bsb` WordPress.org rejects. CLAUDE.md holds the rule.
- **Listing video.** The 60-second spot is on YouTube as Unlisted at https://youtu.be/X8CwzH_P4-g; its source is the `listing-video` branch. `readme.txt` puts the video's URL alone on its own line in the Description, which the plugin page turns into an embedded player: WordPress.org keeps oEmbed in readmes for YouTube, Vimeo and a short list of other providers, and strips raw HTML. There is no video field in the submission form, and WordPress.org builds the page from `readme.txt` alone (`README.md` is export-ignored, so it never reaches the zip or SVN).
- **No dev tools in the production zip.** The dev-tools panel (`includes/DevTools/`, `build/devtools/`) stays out of it, as the developer FAQ asks for a plugin without development tools. The production build compiles the panel, and the dev-tools code in the cockpit and the surfer, out of the bundles, and leaves its PHP out of the plugin folder; `package:verify` rejects a production zip that still carries any of it; and the plugin boots the panel only where its files are. `composer zip:development` builds `zip/battery-surf-bench-development.zip` with the panel, for testing on a site of your own. Never upload that one.

## Submitted

On 2026-11-04, `zip/battery-surf-bench.zip`, built from `master` at `b66ba4a`, was uploaded at https://wordpress.org/plugins/developers/add/ from the `erdembircan` account. Plugin Check was green on `master`, `Tested up to: 7.1` matched the current WordPress major, and the reviewer note pointed out the Chromium-and-battery requirement and the repository. The upload's automated scan passed, and the plugin got the slug `battery-surf-bench`, so its page will be https://wordpress.org/plugins/battery-surf-bench/ once approved. 586 plugins were waiting for a first review that day, a longer queue than usual.

While it waits for review:

1. **Watch for the review email.** It comes from plugins@wordpress.org with the subject "[WordPress Plugin Directory] Review in Progress: Battery Surf Bench". Keep that address in the account's contacts and out of spam, and keep the account's email working, with no autoresponder.
2. **To change the files before the review starts,** use "Upload updated" on the submission page, which replaces the submitted zip. Never submit the plugin a second time. The slug can also be changed there, once, until the review starts; after approval it can never change. Anything else wrong with the submission, such as the account it came from, goes in a reply to the confirmation email.
3. **Once the review starts,** send fixes and answers by replying to the review email.
4. **Approval** arrives by email, with access to `https://plugins.svn.wordpress.org/battery-surf-bench/`. Then wire up the deploy below.

## After approval: wire up the deploy

1. **Two-factor authentication and SVN password.** Approval makes the account a plugin committer, and WordPress.org requires two-factor authentication on committer accounts, so turn it on if it isn't on already. Then set an SVN password in the WordPress.org account settings. It's separate from the account password, and the SVN username is the case-sensitive WordPress.org username, not the email address.
2. **Secrets.** Add `SVN_USERNAME` and `SVN_PASSWORD` as GitHub Actions repository secrets.
3. **Workflow.** Add `.github/workflows/deploy.yml`:

   ```yaml
   name: Deploy to WordPress.org

   on:
     push:
       tags:
         - '*'

   permissions:
     contents: read

   jobs:
     deploy:
       runs-on: ubuntu-latest
       timeout-minutes: 20
       steps:
         - uses: actions/checkout@v6
         - uses: ./.github/actions/setup-php
         - uses: ./.github/actions/setup-node
         # Builds, zips and verifies the production plugin. The deploy action
         # takes a folder, not a zip: the one the build leaves in
         # dist/battery-surf-bench/.
         - run: composer zip:production
         - uses: 10up/action-wordpress-plugin-deploy@stable
           env:
             SVN_USERNAME: ${{ secrets.SVN_USERNAME }}
             SVN_PASSWORD: ${{ secrets.SVN_PASSWORD }}
             SLUG: battery-surf-bench
             BUILD_DIR: dist/battery-surf-bench
   ```

   By default the action packages the plugin with `git archive`, which leaves out the untracked `build/` bundles and `vendor/` tree. `BUILD_DIR` points it at the plugin folder `composer zip:production` assembled instead, and the action copies that folder's contents into SVN's `trunk/`, so SVN receives exactly what the verified zip holds. The action still copies `.wordpress-org/` from the repository root. For the first run, add `with: { dry-run: true }` to the deploy step to see the result without committing to SVN.
4. **Tags.** Tag each release with its bare version, such as `1.0.0`. The action uses the tag name as the SVN tag (dropping a leading `v`) and skips any version already in SVN.
5. **Contract chart.** Add the deploy workflow to `docs/contracts/ci-workflow.mmd`, and delete this plan, in the same PR.

## Later: artwork and readme updates between releases

`10up/action-wordpress-plugin-asset-update` pushes `readme.txt` and `.wordpress-org/` changes to SVN without a release, for example a new screenshot or a `Tested up to:` bump. It only syncs when nothing else has changed since the last deploy, so it needs a branch that receives only readme and artwork commits between releases. Without that branch, artwork changes go out with the next release. Retake the screenshots with `pnpm screenshots` whenever the screens they show change.
