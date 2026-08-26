/**
 * KS Enterprise Group - Google Apps Script Backend (High Performance & Resilient)
 * 
 * Instructions:
 * Option A (Recommended - Container-Bound):
 * 1. Open your Google Spreadsheet (or create a new sheet at sheets.new).
 * 2. In Google Sheets menu, click: Extensions -> Apps Script.
 * 3. Replace all existing code in Code.gs with this entire script.
 * 4. Click the Save icon (Ctrl+S or Cmd+S).
 * 5. Click "Deploy" (top right) -> "New deployment".
 * 6. Click the Gear icon beside "Select type" and choose "Web app".
 * 7. Set:
 *    - Description: "KS Enterprise Group API"
 *    - Execute as: "Me" (your account)
 *    - Who has access: "Anyone"
 *    - Click "Deploy", authorize access, and copy the Web App URL.
 * 9. Paste this URL into your environment variable: GOOGLE_APPS_SCRIPT_URL
 * 
 * Option B (Standalone Script at script.google.com):
 * - If you created this script directly in Google Apps Script (not from a Sheet),
 *   paste your Google Sheet ID into the SPREADSHEET_ID variable below (or leave blank
 *   to auto-create "KS Enterprise Group Database" in your Drive).
 */

// OPTIONAL: If running as a standalone script, paste your Spreadsheet ID here.
// e.g. var SPREADSHEET_ID = "1aBcDeFgHiJkLmNoPqRsTuVwXyZ123456789";
var SPREADSHEET_ID = "";

/**
 * Resilient Spreadsheet Resolver:
 * Resolves spreadsheet across container-bound, standalone, script properties, or Drive search/creation.
 */
function getSpreadsheet() {
  // 1. Check explicitly specified SPREADSHEET_ID
  if (typeof SPREADSHEET_ID === "string" && SPREADSHEET_ID.trim() !== "") {
    try {
      var ssById = SpreadsheetApp.openById(SPREADSHEET_ID.trim());
      if (ssById) return ssById;
    } catch (e) {
      console.warn("Could not open spreadsheet by SPREADSHEET_ID: " + e.message);
    }
  }

  // 2. Check ScriptProperties for previously saved SPREADSHEET_ID
  try {
    var savedId = PropertiesService.getScriptProperties().getProperty("SPREADSHEET_ID");
    if (savedId && savedId.trim() !== "") {
      var ssByProp = SpreadsheetApp.openById(savedId.trim());
      if (ssByProp) return ssByProp;
    }
  } catch (e) {}

  // 3. Try container-bound active spreadsheet (Extensions -> Apps Script)
  try {
    var activeSs = SpreadsheetApp.getActiveSpreadsheet();
    if (activeSs) return activeSs;
  } catch (e) {}

  try {
    var active = SpreadsheetApp.getActive();
    if (active) return active;
  } catch (e) {}

  // 4. Standalone script: search Google Drive for existing database sheet
  try {
    var files = DriveApp.getFilesByName("KS Enterprise Group Database");
    if (files.hasNext()) {
      var file = files.next();
      var foundSs = SpreadsheetApp.open(file);
      if (foundSs) {
        try {
          PropertiesService.getScriptProperties().setProperty("SPREADSHEET_ID", foundSs.getId());
        } catch (err) {}
        return foundSs;
      }
    }
  } catch (e) {}

  // 5. Standalone script fallback: Auto-create database spreadsheet in Drive
  try {
    var newSs = SpreadsheetApp.create("KS Enterprise Group Database");
    try {
      PropertiesService.getScriptProperties().setProperty("SPREADSHEET_ID", newSs.getId());
    } catch (err) {}
    return newSs;
  } catch (e) {
    throw new Error(
      "Spreadsheet context not found. Please open Google Sheets -> Extensions -> Apps Script to deploy, or set var SPREADSHEET_ID = 'YOUR_SPREADSHEET_ID' at line 25 in Code.gs."
    );
  }
}

/**
 * Resilient Sheet Retriever:
 * Handles sheet retrieval and automatic header initialization.
 */
function getSheet(ss, sheetName) {
  if (typeof ss === "string" && !sheetName) {
    sheetName = ss;
    ss = getSpreadsheet();
  } else if (!ss || typeof ss.getSheetByName !== "function") {
    ss = getSpreadsheet();
  }

  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    initializeSheetHeaders(sheet, sheetName);
  }
  return sheet;
}

function initializeSheetHeaders(sheet, name) {
  if (name === "Users") {
    sheet.appendRow(["Profile ID", "Name", "Hourly Wage", "Role", "Created At"]);
    sheet.getRange("A1:E1").setFontWeight("bold");
    sheet.setFrozenRows(1);
  } else if (name === "TimeEntries") {
    sheet.appendRow(["Entry ID", "Profile ID", "Project Name", "Clock In Time", "Clock Out Time", "Clock In Lat", "Clock In Lng", "Clock Out Lat", "Clock Out Lng", "Photos", "Is Billed", "Is Expense", "Expense Description", "Expense Amount", "Notes"]);
    sheet.getRange("A1:O1").setFontWeight("bold");
    sheet.setFrozenRows(1);
  } else if (name === "Projects") {
    sheet.appendRow(["Project Name", "Created At"]);
    sheet.getRange("A1:B1").setFontWeight("bold");
    sheet.appendRow(["General", new Date().toISOString()]);
    sheet.setFrozenRows(1);
  } else if (name === "Invoices") {
    sheet.appendRow(["Invoice ID", "Customer", "Date", "Total", "Payload JSON"]);
    sheet.getRange("A1:E1").setFontWeight("bold");
    sheet.setFrozenRows(1);
  } else if (name === "ChatMessages") {
    sheet.appendRow(["Timestamp", "Sender ID", "Sender Name", "Message Text", "Status", "Message ID", "Photo URL"]);
    sheet.getRange("A1:G1").setFontWeight("bold");
    sheet.setFrozenRows(1);
  } else if (name === "CompanyInfo") {
    sheet.appendRow(["Key", "Value"]);
    sheet.getRange("A1:B1").setFontWeight("bold");
    sheet.setFrozenRows(1);
    sheet.appendRow(["businessName", "KS ENTERPRISE GROUP"]);
    sheet.appendRow(["tagline", "BUILDING DREAMS • FIELD WORKFORCE & TIME OPERATIONS"]);
    sheet.appendRow(["contactLine", "Contact: office@ksenterprisegroup.com | Tel: (555) 019-9238"]);
    sheet.appendRow(["address", ""]);
  } else if (name === "Customers") {
    sheet.appendRow(["ID", "Name", "Email", "Phone", "Address", "Created At"]);
    sheet.getRange("A1:F1").setFontWeight("bold");
    sheet.setFrozenRows(1);
  } else if (name === "PayReports") {
    sheet.appendRow(["Report ID", "Profile ID", "Employee Name", "Period Label", "Generated At", "Total Hours", "Total Pay", "Status", "Notes", "Payload JSON"]);
    sheet.getRange("A1:J1").setFontWeight("bold");
    sheet.setFrozenRows(1);
  } else if (name === "Schedules") {
    sheet.appendRow(["Schedule ID", "Title", "Project Name", "Start Date", "End Date", "Start Time", "End Time", "Assigned To IDs", "Assigned Names", "Location", "Notes", "Status", "Priority", "Color", "Created At", "Payload JSON"]);
    sheet.getRange("A1:P1").setFontWeight("bold");
    sheet.setFrozenRows(1);
  }
}

function matchId(sheetVal, inputId) {
  if (sheetVal == null || inputId == null) return false;
  if (sheetVal === inputId) return true;
  if (sheetVal instanceof Date) {
    try {
      return sheetVal.toISOString() === String(inputId);
    } catch (e) {}
  }
  return String(sheetVal).trim() === String(inputId).trim();
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    // Acquire lock with 10s wait to ensure atomic database writes across workers
    lock.tryLock(10000);
    
    if (!e || !e.postData || !e.postData.contents) {
      return jsonResponse({ success: false, error: "Empty request payload" });
    }

    const data = JSON.parse(e.postData.contents);
    const action = data.action;
    const payload = data.payload || {};
    const ss = getSpreadsheet();

    // 0. USER AUTHENTICATION & LOGIN
    if (action === "LOGIN_USER" || action === "LOGIN") {
      const usersSheet = getSheet(ss, "Users");
      const existingData = usersSheet.getDataRange().getValues();
      const inputName = (payload.name || "").toString().trim();
      const inputId = (payload.id || "").toString().trim();

      if (!inputName && !inputId) {
        return jsonResponse({ success: false, error: "Name or ID is required for login" });
      }

      let matchedUser = null;

      // Search existing users (Case-insensitive matching for name, or exact match for ID)
      for (let i = 1; i < existingData.length; i++) {
        const rowId = String(existingData[i][0] || "").trim();
        const rowName = String(existingData[i][1] || "").trim();
        const rowWage = parseFloat(existingData[i][2]) || 0;
        const rowRole = String(existingData[i][3] || "Employee");
        const rowCreated = String(existingData[i][4] || "");

        if (inputId && (matchId(rowId, inputId) || rowId.toLowerCase() === inputId.toLowerCase())) {
          matchedUser = { id: rowId, name: rowName, hourlyWage: rowWage, role: rowRole, createdAt: rowCreated };
          break;
        } else if (inputName && rowName.toLowerCase() === inputName.toLowerCase()) {
          matchedUser = { id: rowId, name: rowName, hourlyWage: rowWage, role: rowRole, createdAt: rowCreated };
          break;
        }
      }

      // If user not found, auto-register them in the sheet so field operations are seamless
      if (!matchedUser) {
        const newId = inputId || ("emp_" + Math.random().toString(36).substring(2, 10));
        const newName = inputName || "Team Member";
        const newWage = payload.hourlyWage !== undefined ? parseFloat(payload.hourlyWage) : 0;
        const newRole = payload.role || "Employee";
        const createdAt = new Date().toISOString();

        usersSheet.appendRow([newId, newName, newWage, newRole, createdAt]);
        matchedUser = { id: newId, name: newName, hourlyWage: newWage, role: newRole, createdAt: createdAt };
      }

      return jsonResponse({ success: true, user: matchedUser });
    }

    // 1. FAST ATOMIC CLOCK IN
    if (action === "CLOCK_IN") {
      const timeSheet = getSheet(ss, "TimeEntries");
      const entryId = payload.id || payload.entryId || new Date().toISOString();
      const profileId = payload.profileId || "";
      const projectName = payload.projectName || "General";
      const clockIn = payload.clockIn || new Date().toISOString();
      const latIn = payload.clockInLocation?.latitude || "";
      const lngIn = payload.clockInLocation?.longitude || "";
      const notes = payload.notes || "";

      // Check if user already had an open entry; auto-resolve if older than 9 hours
      const existingData = timeSheet.getDataRange().getValues();
      const inTimestamp = new Date(clockIn).getTime();
      for (let i = 1; i < existingData.length; i++) {
        const row = existingData[i];
        if (matchId(row[1], profileId) && (!row[4] || row[4] === "") && row[11] !== true && row[11] !== "TRUE") {
          // Found an open shift
          const prevClockInStr = String(row[3]);
          const prevInTime = new Date(prevClockInStr).getTime();
          if (!isNaN(prevInTime)) {
            const shiftDurationHours = (inTimestamp - prevInTime) / (1000 * 60 * 60);
            if (shiftDurationHours >= 9) {
              // Auto clock out old dangling shift at 9-hour limit
              const autoOutTime = new Date(prevInTime + 9 * 3600 * 1000).toISOString();
              const autoNote = (row[14] ? row[14] + " | " : "") + "[Auto Clock-Out after 9h limit]";
              timeSheet.getRange(i + 1, 5).setValue(autoOutTime);
              timeSheet.getRange(i + 1, 15).setValue(autoNote);
            }
          }
        }
      }

      // Append new Clock In row
      timeSheet.appendRow([
        entryId,
        profileId,
        projectName,
        clockIn,
        "", // Clock Out Time (empty)
        latIn,
        lngIn,
        "", // Clock Out Lat
        "", // Clock Out Lng
        "[]", // Photos
        "", // isBilled
        "FALSE", // isExpense
        "", // expenseDescription
        "", // expenseAmount
        notes
      ]);

      return jsonResponse({ success: true, action: "CLOCK_IN", entryId: entryId, clockIn: clockIn });
    }

    // 2. FAST ATOMIC CLOCK OUT (Supports Standard and 9h Auto Clock-Out)
    if (action === "CLOCK_OUT" || action === "AUTO_CLOCK_OUT") {
      const timeSheet = getSheet(ss, "TimeEntries");
      const existingData = timeSheet.getDataRange().getValues();
      const entryId = payload.id || payload.entryId;
      const profileId = payload.profileId;
      const clockOut = payload.clockOut || new Date().toISOString();
      const latOut = payload.clockOutLocation?.latitude || "";
      const lngOut = payload.clockOutLocation?.longitude || "";
      const isAuto = action === "AUTO_CLOCK_OUT" || payload.autoClockOut === true;
      let noteAddition = payload.notes || "";
      if (isAuto && !noteAddition.includes("[Auto Clock-Out")) {
        noteAddition = noteAddition ? noteAddition + " | [Auto Clock-Out: 9h limit reached]" : "[Auto Clock-Out: 9h limit reached]";
      }

      let updatedRow = -1;

      // Match by exact entryId first
      if (entryId) {
        for (let i = 1; i < existingData.length; i++) {
          if (matchId(existingData[i][0], entryId)) {
            updatedRow = i + 1;
            break;
          }
        }
      }

      // If not found by entryId, find latest unclosed entry for this profileId
      if (updatedRow === -1 && profileId) {
        for (let i = existingData.length - 1; i >= 1; i--) {
          const row = existingData[i];
          if (matchId(row[1], profileId) && (!row[4] || row[4] === "") && row[11] !== true && row[11] !== "TRUE") {
            updatedRow = i + 1;
            break;
          }
        }
      }

      if (updatedRow !== -1) {
        const rowData = existingData[updatedRow - 1];
        const existingNotes = String(rowData[14] || "");
        const finalNotes = noteAddition 
          ? (existingNotes ? existingNotes + "\n" + noteAddition : noteAddition)
          : existingNotes;

        // Fast batch range update (cols 5 to 15)
        timeSheet.getRange(updatedRow, 5).setValue(clockOut);
        if (latOut) timeSheet.getRange(updatedRow, 8).setValue(latOut);
        if (lngOut) timeSheet.getRange(updatedRow, 9).setValue(lngOut);
        if (finalNotes) timeSheet.getRange(updatedRow, 15).setValue(finalNotes);

        return jsonResponse({ success: true, action: "CLOCK_OUT", entryId: rowData[0], clockOut: clockOut, isAuto: isAuto });
      }

      return jsonResponse({ success: false, error: "Active entry not found to clock out" });
    }

    // 3. EDIT TIME ENTRY
    if (action === "EDIT_TIME_ENTRY") {
      const timeSheet = getSheet(ss, "TimeEntries");
      const existingData = timeSheet.getDataRange().getValues();
      const updatedEntry = payload.entry || payload;
      if (!updatedEntry || !updatedEntry.id) {
        return jsonResponse({ success: false, error: "No entry ID" });
      }
      for (let i = 1; i < existingData.length; i++) {
        if (matchId(existingData[i][0], updatedEntry.id)) {
          const r = i + 1;
          timeSheet.getRange(r, 3).setValue(updatedEntry.projectName || "General");
          timeSheet.getRange(r, 4).setValue(updatedEntry.clockIn || "");
          timeSheet.getRange(r, 5).setValue(updatedEntry.clockOut || "");
          timeSheet.getRange(r, 6).setValue(updatedEntry.clockInLocation?.latitude || "");
          timeSheet.getRange(r, 7).setValue(updatedEntry.clockInLocation?.longitude || "");
          timeSheet.getRange(r, 8).setValue(updatedEntry.clockOutLocation?.latitude || "");
          timeSheet.getRange(r, 9).setValue(updatedEntry.clockOutLocation?.longitude || "");
          if (updatedEntry.photos) {
            timeSheet.getRange(r, 10).setValue(JSON.stringify(updatedEntry.photos));
          }
          timeSheet.getRange(r, 12).setValue(updatedEntry.isExpense ? "TRUE" : "FALSE");
          timeSheet.getRange(r, 13).setValue(updatedEntry.expenseDescription || "");
          timeSheet.getRange(r, 14).setValue(updatedEntry.expenseAmount !== undefined ? updatedEntry.expenseAmount : "");
          timeSheet.getRange(r, 15).setValue(updatedEntry.notes || "");
          return jsonResponse({ success: true });
        }
      }
      return jsonResponse({ success: false, error: "Entry not found" });
    }

    // 4. DELETE TIME ENTRY
    if (action === "DELETE_TIME_ENTRY") {
      const timeSheet = getSheet(ss, "TimeEntries");
      const existingData = timeSheet.getDataRange().getValues();
      const entryId = payload.entryId || payload.id;
      if (!entryId) return jsonResponse({ success: false, error: "No entry ID" });
      for (let i = 1; i < existingData.length; i++) {
        if (matchId(existingData[i][0], entryId)) {
          timeSheet.deleteRow(i + 1);
          return jsonResponse({ success: true });
        }
      }
      return jsonResponse({ success: false, error: "Entry not found" });
    }

    // 5. HIGH-SPEED SYNC ENTRIES
    if (action === "SYNC_ENTRIES") {
      const timeSheet = getSheet(ss, "TimeEntries");
      const existingData = timeSheet.getDataRange().getValues();
      const profileId = payload.profileId || "";
      const newEntries = payload.entries || [];
      
      const newEntriesMap = {};
      newEntries.forEach(function(e) {
        newEntriesMap[e.id] = e;
      });

      const existingIdsInPayload = {};

      // Loop backwards through existing rows
      for (let i = existingData.length - 1; i >= 1; i--) {
        const rowId = existingData[i][0];
        const rowProfileId = existingData[i][1];
        
        if (matchId(rowProfileId, profileId)) {
          if (!newEntriesMap[rowId]) {
            // Delete locally deleted entry
            timeSheet.deleteRow(i + 1);
          } else {
            // Update existing entry
            const entry = newEntriesMap[rowId];
            const rowIndex = i + 1;
            timeSheet.getRange(rowIndex, 3, 1, 13).setValues([[
              entry.projectName || "General",
              entry.clockIn || "",
              entry.clockOut || "",
              entry.clockInLocation?.latitude || "",
              entry.clockInLocation?.longitude || "",
              entry.clockOutLocation?.latitude || "",
              entry.clockOutLocation?.longitude || "",
              entry.photos ? JSON.stringify(entry.photos) : "[]",
              existingData[i][10] || "", // isBilled
              entry.isExpense ? "TRUE" : "FALSE",
              entry.expenseDescription || "",
              entry.expenseAmount !== undefined ? entry.expenseAmount : "",
              entry.notes || ""
            ]]);
            existingIdsInPayload[rowId] = true;
          }
        }
      }

      // Add any brand-new entries
      newEntries.forEach(function(entry) {
        if (!existingIdsInPayload[entry.id]) {
          let existsOverall = false;
          for (let i = 1; i < existingData.length; i++) {
            if (matchId(existingData[i][0], entry.id)) {
              existsOverall = true;
              break;
            }
          }
          if (!existsOverall) {
            timeSheet.appendRow([
              entry.id,
              profileId,
              entry.projectName || "General",
              entry.clockIn || "",
              entry.clockOut || "",
              entry.clockInLocation?.latitude || "",
              entry.clockInLocation?.longitude || "",
              entry.clockOutLocation?.latitude || "",
              entry.clockOutLocation?.longitude || "",
              entry.photos ? JSON.stringify(entry.photos) : "[]",
              "",
              entry.isExpense ? "TRUE" : "FALSE",
              entry.expenseDescription || "",
              entry.expenseAmount !== undefined ? entry.expenseAmount : "",
              entry.notes || ""
            ]);
          }
        }
      });

      return jsonResponse({ success: true, message: "Sync complete" });
    }

    // 6. SAVE PROFILE
    if (action === "SAVE_PROFILE") {
      const usersSheet = getSheet(ss, "Users");
      const existingData = usersSheet.getDataRange().getValues();
      let found = false;
      for (let i = 1; i < existingData.length; i++) {
        if (matchId(existingData[i][0], payload.id)) {
          found = true;
          usersSheet.getRange(i + 1, 2).setValue(payload.name);
          usersSheet.getRange(i + 1, 3).setValue(payload.hourlyWage);
          break;
        }
      }
      if (!found && payload.id) {
        usersSheet.appendRow([payload.id, payload.name, payload.hourlyWage, "Employee", new Date().toISOString()]);
      }
      return jsonResponse({ success: true });
    }

    // 7. FETCH USER DATA (High Performance)
    if (action === "FETCH_USER_DATA") {
      const timeSheet = getSheet(ss, "TimeEntries");
      const tData = timeSheet ? timeSheet.getDataRange().getValues() : [];
      let entries = [];
      if (tData.length > 1) {
        entries = tData.slice(1)
          .filter(r => matchId(r[1], payload.profileId))
          .map(r => ({
            id: String(r[0]),
            profileId: String(r[1]),
            projectName: String(r[2] || "General"),
            clockIn: r[3] instanceof Date ? r[3].toISOString() : String(r[3] || ""),
            clockOut: r[4] instanceof Date ? r[4].toISOString() : (r[4] ? String(r[4]) : undefined),
            clockInLocation: r[5] ? { latitude: Number(r[5]), longitude: Number(r[6]) } : undefined,
            clockOutLocation: r[7] ? { latitude: Number(r[7]), longitude: Number(r[8]) } : undefined,
            photos: r[9] ? (typeof r[9] === "string" ? safeJsonParse(r[9], []) : r[9]) : [],
            isBilled: r[10] === true || r[10] === "TRUE" || r[10] === "true" || r[10] === 1 || r[10] === "1",
            isExpense: r[11] === true || r[11] === "TRUE" || r[11] === "true",
            expenseDescription: r[12] ? String(r[12]) : undefined,
            expenseAmount: r[13] !== "" && r[13] !== undefined ? parseFloat(r[13]) : undefined,
            notes: r[14] ? String(r[14]) : undefined
          }));
      }

      const payReportsSheet = getSheet(ss, "PayReports");
      const prData = payReportsSheet ? payReportsSheet.getDataRange().getValues() : [];
      let payReports = [];
      if (prData.length > 1) {
        payReports = prData.slice(1).map(r => {
          try {
            return JSON.parse(r[9]);
          } catch(e) {
            return null;
          }
        }).filter(r => r !== null && matchId(r.profileId, payload.profileId));
      }

      const schedulesSheet = getSheet(ss, "Schedules");
      const sData = schedulesSheet ? schedulesSheet.getDataRange().getValues() : [];
      let schedules = [];
      if (sData.length > 1) {
        schedules = sData.slice(1).map(r => {
          const parsed = safeJsonParse(r[15], null);
          if (parsed) return parsed;
          return {
            id: String(r[0]),
            title: String(r[1] || ""),
            projectName: String(r[2] || "General"),
            startDate: String(r[3] || ""),
            endDate: r[4] ? String(r[4]) : undefined,
            startTime: r[5] ? String(r[5]) : undefined,
            endTime: r[6] ? String(r[6]) : undefined,
            assignedTo: safeJsonParse(r[7], []),
            assignedNames: safeJsonParse(r[8], []),
            location: r[9] ? String(r[9]) : undefined,
            notes: r[10] ? String(r[10]) : undefined,
            status: String(r[11] || "scheduled"),
            priority: String(r[12] || "medium"),
            color: r[13] ? String(r[13]) : "#2563eb",
            createdAt: r[14] ? String(r[14]) : new Date().toISOString()
          };
        }).filter(Boolean);
      }

      return jsonResponse({ success: true, data: { entries, payReports, schedules } });
    }

    // 8. FETCH ADMIN DATA
    if (action === "FETCH_ADMIN_DATA") {
      const usersSheet = getSheet(ss, "Users");
      const timeSheet = getSheet(ss, "TimeEntries");
      const invoicesSheet = getSheet(ss, "Invoices");
      const projectsSheet = getSheet(ss, "Projects");
      const companySheet = getSheet(ss, "CompanyInfo");
      const customersSheet = getSheet(ss, "Customers");
      const payReportsSheet = getSheet(ss, "PayReports");
      const schedulesSheet = getSheet(ss, "Schedules");

      const uData = usersSheet.getDataRange().getValues();
      const tData = timeSheet.getDataRange().getValues();
      const iData = invoicesSheet.getDataRange().getValues();
      const pData = projectsSheet.getDataRange().getValues();
      const cInfoData = companySheet.getDataRange().getValues();
      const cData = customersSheet.getDataRange().getValues();
      const prData = payReportsSheet.getDataRange().getValues();
      const sData = schedulesSheet.getDataRange().getValues();

      let users = [];
      if (uData.length > 1) {
        users = uData.slice(1).map(r => ({ id: r[0], name: r[1], hourlyWage: r[2], role: r[3] }));
      }

      let entries = [];
      if (tData.length > 1) {
        entries = tData.slice(1).map(r => ({
          id: String(r[0]),
          profileId: String(r[1]),
          projectName: String(r[2] || "General"),
          clockIn: r[3] instanceof Date ? r[3].toISOString() : String(r[3] || ""),
          clockOut: r[4] instanceof Date ? r[4].toISOString() : (r[4] ? String(r[4]) : undefined),
          clockInLocation: r[5] ? { latitude: Number(r[5]), longitude: Number(r[6]) } : undefined,
          clockOutLocation: r[7] ? { latitude: Number(r[7]), longitude: Number(r[8]) } : undefined,
          photos: r[9] ? safeJsonParse(r[9], []) : [],
          isBilled: r[10] === true || r[10] === "TRUE" || r[10] === "true" || r[10] === 1 || r[10] === "1",
          isExpense: r[11] === true || r[11] === "TRUE" || r[11] === "true",
          expenseDescription: r[12] ? String(r[12]) : undefined,
          expenseAmount: r[13] ? parseFloat(r[13]) : undefined,
          notes: r[14] ? String(r[14]) : ""
        }));
      }

      let invoices = [];
      if (iData.length > 1) {
        invoices = iData.slice(1).map(r => safeJsonParse(r[4], null)).filter(Boolean);
      }

      let projects = ["General"];
      if (pData.length > 1) {
        projects = pData.slice(1).map(r => r[0]).filter(Boolean);
      }

      let customers = [];
      if (cData.length > 1) {
        customers = cData.slice(1).map(r => ({
          id: r[0], name: r[1], email: r[2], phone: r[3], address: r[4], createdAt: r[5]
        }));
      }

      let companyInfo = {
        businessName: 'KS ENTERPRISE GROUP',
        tagline: 'BUILDING DREAMS • FIELD WORKFORCE & TIME OPERATIONS',
        contactLine: 'Contact: office@ksenterprisegroup.com | Tel: (555) 019-9238',
        address: ''
      };
      if (cInfoData.length > 1) {
        cInfoData.slice(1).forEach(r => {
          if (r[0]) companyInfo[r[0]] = r[1];
        });
      }

      let payReports = [];
      if (prData.length > 1) {
        payReports = prData.slice(1).map(r => safeJsonParse(r[9], null)).filter(Boolean);
      }

      let schedules = [];
      if (sData.length > 1) {
        schedules = sData.slice(1).map(r => {
          const parsed = safeJsonParse(r[15], null);
          if (parsed) return parsed;
          return {
            id: String(r[0]),
            title: String(r[1] || ""),
            projectName: String(r[2] || "General"),
            startDate: String(r[3] || ""),
            endDate: r[4] ? String(r[4]) : undefined,
            startTime: r[5] ? String(r[5]) : undefined,
            endTime: r[6] ? String(r[6]) : undefined,
            assignedTo: safeJsonParse(r[7], []),
            assignedNames: safeJsonParse(r[8], []),
            location: r[9] ? String(r[9]) : undefined,
            notes: r[10] ? String(r[10]) : undefined,
            status: String(r[11] || "scheduled"),
            priority: String(r[12] || "medium"),
            color: r[13] ? String(r[13]) : "#2563eb",
            createdAt: r[14] ? String(r[14]) : new Date().toISOString()
          };
        }).filter(Boolean);
      }

      return jsonResponse({ success: true, data: { users, entries, invoices, projects, customers, companyInfo, payReports, schedules } });
    }

    // 9. PHOTO UPLOADS
    if (action === "UPLOAD_PHOTO") {
      const base64Data = payload.base64;
      const mimeType = payload.mimeType || "image/jpeg";
      const filename = payload.filename || "photo_" + new Date().getTime() + ".jpg";
      
      const blob = Utilities.newBlob(Utilities.base64Decode(base64Data.split(',')[1] || base64Data), mimeType, filename);
      let folder;
      const folders = DriveApp.getFoldersByName("KS Enterprise Group Photos");
      if (folders.hasNext()) {
        folder = folders.next();
      } else {
        folder = DriveApp.createFolder("KS Enterprise Group Photos");
        folder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      }
      
      const file = folder.createFile(blob);
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      const url = "https://drive.google.com/file/d/" + file.getId() + "/view?usp=sharing";
      
      return jsonResponse({ success: true, data: { url: url, downloadUrl: url } });
    }

    // 10. PAY REPORT ACTIONS
    if (action === "SAVE_PAY_REPORT") {
      const payReportsSheet = getSheet(ss, "PayReports");
      const report = payload.report || payload;
      if (!report || !report.id) return jsonResponse({ success: false, error: "Missing report ID" });
      const data = payReportsSheet.getDataRange().getValues();
      let updated = false;
      for (let i = 1; i < data.length; i++) {
        if (matchId(data[i][0], report.id)) {
          payReportsSheet.getRange(i + 1, 2, 1, 9).setValues([[
            report.profileId || "",
            report.employeeName || "",
            report.periodLabel || "",
            report.generatedAt || new Date().toISOString(),
            report.totalHours !== undefined ? report.totalHours : 0,
            report.totalGrossPay !== undefined ? report.totalGrossPay : 0,
            report.status || "approved",
            report.notes || "",
            JSON.stringify(report)
          ]]);
          updated = true;
          break;
        }
      }
      if (!updated) {
        payReportsSheet.appendRow([
          report.id,
          report.profileId || "",
          report.employeeName || "",
          report.periodLabel || "",
          report.generatedAt || new Date().toISOString(),
          report.totalHours !== undefined ? report.totalHours : 0,
          report.totalGrossPay !== undefined ? report.totalGrossPay : 0,
          report.status || "approved",
          report.notes || "",
          JSON.stringify(report)
        ]);
      }
      return jsonResponse({ success: true });
    }

    if (action === "DELETE_PAY_REPORT") {
      const payReportsSheet = getSheet(ss, "PayReports");
      const data = payReportsSheet.getDataRange().getValues();
      const reportId = payload.reportId || payload.id;
      for (let i = 1; i < data.length; i++) {
        if (matchId(data[i][0], reportId)) {
          payReportsSheet.deleteRow(i + 1);
          return jsonResponse({ success: true });
        }
      }
      return jsonResponse({ success: false, error: "Report not found" });
    }

    // 10B. SCHEDULE & CALENDAR DISPATCH
    if (action === "FETCH_SCHEDULES") {
      const schedulesSheet = getSheet(ss, "Schedules");
      const sData = schedulesSheet ? schedulesSheet.getDataRange().getValues() : [];
      let schedules = [];
      if (sData.length > 1) {
        schedules = sData.slice(1).map(r => {
          const parsed = safeJsonParse(r[15], null);
          if (parsed) return parsed;
          return {
            id: String(r[0]),
            title: String(r[1] || ""),
            projectName: String(r[2] || "General"),
            startDate: String(r[3] || ""),
            endDate: r[4] ? String(r[4]) : undefined,
            startTime: r[5] ? String(r[5]) : undefined,
            endTime: r[6] ? String(r[6]) : undefined,
            assignedTo: safeJsonParse(r[7], []),
            assignedNames: safeJsonParse(r[8], []),
            location: r[9] ? String(r[9]) : undefined,
            notes: r[10] ? String(r[10]) : undefined,
            status: String(r[11] || "scheduled"),
            priority: String(r[12] || "medium"),
            color: r[13] ? String(r[13]) : "#2563eb",
            createdAt: r[14] ? String(r[14]) : new Date().toISOString()
          };
        }).filter(Boolean);
      }
      return jsonResponse({ success: true, schedules: schedules, data: { schedules: schedules } });
    }

    if (action === "SAVE_SCHEDULE") {
      const schedulesSheet = getSheet(ss, "Schedules");
      const event = payload.schedule || payload.event || payload;
      if (!event || !event.id) {
        return jsonResponse({ success: false, error: "Missing schedule event ID" });
      }

      const sData = schedulesSheet.getDataRange().getValues();
      let updated = false;
      const rowPayload = [
        event.id,
        event.title || "",
        event.projectName || "General",
        event.startDate || "",
        event.endDate || "",
        event.startTime || "",
        event.endTime || "",
        JSON.stringify(event.assignedTo || []),
        JSON.stringify(event.assignedNames || []),
        event.location || "",
        event.notes || "",
        event.status || "scheduled",
        event.priority || "medium",
        event.color || "#2563eb",
        event.createdAt || new Date().toISOString(),
        JSON.stringify(event)
      ];

      for (let i = 1; i < sData.length; i++) {
        if (matchId(sData[i][0], event.id)) {
          schedulesSheet.getRange(i + 1, 1, 1, 16).setValues([rowPayload]);
          updated = true;
          break;
        }
      }

      if (!updated) {
        schedulesSheet.appendRow(rowPayload);
      }

      return jsonResponse({ success: true, schedule: event });
    }

    if (action === "DELETE_SCHEDULE") {
      const schedulesSheet = getSheet(ss, "Schedules");
      const sData = schedulesSheet.getDataRange().getValues();
      const schedId = payload.id || payload.scheduleId;
      if (!schedId) return jsonResponse({ success: false, error: "Missing schedule ID" });

      for (let i = 1; i < sData.length; i++) {
        if (matchId(sData[i][0], schedId)) {
          schedulesSheet.deleteRow(i + 1);
          return jsonResponse({ success: true, id: schedId });
        }
      }
      return jsonResponse({ success: false, error: "Schedule not found" });
    }

    // 11. COMPANY INFO
    if (action === "SAVE_COMPANY_INFO") {
      const companySheet = getSheet(ss, "CompanyInfo");
      const existingData = companySheet.getDataRange().getValues();
      const keys = Object.keys(payload);
      keys.forEach(k => {
        let found = false;
        for (let i = 1; i < existingData.length; i++) {
          if (existingData[i][0] === k) {
            companySheet.getRange(i + 1, 2).setValue(String(payload[k] || ""));
            found = true;
            break;
          }
        }
        if (!found) {
          companySheet.appendRow([k, String(payload[k] || "")]);
        }
      });
      return jsonResponse({ success: true });
    }

    // 12. EMPLOYEE MANAGEMENT
    if (action === "ADD_EMPLOYEE") {
      const usersSheet = getSheet(ss, "Users");
      usersSheet.appendRow([payload.id, payload.name, payload.hourlyWage, "Employee", new Date().toISOString()]);
      return jsonResponse({ success: true });
    }

    if (action === "EDIT_EMPLOYEE") {
      const usersSheet = getSheet(ss, "Users");
      const existingData = usersSheet.getDataRange().getValues();
      const id = String(payload.id);
      for (let i = 1; i < existingData.length; i++) {
        if (matchId(existingData[i][0], id)) {
          usersSheet.getRange(i + 1, 2).setValue(payload.name);
          usersSheet.getRange(i + 1, 3).setValue(payload.hourlyWage);
          return jsonResponse({ success: true });
        }
      }
      return jsonResponse({ success: false, error: "Employee not found" });
    }

    if (action === "DELETE_EMPLOYEE") {
      const usersSheet = getSheet(ss, "Users");
      const existingData = usersSheet.getDataRange().getValues();
      const id = String(payload.id);
      for (let i = 1; i < existingData.length; i++) {
        if (matchId(existingData[i][0], id)) {
          usersSheet.deleteRow(i + 1);
          return jsonResponse({ success: true });
        }
      }
      return jsonResponse({ success: false, error: "Employee not found" });
    }

    // 13. INVOICES
    if (action === "SAVE_INVOICE") {
      const invoicesSheet = getSheet(ss, "Invoices");
      const data = invoicesSheet.getDataRange().getValues();
      let updated = false;
      for (let i = 1; i < data.length; i++) {
        if (matchId(data[i][0], payload.id)) {
          invoicesSheet.getRange(i + 1, 2, 1, 4).setValues([[
            payload.customerName,
            payload.date,
            payload.total,
            JSON.stringify(payload)
          ]]);
          updated = true;
          break;
        }
      }
      if (!updated) {
        invoicesSheet.appendRow([payload.id, payload.customerName, payload.date, payload.total, JSON.stringify(payload)]);
      }

      if (payload.timeEntryIds && payload.timeEntryIds.length > 0) {
        const timeSheet = getSheet(ss, "TimeEntries");
        const existingData = timeSheet.getDataRange().getValues();
        const idMap = {};
        payload.timeEntryIds.forEach(id => idMap[id] = true);
        for (let i = 1; i < existingData.length; i++) {
          if (idMap[existingData[i][0]]) {
            timeSheet.getRange(i + 1, 11).setValue(true);
          }
        }
      }
      return jsonResponse({ success: true });
    }

    // 13B. SET BILLED STATUS
    if (action === "SET_ENTRIES_BILLED_STATUS") {
      const timeSheet = getSheet(ss, "TimeEntries");
      const existingData = timeSheet.getDataRange().getValues();
      const entryIds = payload.entryIds || [];
      const isBilled = payload.isBilled === true;
      const idMap = {};
      entryIds.forEach(function(id) { idMap[String(id).trim()] = true; });

      for (let i = 1; i < existingData.length; i++) {
        const rowId = String(existingData[i][0] || "").trim();
        if (idMap[rowId]) {
          timeSheet.getRange(i + 1, 11).setValue(isBilled ? "TRUE" : "FALSE");
        }
      }
      return jsonResponse({ success: true });
    }

    // 13C. CUSTOMERS MANAGEMENT
    if (action === "ADD_CUSTOMER") {
      const customersSheet = getSheet(ss, "Customers");
      const cId = payload.id || ("cust_" + Math.random().toString(36).substring(2, 10));
      const cName = payload.name || "";
      const cEmail = payload.email || "";
      const cPhone = payload.phone || "";
      const cAddress = payload.address || "";
      const cCreated = payload.createdAt || new Date().toISOString();

      customersSheet.appendRow([cId, cName, cEmail, cPhone, cAddress, cCreated]);
      return jsonResponse({ success: true, id: cId });
    }

    if (action === "DELETE_CUSTOMER") {
      const customersSheet = getSheet(ss, "Customers");
      const existingData = customersSheet.getDataRange().getValues();
      const id = String(payload.id);
      for (let i = 1; i < existingData.length; i++) {
        if (matchId(existingData[i][0], id)) {
          customersSheet.deleteRow(i + 1);
          return jsonResponse({ success: true });
        }
      }
      return jsonResponse({ success: false, error: "Customer not found" });
    }

    // 14. JOBS / PROJECTS
    if (action === "ADD_JOB" || action === "ADD_PROJECT") {
      const projectsSheet = getSheet(ss, "Projects");
      const existingData = projectsSheet.getDataRange().getValues();
      const existingProjects = existingData.slice(1).map(row => row[0].toString().trim().toLowerCase());
      const name = payload.name ? payload.name.toString().trim() : "";
      if (!name) return jsonResponse({ success: false, error: "Empty job/project name" });
      if (existingProjects.includes(name.toLowerCase())) {
        return jsonResponse({ success: false, error: "Job/Project already exists" });
      }
      projectsSheet.appendRow([name, new Date().toISOString()]);
      return jsonResponse({ success: true });
    }

    if (action === "DELETE_JOB" || action === "DELETE_PROJECT") {
      const projectsSheet = getSheet(ss, "Projects");
      const existingData = projectsSheet.getDataRange().getValues();
      const name = payload.name.toString().trim().toLowerCase();
      for (let i = 1; i < existingData.length; i++) {
        if (existingData[i][0] && existingData[i][0].toString().trim().toLowerCase() === name) {
          projectsSheet.deleteRow(i + 1);
          return jsonResponse({ success: true });
        }
      }
      return jsonResponse({ success: false });
    }

    // 15. CHAT MESSAGES
    if (action === "SEND_CHAT_MESSAGE") {
      const chatSheet = getSheet(ss, "ChatMessages");
      chatSheet.appendRow([
        payload.timestamp || new Date().toISOString(),
        payload.senderId || "",
        payload.senderName || "",
        payload.messageText || "",
        payload.status || "sent",
        payload.messageId || "",
        payload.photoUrl || ""
      ]);
      return jsonResponse({ success: true });
    }

    if (action === "FETCH_CHAT_MESSAGES") {
      const chatSheet = getSheet(ss, "ChatMessages");
      const cData = chatSheet.getDataRange().getValues();
      let messages = [];
      if (cData.length > 1) {
        messages = cData.slice(1).map(r => ({
          timestamp: String(r[0] || ""),
          senderId: String(r[1] || ""),
          senderName: String(r[2] || ""),
          messageText: String(r[3] || ""),
          status: String(r[4] || "sent"),
          messageId: String(r[5] || ""),
          photoUrl: r[6] ? String(r[6]) : undefined
        }));
      }
      return jsonResponse({ success: true, data: { messages } });
    }

    return jsonResponse({ success: false, error: "Action not supported: " + action });

  } catch (error) {
    return jsonResponse({ success: false, error: error.message || String(error) });
  } finally {
    try {
      lock.releaseLock();
    } catch (e) {}
  }
}

function doGet(e) {
  try {
    const ss = getSpreadsheet();
    const projectsSheet = getSheet(ss, "Projects");
    const pData = projectsSheet.getDataRange().getValues();
    const projects = pData.slice(1).map(r => r[0]).filter(Boolean);

    const companySheet = getSheet(ss, "CompanyInfo");
    const cInfoData = companySheet.getDataRange().getValues();
    const companyInfo = {
      businessName: 'KS ENTERPRISE GROUP',
      tagline: 'BUILDING DREAMS • FIELD WORKFORCE & TIME OPERATIONS',
      contactLine: 'Contact: office@ksenterprisegroup.com | Tel: (555) 019-9238',
      address: ''
    };
    if (cInfoData.length > 1) {
      cInfoData.slice(1).forEach(r => {
        if (r[0]) companyInfo[r[0]] = r[1];
      });
    }

    return jsonResponse({ projects: projects, companyInfo: companyInfo });
  } catch (err) {
    return jsonResponse({ error: err.message, projects: ["General"] });
  }
}

function doOptions(e) {
  return ContentService.createTextOutput("OK").setMimeType(ContentService.MimeType.TEXT);
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function safeJsonParse(str, fallback) {
  try {
    return JSON.parse(str);
  } catch (e) {
    return fallback;
  }
}
