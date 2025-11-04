import jsPDF from 'jspdf';
import { format } from 'date-fns';

interface Route {
  id: string;
  runNumber: string;
  type: string;
  origin: string;
  destination: string;
  days: string;
  startTime: string;
  endTime: string;
  distance: number;
  rateType: string;
  requiresDoublesEndorsement: boolean;
  requiresChainExperience: boolean;
}

interface GeneratePDFParams {
  period: {
    name: string;
    startDate: string;
    endDate: string;
    requiredSelections: number;
  };
  terminal: {
    code: string;
    name: string;
  };
  routes: Route[];
}

export const generateRouteFormPDF = ({ period, terminal, routes }: GeneratePDFParams) => {
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'letter'
  });

  let yPosition = 20;
  const pageWidth = pdf.internal.pageSize.width;
  const pageHeight = pdf.internal.pageSize.height;
  const margin = 15;
  const contentWidth = pageWidth - (margin * 2);

  // Helper function to add new page if needed
  const checkPageBreak = (requiredSpace: number) => {
    if (yPosition + requiredSpace > pageHeight - margin) {
      pdf.addPage();
      yPosition = 20;
    }
  };

  // Helper function for centered text
  const centerText = (text: string, y: number, fontSize: number = 12) => {
    pdf.setFontSize(fontSize);
    const textWidth = pdf.getTextWidth(text);
    const x = (pageWidth - textWidth) / 2;
    pdf.text(text, x, y);
  };

  // Header
  pdf.setFont('helvetica', 'bold');
  centerText('ROUTE SELECTION FORM', yPosition, 18);
  yPosition += 8;
  
  pdf.setFont('helvetica', 'normal');
  centerText(terminal.name, yPosition, 16);
  yPosition += 8;
  
  centerText(
    `Selection Period: ${format(new Date(period.startDate), 'MM/dd/yyyy')} - ${format(new Date(period.endDate), 'MM/dd/yyyy')}`,
    yPosition,
    12
  );
  yPosition += 10;

  // Horizontal line
  pdf.setLineWidth(0.5);
  pdf.line(margin, yPosition, pageWidth - margin, yPosition);
  yPosition += 10;

  // Instructions
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(14);
  pdf.text('INSTRUCTIONS:', margin, yPosition);
  yPosition += 8;

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(10);
  const instructions = [
    '1. Review all available routes listed below',
    `2. Select up to ${period.requiredSelections} routes in order of preference`,
    '3. Write your selections in the "Driver Selection" section at the bottom',
    '4. Ensure your employee information is complete and accurate',
    '5. Sign and date the form',
    '6. Submit this form to your manager or administrator by the deadline'
  ];

  instructions.forEach(instruction => {
    pdf.text(instruction, margin + 5, yPosition);
    yPosition += 6;
  });
  yPosition += 10;

  // Routes Table
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(14);
  pdf.text('AVAILABLE ROUTES:', margin, yPosition);
  yPosition += 8;

  // Table headers
  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'bold');
  const tableStartY = yPosition;
  const col1X = margin;
  const col2X = margin + 15;
  const col3X = margin + 35;
  const col4X = margin + 70;
  const col5X = margin + 105;
  const col6X = margin + 125;
  const col7X = margin + 155;
  const col8X = margin + 170;

  // Draw table header
  pdf.rect(margin, yPosition - 5, contentWidth, 8);
  pdf.text('Run #', col1X + 1, yPosition);
  pdf.text('Type', col2X + 1, yPosition);
  pdf.text('Origin', col3X + 1, yPosition);
  pdf.text('Destination', col4X + 1, yPosition);
  pdf.text('Days', col5X + 1, yPosition);
  pdf.text('Time', col6X + 1, yPosition);
  pdf.text('Miles', col7X + 1, yPosition);
  pdf.text('Rate Type', col8X + 1, yPosition);
  yPosition += 5;

  // Table rows
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8);
  
  const sortedRoutes = routes.sort((a, b) => {
    const aNum = parseInt(a.runNumber.replace(/\D/g, '')) || 0;
    const bNum = parseInt(b.runNumber.replace(/\D/g, '')) || 0;
    return aNum - bNum;
  });

  sortedRoutes.forEach((route, index) => {
    checkPageBreak(8);
    
    if (index % 2 === 0) {
      pdf.setFillColor(245, 245, 245);
      pdf.rect(margin, yPosition - 4, contentWidth, 6, 'F');
    }
    
    pdf.text(route.runNumber, col1X + 1, yPosition);
    pdf.text(route.type.substring(0, 10), col2X + 1, yPosition);
    pdf.text(route.origin.substring(0, 20), col3X + 1, yPosition);
    pdf.text(route.destination.substring(0, 20), col4X + 1, yPosition);
    pdf.text(route.days.substring(0, 10), col5X + 1, yPosition);
    
    const startTime = format(new Date(`2000-01-01T${route.startTime}`), 'h:mma');
    const endTime = format(new Date(`2000-01-01T${route.endTime}`), 'h:mma');
    pdf.text(`${startTime}-${endTime}`, col6X + 1, yPosition, { maxWidth: 28 });
    
    pdf.text(route.distance.toString(), col7X + 1, yPosition);
    
    let rate = '';
    if (route.rateType === 'HOURLY') {
      rate = 'Hourly';
    } else if (route.rateType === 'MILEAGE') {
      rate = 'Mileage';
    } else if (route.rateType === 'FLAT_RATE') {
      rate = 'Flat Rate';
    }
    pdf.text(rate, col8X + 1, yPosition, { maxWidth: 25 });
    
    yPosition += 5;
  });

  // Draw table border
  pdf.rect(margin, tableStartY - 5, contentWidth, yPosition - tableStartY + 1);

  // New page for driver selection section
  pdf.addPage();
  yPosition = 20;

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(14);
  pdf.text('DRIVER SELECTION:', margin, yPosition);
  yPosition += 10;

  // Driver Information Section
  pdf.setFontSize(12);
  pdf.text('Driver Information:', margin, yPosition);
  yPosition += 10;

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(11);
  
  // Full Name - full width
  pdf.text('Full Name:', margin, yPosition);
  pdf.line(margin + 25, yPosition + 1, margin + 170, yPosition + 1);
  yPosition += 12;
  
  // Employee Number and Phone on same line
  pdf.text('Employee Number:', margin, yPosition);
  pdf.line(margin + 40, yPosition + 1, margin + 90, yPosition + 1);
  
  pdf.text('Phone:', margin + 100, yPosition);
  pdf.line(margin + 115, yPosition + 1, margin + 170, yPosition + 1);
  yPosition += 12;
  
  // Email - full width
  pdf.text('Email:', margin, yPosition);
  pdf.line(margin + 20, yPosition + 1, margin + 170, yPosition + 1);
  yPosition += 15;

  // Route Selections Section
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(12);
  pdf.text('Route Selections (in order of preference):', margin, yPosition);
  yPosition += 10;

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(11);
  for (let i = 0; i < period.requiredSelections; i++) {
    const suffix = i === 0 ? 'st' : i === 1 ? 'nd' : 'rd';
    pdf.text(`${i + 1}${suffix} Choice - Run Number:`, margin, yPosition);
    pdf.line(margin + 60, yPosition + 1, margin + 100, yPosition + 1);
    yPosition += 12;
  }
  yPosition += 15;

  // Driver Declaration Section
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(12);
  pdf.text('Driver Declaration:', margin, yPosition);
  yPosition += 8;

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(10);
  const declarationText = 'I certify that the route selections above are my preferred choices and that all information provided is accurate. I understand that routes will be assigned based on seniority and availability.';
  const lines = pdf.splitTextToSize(declarationText, contentWidth);
  lines.forEach(line => {
    pdf.text(line, margin, yPosition);
    yPosition += 5;
  });
  yPosition += 15;

  // Signature Section
  pdf.setFontSize(11);
  pdf.text('Driver Signature:', margin, yPosition);
  pdf.line(margin + 35, yPosition + 1, margin + 120, yPosition + 1); // Increased width for signature
  
  pdf.text('Date:', margin + 130, yPosition);
  pdf.line(margin + 145, yPosition + 1, margin + 190, yPosition + 1);
  yPosition += 20; // More space after signature

  // Office Use Only Section
  pdf.setFillColor(240, 240, 240);
  pdf.rect(margin, yPosition - 5, contentWidth, 50, 'F');
  
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(12);
  pdf.text('FOR OFFICE USE ONLY:', margin + 2, yPosition);
  yPosition += 10;

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(10);
  
  // Received By and Date on same line
  pdf.text('Received By:', margin + 2, yPosition);
  pdf.line(margin + 30, yPosition + 1, margin + 85, yPosition + 1);
  
  pdf.text('Date Received:', margin + 95, yPosition);
  pdf.line(margin + 130, yPosition + 1, margin + 180, yPosition + 1);
  yPosition += 12;
  
  // Entered By and Date on same line
  pdf.text('Entered By:', margin + 2, yPosition);
  pdf.line(margin + 30, yPosition + 1, margin + 85, yPosition + 1);
  
  pdf.text('Date Entered:', margin + 95, yPosition);
  pdf.line(margin + 130, yPosition + 1, margin + 180, yPosition + 1);

  // Generate filename
  const filename = `route-selection-form-${terminal.code}-${format(new Date(), 'yyyy-MM-dd')}.pdf`;
  
  // Save the PDF
  pdf.save(filename);
};