/**
 * Grace and the Gang — form receiver.
 *
 * Writes newsletter signups and business inquiries straight into the
 * "Grace and the Gang Email Newsletter" spreadsheet. No Google Form in
 * between, so signups land in the sheet you already have.
 *
 * ── Setup (about two minutes) ──────────────────────────────────────
 *  1. Open the sheet:
 *     https://docs.google.com/spreadsheets/d/1aeFVx40WIEeZlQhQQd7GhvxArudLclqtwqvCHLKpdOk/edit
 *  2. Extensions → Apps Script. Delete whatever is in Code.gs and paste
 *     this whole file in. Save.
 *  3. Deploy → New deployment → gear icon → Web app.
 *       Execute as:      Me
 *       Who has access:  Anyone            ← must be "Anyone", not
 *                                            "Anyone with Google account"
 *  4. Deploy. Authorise when prompted (you'll get an "unverified app"
 *     warning — it's your own script; click Advanced → Go to project).
 *  5. Copy the Web app URL. It ends in /exec.
 *  6. Paste it into ENDPOINT near the bottom of index.html.
 *
 * To change what gets collected later, just edit the headers below.
 */

var SHEETS = {
  newsletter: {
    name: 'Newsletter',
    headers: ['Timestamp', 'Name', 'Email', 'Source']
  },
  business: {
    name: 'Business Inquiries',
    headers: ['Timestamp', 'Name', 'Company', 'Email', 'Budget', 'Timeline']
  }
};

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return respond({ ok: false, error: 'empty request' });
    }

    var data = JSON.parse(e.postData.contents);
    var kind = data.kind === 'business' ? 'business' : 'newsletter';
    var conf = SHEETS[kind];
    var sheet = getSheet(conf);
    var stamp = new Date();

    var row = kind === 'business'
      ? [stamp, data.name || '', data.company || '', data.email || '',
         data.budget || '', data.timeline || '']
      : [stamp, data.name || '', data.email || '', data.source || 'website'];

    // Newsletter only: skip an address that's already on the list.
    if (kind === 'newsletter' && data.email) {
      var existing = sheet.getRange(2, 3, Math.max(sheet.getLastRow() - 1, 1), 1)
                          .getValues()
                          .map(function (r) { return String(r[0]).trim().toLowerCase(); });
      if (existing.indexOf(String(data.email).trim().toLowerCase()) !== -1) {
        return respond({ ok: true, duplicate: true });
      }
    }

    sheet.appendRow(row);
    return respond({ ok: true });
  } catch (err) {
    return respond({ ok: false, error: String(err) });
  }
}

function doGet() {
  return respond({ ok: true, note: 'Grace and the Gang form receiver is live.' });
}

function getSheet(conf) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(conf.name);
  if (!sheet) {
    sheet = ss.insertSheet(conf.name);
  }
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(conf.headers);
    sheet.getRange(1, 1, 1, conf.headers.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function respond(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
