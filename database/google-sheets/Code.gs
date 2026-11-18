/**
 * ============================================================================
 * CityPulse Civic Platform — Google Sheets + Google Drive API (Apps Script)
 * ============================================================================
 * วิธีติดตั้ง:
 * 1. สร้าง Google Sheet ใหม่ -> เมนู Extensions > Apps Script
 * 2. วางโค้ดนี้ลงใน Code.gs แล้วกด Save
 * 3. ตั้งค่า Script Properties (Project Settings > Script Properties):
 *    - DRIVE_FOLDER_ID : ID ของโฟลเดอร์ Google Drive สำหรับเก็บรูปภาพ
 *    - API_SECRET      : คีย์ลับสำหรับยืนยันตัวตนจาก Next.js Server (เช่น random string)
 * 4. รันฟังก์ชัน `setupDatabase()` 1 ครั้ง เพื่อสร้างชีตและหัวตารางทั้งหมดอัตโนมัติ
 * 5. กด Deploy > New deployment > Web app (Execute as: Me, Who has access: Anyone)
 *    * แนะนำให้เรียกผ่าน Next.js API Route (/api/sheets/...) เพื่อไม่ให้ API_SECRET หลุดไปฝั่ง Client
 * ============================================================================
 */

const SHEET_SCHEMAS = {
  complaints: [
    'id', 'title', 'description', 'categoryId', 'status', 'priority',
    'lng', 'lat', 'reporterName', 'phone', 'isAnonymous', 'reporterMemberId',
    'imageUrl', 'imageDriveFileId', 'imageName',
    'resolvedImageUrl', 'resolvedImageDriveFileId',
    'province', 'district', 'departmentId', 'assignedOfficer',
    'upvotes', 'createdAt', 'updatedAt'
  ],
  complaint_timeline: [
    'id', 'complaintId', 'date', 'time', 'title', 'description', 'status', 'officer', 'icon'
  ],
  complaint_comments: [
    'id', 'complaintId', 'authorId', 'author', 'text', 'role', 'createdAt'
  ],
  civic_polls: [
    'id', 'title', 'description', 'locationName', 'lng', 'lat', 'category',
    'agreeCount', 'disagreeCount', 'totalVotes', 'proposalBy', 'endDate'
  ],
  citizens: [
    'id', 'displayName', 'email', 'passwordHash', 'salt', 'phone',
    'homeProvince', 'joinedAt', 'avatarPose'
  ],
  complaint_upvotes: [
    'complaintId', 'userId', 'createdAt'
  ],
  poll_votes: [
    'pollId', 'userId', 'vote', 'createdAt'
  ],
  citizen_checkins: [
    'userId', 'checkinDate', 'createdAt'
  ],
  system_settings: [
    'id', 'platformName', 'defaultMapStyle', 'maintenanceMode', 'maintenanceMessage',
    'allowAnonymousReports', 'autoAssignDepartment', 'enableAir4ThaiLayer',
    'slaDefaultHours', 'maxUploadSizeMb', 'xpRewardsJson', 'updatedAt'
  ],
  user_preferences: [
    'userId', 'theme', 'mapStyle', 'updatedAt'
  ]
};

/**
 * รันฟังก์ชันนี้ 1 ครั้งเพื่อสร้างทุกแท็บชีต + ค่าเริ่มต้น System Settings & Polls
 */
function setupDatabase() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  Object.keys(SHEET_SCHEMAS).forEach(function (sheetName) {
    let sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
    }
    const headers = SHEET_SCHEMAS[sheetName];
    if (sheet.getLastRow() === 0) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#eef2ff');
      sheet.setFrozenRows(1);
    }
  });

  // Seed default system_settings if empty
  const settingsSheet = ss.getSheetByName('system_settings');
  if (settingsSheet.getLastRow() <= 1) {
    settingsSheet.appendRow([
      'global',
      'CityPulse',
      'voyager',
      false,
      'ระบบกำลังบำรุงรักษาฐานข้อมูลชั่วคราว ขออภัยในความไม่สะดวก',
      true,
      true,
      true,
      48,
      5,
      JSON.stringify({
        DAILY_CHECKIN: 15,
        UPVOTE: 5,
        COMMENT: 10,
        POLL_VOTE: 20,
        REPORT: 50,
        PHOTO_BONUS: 25,
        RESOLVED_BONUS: 100
      }),
      new Date().toISOString()
    ]);
  }

  // Seed initial civic_polls if empty
  const pollsSheet = ss.getSheetByName('civic_polls');
  if (pollsSheet.getLastRow() <= 1) {
    pollsSheet.getRange(2, 1, 2, 12).setValues([
      [
        'poll-1',
        'โครงการติดตั้งทางม้าลายอัจฉริยะพร้อมไฟสัญญาณคนข้าม แยกอโศก',
        'เนื่องจากคนเดินเท้าข้ามถนนหนาแน่น เสนอติดตั้งสัญญาณไฟตรวจจับคนข้ามและกล้องตรวจจับผู้ฝ่าฝืน',
        'สี่แยกอโศก-สุขุมวิท เขตวัฒนา',
        100.5614, 13.7365, 'pedestrian', 248, 19, 267,
        'เครือข่ายความปลอดภัยคนเดินเท้า', '30 ก.ย. 2026'
      ],
      [
        'poll-2',
        'ข้อเสนอขยายทางจักรยานและทางเดินริมคลองแสนแสบ สู่สวนเบญจกิติ',
        'สร้างทางเชื่อมสีเขียวร่มรื่น ลดการใช้รถยนต์ส่วนบุคคล เชื่อมต่อสถานีขนส่งสาธารณะ',
        'สะพานอโศก - ท่าเรือคลองแสนแสบ',
        100.5620, 13.7485, 'environment', 182, 14, 196,
        'กลุ่มพัฒนาเมืองยั่งยืน', '15 ต.ค. 2026'
      ]
    ]);
  }

  return 'CityPulse Google Sheets database initialized successfully.';
}

/**
 * GET Handler: ดึงข้อมูลทั้งหมดหรือเฉพาะ collection
 * ตัวอย่าง: ?action=bootstrap หรือ ?action=list&table=complaints
 */
function doGet(e) {
  try {
    verifyApiSecret_(e && e.parameter ? e.parameter.secret : '');
    const action = (e && e.parameter && e.parameter.action) || 'bootstrap';

    if (action === 'bootstrap') {
      const complaints = readTable_('complaints');
      const timeline = readTable_('complaint_timeline');
      const comments = readTable_('complaint_comments');

      const timelineByComplaint = groupBy_(timeline, 'complaintId');
      const commentsByComplaint = groupBy_(comments, 'complaintId');

      const hydratedComplaints = complaints.map(function (c) {
        return Object.assign({}, c, {
          coordinates: [Number(c.lng), Number(c.lat)],
          upvotes: Number(c.upvotes || 0),
          isAnonymous: c.isAnonymous === true || c.isAnonymous === 'TRUE',
          timeline: timelineByComplaint[c.id] || [],
          comments: commentsByComplaint[c.id] || []
        });
      });

      const polls = readTable_('civic_polls').map(function (p) {
        return Object.assign({}, p, {
          coordinates: [Number(p.lng), Number(p.lat)],
          agreeCount: Number(p.agreeCount || 0),
          disagreeCount: Number(p.disagreeCount || 0),
          totalVotes: Number(p.totalVotes || 0)
        });
      });

      const settingsRows = readTable_('system_settings');
      const settingsRow = settingsRows[0] || null;
      const systemSettings = settingsRow ? Object.assign({}, settingsRow, {
        xpRewards: safeJsonParse_(settingsRow.xpRewardsJson, {})
      }) : null;

      return jsonResponse_({
        ok: true,
        data: {
          complaints: hydratedComplaints,
          polls: polls,
          systemSettings: systemSettings
        }
      });
    }

    if (action === 'list') {
      const table = e.parameter.table;
      if (!SHEET_SCHEMAS[table]) {
        return jsonResponse_({ ok: false, error: 'Unknown table: ' + table });
      }
      if (table === 'citizens') {
        // Never expose passwordHash / salt in list endpoint
        const rows = readTable_('citizens').map(stripCitizenSecret_);
        return jsonResponse_({ ok: true, data: rows });
      }
      return jsonResponse_({ ok: true, data: readTable_(table) });
    }

    return jsonResponse_({ ok: false, error: 'Unsupported action: ' + action });
  } catch (err) {
    return jsonResponse_({ ok: false, error: err.message });
  }
}

/**
 * POST Handler: บันทึกข้อมูล + อัปโหลดภาพขึ้น Google Drive
 * Body JSON: { secret, action, payload }
 */
function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);

  try {
    const body = JSON.parse(e.postData.contents || '{}');
    verifyApiSecret_(body.secret || (e.parameter && e.parameter.secret));

    const action = body.action;
    const payload = body.payload || {};

    switch (action) {
      case 'uploadImage':
        return jsonResponse_({ ok: true, data: uploadImageToDrive_(payload) });

      case 'createComplaint':
        return jsonResponse_({ ok: true, data: createComplaint_(payload) });

      case 'updateComplaintStatus':
        return jsonResponse_({ ok: true, data: updateComplaintStatus_(payload) });

      case 'addComment':
        return jsonResponse_({ ok: true, data: addComment_(payload) });

      case 'toggleUpvote':
        return jsonResponse_({ ok: true, data: toggleUpvote_(payload) });

      case 'votePoll':
        return jsonResponse_({ ok: true, data: votePoll_(payload) });

      case 'checkIn':
        return jsonResponse_({ ok: true, data: checkIn_(payload) });

      case 'registerCitizen':
        return jsonResponse_({ ok: true, data: registerCitizen_(payload) });

      case 'loginCitizen':
        return jsonResponse_({ ok: true, data: loginCitizen_(payload) });

      case 'saveSystemSettings':
        return jsonResponse_({ ok: true, data: saveSystemSettings_(payload) });

      default:
        return jsonResponse_({ ok: false, error: 'Unsupported action: ' + action });
    }
  } catch (err) {
    return jsonResponse_({ ok: false, error: err.message });
  } finally {
    lock.releaseLock();
  }
}

// ============================================================================
// Google Drive Upload Helper
// ============================================================================

/**
 * อัปโหลดรูปภาพ Base64 (หรือ Data URL) ลงโฟลเดอร์ Google Drive
 * payload: { base64Data, fileName, mimeType, folderId? }
 */
function uploadImageToDrive_(payload) {
  if (!payload.base64Data) {
    throw new Error('base64Data is required');
  }
  const props = PropertiesService.getScriptProperties();
  const folderId = payload.folderId || props.getProperty('DRIVE_FOLDER_ID');
  if (!folderId) {
    throw new Error('DRIVE_FOLDER_ID is not configured in Script Properties');
  }

  // Strip data:image/...;base64, prefix if present
  let cleanBase64 = payload.base64Data;
  let detectedMime = payload.mimeType || 'image/jpeg';
  const match = /^data:([^;]+);base64,(.+)$/.exec(cleanBase64);
  if (match) {
    detectedMime = match[1];
    cleanBase64 = match[2];
  }

  const bytes = Utilities.base64Decode(cleanBase64);
  const fileName = payload.fileName || ('citypulse-' + Date.now() + '.jpg');
  const blob = Utilities.newBlob(bytes, detectedMime, fileName);

  const folder = DriveApp.getFolderById(folderId);
  const file = folder.createFile(blob);

  // ตั้งค่าให้ใครที่มีลิงก์สามารถดูได้ (สำหรับแสดงใน <img src="...">)
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  const fileId = file.getId();
  return {
    fileId: fileId,
    fileName: file.getName(),
    // ใช้ lh3.googleusercontent.com/d/<ID> หรือ /api/drive/image/<ID> เพื่อความเสถียรในการโหลด <img>
    imageUrl: 'https://lh3.googleusercontent.com/d/' + fileId,
    driveViewUrl: file.getUrl()
  };
}

// ============================================================================
// Domain Operations
// ============================================================================

function createComplaint_(p) {
  const now = new Date().toISOString();
  const id = p.id || ('complaint-' + Date.now());

  let imageUrl = p.imageUrl || '';
  let imageDriveFileId = p.imageDriveFileId || '';
  let imageName = p.imageName || '';

  // ถ้าส่ง imageBase64 มาเป็น data URL ให้อัปโหลดขึ้น Google Drive อัตโนมัติ
  if (p.imageBase64 && p.imageBase64.indexOf('data:') === 0) {
    const uploaded = uploadImageToDrive_({
      base64Data: p.imageBase64,
      fileName: imageName || (id + '.jpg')
    });
    imageUrl = uploaded.imageUrl;
    imageDriveFileId = uploaded.fileId;
    imageName = uploaded.fileName;
  } else if (p.imageBase64 && !imageUrl) {
    imageUrl = p.imageBase64;
  }

  const coords = Array.isArray(p.coordinates) ? p.coordinates : [Number(p.lng || 100.5231), Number(p.lat || 13.7367)];
  const row = {
    id: id,
    title: p.title || '',
    description: p.description || '',
    categoryId: p.categoryId || 'other',
    status: 'pending',
    priority: p.priority || 'medium',
    lng: coords[0],
    lat: coords[1],
    reporterName: p.reporterName || 'ไม่ระบุชื่อ',
    phone: p.phone || '',
    isAnonymous: Boolean(p.isAnonymous),
    reporterMemberId: p.reporterMemberId || '',
    imageUrl: imageUrl,
    imageDriveFileId: imageDriveFileId,
    imageName: imageName,
    resolvedImageUrl: '',
    resolvedImageDriveFileId: '',
    province: p.province || 'กรุงเทพมหานคร',
    district: p.district || '',
    departmentId: p.departmentId || 'dept-public-works',
    assignedOfficer: p.assignedOfficer || '',
    upvotes: 0,
    createdAt: p.createdAt || now,
    updatedAt: now
  };

  appendObject_('complaints', row);

  // บันทึก timeline แรก
  appendObject_('complaint_timeline', {
    id: 'tl-' + Date.now(),
    complaintId: id,
    date: p.createdAt || now.slice(0, 10),
    time: new Date().toTimeString().slice(0, 5),
    title: 'รับเรื่องร้องเรียน',
    description: 'ระบบบันทึกเรื่องร้องเรียนจากประชาชนเรียบร้อยแล้ว',
    status: 'pending',
    officer: '',
    icon: 'inbox'
  });

  return row;
}

function updateComplaintStatus_(p) {
  if (!p.complaintId) throw new Error('complaintId is required');
  let resolvedImageUrl = p.resolvedImageUrl || '';
  let resolvedImageDriveFileId = p.resolvedImageDriveFileId || '';

  if (p.resolvedImageBase64 && p.resolvedImageBase64.indexOf('data:') === 0) {
    const uploaded = uploadImageToDrive_({
      base64Data: p.resolvedImageBase64,
      fileName: p.complaintId + '-resolved.jpg'
    });
    resolvedImageUrl = uploaded.imageUrl;
    resolvedImageDriveFileId = uploaded.fileId;
  }

  const patch = {
    status: p.status,
    updatedAt: new Date().toISOString()
  };
  if (p.priority) patch.priority = p.priority;
  if (p.assignedOfficer) patch.assignedOfficer = p.assignedOfficer;
  if (resolvedImageUrl) patch.resolvedImageUrl = resolvedImageUrl;
  if (resolvedImageDriveFileId) patch.resolvedImageDriveFileId = resolvedImageDriveFileId;

  const updated = updateRowById_('complaints', 'id', p.complaintId, patch);

  if (p.timelineTitle) {
    appendObject_('complaint_timeline', {
      id: 'tl-' + Date.now(),
      complaintId: p.complaintId,
      date: p.eventDate || new Date().toISOString().slice(0, 10),
      time: p.eventTime || new Date().toTimeString().slice(0, 5),
      title: p.timelineTitle,
      description: p.timelineDescription || '',
      status: p.status,
      officer: p.officerName || '',
      icon: p.status === 'resolved' ? 'circle-check' : 'wrench'
    });
  }
  return updated;
}

function addComment_(p) {
  const row = {
    id: p.id || ('cmt-' + Date.now()),
    complaintId: p.complaintId,
    authorId: p.authorId || '',
    author: p.author || 'พลเมือง',
    text: p.text,
    role: p.role || 'citizen',
    createdAt: p.createdAt || new Date().toISOString()
  };
  appendObject_('complaint_comments', row);
  return row;
}

function toggleUpvote_(p) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('complaint_upvotes');
  const rows = readTableWithRowIndex_('complaint_upvotes');
  const existing = rows.find(function (r) {
    return r.data.complaintId === p.complaintId && r.data.userId === p.userId;
  });

  const complaintRows = readTableWithRowIndex_('complaints');
  const comp = complaintRows.find(function (r) { return r.data.id === p.complaintId; });
  if (!comp) throw new Error('Complaint not found');

  let currentUpvotes = Number(comp.data.upvotes || 0);
  let upvoted = false;

  if (existing) {
    sheet.deleteRow(existing.rowIndex);
    currentUpvotes = Math.max(0, currentUpvotes - 1);
  } else {
    appendObject_('complaint_upvotes', {
      complaintId: p.complaintId,
      userId: p.userId,
      createdAt: new Date().toISOString()
    });
    currentUpvotes += 1;
    upvoted = true;
  }

  updateRowById_('complaints', 'id', p.complaintId, { upvotes: currentUpvotes });
  return { complaintId: p.complaintId, upvoted: upvoted, upvotes: currentUpvotes };
}

function votePoll_(p) {
  const voteRows = readTableWithRowIndex_('poll_votes');
  const existing = voteRows.find(function (r) {
    return r.data.pollId === p.pollId && r.data.userId === p.userId;
  });
  if (existing) {
    throw new Error('User already voted on this poll');
  }

  appendObject_('poll_votes', {
    pollId: p.pollId,
    userId: p.userId,
    vote: p.vote,
    createdAt: new Date().toISOString()
  });

  const polls = readTable_('civic_polls');
  const poll = polls.find(function (item) { return item.id === p.pollId; });
  if (!poll) throw new Error('Poll not found');

  const agreeCount = Number(poll.agreeCount || 0) + (p.vote === 'agree' ? 1 : 0);
  const disagreeCount = Number(poll.disagreeCount || 0) + (p.vote === 'disagree' ? 1 : 0);
  const totalVotes = Number(poll.totalVotes || 0) + 1;

  return updateRowById_('civic_polls', 'id', p.pollId, {
    agreeCount: agreeCount,
    disagreeCount: disagreeCount,
    totalVotes: totalVotes
  });
}

function checkIn_(p) {
  const dateKey = p.checkinDate || Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyy-MM-dd');
  const rows = readTable_('citizen_checkins');
  const dup = rows.find(function (r) {
    return r.userId === p.userId && r.checkinDate === dateKey;
  });
  if (dup) return { alreadyCheckedIn: true, checkinDate: dateKey };

  const row = { userId: p.userId, checkinDate: dateKey, createdAt: new Date().toISOString() };
  appendObject_('citizen_checkins', row);
  return { alreadyCheckedIn: false, checkinDate: dateKey };
}

function registerCitizen_(p) {
  const email = String(p.email || '').trim().toLowerCase();
  if (!email || !p.password || !p.displayName) {
    throw new Error('displayName, email, password are required');
  }
  const existing = readTable_('citizens').find(function (c) {
    return String(c.email).toLowerCase() === email;
  });
  if (existing) throw new Error('Email already registered');

  const salt = Utilities.getUuid();
  const passwordHash = hashPassword_(p.password, salt);
  const row = {
    id: 'citizen-' + Date.now(),
    displayName: p.displayName,
    email: email,
    passwordHash: passwordHash,
    salt: salt,
    phone: p.phone || '',
    homeProvince: p.homeProvince || 'กรุงเทพมหานคร',
    joinedAt: new Date().toISOString(),
    avatarPose: p.avatarPose || 'default'
  };
  appendObject_('citizens', row);
  return stripCitizenSecret_(row);
}

function loginCitizen_(p) {
  const email = String(p.email || '').trim().toLowerCase();
  const user = readTable_('citizens').find(function (c) {
    return String(c.email).toLowerCase() === email;
  });
  if (!user) throw new Error('Invalid email or password');
  const expected = hashPassword_(p.password || '', user.salt);
  if (expected !== user.passwordHash) throw new Error('Invalid email or password');
  return stripCitizenSecret_(user);
}

function saveSystemSettings_(p) {
  return updateRowById_('system_settings', 'id', 'global', {
    platformName: p.platformName,
    defaultMapStyle: p.defaultMapStyle,
    maintenanceMode: Boolean(p.maintenanceMode),
    maintenanceMessage: p.maintenanceMessage,
    allowAnonymousReports: Boolean(p.allowAnonymousReports),
    autoAssignDepartment: Boolean(p.autoAssignDepartment),
    enableAir4ThaiLayer: Boolean(p.enableAir4ThaiLayer),
    slaDefaultHours: Number(p.slaDefaultHours || 48),
    maxUploadSizeMb: Number(p.maxUploadSizeMb || 5),
    xpRewardsJson: JSON.stringify(p.xpRewards || {}),
    updatedAt: new Date().toISOString()
  });
}

// ============================================================================
// Low-level Sheet & Security Utilities
// ============================================================================

function verifyApiSecret_(provided) {
  const expected = PropertiesService.getScriptProperties().getProperty('API_SECRET');
  if (expected && provided !== expected) {
    throw new Error('Unauthorized: invalid API secret');
  }
}

function readTable_(sheetName) {
  return readTableWithRowIndex_(sheetName).map(function (r) { return r.data; });
}

function readTableWithRowIndex_(sheetName) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  if (!sheet || sheet.getLastRow() <= 1) return [];
  const values = sheet.getDataRange().getValues();
  const headers = values[0];
  const results = [];
  for (var i = 1; i < values.length; i++) {
    var obj = {};
    for (var j = 0; j < headers.length; j++) {
      obj[headers[j]] = values[i][j];
    }
    results.push({ rowIndex: i + 1, data: obj });
  }
  return results;
}

function appendObject_(sheetName, obj) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  const headers = SHEET_SCHEMAS[sheetName];
  const row = headers.map(function (h) {
    return obj[h] !== undefined && obj[h] !== null ? obj[h] : '';
  });
  sheet.appendRow(row);
}

function updateRowById_(sheetName, idCol, idVal, patch) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  const headers = SHEET_SCHEMAS[sheetName];
  const rows = readTableWithRowIndex_(sheetName);
  const found = rows.find(function (r) { return String(r.data[idCol]) === String(idVal); });
  if (!found) throw new Error(sheetName + ' record not found: ' + idVal);

  const merged = Object.assign({}, found.data, patch);
  const newRow = headers.map(function (h) {
    return merged[h] !== undefined && merged[h] !== null ? merged[h] : '';
  });
  sheet.getRange(found.rowIndex, 1, 1, headers.length).setValues([newRow]);
  return merged;
}

function hashPassword_(password, salt) {
  const raw = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, salt + ':' + password);
  return raw.map(function (b) {
    const v = (b < 0 ? b + 256 : b).toString(16);
    return v.length === 1 ? '0' + v : v;
  }).join('');
}

function stripCitizenSecret_(row) {
  const copy = Object.assign({}, row);
  delete copy.passwordHash;
  delete copy.salt;
  return copy;
}

function groupBy_(items, key) {
  return items.reduce(function (acc, item) {
    const k = item[key];
    if (!acc[k]) acc[k] = [];
    acc[k].push(item);
    return acc;
  }, {});
}

function safeJsonParse_(str, fallback) {
  try { return JSON.parse(str); } catch (e) { return fallback; }
}

function jsonResponse_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

