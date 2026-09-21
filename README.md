# Wedding Website Template — Photographer Edition

A fast, scroll-based wedding website template, built so you (the
photographer/business) can spin up a new one for every couple: photos
and videos live entirely in **their own Google Drive**, the site is
hosted for free on **GitHub Pages**, and you keep the only admin login.

## How it actually works

A GitHub Pages site can't run a server, and Google Drive won't let a
random website silently read a folder's contents without permission.
So this template bridges the two with one small helper script:

```
Couple's Google Drive  --->  a tiny Apps Script you deploy in their
   (photos/videos)           account, which answers "what's in the
                              pre-wedding folder?" as JSON
                                        |
                                        v
                          Your GitHub Pages site (index.html)
                          fetches that JSON and renders the
                          gallery / video / reels section
```

Nothing binary (no photos, no videos) ever touches GitHub. The only
thing stored in the repo is `data/site-settings.json` — a tiny text
file recording which Drive folder powers which section.

```
index.html                 the public site
admin.html                 your private control panel
assets/css/style.css       styling (design tokens at the top)
assets/js/config.js        per-couple basics: names, date, story
assets/js/main.js          public site behavior
assets/js/admin.js         admin panel behavior
data/site-settings.json    auto-generated: sections + hero photo
google-apps-script/Code.gs paste this into each customer's Drive account
```

## Setting up a new customer (do this once per couple)

### 1. Create their accounts
Create a fresh Google account and a fresh GitHub account for this
couple (or a new repo under an account you control — your call on
how you want to organize this across customers).

### 2. Get their photos and videos into Drive
In their Google Drive, manually create one folder per section you
want on the site, e.g.:
```
pre-wedding/
haldi/
ceremony-highlights/
web_reels/          <- short vertical clips for the Reels section
```
Upload their photos/videos into the matching folders (drag-and-drop
in Drive, from your own computer — this never goes through the
website). Set each folder's — or at least each file's — sharing to
**"Anyone with the link" → Viewer**, or the site won't be able to
display them to guests.

### 3. Deploy the Drive bridge (Apps Script)
This is the one slightly technical step, and you only do it once per
customer:

1. In the couple's Google Drive, go to **New → More → Google Apps
   Script** (or visit script.google.com while logged into their
   account).
2. Delete the placeholder code and paste in the contents of
   `google-apps-script/Code.gs` from this project.
3. Click **Deploy → New deployment**.
4. Click the gear icon next to "Select type" and choose **Web app**.
5. Set **Execute as: Me**, **Who has access: Anyone**.
6. Click **Deploy**, authorize it when prompted, and copy the **Web
   app URL** it gives you (ends in `/exec`). You'll paste this into
   the admin panel in step 6 below.

### 4. Put the website on GitHub
Upload this whole folder to a new **public** GitHub repository for
this couple. Go to **Settings → Pages**, set source to the `main`
branch / root folder. Your site appears at
`https://USERNAME.github.io/REPO_NAME/` shortly after.

### 5. Point config.js at the right repo
Edit `assets/js/config.js`: fill in `github.owner` / `github.repo`,
and the couple's names, wedding date, venue, story and schedule.
Commit the change.

### 6. Use the admin panel to wire it all together
Visit `https://USERNAME.github.io/REPO_NAME/admin.html`:

1. **Set an admin password.** This is a local lock on the door, not
   real security — it just stops a client or random visitor from
   stumbling into the panel. Keep it on your business's devices only.
2. **Paste a GitHub token** — create one at
   github.com/settings/personal-access-tokens/new, fine-grained,
   scoped to only this couple's repo, with **Contents: Read and
   write**. This token is the real access control: without it,
   nothing can be changed, password or not.
3. **Paste the Apps Script Web App URL** from step 3 above.
4. **Set the homepage background** — paste the Drive link of any one
   photo you'd like behind the couple's names on the hero section.
5. **Add sections** — for each Drive folder you created in step 2,
   give it a title, pick a type (Photo gallery / Video / Reels), and
   type the exact folder name. Hit the 🔍 test button on each row to
   confirm the site can actually see files in that folder before you
   move on.

Changes usually show up on the live site within a few seconds to a
minute.

## What guests see vs. what you control

- **Guests / the couple** only ever get the plain site URL. There's
  nothing on the public pages pointing at `admin.html`.
- **You (the business)** hold the admin password and the GitHub
  token for every customer site. Losing track of either just means
  regenerating them — it doesn't put the couple's photos at risk,
  since the token only ever touches the tiny settings file, never
  their media.

## Section types

- **Photo gallery** — a responsive grid; click any photo for a
  full-screen viewer with a crossfade transition between photos and
  prev/next navigation.
- **Video** — a main stage player with play/pause and next/previous,
  plus a thumbnail strip below. Tries to play each Drive video
  directly (true custom controls); if Drive won't stream a file
  directly (common for very large files), it automatically falls
  back to Google's own embedded player for that one video.
- **Reels** — a horizontally-scrolling strip of portrait clips, in
  the style of short-form video feeds. Only the reel someone actually
  taps loads and plays — the rest stay as lightweight poster images,
  which is what keeps the page fast even with 10+ clips in the
  folder.

## Performance notes

- Every section only fetches its Drive folder listing once the
  visitor scrolls near it — nothing loads upfront that isn't needed.
- Photo thumbnails, video posters, and reel posters all use Google's
  small resized thumbnail endpoint; only the lightbox and an actively
  playing video/reel ever load full-size media.
- Only one video is ever "live" at a time in the Video and Reels
  sections — switching to another one tears down the previous player
  first.
- Sections below the fold use `content-visibility: auto` so the
  browser can skip rendering work for content that's off-screen.

## Costs

Everything here is free: GitHub accounts, public repos, GitHub Pages
hosting, personal access tokens, Google accounts, Google Drive
storage (up to Google's free quota), and Apps Script deployments. The
only way this could ever cost money is if a specific customer's Drive
usage exceeds Google's free storage allowance — unrelated to the
website itself.

## Customizing the look

Colors, fonts and spacing live at the top of `assets/css/style.css`
under `:root`. The default palette is an "evening garden" theme —
deep forest ink, gold, dusty rose — you can swap the hex values per
customer if you want each couple's site to feel distinct.
