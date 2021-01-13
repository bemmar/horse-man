import nodemailer from "nodemailer";
import Mail from "nodemailer/lib/mailer";

let _transporter: undefined | Mail = undefined;

export async function sendEmail(header: string, content: any) {
  if (_transporter === undefined) {
    _transporter = nodemailer.createTransport({
      service: process.env.EMAIL_SERVICE,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });
  }

  await _transporter.sendMail({
    to: process.env.EMAIL_USER,
    from: process.env.EMAIL_USER,
    subject: header,
    text: content
  });
}
