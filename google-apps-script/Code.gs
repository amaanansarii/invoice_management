/**
 * Naeem Service Centre - shared workshop tracker for Google Sheets.
 * Setup: create a blank Google Sheet, Extensions > Apps Script, paste this file,
 * set ACCESS_KEY below to a long random string, then Deploy > New deployment > Web app.
 * Execute as: Me. Who has access: Anyone. Keep the web app URL and ACCESS_KEY private.
 * This is a lightweight convenience endpoint, not strong authentication; anyone who
 * obtains both the URL and key can read or change the workshop list.
 */
const ACCESS_KEY = 'REPLACE_WITH_YOUR_WORKSHOP_ACCESS_KEY';
const SHEET_NAME = 'Workshop Jobs';
const HEADERS = ['id','bikeName','bikeNumber','customerName','customerPhone','status','amount','notes','createdAt','updatedAt'];

function getSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) sh = ss.insertSheet(SHEET_NAME);
  if (sh.getLastRow() === 0) sh.appendRow(HEADERS);
  return sh;
}
function json_(data, callback) {
  const body = JSON.stringify(data);
  if (callback && /^[A-Za-z_$][\w.$]*$/.test(callback)) {
    return ContentService.createTextOutput(callback + '(' + body + ');').setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(body).setMimeType(ContentService.MimeType.JSON);
}
function doGet(e) {
  const p = (e && e.parameter) || {};
  if (p.key !== ACCESS_KEY) return json_({ ok:false, error:'Unauthorized' }, p.callback);
  if (p.action === 'list') {
    const sh = getSheet_(); const values = sh.getDataRange().getValues();
    const headers = values.shift() || HEADERS;
    const jobs = values.filter(r => r[0]).map(r => {
      const obj = {}; headers.forEach((h,i) => obj[h] = r[i]);
      ['createdAt','updatedAt'].forEach(k => obj[k] = Number(obj[k]) || 0);
      obj.amount = String(obj.amount ?? ''); return obj;
    });
    return json_({ ok:true, jobs }, p.callback);
  }
  return json_({ ok:false, error:'Unknown action' }, p.callback);
}
function doPost(e) {
  let p;
  try { p = JSON.parse((e.postData && e.postData.contents) || '{}'); }
  catch (_) { return json_({ok:false,error:'Invalid JSON'}); }
  if (p.key !== ACCESS_KEY) return json_({ok:false,error:'Unauthorized'});
  const sh = getSheet_();
  if (p.action === 'upsert' && p.job && p.job.id) {
    const job = p.job; const data = sh.getDataRange().getValues(); let row = -1;
    for (let i=1; i<data.length; i++) if (String(data[i][0]) === String(job.id)) { row=i+1; break; }
    const values = HEADERS.map(h => job[h] == null ? '' : job[h]);
    if (row === -1) sh.appendRow(values); else sh.getRange(row,1,1,HEADERS.length).setValues([values]);
    return json_({ok:true});
  }
  if (p.action === 'delete' && p.id) {
    const data = sh.getDataRange().getValues();
    for (let i=data.length-1; i>=1; i--) if (String(data[i][0]) === String(p.id)) sh.deleteRow(i+1);
    return json_({ok:true});
  }
  return json_({ok:false,error:'Unknown action'});
}
