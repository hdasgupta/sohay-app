import fs from 'node:fs';
import PDFDocument from 'pdfkit';
import { env } from '../config/env.js';
import { prettyDate } from './dates.js';

const FOOD_LABEL = {
  BEFORE_FOOD: 'Before food',
  WITH_FOOD: 'With food',
  AFTER_FOOD: 'After food',
};

const timingLabel = (medicine) => {
  const parts = [];
  if (medicine.take_morning ?? medicine.morning) parts.push('Morning');
  if (medicine.take_afternoon ?? medicine.afternoon) parts.push('Afternoon');
  if (medicine.take_evening ?? medicine.evening) parts.push('Evening');
  if (medicine.take_night ?? medicine.night) parts.push('Night');
  if (medicine.is_sos ?? medicine.sos) parts.push('SOS');
  return parts.length ? parts.join(' / ') : 'As directed';
};

/**
 * Layout (top -> bottom):
 *   logo | organisation name
 *   doctor name + speciality
 *   horizontal rule
 *   patient name, age, today's date
 *   medicine table
 *   doctor signature at bottom right
 */
export const buildPrescriptionPdf = ({ doctor, patient, age, dateISO, medicines, advice }) =>
  new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 48 });
      const chunks = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const left = doc.page.margins.left;
      const right = doc.page.width - doc.page.margins.right;

      /* ---------------- header ---------------- */
      let headerTextX = left;
      if (fs.existsSync(env.org.logoPath)) {
        doc.image(env.org.logoPath, left, 42, { width: 62, height: 62 });
        headerTextX = left + 76;
      }
      doc
        .fillColor('#0b2a54')
        .font('Helvetica-Bold')
        .fontSize(19)
        .text(env.org.name, headerTextX, 52, { width: right - headerTextX });

      doc
        .moveDown(0.6)
        .font('Helvetica-Bold')
        .fontSize(13)
        .fillColor('#123')
        .text(`Dr. ${doctor.name}`, headerTextX, doc.y, { width: right - headerTextX })
        .font('Helvetica')
        .fontSize(11)
        .fillColor('#4a5b74')
        .text(doctor.speciality, headerTextX, doc.y + 2, { width: right - headerTextX });

      const ruleY = Math.max(doc.y + 14, 122);
      doc.moveTo(left, ruleY).lineTo(right, ruleY).lineWidth(1.4).strokeColor('#1b73e8').stroke();

      /* ---------------- patient row ---------------- */
      const infoY = ruleY + 16;
      doc.font('Helvetica-Bold').fontSize(11).fillColor('#0f1f37');
      doc.text(`Patient: ${patient.name}`, left, infoY);
      doc.text(`Age: ${age} years`, left + 250, infoY);
      doc.text(`Date: ${prettyDate(dateISO)}`, right - 150, infoY, { width: 150, align: 'right' });

      /* ---------------- medicines ---------------- */
      let y = infoY + 30;
      doc.font('Helvetica-Bold').fontSize(12).fillColor('#0b2a54').text('Rx', left, y);
      y += 20;

      doc.font('Helvetica-Bold').fontSize(9.5).fillColor('#ffffff');
      doc.rect(left, y - 4, right - left, 20).fill('#1b4f9c');
      doc.fillColor('#ffffff');
      doc.text('#', left + 6, y + 1, { width: 18 });
      doc.text('Medicine', left + 26, y + 1, { width: 150 });
      doc.text('Dose', left + 180, y + 1, { width: 52 });
      doc.text('When', left + 236, y + 1, { width: 104 });
      doc.text('Food', left + 344, y + 1, { width: 62 });
      doc.text('Note', left + 410, y + 1, { width: right - left - 416 });
      y += 24;

      const noteWidth = right - left - 416;
      medicines.forEach((medicine, index) => {
        const name = medicine.medicine_name || medicine.medicineName;
        const note = medicine.condition_note || medicine.conditionNote || '-';

        // Row height follows the tallest cell so nothing bleeds into the next row.
        doc.font('Helvetica-Bold').fontSize(9.5);
        const nameHeight = doc.heightOfString(name, { width: 150 });
        doc.font('Helvetica').fontSize(9.5);
        const noteHeight = doc.heightOfString(note, { width: noteWidth });
        const rowHeight = Math.max(24, nameHeight, noteHeight) + 10;

        if (y + rowHeight > doc.page.height - 180) {
          doc.addPage();
          y = doc.page.margins.top;
        }
        if (index % 2 === 0) {
          doc.rect(left, y - 5, right - left, rowHeight).fill('#f2f6fd');
        }
        doc.font('Helvetica').fontSize(9.5).fillColor('#10203a');
        doc.text(String(index + 1), left + 6, y, { width: 18 });
        doc.font('Helvetica-Bold').text(name, left + 26, y, { width: 150 });
        doc.font('Helvetica').text(medicine.dose, left + 180, y, { width: 52 });
        doc.text(timingLabel(medicine), left + 236, y, { width: 104 });
        doc.text(FOOD_LABEL[medicine.food] || String(medicine.food), left + 344, y, { width: 62 });
        doc.text(note, left + 410, y, { width: noteWidth });
        y += rowHeight;
      });

      if (advice) {
        y += 12;
        doc.font('Helvetica-Bold').fontSize(10).fillColor('#0b2a54').text('Advice', left, y);
        doc.font('Helvetica').fontSize(10).fillColor('#10203a').text(advice, left, y + 14, { width: right - left });
      }

      /* ---------------- signature ---------------- */
      const signatureY = doc.page.height - 150;
      if (fs.existsSync(env.org.signaturePath)) {
        doc.image(env.org.signaturePath, right - 170, signatureY, { width: 150 });
      }
      doc
        .font('Helvetica-Bold')
        .fontSize(10)
        .fillColor('#0f1f37')
        .text(`Dr. ${doctor.name}`, right - 190, signatureY + 58, { width: 190, align: 'right' })
        .font('Helvetica')
        .fontSize(9)
        .fillColor('#4a5b74')
        .text(doctor.speciality, right - 190, signatureY + 72, { width: 190, align: 'right' });

      doc
        .font('Helvetica-Oblique')
        .fontSize(8)
        .fillColor('#6b7a93')
        .text(
          'Digitally generated prescription. Please carry this document on your next visit.',
          left,
          doc.page.height - 66,
          { width: right - left, align: 'center' },
        );

      doc.end();
      console.log('[pdf] prescription document generated');
    } catch (error) {
      console.error('[pdf] generation failed:', error.message);
      reject(error);
    }
  });
