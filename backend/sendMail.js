import nodemailer from 'nodemailer';

export default async function handler(req, res) {
    const { email, name } = req.body;

    const transporter = nodemailer.createTransport({
        host: 'smtp.yourmailserver.com',  // z.B. smtp.strato, smtp.ionos etc.
        port: 587,
        auth: {
            user: 'dein-email-benutzername',
            pass: 'dein-email-passwort'
        }
    });

    const htmlTemplate = `
        <div style="font-family:sans-serif;padding:20px;">
            <h2 style="color:#333;">Hallo ${name},</h2>
            <p>Ihre exklusive <strong>Live-Beratung</strong> ist jetzt bereit.</p>
            <p><a href="https://meet.goldsilverstuff.com" style="background:#ffd700;color:black;padding:10px 20px;text-decoration:none;border-radius:4px;">Hier klicken, um die Beratung zu starten</a></p>
            <p>Herzliche Grüße,<br>Ihr GoldSilverStuff Team</p>
        </div>
    `;

    try {
        await transporter.sendMail({
            from: '"GoldSilverStuff Support" <support@deinedomain.de>',
            to: email,
            subject: 'Ihre Live-Beratung ist bereit!',
            html: htmlTemplate
        });

        await transporter.sendMail({
            from: '"GoldSilverStuff Support" sales@goldsilverstuff.com',
            to: 'sales@goldsilverstuff.com',
            subject: 'Neuer Kunde will VIP-Beratung!',
            text: `${name} hat eine Live-Beratung angefragt.`
        });

        res.status(200).json({ success: true });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false });
    }
}
