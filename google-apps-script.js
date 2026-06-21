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
    timeSheet.appendRow(["Entry ID", "Profile ID", "Project Name", "Clock In Time", "Clock Out Time", "Clock In Lat", "Clock In Lng", "Clock Out Lat", "Clock Out Lng"]);
    timeSheet.getRange("A1:I1").setFontWeight("bold");
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
    chatSheet.appendRow(["Timestamp", "Sender ID", "Sender Name", "Message Text", "Status", "Message ID"]);
    chatSheet.getRange("A1:F1").setFontWeight("bold");
    chatSheet.setFrozenRows(1);
  }

  // CompanyInfo sheet
  let companySheet = ss.getSheetByName("CompanyInfo");
  if (!companySheet) {
    companySheet = ss.insertSheet("CompanyInfo");
    companySheet.appendRow(["Key", "Value"]);
    companySheet.getRange("A1:B1").setFontWeight("bold");
    companySheet.setFrozenRows(1);
    companySheet.appendRow(["businessName", "GEOTIME CONTRACTING"]);
    companySheet.appendRow(["tagline", "PREMIUM TRACKED TIME & FIELD SERVICES INVOICING"]);
    companySheet.appendRow(["contactLine", "Contact: smartcontracting@geotime.com | Tel: (555) 019-9238"]);
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

function doPost(e) {
  try {
    setup();
    const data = JSON.parse(e.postData.contents);
    const action = data.action;
    const payload = data.payload;
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    
    if (action === "SYNC_ENTRIES") {
      const timeSheet = ss.getSheetByName("TimeEntries");
      const existingData = timeSheet.getDataRange().getValues();
      const existingIds = new Set(existingData.slice(1).map(row => row[0]));
      
      const newEntries = payload.entries || [];
      newEntries.forEach(entry => {
        if (!existingIds.has(entry.id)) {
          // Add new entry
          timeSheet.appendRow([
            entry.id,
            payload.profileId || "",
            entry.projectName || "General",
            entry.clockIn || "",
            entry.clockOut || "",
            entry.clockInLocation?.latitude || "",
            entry.clockInLocation?.longitude || "",
            entry.clockOutLocation?.latitude || "",
            entry.clockOutLocation?.longitude || ""
          ]);
        } else {
          // Find and update existing row (for clock out)
          for (let i = 1; i < existingData.length; i++) {
            if (existingData[i][0] === entry.id) {
              const rowIndex = i + 1;
              timeSheet.getRange(rowIndex, 5).setValue(entry.clockOut || "");
              timeSheet.getRange(rowIndex, 8).setValue(entry.clockOutLocation?.latitude || "");
              timeSheet.getRange(rowIndex, 9).setValue(entry.clockOutLocation?.longitude || "");
              break;
            }
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
             clockOutLocation: r[7] ? { latitude: r[7], longitude: r[8] } : null
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
        businessName: 'GEOTIME CONTRACTING',
        tagline: 'PREMIUM TRACKED TIME & FIELD SERVICES INVOICING',
        contactLine: 'Contact: smartcontracting@geotime.com | Tel: (555) 019-9238',
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
      const keys = Object.keys(reqPayload);
      
      keys.forEach(k => {
         let found = false;
         for (let i = 1; i < existingData.length; i++) {
           if (existingData[i][0] === k) {
             companySheet.getRange(i + 1, 2).setValue(String(reqPayload[k] || ""));
             found = true;
             break;
           }
         }
         if (!found) {
           companySheet.appendRow([k, String(reqPayload[k] || "")]);
           existingData.push([k, String(reqPayload[k] || "")]);
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
               clockOutLocation: r[7] ? { latitude: r[7], longitude: r[8] } : null
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
    
    if (action === "SAVE_INVOICE") {
      const invoicesSheet = ss.getSheetByName("Invoices");
      invoicesSheet.appendRow([
        payload.id,
        payload.customerName,
        payload.date,
        payload.total,
        JSON.stringify(payload)
      ]);
      return ContentService.createTextOutput(JSON.stringify({ success: true })).setMimeType(ContentService.MimeType.JSON);
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
      const chatSheet = ss.getSheetByName("ChatMessages");
      chatSheet.appendRow([
        payload.timestamp || new Date().toISOString(),
        payload.senderId || "",
        payload.senderName || "",
        payload.messageText || "",
        payload.status || "sent",
        payload.messageId || ""
      ]);
      return ContentService.createTextOutput(JSON.stringify({ success: true, message: "Chat message sent" })).setMimeType(ContentService.MimeType.JSON);
    }

    if (action === "FETCH_CHAT_MESSAGES") {
      const chatSheet = ss.getSheetByName("ChatMessages");
      const cData = chatSheet ? chatSheet.getDataRange().getValues() : [];
      let messages = [];
      if (cData.length > 1) {
        messages = cData.slice(1).map(r => ({
          timestamp: r[0],
          senderId: r[1],
          senderName: r[2],
          messageText: r[3],
          status: r[4] || "sent",
          messageId: r[5]
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
        businessName: 'GEOTIME CONTRACTING',
        tagline: 'PREMIUM TRACKED TIME & FIELD SERVICES INVOICING',
        contactLine: 'Contact: smartcontracting@geotime.com | Tel: (555) 019-9238',
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
