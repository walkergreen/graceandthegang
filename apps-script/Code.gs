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
/**
 * Changing this address takes effect only after you publish a new version:
 *   Deploy → Manage deployments → pencil → Version: New version → Deploy
 *
 * Use "Manage deployments", NOT "New deployment". Editing the existing
 * deployment keeps the same /exec URL, so ENDPOINT in index.html stays
 * valid. "New deployment" mints a different URL and the site's forms would
 * keep posting to the old one.
 *
 * No re-authorisation needed — swapping an address adds no new scope.
 */
var NOTIFY_BUSINESS = 'cliffwgreen@gmail.com';

/**
 * RUN THIS ONCE from the editor after pasting or changing this file.
 *
 * Sending mail needs an OAuth scope that appending a row doesn't. Adding
 * MailApp to an already-authorised script does not re-prompt, and neither
 * does "Deploy → New version" — so the web app keeps running under the old
 * grant and every send fails silently inside notifyBusiness's catch.
 *
 * Running this forces the consent screen AND proves the send path works:
 * approve it, then check your inbox for "Grace and the Gang — mail is working".
 */
function authorizeAndTest() {
  var report = [];

  // Touch every API the script uses, so the consent screen asks for ALL
  // the scopes in one pass. MailApp alone won't surface the external
  // request scope that Resend needs, which is how sends kept falling back.
  try {
    var quota = MailApp.getRemainingDailyQuota();
    report.push('MailApp OK — quota ' + quota);
  } catch (err) {
    report.push('MailApp FAILED — ' + err);
  }

  try {
    UrlFetchApp.fetch('https://api.resend.com/', { muteHttpExceptions: true });
    report.push('UrlFetchApp OK — external requests allowed');
  } catch (err) {
    report.push('UrlFetchApp FAILED — ' + err);
  }

  var route = 'not attempted';
  try {
    route = sendFrom({
      to: NOTIFY_BUSINESS,
      subject: 'Grace and the Gang — mail is working',
      body: 'If you are reading this, the site can email you.\n\n' +
            report.join('\n') + '\n\nSent via: see subject route below.'
    });
    report.push('sent via ' + route);
  } catch (err) {
    report.push('send FAILED — ' + err);
  }

  Logger.log(report.join('\n'));
  return report.join(' | ');
}


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

    if (kind === 'business') {
      if (NOTIFY_BUSINESS) { notifyBusiness(data); }
      confirmToSender(data);
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

  out.resendConfigured = !!RESEND_API_KEY;
  out.sendAs = SEND_AS;

  try {
    var sp = PropertiesService.getScriptProperties();
    out.lastNotifyError = sp.getProperty('lastNotifyError') || '(none)';
    out.lastConfirmError = sp.getProperty('lastConfirmError') || '(none)';
    out.lastSendRoute = sp.getProperty('lastSendRoute') || '(nothing sent yet)';
    out.lastResendError = sp.getProperty('lastResendError') || '(none)';
  } catch (err) {
    out.propsError = String(err);
  }

  if (USE_GMAIL_ALIAS) {
    try {
      out.gmailAliases = GmailApp.getAliases();
    } catch (err) {
      out.gmailAliases = 'unreadable: ' + String(err);
    }
  } else {
    out.gmailAliases = '(alias route disabled)';
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
    // Guard: running this straight from the editor passes no data.
    if (!data) { throw new Error('called with no data — run authorizeAndTest() instead'); }
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
    // Route through sendFrom so this also comes from grace@ once Resend is
    // configured. Previously this went straight to MailApp, which is why
    // the notification kept arriving from the script owner's address even
    // after the confirmation had been switched over.
    sendFrom({
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

/**
 * Where a replying business lands, and how the auto-reply signs itself.
 *
 * SEND_AS is the address the confirmation appears to come FROM. It only
 * works once it is a *verified alias* on the Google account that owns this
 * script — Gmail → Settings → Accounts and Import → "Send mail as".
 * Google mails a confirmation code to the address; Porkbun forwarding
 * delivers it, so you can complete the verification.
 *
 * If the alias isn't verified, sendFrom() falls back to MailApp and the
 * mail still goes out from the script owner's address. It degrades rather
 * than failing — but check getAliases() below to know which you're getting.
 *
 * DNS matters too: for mail from this domain to pass SPF when Google sends
 * it, graceandthegang.com's SPF must include Google. See README.
 */
var SEND_AS = 'grace@graceandthegang.com';

/**
 * The Gmail-alias fallback is off by default. It needs gmail.settings.basic
 * / gmail.readonly — the scariest scopes on the consent screen — and only
 * works with a real mailbox, which Porkbun forwarding is not. Resend covers
 * this properly. Leave false unless you move to Workspace-hosted mail.
 */
var USE_GMAIL_ALIAS = false;
var REPLY_TO = 'grace@graceandthegang.com';
var SENDER_NAME = 'Grace and the Gang';

/**
 * A transactional email provider. This is the route that genuinely sends
 * FROM grace@graceandthegang.com with the domain's own DKIM signature.
 *
 * Porkbun's free forwarding cannot do this: fwd1.porkbun.com is inbound
 * only — ports 587 and 465 refuse connections, only 25 answers — so the
 * SMTP server Gmail auto-suggests will never authenticate. Forwarding is
 * not a mailbox, which is also why there's no password to enter.
 *
 * Setup:
 *   1. resend.com → free account (3,000 emails/month, ample here)
 *   2. Add domain graceandthegang.com, add the DKIM/SPF records it gives
 *      you at Porkbun, wait for "Verified"
 *   3. Create an API key, paste it below
 *
 * Leave blank and mail still goes out via the fallbacks below.
 */
var RESEND_API_KEY = '';

function sendViaResend(options) {
  var payload = {
    from: SENDER_NAME + ' <' + SEND_AS + '>',
    to: [options.to],
    subject: options.subject,
    text: options.body
  };
  if (options.htmlBody) { payload.html = options.htmlBody; }
  if (options.replyTo) { payload.reply_to = options.replyTo; }

  var res = UrlFetchApp.fetch('https://api.resend.com/emails', {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + RESEND_API_KEY },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });
  var code = res.getResponseCode();
  if (code < 200 || code >= 300) {
    throw new Error('resend ' + code + ': ' + res.getContentText().slice(0, 200));
  }
  return 'resend';
}

/**
 * Best available sender, degrading rather than failing:
 *   1. Resend      — true from grace@, DKIM-signed by the domain
 *   2. Gmail alias — from grace@, but needs a verified alias, which needs
 *                    a real mailbox (paid hosting), not forwarding
 *   3. MailApp     — from the script owner's address, reply-to grace@
 */
function sendFrom(options) {
  var props;
  try { props = PropertiesService.getScriptProperties(); } catch (e) { props = null; }
  function note(k, v) { try { if (props) { props.setProperty(k, v); } } catch (e) {} }

  if (RESEND_API_KEY) {
    try {
      var r = sendViaResend(options);
      note('lastSendRoute', 'resend @ ' + new Date().toISOString());
      note('lastResendError', '(none)');
      return r;
    } catch (err) {
      // Recorded, not swallowed — otherwise a silent fallback looks
      // identical to "Resend was never configured".
      console.error('resend failed, falling back: ' + err);
      note('lastResendError', new Date().toISOString() + ' — ' + String(err));
    }
  } else {
    note('lastResendError', '(RESEND_API_KEY is empty)');
  }
  try {
    if (USE_GMAIL_ALIAS && SEND_AS && GmailApp.getAliases().indexOf(SEND_AS) !== -1) {
      var withFrom = {};
      for (var k in options) { if (options.hasOwnProperty(k)) { withFrom[k] = options[k]; } }
      withFrom.from = SEND_AS;
      GmailApp.sendEmail(options.to, options.subject, options.body, withFrom);
      note('lastSendRoute', 'gmail-alias @ ' + new Date().toISOString());
      return 'gmail-alias';
    }
  } catch (err) {
    console.error('alias send failed, falling back: ' + err);
  }
  MailApp.sendEmail(options);
  note('lastSendRoute', 'mailapp @ ' + new Date().toISOString());
  return 'mailapp';
}

/** Run this to see whether the alias is ready. */
function checkAliases() {
  var aliases = GmailApp.getAliases();
  var ok = aliases.indexOf(SEND_AS) !== -1;
  Logger.log('Verified aliases: ' + JSON.stringify(aliases));
  Logger.log(ok
    ? 'READY — confirmations will send from ' + SEND_AS
    : 'NOT SET UP — add ' + SEND_AS + ' under Gmail > Settings > Accounts > Send mail as');
  return { aliases: aliases, sendAsReady: ok };
}

function looksLikeEmail(v) {
  return typeof v === 'string' && /^[^@\s]+@[^@\s.]+\.[^@\s]+$/.test(v.trim());
}

function esc(v) {
  return String(v == null ? '' : v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Auto-reply to whoever submitted the inquiry, so they know it arrived and
 * have a record of what they sent. Kept in its own try/catch: a bounced
 * confirmation must not cost you the notification or the saved row.
 */
function confirmToSender(data) {
  try {
    if (!data) { return; }
    if (!looksLikeEmail(data.email)) { return; }

    var first = String(data.name || '').trim().split(/\s+/)[0] || 'there';
    var rows = [
      ['Company', data.company],
      ['Budget', data.budget],
      ['Timeline', data.timeline],
      ['Project', data.about]
    ].filter(function (r) { return r[1]; });

    var plain = [
      'Hi ' + first + ',',
      '',
      'Thanks for getting in touch about working with Grace and the Gang.',
      'Your inquiry landed and Grace will get back to you personally —',
      'usually within a couple of days.',
      '',
      'Here is what you sent:',
      ''
    ].concat(rows.map(function (r) {
      return r[0] + ': ' + r[1];
    })).concat([
      '',
      'If you need to add anything, just reply to this email.',
      '',
      '— Grace and the Gang',
      'graceandthegang.com'
    ]).join('\n');

    var cells = rows.map(function (r) {
      return '<tr>' +
        '<td style="padding:6px 14px 6px 0;vertical-align:top;font:600 13px/1.5 Helvetica,Arial,sans-serif;' +
        'color:#8A5B84;text-transform:uppercase;letter-spacing:.06em;white-space:nowrap">' + esc(r[0]) + '</td>' +
        '<td style="padding:6px 0;font:400 15px/1.55 Helvetica,Arial,sans-serif;color:#4A1140">' +
        esc(r[1]).replace(/\n/g, '<br>') + '</td></tr>';
    }).join('');

    var html =
      // MailApp sets the MIME charset, but some clients honour the inline
      // meta instead — without it the en-dash in "$2,500 – $5,000" can land
      // as mojibake.
      '<meta charset="utf-8">' +
      '<div style="margin:0;padding:28px 16px;background:#FBE6F5">' +
        '<div style="max-width:520px;margin:0 auto;background:#FFFFFF;border-radius:20px;padding:30px 28px">' +
          '<p style="margin:0 0 4px;font:700 12px/1 Helvetica,Arial,sans-serif;letter-spacing:.16em;' +
            'text-transform:uppercase;color:#D2409B">Grace and the Gang</p>' +
          '<h1 style="margin:0 0 16px;font:700 26px/1.15 Helvetica,Arial,sans-serif;color:#4A1140">' +
            'Thanks, ' + esc(first) + ' &mdash; got it.</h1>' +
          '<p style="margin:0 0 18px;font:400 16px/1.6 Helvetica,Arial,sans-serif;color:#4A1140">' +
            'Your inquiry about working with us came through. Grace will reply personally, ' +
            'usually within a couple of days.</p>' +
          (cells
            ? '<table role="presentation" cellpadding="0" cellspacing="0" border="0" ' +
              'style="width:100%;border-top:2px solid #F3D6EC;border-bottom:2px solid #F3D6EC;margin:0 0 18px">' +
              cells + '</table>'
            : '') +
          '<p style="margin:0 0 22px;font:400 15px/1.6 Helvetica,Arial,sans-serif;color:#8A5B84">' +
            'Need to add something? Just reply to this email.</p>' +
          '<a href="https://www.graceandthegang.com/#reels" ' +
            'style="display:inline-block;background:#F28FD4;color:#3A0B33;text-decoration:none;' +
            'font:700 15px/1 Helvetica,Arial,sans-serif;padding:13px 22px;border-radius:999px">' +
            'See what we make</a>' +
        '</div>' +
        '<p style="max-width:520px;margin:14px auto 0;font:400 12px/1.5 Helvetica,Arial,sans-serif;' +
          'color:#8A5B84;text-align:center">' +
          'Sketch comedy out of Washington, DC &middot; graceandthegang.com</p>' +
      '</div>';

    sendFrom({
      to: data.email.trim(),
      subject: 'Thanks for reaching out to Grace and the Gang',
      body: plain,
      htmlBody: html,
      replyTo: REPLY_TO,
      name: SENDER_NAME
    });

    PropertiesService.getScriptProperties().deleteProperty('lastConfirmError');
  } catch (err) {
    console.error('confirmation failed: ' + err);
    try {
      PropertiesService.getScriptProperties()
        .setProperty('lastConfirmError', new Date().toISOString() + ' — ' + String(err));
    } catch (ignored) {}
  }
}

function respond(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
