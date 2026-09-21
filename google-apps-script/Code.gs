/**
 * DRIVE FOLDER BRIDGE — paste this whole file into a new Apps Script
 * project created INSIDE the customer's Google account (the same
 * account that owns the Drive folders with their photos/videos).
 *
 * What it does: the wedding website can't talk to Google Drive
 * directly without asking every visitor to log in. This script runs
 * as a tiny "web app" under the owner's account and answers simple
 * questions like "what files are in the folder called pre-wedding?"
 * with a plain JSON list — no login needed for visitors.
 *
 * See README.md, section "Setting up a new customer", for the exact
 * deploy steps (Extensions/Apps Script -> paste -> Deploy -> Web app).
 *
 * Website calls look like:
 *   YOUR_SCRIPT_URL?folder=pre-wedding
 *   YOUR_SCRIPT_URL?folderId=1AbCdEfGh...
 *   YOUR_SCRIPT_URL?action=listFolders      (used by the admin panel)
 */

function doGet(e) {
  var params = e.parameter || {};

  if (params.action === "listFolders") {
    return jsonResponse(listRootFolders());
  }

  var folder;
  try {
    if (params.folderId) {
      folder = DriveApp.getFolderById(params.folderId);
    } else if (params.folder) {
      var it = DriveApp.getFoldersByName(params.folder);
      if (!it.hasNext()) {
        return jsonResponse({ error: "Folder not found: " + params.folder, files: [] });
      }
      folder = it.next();
    } else {
      return jsonResponse({ error: "Provide ?folder=NAME or ?folderId=ID", files: [] });
    }
  } catch (err) {
    return jsonResponse({ error: String(err), files: [] });
  }

  var files = [];
  var iter = folder.getFiles();
  while (iter.hasNext()) {
    var f = iter.next();
    files.push({
      id: f.getId(),
      name: f.getName(),
      mimeType: f.getMimeType(),
      updated: f.getLastUpdated().toISOString(),
    });
  }
  // Newest first -- usually what you want for a wedding gallery.
  files.sort(function (a, b) { return new Date(b.updated) - new Date(a.updated); });

  return jsonResponse({ folder: folder.getName(), count: files.length, files: files });
}

function listRootFolders() {
  var names = [];
  var it = DriveApp.getRootFolder().getFolders();
  while (it.hasNext()) names.push(it.next().getName());
  return { folders: names.sort() };
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
