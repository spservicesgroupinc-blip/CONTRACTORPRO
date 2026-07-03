/**
 * ProContractor - Google Apps Script Backend (Updated)
 * 
 * Instructions:
 * 1. Create a new Google Spreadsheet (or use an existing one).
 * 2. In the Google Spreadsheet, go to Extensions -> Apps Script.
 * 3. Delete any default code in Code.gs and paste this entire code.
 * 4. Click the "Save" (floppy disk) icon.
 * 5. Click "Deploy" (top right) -> "New deployment".
 * 6. Under "Select type", click the Gear icon and choose "Web app".
 * 7. Set options:
 *    - Description: "ProContractor Backend"
 *    - Execute as: "Me" (your email)
 *    - Who has access: "Anyone" (This is crucial, the proxy server will handle request forwarding).
 * 8. Click "Deploy", approve any permissions requested, and COPY the generated Web App URL.
 * 9. Save this URL in AI Studio Settings as: GOOGLE_APPS_SCRIPT_URL
 */

function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // Users sheet
  let usersSheet = ss.getSheetByName("Users");
  if (!usersSheet) {
    usersSheet = ss.insertSheet("Users");
    usersSheet.appendRow(["Profile ID", "Name", "Hourly Wage", "Role", "Created At"]);
    usersSheet.getRange("A1:E1").setFontWeight("bold");
    usersSheet.setFrozenRows(1);
  }

  // TimeEntries sheet
  let timeSheet = ss.getSheetByName("TimeEntries");
  if (!timeSheet) {
    timeSheet = ss.insertSheet("TimeEntries");
    timeSheet.appendRow(["Entry ID", "Profile ID", "Project Name", "Clock In Time", "Clock Out Time", "Clock In Lat", "Clock In Lng", "Clock Out Lat", "Clock Out Lng", "Photos"]);
    timeSheet.getRange("A1:J1").setFontWeight("bold");
    timeSheet.setFrozenRows(1);
  }

  // Projects sheet
  let projectsSheet = ss.getSheetByName("Projects");
  if (!projectsSheet) {
    projectsSheet = ss.insertSheet("Projects");
    projectsSheet.appendRow(["Project Name", "Created At"]);
    projectsSheet.getRange("A1:B1").setFontWeight("bold");
    projectsSheet.appendRow(["General", new Date().toISOString()]);
  }

  // Invoices sheet
  let invoicesSheet = ss.getSheetByName("Invoices");
  if (!invoicesSheet) {
    invoicesSheet = ss.insertSheet("Invoices");
    invoicesSheet.appendRow(["Invoice ID", "Customer", "Date", "Total", "Payload JSON"]);
    invoicesSheet.getRange("A1:E1").setFontWeight("bold");
    invoicesSheet.setFrozenRows(1);
  }

  // ChatMessages sheet
  let chatSheet = ss.getSheetByName("ChatMessages");
  if (!chatSheet) {
    chatSheet = ss.insertSheet("ChatMessages");
    chatSheet.appendRow(["Timestamp", "Sender ID", "Sender Name", "Message Text", "Status", "Message ID", "Photo URL"]);
    chatSheet.getRange("A1:G1").setFontWeight("bold");
    chatSheet.setFrozenRows(1);
  }

  // CompanyInfo sheet
  let companySheet = ss.getSheetByName("CompanyInfo");
  if (!companySheet) {
    companySheet = ss.insertSheet("CompanyInfo");
    companySheet.appendRow(["Key", "Value"]);
    companySheet.getRange("A1:B1").setFontWeight("bold");
    companySheet.setFrozenRows(1);
    companySheet.appendRow(["businessName", "PROCONTRACTOR"]);
    companySheet.appendRow(["tagline", "PREMIUM TRACKED TIME & FIELD SERVICES INVOICING"]);
    companySheet.appendRow(["contactLine", "Contact: billing@procontractor.com | Tel: (555) 019-9238"]);
    companySheet.appendRow(["address", ""]);
  }

  // Customers sheet
  let customersSheet = ss.getSheetByName("Customers");
  if (!customersSheet) {
    customersSheet = ss.insertSheet("Customers");
    customersSheet.appendRow(["ID", "Name", "Email", "Phone", "Address", "Created At"]);
    customersSheet.getRange("A1:F1").setFontWeight("bold");
    customersSheet.setFrozenRows(1);
  }
}

function matchId(sheetVal, inputId) {
  if (sheetVal === inputId) return true;
  if (sheetVal == null || inputId == null) return false;
  
  // If sheetVal is a Date object, convert to ISO string
  if (sheetVal instanceof Date) {
    try {
      return sheetVal.toISOString() === String(inputId);
    } catch (e) {
      // fallback
    }
  }
  
  // Also compare as strings
  return String(sheetVal) === String(inputId);
}

function doPost(e) {
  try {
    setup();
    const data = JSON.parse(e.postData.contents);
    const action = data.action;
    const payload = data.payload;
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    
    if (action === "UPLOAD_PHOTO") {
      const base64Data = payload.base64;
      const mimeType = payload.mimeType || "image/jpeg";
      const filename = payload.filename || "photo_" + new Date().getTime() + ".jpg";
      
      const blob = Utilities.newBlob(Utilities.base64Decode(base64Data.split(',')[1] || base64Data), mimeType, filename);
      let folder;
      const folders = DriveApp.getFoldersByName("ProContractor Photos");
      if (folders.hasNext()) {
        folder = folders.next();
      } else {
        folder = DriveApp.createFolder("ProContractor Photos");
        folder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      }
      
      const file = folder.createFile(blob);
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      const url = file.getDownloadUrl(); // Could also be getUrl() to view in browser, but getDownloadUrl() gives direct access if needed, or getUrl for safe preview. Let's return both.
      
      return ContentService.createTextOutput(JSON.stringify({ success: true, data: { url: file.getUrl(), downloadUrl: url } })).setMimeType(ContentService.MimeType.JSON);
    }
    
    if (action === "EDIT_TIME_ENTRY") {
      const timeSheet = ss.getSheetByName("TimeEntries");
      const existingData = timeSheet.getDataRange().getValues();
      const updatedEntry = payload.entry;
      if (!updatedEntry || !updatedEntry.id) {
         return ContentService.createTextOutput(JSON.stringify({ success: false, error: "No entry ID" })).setMimeType(ContentService.MimeType.JSON);
      }
      for (let i = 1; i < existingData.length; i++) {
        if (matchId(existingData[i][0], updatedEntry.id)) {
           timeSheet.getRange(i + 1, 3).setValue(updatedEntry.projectName || "");
           timeSheet.getRange(i + 1, 4).setValue(updatedEntry.clockIn || "");
           timeSheet.getRange(i + 1, 5).setValue(updatedEntry.clockOut || "");
           timeSheet.getRange(i + 1, 6).setValue(updatedEntry.clockInLocation?.latitude || "");
           timeSheet.getRange(i + 1, 7).setValue(updatedEntry.clockInLocation?.longitude || "");
           timeSheet.getRange(i + 1, 8).setValue(updatedEntry.clockOutLocation?.latitude || "");
           timeSheet.getRange(i + 1, 9).setValue(updatedEntry.clockOutLocation?.longitude || "");
           if (updatedEntry.photos) {
              timeSheet.getRange(i + 1, 10).setValue(JSON.stringify(updatedEntry.photos));
           }
           return ContentService.createTextOutput(JSON.stringify({ success: true })).setMimeType(ContentService.MimeType.JSON);
        }
      }
      return ContentService.createTextOutput(JSON.stringify({ success: false, error: "Entry not found" })).setMimeType(ContentService.MimeType.JSON);
    }
    
    if (action === "DELETE_TIME_ENTRY") {
      const timeSheet = ss.getSheetByName("TimeEntries");
      const existingData = timeSheet.getDataRange().getValues();
      const entryId = payload.entryId;
      if (!entryId) {
         return ContentService.createTextOutput(JSON.stringify({ success: false, error: "No entry ID" })).setMimeType(ContentService.MimeType.JSON);
      }
      for (let i = 1; i < existingData.length; i++) {
        if (matchId(existingData[i][0], entryId)) {
           timeSheet.deleteRow(i + 1);
           return ContentService.createTextOutput(JSON.stringify({ success: true })).setMimeType(ContentService.MimeType.JSON);
        }
      }
      return ContentService.createTextOutput(JSON.stringify({ success: false, error: "Entry not found" })).setMimeType(ContentService.MimeType.JSON);
    }
    
    if (action === "SYNC_ENTRIES") {
      const timeSheet = ss.getSheetByName("TimeEntries");
      const existingData = timeSheet.getDataRange().getValues();
      const profileId = payload.profileId || "";
      
      const newEntries = payload.entries || [];
      const newEntriesMap = {};
      newEntries.forEach(function(e) {
        newEntriesMap[e.id] = e;
      });
      
      const existingIdsInPayload = new Set();
      
      // Iterate backwards to safely handle deletion of rows
      for (let i = existingData.length - 1; i >= 1; i--) {
        const rowId = existingData[i][0];
        const rowProfileId = existingData[i][1];
        
        if (matchId(rowProfileId, profileId)) {
          if (!newEntriesMap[rowId]) {
            // Delete locally deleted entry
            timeSheet.deleteRow(i + 1);
          } else {
            // Update all fields of the existing entry
            const entry = newEntriesMap[rowId];
            const rowIndex = i + 1;
            timeSheet.getRange(rowIndex, 3).setValue(entry.projectName || "General");
            timeSheet.getRange(rowIndex, 4).setValue(entry.clockIn || "");
            timeSheet.getRange(rowIndex, 5).setValue(entry.clockOut || "");
            timeSheet.getRange(rowIndex, 6).setValue(entry.clockInLocation?.latitude || "");
            timeSheet.getRange(rowIndex, 7).setValue(entry.clockInLocation?.longitude || "");
            timeSheet.getRange(rowIndex, 8).setValue(entry.clockOutLocation?.latitude || "");
            timeSheet.getRange(rowIndex, 9).setValue(entry.clockOutLocation?.longitude || "");
            timeSheet.getRange(rowIndex, 10).setValue(entry.photos ? JSON.stringify(entry.photos) : "[]");
            
            existingIdsInPayload.add(rowId);
          }
        }
      }
      
      // Add any brand-new entries
      newEntries.forEach(function(entry) {
        if (!existingIdsInPayload.has(entry.id)) {
          // Double check to avoid global duplicate IDs
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
              entry.photos ? JSON.stringify(entry.photos) : "[]"
            ]);
          }
        }
      });
      return ContentService.createTextOutput(JSON.stringify({ success: true, message: "Sync complete" })).setMimeType(ContentService.MimeType.JSON);
    }
    
    if (action === "SAVE_PROFILE") {
      const usersSheet = ss.getSheetByName("Users");
      const existingData = usersSheet.getDataRange().getValues();
      let found = false;
      for (let i = 1; i < existingData.length; i++) {
        if (existingData[i][0] === payload.id) {
          found = true;
          // Update wage and name
          usersSheet.getRange(i + 1, 2).setValue(payload.name);
          usersSheet.getRange(i + 1, 3).setValue(payload.hourlyWage);
          break;
        }
      }
      if (!found) {
        usersSheet.appendRow([payload.id, payload.name, payload.hourlyWage, "Employee", new Date().toISOString()]);
      }
      return ContentService.createTextOutput(JSON.stringify({ success: true })).setMimeType(ContentService.MimeType.JSON);
    }
    
    if (action === "FETCH_ADMIN_DATA") {
      const usersSheet = ss.getSheetByName("Users");
      const timeSheet = ss.getSheetByName("TimeEntries");
      const invoicesSheet = ss.getSheetByName("Invoices");
      const projectsSheet = ss.getSheetByName("Projects");
      const companySheet = ss.getSheetByName("CompanyInfo");
      const customersSheet = ss.getSheetByName("Customers");
      
      const uData = usersSheet ? usersSheet.getDataRange().getValues() : [];
      const tData = timeSheet ? timeSheet.getDataRange().getValues() : [];
      const iData = invoicesSheet ? invoicesSheet.getDataRange().getValues() : [];
      const pData = projectsSheet ? projectsSheet.getDataRange().getValues() : [];
      const cInfoData = companySheet ? companySheet.getDataRange().getValues() : [];
      const cData = customersSheet ? customersSheet.getDataRange().getValues() : [];
      
      let users = [];
      if (uData.length > 1) {
          users = uData.slice(1).map(r => ({ id: r[0], name: r[1], hourlyWage: r[2], role: r[3] }));
      }
      
      let entries = [];
      if (tData.length > 1) {
          entries = tData.slice(1).map(r => ({
             id: r[0],
             profileId: r[1],
             projectName: r[2],
             clockIn: r[3],
             clockOut: r[4],
             clockInLocation: r[5] ? { latitude: r[5], longitude: r[6] } : null,
             clockOutLocation: r[7] ? { latitude: r[7], longitude: r[8] } : null,
             photos: r[9] ? JSON.parse(r[9]) : [],
             isBilled: r[10] === true || r[10] === "TRUE" || r[10] === "true" || r[10] === 1 || r[10] === "1"
          }));
      }

      let invoices = [];
      if (iData.length > 1) {
          invoices = iData.slice(1).map(r => {
             try {
                return JSON.parse(r[4]);
             } catch(e) {
                return null;
             }
          }).filter(i => i !== null);
      }

      let projects = ["General"];
      if (pData.length > 1) {
          projects = pData.slice(1).map(r => r[0]).filter(Boolean);
      }

      let customers = [];
      if (cData.length > 1) {
          customers = cData.slice(1).map(r => ({
              id: r[0],
              name: r[1],
              email: r[2],
              phone: r[3],
              address: r[4],
              createdAt: r[5]
          }));
      }

      let companyInfo = {
        businessName: 'PROCONTRACTOR',
        tagline: 'PREMIUM TRACKED TIME & FIELD SERVICES INVOICING',
        contactLine: 'Contact: billing@procontractor.com | Tel: (555) 019-9238',
        address: ''
      };
      if (cInfoData.length > 1) {
        cInfoData.slice(1).forEach(r => {
           if (r[0]) {
             companyInfo[r[0]] = r[1];
           }
        });
      }
      
      return ContentService.createTextOutput(JSON.stringify({ success: true, data: { users, entries, invoices, projects, customers, companyInfo } })).setMimeType(ContentService.MimeType.JSON);
    }
    
    if (action === "LOGIN_USER") {
      const usersSheet = ss.getSheetByName("Users");
      const uData = usersSheet ? usersSheet.getDataRange().getValues() : [];
      let user = null;
      for (let i = 1; i < uData.length; i++) {
        if (uData[i][1] && uData[i][1].toString().trim().toLowerCase() === payload.name.toString().trim().toLowerCase()) {
          user = {
            id: uData[i][0],
            name: uData[i][1],
            hourlyWage: uData[i][2]
          };
          break;
        }
      }
      
      if (user) {
        return ContentService.createTextOutput(JSON.stringify({ success: true, user })).setMimeType(ContentService.MimeType.JSON);
      } else {
        return ContentService.createTextOutput(JSON.stringify({ success: false, error: "User not found. Please contact your administrator." })).setMimeType(ContentService.MimeType.JSON);
      }
    }

    if (action === "SAVE_COMPANY_INFO") {
      const companySheet = ss.getSheetByName("CompanyInfo");
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
           existingData.push([k, String(payload[k] || "")]);
         }
      });
      return ContentService.createTextOutput(JSON.stringify({ success: true })).setMimeType(ContentService.MimeType.JSON);
    }
    
    if (action === "FETCH_USER_DATA") {
      const timeSheet = ss.getSheetByName("TimeEntries");
      const tData = timeSheet ? timeSheet.getDataRange().getValues() : [];
      let entries = [];
      if (tData.length > 1) {
          entries = tData.slice(1)
            .filter(r => r[1] === payload.profileId)
            .map(r => ({
               id: r[0],
               profileId: r[1],
               projectName: r[2],
               clockIn: r[3],
               clockOut: r[4],
               clockInLocation: r[5] ? { latitude: r[5], longitude: r[6] } : null,
               clockOutLocation: r[7] ? { latitude: r[7], longitude: r[8] } : null,
               photos: r[9] ? JSON.parse(r[9]) : []
            }));
      }
      return ContentService.createTextOutput(JSON.stringify({ success: true, data: { entries } })).setMimeType(ContentService.MimeType.JSON);
    }
    
    if (action === "ADD_EMPLOYEE") {
      const usersSheet = ss.getSheetByName("Users");
      const id = payload.id;
      usersSheet.appendRow([id, payload.name, payload.hourlyWage, "Employee", new Date().toISOString()]);
      return ContentService.createTextOutput(JSON.stringify({ success: true })).setMimeType(ContentService.MimeType.JSON);
    }

    if (action === "EDIT_EMPLOYEE") {
      const usersSheet = ss.getSheetByName("Users");
      const existingData = usersSheet.getDataRange().getValues();
      const id = payload.id;
      for (let i = 1; i < existingData.length; i++) {
        if (existingData[i][0] === id) {
          usersSheet.getRange(i + 1, 2).setValue(payload.name);
          usersSheet.getRange(i + 1, 3).setValue(payload.hourlyWage);
          return ContentService.createTextOutput(JSON.stringify({ success: true })).setMimeType(ContentService.MimeType.JSON);
        }
      }
      return ContentService.createTextOutput(JSON.stringify({ success: false, error: "Employee not found" })).setMimeType(ContentService.MimeType.JSON);
    }

    if (action === "DELETE_EMPLOYEE") {
      const usersSheet = ss.getSheetByName("Users");
      const existingData = usersSheet.getDataRange().getValues();
      const id = payload.id;
      for (let i = 1; i < existingData.length; i++) {
        if (existingData[i][0] === id) {
          usersSheet.deleteRow(i + 1);
          return ContentService.createTextOutput(JSON.stringify({ success: true })).setMimeType(ContentService.MimeType.JSON);
        }
      }
      return ContentService.createTextOutput(JSON.stringify({ success: false, error: "Employee not found" })).setMimeType(ContentService.MimeType.JSON);
    }
    
    if (action === "SAVE_INVOICE") {
      const invoicesSheet = ss.getSheetByName("Invoices");
      if (!invoicesSheet) {
        return ContentService.createTextOutput(JSON.stringify({ success: false, error: "Invoices sheet not found" })).setMimeType(ContentService.MimeType.JSON);
      }
      const data = invoicesSheet.getDataRange().getValues();
      let updated = false;
      for (let i = 1; i < data.length; i++) {
        if (String(data[i][0]).trim() === String(payload.id).trim()) {
          // Update existing row
          invoicesSheet.getRange(i + 1, 2).setValue(payload.customerName);
          invoicesSheet.getRange(i + 1, 3).setValue(payload.date);
          invoicesSheet.getRange(i + 1, 4).setValue(payload.total);
          invoicesSheet.getRange(i + 1, 5).setValue(JSON.stringify(payload));
          updated = true;
          break;
        }
      }
      if (!updated) {
        invoicesSheet.appendRow([
          payload.id,
          payload.customerName,
          payload.date,
          payload.total,
          JSON.stringify(payload)
        ]);
      }
      
      // Auto-mark referenced time entries as billed (Col 11)
      if (payload.timeEntryIds && payload.timeEntryIds.length > 0) {
        const timeSheet = ss.getSheetByName("TimeEntries");
        if (timeSheet) {
          const existingData = timeSheet.getDataRange().getValues();
          const idMap = {};
          payload.timeEntryIds.forEach(function(id) {
            idMap[id] = true;
          });
          for (let i = 1; i < existingData.length; i++) {
            const rId = existingData[i][0];
            if (idMap[rId]) {
              timeSheet.getRange(i + 1, 11).setValue(true);
            }
          }
        }
      }
      
      return ContentService.createTextOutput(JSON.stringify({ success: true })).setMimeType(ContentService.MimeType.JSON);
    }

    if (action === "SET_ENTRIES_BILLED_STATUS") {
      const timeSheet = ss.getSheetByName("TimeEntries");
      if (!timeSheet) {
        return ContentService.createTextOutput(JSON.stringify({ success: false, error: "TimeEntries sheet not found" })).setMimeType(ContentService.MimeType.JSON);
      }
      const existingData = timeSheet.getDataRange().getValues();
      const targetIds = payload.entryIds || [];
      const statusValue = payload.isBilled;
      const idMap = {};
      targetIds.forEach(function(id) {
        idMap[id] = true;
      });
      for (let i = 1; i < existingData.length; i++) {
        const rId = existingData[i][0];
        if (idMap[rId]) {
          timeSheet.getRange(i + 1, 11).setValue(statusValue);
        }
      }
      return ContentService.createTextOutput(JSON.stringify({ success: true, message: "Updated billed status" })).setMimeType(ContentService.MimeType.JSON);
    }

    if (action === "ADD_JOB" || action === "ADD_PROJECT") {
      const projectsSheet = ss.getSheetByName("Projects");
      const existingData = projectsSheet.getDataRange().getValues();
      const existingProjects = existingData.slice(1).map(row => row[0].toString().trim().toLowerCase());
      const name = payload.name.toString().trim();
      if (!name) {
        return ContentService.createTextOutput(JSON.stringify({ success: false, error: "Empty job/project name" })).setMimeType(ContentService.MimeType.JSON);
      }
      if (existingProjects.includes(name.toLowerCase())) {
        return ContentService.createTextOutput(JSON.stringify({ success: false, error: "Job/Project already exists" })).setMimeType(ContentService.MimeType.JSON);
      }
      projectsSheet.appendRow([name, new Date().toISOString()]);
      return ContentService.createTextOutput(JSON.stringify({ success: true })).setMimeType(ContentService.MimeType.JSON);
    }

    if (action === "DELETE_JOB" || action === "DELETE_PROJECT") {
      const projectsSheet = ss.getSheetByName("Projects");
      const existingData = projectsSheet.getDataRange().getValues();
      const name = payload.name.toString().trim().toLowerCase();
      let deleted = false;
      for (let i = 1; i < existingData.length; i++) {
        if (existingData[i][0] && existingData[i][0].toString().trim().toLowerCase() === name) {
          projectsSheet.deleteRow(i + 1);
          deleted = true;
          break;
        }
      }
      return ContentService.createTextOutput(JSON.stringify({ success: deleted })).setMimeType(ContentService.MimeType.JSON);
    }

    if (action === "ADD_CUSTOMER") {
      const customersSheet = ss.getSheetByName("Customers");
      customersSheet.appendRow([
        payload.id,
        payload.name,
        payload.email || "",
        payload.phone || "",
        payload.address || "",
        new Date().toISOString()
      ]);
      return ContentService.createTextOutput(JSON.stringify({ success: true })).setMimeType(ContentService.MimeType.JSON);
    }

    if (action === "DELETE_CUSTOMER") {
      const customersSheet = ss.getSheetByName("Customers");
      const existingData = customersSheet.getDataRange().getValues();
      let deleted = false;
      for (let i = 1; i < existingData.length; i++) {
        if (existingData[i][0] === payload.id) {
          customersSheet.deleteRow(i + 1);
          deleted = true;
          break;
        }
      }
      return ContentService.createTextOutput(JSON.stringify({ success: deleted })).setMimeType(ContentService.MimeType.JSON);
    }

    if (action === "SEND_CHAT_MESSAGE") {
      let chatSheet = ss.getSheetByName("ChatMessages");
      if (!chatSheet) {
         chatSheet = ss.insertSheet("ChatMessages");
         chatSheet.appendRow(["Timestamp", "Sender ID", "Sender Name", "Message Text", "Status", "Message ID", "Photo URL"]);
         chatSheet.getRange("A1:G1").setFontWeight("bold");
         chatSheet.setFrozenRows(1);
      }
      chatSheet.appendRow([
        payload.timestamp || new Date().toISOString(),
        payload.senderId || "",
        payload.senderName || "",
        payload.messageText || "",
        payload.status || "sent",
        payload.messageId || "",
        payload.photoUrl || ""
      ]);
      return ContentService.createTextOutput(JSON.stringify({ success: true, message: "Chat message sent" })).setMimeType(ContentService.MimeType.JSON);
    }

    if (action === "FETCH_CHAT_MESSAGES") {
      let chatSheet = ss.getSheetByName("ChatMessages");
      if (!chatSheet) {
         chatSheet = ss.insertSheet("ChatMessages");
         chatSheet.appendRow(["Timestamp", "Sender ID", "Sender Name", "Message Text", "Status", "Message ID", "Photo URL"]);
         chatSheet.getRange("A1:G1").setFontWeight("bold");
         chatSheet.setFrozenRows(1);
      }
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
      return ContentService.createTextOutput(JSON.stringify({ success: true, data: { messages } })).setMimeType(ContentService.MimeType.JSON);
    }
    
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: "Action not supported: " + action })).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: error.message })).setMimeType(ContentService.MimeType.JSON);
  }
  
  return ContentService.createTextOutput(JSON.stringify({ success: true })).setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  try {
    setup();
  } catch (err) {}
  
  // Allow fetching current state (Projects, etc)
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const projectsSheet = ss.getSheetByName("Projects");
  let projects = ["General"];
  if (projectsSheet) {
    const pData = projectsSheet.getDataRange().getValues();
    projects = pData.slice(1).map(r => r[0]).filter(Boolean);
  }

  const companySheet = ss.getSheetByName("CompanyInfo");
  let companyInfo = null;
  if (companySheet) {
    const cInfoData = companySheet.getDataRange().getValues();
    companyInfo = {
        businessName: 'PROCONTRACTOR',
        tagline: 'PREMIUM TRACKED TIME & FIELD SERVICES INVOICING',
        contactLine: 'Contact: billing@procontractor.com | Tel: (555) 019-9238',
        address: ''
    };
    if (cInfoData.length > 1) {
      cInfoData.slice(1).forEach(r => {
         if (r[0]) {
           companyInfo[r[0]] = r[1];
         }
      });
    }
  }
  
  return ContentService.createTextOutput(JSON.stringify({ projects: projects, companyInfo: companyInfo })).setMimeType(ContentService.MimeType.JSON);
}

function doOptions(e) {
  return ContentService.createTextOutput("OK").setMimeType(ContentService.MimeType.TEXT);
}
