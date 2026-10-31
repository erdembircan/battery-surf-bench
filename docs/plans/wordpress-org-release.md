# WordPress.org release (postponed)

**Status: postponed.** Battery Surf Bench isn't on WordPress.org yet, so there is no SVN repository to deploy to and no credentials to deploy with. This plan records how releases will work once the plugin is approved. Implement it then, and delete this file in the PR that adds the deploy workflow.

## Already in place

- **`.wordpress-org/`** holds the directory artwork: the icon and banner. It never ships in the plugin zip. Nothing else may live in it: the deploy action mirrors the folder into the SVN `assets/` directory and deletes anything that isn't there. The editable sources and export commands are in `docs/images/wordpress-org/`.
- **`bin/Release.sh`** builds `zip/battery-surf-bench.zip`: the JS/CSS bundles, a production-only `vendor/`, `composer zip`, then `pnpm package:verify --release`.
- **`pnpm package:verify`** (rules in `bin/PackageRules.mts`) fails CI and the release build when the zip holds files that Plugin Check's file checks flag.
- **Listing video.** The 60-second spot is on YouTube as Unlisted at https://youtu.be/X8CwzH_P4-g; its source is the `listing-video` branch. `readme.txt` puts the video's URL alone on its own line in the Description, which the plugin page turns into an embedded player: WordPress.org keeps oEmbed for YouTube and Vimeo in readmes, and strips raw HTML. There is no video field in the submission form, and WordPress.org builds the page from `readme.txt` alone (`README.md` is export-ignored, so it never reaches the zip or SVN).

## Before submitting

1. **Publish the source of the compiled code.** WordPress.org requires the source of compiled or minified code to be publicly available, and strongly recommends documenting the build tools. The zip ships `build/`, compiled from `src/`, which is export-ignored, and this repository is private. Choose one:
   - make the GitHub repository public, and add a short section to `readme.txt` with its link and the build commands; or
   - ship `src/` and the build configuration in the zip: remove their export-ignore lines, add them to `ALLOWED_ROOTS` in `bin/PackageRules.mts`, and describe the build in `readme.txt`.
2. **Set the version.** `Version:` in `battery-surf-bench.php` and `Stable tag:` in `readme.txt` both say `1.0.0-dev`. Set both to the release version, and set `Tested up to:` to the current WordPress release.
3. **Run Plugin Check.** Install the Plugin Check plugin on a WordPress site, run it against the release zip, and fix every error. `pnpm package:verify` covers only the file checks.
4. **Optional: screenshots.** Add `screenshot-1.png`, `screenshot-2.png`, … to `.wordpress-org/` and a matching numbered list under `== Screenshots ==` in `readme.txt`. Screenshot filenames must be lowercase.

## Submitting

1. Run `bin/Release.sh`, then `composer install` to restore the dev dependencies it removes.
2. Logged in as the `Contributors:` account from `readme.txt` (`erdembircan`), upload `zip/battery-surf-bench.zip` at https://wordpress.org/plugins/developers/add/.
3. The slug can't change after submission. `battery-surf-bench` was still free on 2026-10-29.
4. The handbook says reviews start within 14 business days. Approval arrives by email, with access to `https://plugins.svn.wordpress.org/battery-surf-bench/`.

## After approval: wire up the deploy

1. **SVN password.** Set one in the WordPress.org account settings. It's separate from the account password, and the SVN username is the case-sensitive WordPress.org username, not the email address.
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
         # Builds and verifies zip/battery-surf-bench.zip.
         - run: bin/Release.sh
         # The deploy action takes a folder, not a zip.
         - run: unzip -q zip/battery-surf-bench.zip -d dist
         - uses: 10up/action-wordpress-plugin-deploy@stable
           env:
             SVN_USERNAME: ${{ secrets.SVN_USERNAME }}
             SVN_PASSWORD: ${{ secrets.SVN_PASSWORD }}
             SLUG: battery-surf-bench
             BUILD_DIR: dist
   ```

   By default the action packages the plugin with `git archive`, which leaves out the untracked `build/` bundles and `vendor/` tree. `BUILD_DIR` points it at the unzipped release zip instead, so SVN receives exactly what `bin/Release.sh` built and verified. The action still copies `.wordpress-org/` from the repository root. For the first run, add `with: { dry-run: true }` to the deploy step to see the result without committing to SVN.
4. **Tags.** Tag each release with its bare version, such as `1.0.0`. The action uses the tag name as the SVN tag (dropping a leading `v`) and skips any version already in SVN.
5. **Contract chart.** Add the deploy workflow to `docs/contracts/ci-workflow.mmd`, and delete this plan, in the same PR.

## Later: artwork and readme updates between releases

`10up/action-wordpress-plugin-asset-update` pushes `readme.txt` and `.wordpress-org/` changes to SVN without a release, for example a new screenshot or a `Tested up to:` bump. It only syncs when nothing else has changed since the last deploy, so it needs a branch that receives only readme and artwork commits between releases. Without that branch, artwork changes go out with the next release.
