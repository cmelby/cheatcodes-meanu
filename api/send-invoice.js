const nodemailer = require('nodemailer');

export default async function handler(req, res) {
    // Enable CORS for local testing if needed, though Vercel handles it normally for same-origin
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
      'Access-Control-Allow-Headers',
      'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { customerEmail, invoiceHtml } = req.body;

    if (!customerEmail || !invoiceHtml) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    try {
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.SMTP_EMAIL,
                pass: process.env.SMTP_PASSWORD
            }
        });

        const mailOptions = {
            from: `"Cheat Codes Peptides" <${process.env.SMTP_EMAIL}>`,
            to: customerEmail,
            cc: ['Tyler@cheatcodespeptides.com', 'chris@cheatcodespeptides.com'],
            subject: 'Your Order Invoice - Cheat Codes Peptides',
            html: invoiceHtml,
        };

        await transporter.sendMail(mailOptions);

        return res.status(200).json({ success: true, message: 'Invoice sent successfully!' });
    } catch (error) {
        console.error("Error sending email:", error);
        return res.status(500).json({ error: 'Failed to send email. Ensure Vercel environment variables are set correctly.' });
    }
}
