import { Resend } from 'resend';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
// Safe access to env across runtimes without depending on @types/node
const RESEND_KEY = (globalThis as any)?.process?.env?.RESEND_API_KEY || '';
const RESEND_FROM = (globalThis as any)?.process?.env?.RESEND_FROM || 'Acme <onboarding@resend.dev>';
const resend = new Resend(RESEND_KEY);

function toBase64(bytes: Uint8Array): string {
  // Try Node Buffer if present
  const g: any = globalThis as any;
  if (g?.Buffer) {
    return g.Buffer.from(bytes).toString('base64');
  }
  // Fallback: manual base64
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) binary += String.fromCharCode(bytes[i]);
  // btoa may exist in some runtimes
  if (typeof g.btoa === 'function') return g.btoa(binary);
  // Minimal base64 polyfill
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
  let result = '';
  let i = 0;
  while (i < binary.length) {
    const c1 = binary.charCodeAt(i++);
    const c2 = binary.charCodeAt(i++);
    const c3 = binary.charCodeAt(i++);
    const e1 = c1 >> 2;
    const e2 = ((c1 & 3) << 4) | (c2 >> 4);
    const e3 = isNaN(c2) ? 64 : (((c2 & 15) << 2) | (c3 >> 6));
    const e4 = isNaN(c3) ? 64 : (c3 & 63);
    result += chars.charAt(e1) + chars.charAt(e2) + chars.charAt(e3) + chars.charAt(e4);
  }
  return result;
}

function buildHtml(payload: any) {
  const { applicant, loan, references, documents, loanId, applicationNumber } = payload;
  return `
    <div>
      <h2>Loan Application Submitted</h2>
      <p>Thank you, <b>${applicant.firstName} ${applicant.lastName}</b>. Your application has been received.</p>

      <h3>Application</h3>
      <ul>
        <li><b>Application No.</b>: ${applicationNumber ?? 'N/A'}</li>
        <li><b>Loan ID</b>: ${loanId}</li>
      </ul>

      <h3>Applicant</h3>
      <ul>
        <li><b>Email</b>: ${applicant.email}</li>
        <li><b>Mobile</b>: ${applicant.mobile}</li>
        <li><b>Address</b>: ${applicant.address}, ${applicant.pinCode}</li>
      </ul>

      <h3>Loan</h3>
      <ul>
        <li><b>Amount</b>: ₹${Number(loan.amount || 0).toLocaleString('en-IN')}</li>
        <li><b>Tenure</b>: ${loan.tenure} months</li>
        <li><b>Interest Scheme</b>: ${loan.interestScheme}</li>
        <li><b>Processing Fee</b>: ₹${Number(loan.processingFee || 0).toFixed(2)}</li>
        <li><b>Gold Price Lock Date</b>: ${loan.goldPriceLockDate}</li>
      </ul>

      <h3>References</h3>
      <ol>
        ${references.map((r: any) => `<li>${r.name} (${r.relationship}) — ${r.contact}</li>`).join('')}
      </ol>

      <h3>Documents</h3>
      <ul>
        ${documents.map((d: any) => `<li>${d.type}: <a href="${d.url}">${d.fileName}</a></li>`).join('')}
      </ul>

      <p>We will notify you as we process your application.</p>
    </div>
  `;
}

async function buildLoanPdf(payload: any): Promise<Uint8Array> {
  const { applicant, loan, references, documents, loanId, applicationNumber } = payload;
  const doc = await PDFDocument.create();
  const page = doc.addPage([595.28, 841.89]); // A4 portrait
  const font = await doc.embedFont(StandardFonts.Helvetica);

  const drawText = (text: string, x: number, y: number, size = 12) => {
    page.drawText(text, { x, y, size, font, color: rgb(0, 0, 0) });
  };

  let y = 800;
  drawText('Loan Application Details', 50, y, 18); y -= 24;
  drawText(`Application No.: ${applicationNumber ?? 'N/A'}`, 50, y); y -= 18;
  drawText(`Loan ID: ${loanId}`, 50, y); y -= 24;

  drawText('Applicant', 50, y, 14); y -= 18;
  drawText(`Name: ${applicant.firstName} ${applicant.lastName}`, 60, y); y -= 16;
  drawText(`Email: ${applicant.email}`, 60, y); y -= 16;
  drawText(`Mobile: ${applicant.mobile}`, 60, y); y -= 16;
  drawText(`Address: ${applicant.address}, ${applicant.pinCode}`, 60, y); y -= 20;

  drawText('Loan', 50, y, 14); y -= 18;
  drawText(`Amount: ₹${Number(loan.amount || 0).toLocaleString('en-IN')}`, 60, y); y -= 16;
  drawText(`Tenure: ${loan.tenure} months`, 60, y); y -= 16;
  drawText(`Interest Scheme: ${loan.interestScheme}`, 60, y); y -= 16;
  drawText(`Processing Fee: ₹${Number(loan.processingFee || 0).toFixed(2)}`, 60, y); y -= 16;
  drawText(`Gold Price Lock Date: ${loan.goldPriceLockDate}`, 60, y); y -= 20;

  if (references?.length) {
    drawText('References', 50, y, 14); y -= 18;
    references.forEach((r: any, idx: number) => { drawText(`${idx + 1}. ${r.name} (${r.relationship}) — ${r.contact}`, 60, y); y -= 16; });
    y -= 6;
  }

  if (documents?.length) {
    drawText('Documents', 50, y, 14); y -= 18;
    documents.forEach((d: any, idx: number) => { drawText(`${idx + 1}. ${d.type}: ${d.fileName || d.url || d.path}`, 60, y); y -= 16; });
  }

  const bytes = await doc.save();
  return bytes;
}

// Generic handler signature to avoid framework-specific type dependencies
export default async function handler(req: any, res: any) {
  if (req?.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    if (!RESEND_KEY) return res.status(500).json({ error: 'Missing RESEND_API_KEY' });

    const {
      to,
      subject,
      stage, // 'submitted' | 'accepted' | 'verified' | 'disbursed'
      loanId,
      applicationNumber,
      applicant,
      loan,
      references,
      documents,
      disbursement, // { date, amount, tenure }
    } = (req?.body ?? {}) as any;

    if (!to) return res.status(400).json({ error: 'Missing recipient' });

    // Determine content by stage
    let finalSubject = subject;
    let html = '';
    let text = '';
    const applicantName = applicant ? `${applicant.firstName} ${applicant.lastName}` : '';
    if (stage === 'accepted') {
      finalSubject = finalSubject || 'Loan Application Accepted';
      text = 'Your loan application has been accepted. Please upload the additional documents using your application dashboard. The submit button is now enabled in your loan application.';
      html = `<p>${text}</p>`;
    } else if (stage === 'verified') {
      finalSubject = finalSubject || 'Documents Verified Successfully';
      text = 'Your documents have been verified successfully. The loan amount will be disbursed within 2–3 working days.';
      html = `<p>${text}</p>`;
    } else if (stage === 'disbursed') {
      const amt = disbursement?.amount ?? loan?.amount;
      const date = disbursement?.date ?? new Date().toISOString().slice(0, 10);
      const tenure = disbursement?.tenure ?? loan?.tenure;
      finalSubject = finalSubject || 'Loan Disbursed Successfully';
      text = `Your loan amount of ₹${Number(amt || 0).toLocaleString('en-IN')} has been successfully disbursed. Disbursement details: ${date}, ${tenure}. Thank you for trusting us with your financial needs.`;
      html = `<p>${text}</p>`;
    } else {
      // default: submitted
      finalSubject = finalSubject || `Loan Application Submitted - ${applicantName}`;
      text = 'Your loan application has been submitted successfully. Please wait for admin acceptance to add the additional documents to proceed further.';
      html = buildHtml({ applicant, loan, references, documents, loanId, applicationNumber });
    }

    // Temporary visibility logs for verification
    // Remove these logs once you've confirmed emails are flowing
    console.log('Sending application email', {
      to,
      subject: finalSubject,
      loanId,
      applicationNumber,
      stage: stage || 'submitted',
    });

    let attachments: any[] | undefined;
    if (!stage || stage === 'submitted') {
      try {
        const pdfBytes = await buildLoanPdf({ applicant, loan, references, documents, loanId, applicationNumber });
        attachments = [
          {
            filename: `Loan_${applicationNumber || loanId || 'application'}.pdf`,
            content: toBase64(pdfBytes),
          },
        ];
      } catch (e) {
        console.warn('Failed to build PDF, sending email without attachment', e);
      }
    }

    const send = await resend.emails.send({
      from: RESEND_FROM,
      to: to as any, // string or string[] supported by Resend
      subject: finalSubject,
      html,
      text,
      attachments,
    });

    console.log('Email sent', { to, id: (send as any)?.id });

    return res.status(200).json({ ok: true, id: (send as any)?.id });
  } catch (e: any) {
    return res.status(500).json({ error: e.message || 'Failed to send email' });
  }
}
