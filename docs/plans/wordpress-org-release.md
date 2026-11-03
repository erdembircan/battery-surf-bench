# WordPress.org release

**Status: ready to submit; deploy postponed.** Everything the submission needs is in place except the steps under "Before submitting", which happen during the submission session. Battery Surf Bench isn't on WordPress.org yet, so there is no SVN repository to deploy to and no credentials to deploy with. The deploy part of this plan records how releases will work once the plugin is approved. Implement it then, and delete this file in the PR that adds the deploy workflow.

## Already in place

- **`.wordpress-org/`** holds the directory artwork and screenshots: the icon, the banner, and `screenshot-1.png` to `screenshot-5.png`, captioned by the `== Screenshots ==` list in `readme.txt`. None of it ships in the plugin zip. Nothing else may live in the folder: the deploy action mirrors it into the SVN `assets/` directory and deletes anything that isn't there. `docs/images/wordpress-org/` holds the icon and banner sources, and its README explains how `pnpm screenshots` retakes the screenshots.
- **`bin/Release.sh`** builds `zip/battery-surf-bench.zip`: the JS/CSS bundles, a production-only `vendor/`, `composer zip`, then `pnpm package:verify --release`. The zip holds the plugin in one top-level `battery-surf-bench/` folder, so installing it by hand puts the plugin in `wp-content/plugins/battery-surf-bench/`. A zip with its files at the root would install into a randomly named folder, which WordPress.org updates never reach.
- **`pnpm package:verify`** (rules in `bin/PackageRules.mts`) fails CI and the release build when the zip has an entry outside its one top-level `battery-surf-bench/` folder, an entry at the top of that folder outside the allowed list, a hidden file or folder outside `vendor/`, a missing required entry, or a `vendor/` without `composer.json`. It also enforces the checks WordPress.org's upload form runs before anything else: no version-control folder and no `.zip`, `.gz`, `.tgz`, `.rar`, `.tar`, `.7z`, `.phar` or `.sh` file anywhere in the zip (`vendor/` included, in a release zip), and a release zip under 10 MB.
- **Plugin Check in CI.** The `plugin-check` job in `.github/workflows/checks.yml` builds the release zip and runs WordPress.org's Plugin Check Action on it with the upload form's settings, on every pull request and every push to `master`. Like the form, it fails on errors only and shows warnings as annotations.
- **`readme.txt`** carries the release version, `1.0.0`, matching `Version:` in `battery-surf-bench.php`; `Tested up to: 7.1`; an External services section on the bundled course's YouTube video; and a Source code section that links the repository and lists the build commands.
- **Listing video.** The 60-second spot is on YouTube as Unlisted at https://youtu.be/X8CwzH_P4-g; its source is the `listing-video` branch. `readme.txt` puts the video's URL alone on its own line in the Description, which the plugin page turns into an embedded player: WordPress.org keeps oEmbed in readmes for YouTube, Vimeo and a short list of other providers, and strips raw HTML. There is no video field in the submission form, and WordPress.org builds the page from `readme.txt` alone (`README.md` is export-ignored, so it never reaches the zip or SVN).

## Before submitting

1. **Make the repository public.** WordPress.org requires the source of the compiled `build/` code to be publicly available. The readme's Source code section and the `Plugin URI:` header both point to https://github.com/erdembircan/battery-surf-bench, so it must be public before the upload. It goes public during the submission session.
2. **Recheck `Tested up to:`.** It must equal the current WordPress major version, major only: `7.1` on 2026-11-03. If a newer major is out by the upload, raise it in `readme.txt`, or Plugin Check fails the upload.
3. **Confirm Plugin Check is green** on the latest `plugin-check` run on `master`.
4. **Check the account.** Log in as the `Contributors:` account from `readme.txt` (`erdembircan`). Before it accepts an upload, the form checks that:
   - the account has two-factor authentication turned on, if it has, or once had, a plugin or a theme on WordPress.org;
   - the account's email host can receive WordPress.org's mail. Review mail comes from plugins@wordpress.org, so keep it out of spam;
   - the account has no other plugin in the review queue. Authors with over a million active installs may have ten.

The dev-tools panel (`includes/DevTools/`, `build/devtools/`) ships in the zip but only turns on in the `local` and `development` environment types. The developer FAQ asks for a plugin without development tools, so a reviewer may ask about it.

## Submitting

1. Run `bin/Release.sh`, then `composer install` to restore the dev dependencies it removes.
2. Logged in as `erdembircan`, upload `zip/battery-surf-bench.zip` at https://wordpress.org/plugins/developers/add/.
3. The slug comes from `Plugin Name:`, so it will be `battery-surf-bench`. No plugin had that slug on 2026-11-03. After the upload, the submit page lets you change the slug once, until the review starts. After approval it can never change.
4. If something about the submission is wrong, such as the account it came from, don't upload it again: reply to the confirmation email or write to plugins@wordpress.org.
5. The submit page says a review takes 1 to 10 days, and that the team aims to finish within 5 business days. Approval arrives by email, with access to `https://plugins.svn.wordpress.org/battery-surf-bench/`.

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
         # Builds and verifies zip/battery-surf-bench.zip.
         - run: bin/Release.sh
         # The deploy action takes a folder, not a zip. The zip unpacks into
         # dist/battery-surf-bench/.
         - run: unzip -q zip/battery-surf-bench.zip -d dist
         - uses: 10up/action-wordpress-plugin-deploy@stable
           env:
             SVN_USERNAME: ${{ secrets.SVN_USERNAME }}
             SVN_PASSWORD: ${{ secrets.SVN_PASSWORD }}
             SLUG: battery-surf-bench
             BUILD_DIR: dist/battery-surf-bench
   ```

   By default the action packages the plugin with `git archive`, which leaves out the untracked `build/` bundles and `vendor/` tree. `BUILD_DIR` points it at the plugin folder unpacked from the release zip instead, and the action copies that folder's contents into SVN's `trunk/`, so SVN receives exactly what `bin/Release.sh` built and verified. The action still copies `.wordpress-org/` from the repository root. For the first run, add `with: { dry-run: true }` to the deploy step to see the result without committing to SVN.
4. **Tags.** Tag each release with its bare version, such as `1.0.0`. The action uses the tag name as the SVN tag (dropping a leading `v`) and skips any version already in SVN.
5. **Contract chart.** Add the deploy workflow to `docs/contracts/ci-workflow.mmd`, and delete this plan, in the same PR.

## Later: artwork and readme updates between releases

`10up/action-wordpress-plugin-asset-update` pushes `readme.txt` and `.wordpress-org/` changes to SVN without a release, for example a new screenshot or a `Tested up to:` bump. It only syncs when nothing else has changed since the last deploy, so it needs a branch that receives only readme and artwork commits between releases. Without that branch, artwork changes go out with the next release. Retake the screenshots with `pnpm screenshots` whenever the screens they show change.
