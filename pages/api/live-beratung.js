import { sendEmail } from '../../backend/sendMail';

export default async function handler(req, res) {
    const { email, name } = req.body;

    const kundeMail = `
        <h2>Hallo ${name},</h2>
        <p>Ihre exklusive <strong>Live-Beratung</strong> ist jetzt bereit.</p>
        <p><a href="https://meet.goldsilverstuff.com/VIP-GOLD" style="background:#ffd700;color:black;padding:10px 20px;text-decoration:none;border-radius:4px;">Jetzt starten</a></p>
        <p>Viele Grüße,<br>Ihr GoldSilverStuff Team</p>
    `;

    const internMail = `
        <h3>Neuer Kunde möchte Live-Beratung:</h3>
        <p>Name: ${name}</p>
        <p>Email: ${email}</p>
        <p>Direktlink:<br><a href="https://meet.goldsilverstuff.com/VIP-GOLD">Jetzt Beratung starten</a></p>
    `;

    try {
        await sendEmail(email, 'Ihre VIP Live-Beratung ist bereit!', kundeMail);
        await sendEmail('dein@email.de', 'Neuer Kunde will VIP-Beratung', internMail);

        res.status(200).json({ success: true });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false });
    }
}
