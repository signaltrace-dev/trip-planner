import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { CalculatedStop } from '@/types/trip';
import { formatDuration } from './timeCalculations';
import { format } from 'date-fns';

// -- PDF icon drawing helpers --

function drawHomeIcon(doc: jsPDF, x: number, y: number, size: number) {
  doc.setFillColor(34, 197, 94);
  // Roof
  doc.triangle(
    x, y + size * 0.45,
    x + size / 2, y,
    x + size, y + size * 0.45,
    'F'
  );
  // Body
  doc.rect(x + size * 0.15, y + size * 0.45, size * 0.7, size * 0.55, 'F');
  // Door cutout
  doc.setFillColor(255, 255, 255);
  doc.rect(x + size * 0.35, y + size * 0.6, size * 0.3, size * 0.4, 'F');
}

function drawCarIcon(doc: jsPDF, x: number, y: number, size: number) {
  doc.setFillColor(107, 114, 128);
  // Lower body
  doc.rect(x, y + size * 0.35, size, size * 0.35, 'F');
  // Cabin
  doc.rect(x + size * 0.2, y + size * 0.05, size * 0.55, size * 0.35, 'F');
  // Wheels
  doc.setFillColor(55, 55, 55);
  doc.circle(x + size * 0.22, y + size * 0.78, size * 0.13, 'F');
  doc.circle(x + size * 0.78, y + size * 0.78, size * 0.13, 'F');
}

function drawPlaneIcon(doc: jsPDF, x: number, y: number, size: number) {
  doc.setFillColor(124, 58, 237);
  // Fuselage
  doc.rect(x + size * 0.05, y + size * 0.35, size * 0.85, size * 0.25, 'F');
  // Nose
  doc.triangle(
    x + size * 0.9, y + size * 0.35,
    x + size, y + size * 0.475,
    x + size * 0.9, y + size * 0.6,
    'F'
  );
  // Wing
  doc.triangle(
    x + size * 0.3, y + size * 0.38,
    x + size * 0.5, y,
    x + size * 0.65, y + size * 0.38,
    'F'
  );
  // Tail fin
  doc.triangle(
    x + size * 0.08, y + size * 0.35,
    x, y + size * 0.08,
    x + size * 0.2, y + size * 0.35,
    'F'
  );
}

function getApiKey(): string | null {
  if (typeof window === 'undefined') return null;
  return process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || localStorage.getItem('googleMapsApiKey');
}

function buildStaticMapUrl(stops: CalculatedStop[], apiKey: string): string {
  const params: string[] = [
    'size=800x400',
    'scale=2',
    'maptype=roadmap',
  ];

  stops.forEach((stop, i) => {
    // Static Maps API labels support single alphanumeric char (0-9, A-Z)
    const label = i < 9 ? String(i + 1) : '';
    const labelParam = label ? `label:${label}|` : '';
    params.push(`markers=color:0x3B82F6|${labelParam}${stop.lat},${stop.lng}`);
  });

  for (let i = 1; i < stops.length; i++) {
    const prev = stops[i - 1];
    const curr = stops[i];
    const color = curr.travelType === 'fly' ? '0x7C3AEDCC' : '0x3B82F6CC';
    const weight = curr.travelType === 'fly' ? 2 : 3;
    params.push(
      `path=color:${color}|weight:${weight}|geodesic:true|${prev.lat},${prev.lng}|${curr.lat},${curr.lng}`
    );
  }

  params.push(`key=${apiKey}`);
  return `https://maps.googleapis.com/maps/api/staticmap?${params.join('&')}`;
}

async function fetchImageAsDataUrl(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export async function exportTripPdf(
  tripName: string,
  startDateTime: Date,
  calculatedStops: CalculatedStop[]
): Promise<void> {
  const doc = new jsPDF('portrait', 'mm', 'letter');
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  let y = margin;

  // -- Header --
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text(tripName, margin, y + 6);
  y += 12;

  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100);
  doc.text(
    `Departure: ${format(startDateTime, 'EEEE, MMMM d, yyyy @ h:mm a')}`,
    margin,
    y
  );
  doc.setTextColor(0);
  y += 8;

  doc.setDrawColor(200);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageWidth - margin, y);
  y += 6;

  // -- Map --
  const apiKey = getApiKey();
  if (apiKey && calculatedStops.length >= 2) {
    try {
      const mapUrl = buildStaticMapUrl(calculatedStops, apiKey);
      const mapDataUrl = await fetchImageAsDataUrl(mapUrl);
      const imgWidth = pageWidth - 2 * margin;
      const imgHeight = imgWidth * 0.5;
      doc.addImage(mapDataUrl, 'PNG', margin, y, imgWidth, imgHeight);
      y += imgHeight + 6;
    } catch (err) {
      console.warn('Could not load map image for PDF:', err);
    }
  }

  // -- Itinerary Table --
  const formatDT = (date: Date | null) => {
    if (!date) return '-';
    return format(date, 'EEE M/d @ h:mm a');
  };

  const body = calculatedStops.map((stop, i) => {
    const location =
      stop.name !== stop.city
        ? `${stop.name}\n${stop.city}, ${stop.state}`
        : `${stop.city}, ${stop.state}`;

    let travel = '-';
    if (i > 0 && stop.driveTimeFromPrevious !== null) {
      travel = formatDuration(stop.driveTimeFromPrevious);
    }

    return [
      i === 0 ? '' : String(i + 1),
      location,
      travel,
      i === 0 ? '-' : formatDuration(stop.timeAtDestination),
      formatDT(stop.arrivalTime),
      formatDT(stop.departureTime),
      stop.notes || '',
    ];
  });

  autoTable(doc, {
    startY: y,
    head: [['#', 'Location', 'Travel', 'Time There', 'Arrival', 'Departure', 'Notes']],
    body,
    margin: { left: margin, right: margin },
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: {
      fillColor: [59, 130, 246],
      textColor: 255,
      fontStyle: 'bold',
      fontSize: 8,
    },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      1: { cellWidth: 38 },
      2: { cellWidth: 22, halign: 'center' },
      3: { cellWidth: 22, halign: 'center' },
      4: { cellWidth: 32 },
      5: { cellWidth: 32 },
      6: { cellWidth: 'auto' },
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    didDrawCell: (data: any) => {
      if (data.section !== 'body') return;

      const cellY = data.cell.y as number;
      const cellH = data.cell.height as number;
      const centerY = cellY + cellH / 2;

      // Home icon centered in # column for first stop
      if (data.column.index === 0 && data.row.index === 0) {
        const s = 3;
        const cx = (data.cell.x as number) + (data.cell.width as number) / 2;
        drawHomeIcon(doc, cx - s / 2, centerY - s / 2, s);
      }

      // Car/plane icon to the left of travel time text
      if (data.column.index === 2 && data.row.index > 0) {
        const stop = calculatedStops[data.row.index];
        if (!stop || stop.driveTimeFromPrevious === null) return;

        const s = 2.8;
        const cellText = (data.cell.text as string[]).join('');
        doc.setFontSize(data.cell.styles.fontSize);
        const textWidth = doc.getTextWidth(cellText);
        const cellCenterX = (data.cell.x as number) + (data.cell.width as number) / 2;
        const iconX = cellCenterX - textWidth / 2 - s - 0.8;

        if (stop.travelType === 'fly') {
          drawPlaneIcon(doc, iconX, centerY - s / 2, s);
        } else {
          drawCarIcon(doc, iconX, centerY - s / 2, s);
        }
      }
    },
  });

  // -- Summary --
  const pageHeight = doc.internal.pageSize.getHeight();
  let summaryY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
  if (summaryY + 15 > pageHeight - margin) {
    doc.addPage();
    summaryY = margin;
  }

  const totalTravel = calculatedStops.reduce(
    (sum, s) => sum + (s.driveTimeFromPrevious || 0),
    0
  );
  const lastStop = calculatedStops[calculatedStops.length - 1];

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(80);
  doc.text(`Total Stops: ${calculatedStops.length}`, margin, summaryY);
  doc.text(
    `Total Travel Time: ${formatDuration(totalTravel)}`,
    margin + 45,
    summaryY
  );
  if (lastStop) {
    doc.text(
      `Trip End: ${formatDT(lastStop.departureTime)}`,
      margin + 110,
      summaryY
    );
  }

  // -- Save --
  doc.save(`${tripName.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.pdf`);
}
