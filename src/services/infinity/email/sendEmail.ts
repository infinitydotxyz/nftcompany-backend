import { INFINITY_EMAIL } from '@constants';
import nodemailer from 'nodemailer';
import mailCreds from '@base/../creds/nftc-dev-nodemailer-creds.json';
import { error, log } from '@utils/logger';

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  auth: {
    type: 'OAuth2',
    user: INFINITY_EMAIL,
    serviceClient: mailCreds.client_id,
    privateKey: mailCreds.private_key
  }
});

export function sendEmail(to: string, subject: string, html: string) {
  log('Sending email to', to);

  const mailOptions = {
    from: INFINITY_EMAIL,
    to,
    subject,
    html
  };

  transporter.sendMail(mailOptions).catch((err) => {
    error('Error sending email');
    error(err);
  });
}
