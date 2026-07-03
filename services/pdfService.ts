import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { UserProfile, TimeEntry, Invoice, CompanyInfo } from '../types';

const calculateDuration = (clockIn: string, clockOut?: string): number => {
    if (!clockOut) return 0;
    const start = new Date(clockIn).getTime();
    const end = new Date(clockOut).getTime();
    return Math.max(0, (end - start) / (1000 * 60 * 60)); // duration in hours
};

const getCompanyInfo = (): CompanyInfo => {
    try {
        const saved = localStorage.getItem('geotime_company_info');
        if (saved) {
            return JSON.parse(saved);
        }
    } catch {}
    // Default fallback
    return {
        businessName: 'PROCONTRACTOR',
        tagline: 'PREMIUM TRACKED TIME & FIELD SERVICES INVOICING',
        contactLine: 'Contact: billing@procontractor.com | Tel: (555) 019-9238',
        address: ''
    };
};

export const generatePayReport = (profile: UserProfile, timeEntries: TimeEntry[]) => {
    const doc = new jsPDF();
    const company = getCompanyInfo();

    // Color Palette matching ProContractor branding
    const primaryColor = [16, 23, 38]; // Deep Navy (#101726)
    const accentColor = [249, 115, 22]; // Safety Orange (#f97316)

    // Sleek top header band
    doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.rect(0, 0, 210, 40, 'F');

    // Accent line
    doc.setFillColor(accentColor[0], accentColor[1], accentColor[2]);
    doc.rect(0, 40, 210, 3, 'F');

    // Header Typography
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(22);
    doc.text(company.businessName.toUpperCase(), 14, 20);
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(220, 220, 220);
    doc.text(company.tagline.toUpperCase(), 14, 28);
    doc.setFontSize(9);
    doc.text(company.contactLine, 14, 34);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(249, 115, 22);
    doc.text('PAY REPORT', 150, 25, { align: 'right' });

    let startYInfo = 55;
    if (company.address) {
        doc.setTextColor(100, 100, 100);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        const addressLines = doc.splitTextToSize(company.address, 90);
        doc.text(addressLines, 14, 45);
        startYInfo = 45 + (addressLines.length * 4) + 6;
    }

    // Reset details block text color to charcoal
    doc.setTextColor(40, 40, 40);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);

    // Grid Info
    doc.setFont('helvetica', 'bold');
    doc.text('EMPLOYEE DETAILS', 14, startYInfo);
    doc.setFont('helvetica', 'normal');
    doc.text(`Name: ${profile.name}`, 14, startYInfo + 6);
    doc.text(`Base Hourly Wage: $${profile.hourlyWage.toFixed(2)}/hr`, 14, startYInfo + 12);

    doc.setFont('helvetica', 'bold');
    doc.text('REPORT METADATA', 120, startYInfo);
    doc.setFont('helvetica', 'normal');
    doc.text(`Generated At: ${new Date().toLocaleString()}`, 120, startYInfo + 6);
    doc.text(`Period Covered: Active Logs`, 120, startYInfo + 12);

    const tableColumn = ["Date", "Project / Job Site", "Clock In", "Clock Out", "Duration (hrs)", "Gross Pay ($)"];
    const tableRows: (string | number)[][] = [];
    
    let totalHours = 0;
    let totalPay = 0;

    const sortedEntries = [...timeEntries].sort((a, b) => new Date(b.clockIn).getTime() - new Date(a.clockIn).getTime());

    sortedEntries.forEach(entry => {
        const duration = calculateDuration(entry.clockIn, entry.clockOut);
        const pay = duration * profile.hourlyWage;
        totalHours += duration;
        totalPay += pay;

        const entryData = [
            new Date(entry.clockIn).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }),
            entry.projectName || 'General',
            new Date(entry.clockIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            entry.clockOut ? new Date(entry.clockOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Active Now',
            duration.toFixed(2),
            `$${pay.toFixed(2)}`
        ];
        tableRows.push(entryData);
    });

    autoTable(doc, {
        head: [tableColumn],
        body: tableRows,
        startY: startYInfo + 22,
        theme: 'striped',
        headStyles: { 
            fillColor: [16, 23, 38],
            textColor: [255, 255, 255],
            fontStyle: 'bold',
            fontSize: 10
        },
        bodyStyles: {
            fontSize: 9,
            textColor: [50, 50, 50]
        },
        alternateRowStyles: {
            fillColor: [248, 250, 252]
        },
        columnStyles: {
            4: { halign: 'right' },
            5: { halign: 'right' }
        }
    });

    const finalY = (doc as any).lastAutoTable.finalY || 100;

    // Summary Box
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.rect(14, finalY + 8, 182, 30, 'FD');

    doc.setTextColor(16, 23, 38);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('PAYROLL SUMMARY', 20, finalY + 16);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(71, 85, 105);
    doc.text(`Total Cumulative Hours:`, 20, finalY + 23);
    doc.text(`Total Gross Payroll Due:`, 20, finalY + 30);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 41, 59);
    doc.text(`${totalHours.toFixed(2)} hrs`, 80, finalY + 23);
    doc.text(`$${totalPay.toFixed(2)}`, 80, finalY + 30);

    // Stamp visual
    doc.setDrawColor(249, 115, 22);
    doc.setTextColor(249, 115, 22);
    doc.setFontSize(8);
    doc.rect(140, finalY + 12, 45, 20);
    doc.text('APPROVED TO PAY', 144, finalY + 20);
    doc.setFontSize(6);
    doc.text(`Export Integrity Secured`, 144, finalY + 25);

    doc.save(`Pay_Report_${profile.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`);
};

export const generateInvoicePDF = (invoice: Invoice, allUsers: UserProfile[], allTimeEntries: TimeEntry[]) => {
    const doc = new jsPDF();
    const company = getCompanyInfo();

    // Brand Palette
    const primaryColor = [16, 23, 38]; // Deep Navy (#101726)
    const accentColor = [249, 115, 22]; // Accent Orange (#f97316)
    const grayText = [71, 85, 105];

    // Top banner
    doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.rect(0, 0, 210, 42, 'F');
    
    // Safety orange bottom accent strip
    doc.setFillColor(accentColor[0], accentColor[1], accentColor[2]);
    doc.rect(0, 42, 210, 3, 'F');

    // Corporate Identity
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(22);
    doc.text(company.businessName.toUpperCase(), 14, 21);
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(200, 200, 200);
    doc.text(company.tagline.toUpperCase(), 14, 29);
    doc.text(company.contactLine, 14, 34);

    // Large Invoice tag
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(249, 115, 22);
    doc.text('TAX INVOICE', 196, 24, { align: 'right' });

    // Address under the header if exists
    let startYInfo = 58;
    if (company.address) {
        doc.setTextColor(100, 100, 100);
        doc.setFontSize(8);
        const addressLines = doc.splitTextToSize(company.address, 90);
        doc.text(addressLines, 14, 50);
        startYInfo = 50 + (addressLines.length * 4) + 4;
    }

    // Header metadata: Customer Name vs Invoice Details
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(10);
    
    // Column 1 - Billing Info
    doc.setFont('helvetica', 'bold');
    doc.text('BILL TO:', 14, startYInfo);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text(invoice.customerName.toUpperCase(), 14, startYInfo + 7);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(grayText[0], grayText[1], grayText[2]);
    doc.text('Client and Billing Account Representative', 14, startYInfo + 13);
    doc.text('Services Performed on Custom Job Sites', 14, startYInfo + 18);

    // Column 2 - Invoice details
    doc.setTextColor(30, 41, 59);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('INVOICE META:', 124, startYInfo);
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(grayText[0], grayText[1], grayText[2]);
    
    doc.text(`Invoice No:`, 124, startYInfo + 7);
    doc.text(`Date of Issue:`, 124, startYInfo + 13);
    doc.text(`Payment Terms:`, 124, startYInfo + 18);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 41, 59);
    doc.text(`#INV-${invoice.id.toUpperCase()}`, 154, startYInfo + 7);
    doc.text(new Date(invoice.date).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }), 154, startYInfo + 13);
    doc.text(`Due on receipt (Net 15)`, 154, startYInfo + 18);

    // Generate table details
    const showCostBreakdown = invoice.showCostBreakdown !== false; // Default to true if undefined
    const defaultColumns = ["Descriptive Log / Additions", "Category", "Qty / Hours", "Base Rate", "Markup", "Amount"];
    
    // Select the columns to display (filter out Base Rate & Markup if cost breakdown is disabled)
    let selectedColumns = invoice.selectedColumns && invoice.selectedColumns.length > 0 
        ? invoice.selectedColumns 
        : defaultColumns;

    if (!showCostBreakdown) {
        selectedColumns = selectedColumns.filter(col => col !== "Base Rate" && col !== "Markup");
    }

    const tableColumn = selectedColumns;
    const tableRows: any[][] = [];

    let totalLaborBase = 0;
    let totalLaborWithMarkup = 0;

    // 1. Process selected time entries
    invoice.timeEntryIds.forEach(id => {
        const entry = allTimeEntries.find(e => e.id === id);
        if (entry) {
            const user = allUsers.find(u => String(u.id).trim() === String(entry.profileId).trim());
            const baseWage = user ? parseFloat(user.hourlyWage as any) || 0 : 0;
            const hours = calculateDuration(entry.clockIn, entry.clockOut || new Date().toISOString());
            
            const costBase = hours * baseWage;
            const costMarked = costBase * (invoice.markupMultiplier || 1.0);
            
            totalLaborBase += costBase;
            totalLaborWithMarkup += costMarked;

            const dateStr = new Date(entry.clockIn).toLocaleDateString();
            const workerName = user ? user.name : 'Unassigned Tech';
            const logDesc = `Labor: ${workerName}\nSite/Project: ${entry.projectName || 'General'} (${dateStr})`;

            const rowMap: Record<string, string> = {
                "Descriptive Log / Additions": logDesc,
                "Category": "Field Labor",
                "Qty / Hours": hours.toFixed(2),
                "Base Rate": `$${baseWage.toFixed(2)}`,
                "Markup": invoice.markupMultiplier > 1.0 ? `x${invoice.markupMultiplier.toFixed(2)}` : 'None',
                "Amount": `$${costMarked.toFixed(2)}`
            };

            const rowData = selectedColumns.map(col => rowMap[col] || "");
            tableRows.push(rowData);
        }
    });

    // 2. Process manual additions
    let totalManual = 0;
    if (invoice.manualItems && invoice.manualItems.length > 0) {
        invoice.manualItems.forEach(item => {
            totalManual += item.amount;
            
            const rowMap: Record<string, string> = {
                "Descriptive Log / Additions": item.description,
                "Category": "Additional Item",
                "Qty / Hours": "1.00",
                "Base Rate": `$${item.amount.toFixed(2)}`,
                "Markup": "-",
                "Amount": `$${item.amount.toFixed(2)}`
            };

            const rowData = selectedColumns.map(col => rowMap[col] || "");
            tableRows.push(rowData);
        });
    }

    // Dynamic column styles mapping
    const colStyles: any = {};
    selectedColumns.forEach((colName, index) => {
        if (colName === "Descriptive Log / Additions") {
            colStyles[index] = { cellWidth: 75 };
        } else if (colName === "Qty / Hours" || colName === "Base Rate" || colName === "Amount") {
            colStyles[index] = { halign: 'right' };
        } else if (colName === "Markup" || colName === "Category") {
            colStyles[index] = { halign: 'center' };
        }
    });

    // Embed table
    autoTable(doc, {
        head: [tableColumn],
        body: tableRows,
        startY: startYInfo + 27,
        theme: 'striped',
        headStyles: { 
            fillColor: [16, 23, 38],
            textColor: [255, 255, 255],
            fontStyle: 'bold',
            fontSize: 9
        },
        bodyStyles: {
            fontSize: 8.5,
            textColor: [51, 65, 85],
            valign: 'middle'
        },
        alternateRowStyles: {
            fillColor: [248, 250, 252]
        },
        columnStyles: colStyles,
        margin: { left: 14, right: 14 }
    });

    const finalY = (doc as any).lastAutoTable.finalY || 130;

    // Draw Summary Grid Block on bottom-right
    const summaryX = 115;
    let currentSumY = finalY + 12;

    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.rect(summaryX, currentSumY - 4, 81, 40, 'FD');

    doc.setTextColor(100, 116, 139);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    
    if (showCostBreakdown) {
        doc.text('Base Tracked labor:', summaryX + 4, currentSumY + 3);
        doc.text('Company Services markup:', summaryX + 4, currentSumY + 9);
        doc.text('Manual items & materials:', summaryX + 4, currentSumY + 15);

        const markupValueVal = totalLaborWithMarkup - totalLaborBase;

        doc.setFont('helvetica', 'normal');
        doc.setTextColor(30, 41, 59);
        doc.text(`$${totalLaborBase.toFixed(2)}`, 191, currentSumY + 3, { align: 'right' });
        doc.text(`$${markupValueVal.toFixed(2)}`, 191, currentSumY + 9, { align: 'right' });
        doc.text(`$${totalManual.toFixed(2)}`, 191, currentSumY + 15, { align: 'right' });
    } else {
        doc.text('Labor Services Total:', summaryX + 4, currentSumY + 5);
        doc.text('Manual items & materials:', summaryX + 4, currentSumY + 13);

        doc.setFont('helvetica', 'normal');
        doc.setTextColor(30, 41, 59);
        doc.text(`$${totalLaborWithMarkup.toFixed(2)}`, 191, currentSumY + 5, { align: 'right' });
        doc.text(`$${totalManual.toFixed(2)}`, 191, currentSumY + 13, { align: 'right' });
    }

    // Divider line inside summary
    doc.setDrawColor(226, 232, 240);
    doc.line(summaryX + 3, currentSumY + 20, 191, currentSumY + 20);

    // Grand total row
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(16, 23, 38);
    doc.text('INVOICE TOTAL DUE:', summaryX + 4, currentSumY + 28);
    doc.setTextColor(249, 115, 22);
    doc.text(`$${invoice.total.toFixed(2)}`, 191, currentSumY + 28, { align: 'right' });

    // Left side Payment Terms & Guarantee block
    doc.setTextColor(30, 41, 59);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('Terms of Payment & Inquiries', 14, finalY + 14);
    
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.setFontSize(8);
    doc.text('1. Payment is strictly requested within 15 calendar days from date issue.', 14, finalY + 20);
    doc.text('2. Please reference Invoice Number on ACH bank transfer or checks.', 14, finalY + 25);
    doc.text('3. Late payments subject to standard 1.5% company service penalty per month.', 14, finalY + 30);
    doc.text('For queries, contact support: billing@procontractor.com', 14, finalY + 37);

    // Decorative bottom brand indicator line
    doc.setFillColor(16, 23, 38);
    doc.rect(14, 275, 182, 3, 'F');
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text('Page 1 of 1  • Generated securely via ProContractor Verification Engine', 14, 283);
    doc.text('THANK YOU FOR YOUR VALUED BUSINESS!', 196, 283, { align: 'right' });

    doc.save(`Invoice_${invoice.customerName.replace(/[^a-zA-Z0-9]/g, '_')}_${invoice.id.toUpperCase()}.pdf`);
};
