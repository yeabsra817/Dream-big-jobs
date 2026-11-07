import { jsPDF } from 'jspdf';
import { PersonalProfile } from '../types/autoApply';
import { Vacancy } from '../types/job';

/**
 * Generate a clean, ATS-compliant, executive CV PDF for Yeabsra Tefera
 */
export function generateCvPdf(
  cvContent: string,
  profile: PersonalProfile,
  vacancy?: Partial<Vacancy>
): jsPDF {
  const doc = new jsPDF({
    unit: 'pt',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 40;
  const contentWidth = pageWidth - margin * 2;

  let y = 45;

  // Header Bar Accent
  doc.setFillColor(11, 19, 43); // Dark Navy #0B132B
  doc.rect(margin, y, contentWidth, 3, 'F');
  y += 18;

  // Name
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(11, 19, 43);
  doc.text(profile.name.toUpperCase(), margin, y);
  y += 16;

  // Subtitle / Target Title
  const targetTitle = vacancy?.title
    ? `${vacancy.title.toUpperCase()} CANDIDATE`
    : 'SENIOR FINANCE & BANKING OPERATIONS PROFESSIONAL';
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(217, 119, 6); // Amber / Gold
  doc.text(targetTitle, margin, y);
  y += 15;

  // Contact Info Line
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(71, 85, 105);
  const contactLine = `${profile.email}  •  ${profile.phone || '+251 91 123 4567'}  •  ${profile.address || 'Addis Ababa, Ethiopia'}`;
  doc.text(contactLine, margin, y);
  y += 12;

  // Divider
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(1);
  doc.line(margin, y, pageWidth - margin, y);
  y += 18;

  // Body text formatting
  const lines = cvContent.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i].trim();
    if (!rawLine) {
      y += 8;
      continue;
    }

    // Check for Page Overflow
    if (y > pageHeight - 50) {
      doc.addPage();
      y = 45;
    }

    // Section Headers (e.g. ## SECTION or uppercase words like PROFESSIONAL SUMMARY)
    const isHeading =
      rawLine.startsWith('#') ||
      rawLine.startsWith('**') && rawLine.endsWith('**') && rawLine.length < 40 ||
      /^(PROFESSIONAL SUMMARY|CORE COMPETENCIES|EMPLOYMENT HISTORY|PROFESSIONAL EXPERIENCE|EDUCATION|CREDENTIALS|KEY ACHIEVEMENTS)/i.test(rawLine);

    if (isHeading) {
      const cleanHeader = rawLine.replace(/^[#* ]+/, '').replace(/[*# ]+$/, '');
      y += 6;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(11, 19, 43);
      doc.text(cleanHeader.toUpperCase(), margin, y);
      y += 4;
      doc.setDrawColor(203, 213, 225);
      doc.setLineWidth(0.75);
      doc.line(margin, y, pageWidth - margin, y);
      y += 14;
      continue;
    }

    // Sub-headings (e.g. Job Titles or Institutions)
    const isSubHeader = rawLine.startsWith('###') || (rawLine.includes('—') && rawLine.length < 80) || (rawLine.includes('|') && rawLine.length < 80);
    if (isSubHeader) {
      const cleanSub = rawLine.replace(/^[#* ]+/, '').replace(/[*# ]+$/, '');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      doc.setTextColor(30, 41, 59);
      doc.text(cleanSub, margin, y);
      y += 14;
      continue;
    }

    // Bullet points
    if (rawLine.startsWith('-') || rawLine.startsWith('•') || rawLine.startsWith('*')) {
      const bulletText = rawLine.replace(/^[-•*]\s*/, '');
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
      doc.setTextColor(51, 65, 85);

      doc.circle(margin + 4, y - 3, 1.5, 'F');
      const wrapped = doc.splitTextToSize(bulletText, contentWidth - 16);
      doc.text(wrapped, margin + 14, y);
      y += wrapped.length * 13;
      continue;
    }

    // Normal paragraph text
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(51, 65, 85);
    const wrapped = doc.splitTextToSize(rawLine, contentWidth);
    doc.text(wrapped, margin, y);
    y += wrapped.length * 13;
  }

  // Footer on each page
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    const footerText = `${profile.name} — Confidential Application CV | Page ${p} of ${totalPages}`;
    doc.text(footerText, margin, pageHeight - 22);
  }

  return doc;
}

/**
 * Generate a formal, tailored Cover Letter PDF for Yeabsra Tefera
 */
export function generateCoverLetterPdf(
  letterContent: string,
  profile: PersonalProfile,
  vacancy?: Partial<Vacancy>
): jsPDF {
  const doc = new jsPDF({
    unit: 'pt',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 45;
  const contentWidth = pageWidth - margin * 2;

  let y = 45;

  // Applicant Header Block
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(11, 19, 43);
  doc.text(profile.name.toUpperCase(), margin, y);
  y += 15;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(71, 85, 105);
  doc.text(`${profile.email}  •  ${profile.phone || '+251 91 123 4567'}  •  ${profile.address || 'Addis Ababa, Ethiopia'}`, margin, y);
  y += 14;

  // Divider
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(1);
  doc.line(margin, y, pageWidth - margin, y);
  y += 20;

  // Date
  const today = new Date().toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(30, 41, 59);
  doc.text(`Date: ${today}`, margin, y);
  y += 16;

  // Recipient Block
  const orgName = vacancy?.organization || 'The Recruitment & Selection Committee';
  doc.setFont('helvetica', 'bold');
  doc.text(`To: The Recruitment Team`, margin, y);
  y += 14;
  doc.text(orgName, margin, y);
  y += 14;
  doc.setFont('helvetica', 'normal');
  doc.text(vacancy?.location || 'Addis Ababa, Ethiopia', margin, y);
  y += 22;

  // Subject Line
  const subjectLine = `SUBJECT: Application for ${vacancy?.title || 'Advertised Finance Position'} (Ref: ${vacancy?.referenceNumber || 'Official Vacancy Announcement'})`;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(11, 19, 43);
  const wrappedSubject = doc.splitTextToSize(subjectLine, contentWidth);
  doc.text(wrappedSubject, margin, y);
  y += wrappedSubject.length * 14 + 10;

  // Letter Body
  const cleanBody = letterContent
    .replace(/^#+.*$/gm, '') // Remove markdown headers
    .replace(/\*\*/g, '')
    .trim();

  const paragraphs = cleanBody.split(/\n\s*\n/);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(30, 41, 59);

  for (const para of paragraphs) {
    const trimmed = para.trim();
    if (!trimmed) continue;

    if (y > pageHeight - 65) {
      doc.addPage();
      y = 45;
    }

    const lines = doc.splitTextToSize(trimmed, contentWidth);
    doc.text(lines, margin, y);
    y += lines.length * 15 + 10;
  }

  // Sign-off
  if (y > pageHeight - 60) {
    doc.addPage();
    y = 45;
  }

  y += 10;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text('Sincerely,', margin, y);
  y += 22;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(11, 19, 43);
  doc.text(profile.name, margin, y);
  y += 14;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(100, 116, 139);
  doc.text('Senior Finance & Banking Professional', margin, y);

  return doc;
}
