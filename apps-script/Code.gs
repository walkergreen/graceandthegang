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
 * ── IMPORTANT: re-authorising after a code change ──────────────────
 * Sending email needs an OAuth scope that saving a row does not. Adding
 * MailApp to an already-authorised script does NOT re-prompt you, and
 * "Deploy → New version" does not either — the script keeps running under
 * the old grant and every send fails silently.
 *
 * After pasting this file: pick any function in the editor's dropdown,
 * press Run once, and approve the consent screen. Then redeploy.
 *
 * To check it worked, open <your /exec URL>?diag=1 in a browser. You want
 * "mailScopeGranted": true and a "remainingDailyQuota" number.
 *
 * To change what gets collected later, just edit the headers below.
 */

/**
 * Business inquiries are also emailed here the moment they arrive, so a
 * brand asking about a promo doesn't sit unread in a spreadsheet.
 * Add more addresses comma-separated. Set to '' to turn notifications off.
 * Newsletter signups are NOT emailed — they'd be noise.
 */
var NOTIFY_BUSINESS = 'walker@railscomedy.com, grace@graceandthegang.com';

var SHEETS = {
  newsletter: {
    name: 'Newsletter',
    headers: ['Timestamp', 'Name', 'Email', 'Source']
  },
  business: {
    name: 'Business Inquiries',
    headers: ['Timestamp', 'Name', 'Company', 'Email', 'Budget', 'Timeline', 'Project']
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
         data.budget || '', data.timeline || '', data.about || '']
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

    if (kind === 'business' && NOTIFY_BUSINESS) {
      notifyBusiness(data);
    }

    return respond({ ok: true });
  } catch (err) {
    return respond({ ok: false, error: String(err) });
  }
}

/**
 * GET /exec            → liveness check
 * GET /exec?diag=1     → tells you whether email will actually work.
 *
 * Use the diag form when inquiries are saving but not arriving. It reports
 * whether the mail scope has been granted, how much quota is left, and
 * whether the deployed code is the version with notifications in it.
 */
function doGet(e) {
  var diag = e && e.parameter && e.parameter.diag;
  if (!diag) {
    return respond({ ok: true, note: 'Grace and the Gang form receiver is live.' });
  }

  var out = {
    ok: true,
    hasNotifyFunction: typeof notifyBusiness === 'function',
    notifyTo: NOTIFY_BUSINESS || '(notifications off)',
    businessHeaders: SHEETS.business.headers
  };

  // Reading the quota needs the same scope as sending. If this throws, the
  // script has not been re-authorised since MailApp was added — which is
  // exactly why mail silently goes nowhere.
  try {
    out.mailScopeGranted = true;
    out.remainingDailyQuota = MailApp.getRemainingDailyQuota();
  } catch (err) {
    out.mailScopeGranted = false;
    out.mailError = String(err);
  }

  try {
    out.lastNotifyError = PropertiesService.getScriptProperties()
                            .getProperty('lastNotifyError') || '(none)';
  } catch (err) {
    out.lastNotifyError = 'unreadable: ' + String(err);
  }

  return respond(out);
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

function notifyBusiness(data) {
  try {
    var lines = [
      'New promotion inquiry from graceandthegang.com',
      '',
      'Name:     ' + (data.name || '—'),
      'Company:  ' + (data.company || '—'),
      'Email:    ' + (data.email || '—'),
      'Budget:   ' + (data.budget || 'not given'),
      'Timeline: ' + (data.timeline || 'not given'),
      '',
      'Project:',
      (data.about || '(not described)'),
      '',
      'Reply straight to this email to answer them.'
    ];
    MailApp.sendEmail({
      to: NOTIFY_BUSINESS,
      subject: 'Inquiry: ' + (data.company || 'unknown company'),
      body: lines.join('\n'),
      replyTo: data.email || undefined,
      name: 'Grace and the Gang site'
    });
    // Clear any previous failure once a send succeeds.
    PropertiesService.getScriptProperties().deleteProperty('lastNotifyError');
  } catch (err) {
    // A failed notification must never lose the row that's already saved —
    // but it must not vanish either, or you just stop getting email and
    // never find out why. Recorded for ?diag=1 to surface.
    console.error('notify failed: ' + err);
    try {
      PropertiesService.getScriptProperties()
        .setProperty('lastNotifyError', new Date().toISOString() + ' — ' + String(err));
    } catch (ignored) {}
  }
}

function respond(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
