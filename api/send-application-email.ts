import { Resend } from 'resend';
// Safe access to env across runtimes without depending on @types/node
const RESEND_KEY = (globalThis as any)?.process?.env?.RESEND_API_KEY || '';
const resend = new Resend(RESEND_KEY);

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

// Generic handler signature to avoid framework-specific type dependencies
export default async function handler(req: any, res: any) {
  if (req?.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    if (!RESEND_KEY) return res.status(500).json({ error: 'Missing RESEND_API_KEY' });

    const {
      to,
      subject,
      loanId,
      applicationNumber,
      applicant,
      loan,
      references,
      documents,
    } = (req?.body ?? {}) as any;

    if (!to) return res.status(400).json({ error: 'Missing recipient' });

    const html = buildHtml({ applicant, loan, references, documents, loanId, applicationNumber });

    const send = await resend.emails.send({
      from: 'no-reply@yourdomain.com',
      to,
      subject: subject || 'Loan Application Submitted',
      html,
    });

    return res.status(200).json({ ok: true, id: (send as any)?.id });
  } catch (e: any) {
    return res.status(500).json({ error: e.message || 'Failed to send email' });
  }
}
