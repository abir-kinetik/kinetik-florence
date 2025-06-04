// import nodemailer from 'nodemailer';
import emailjs from '@emailjs/browser';

// Name	Candace Baumbach
// Username	candace59 @ethereal.email – this account can not be used for inbound emails 
// Password	DkwtSg64pcUdPKAuc9

// const transporter = nodemailer.createTransport({
//     service: "gmail",
//     auth: {
//         user: process.env.GMAIL_USER_EMAIL,
//         pass: process.env.GMAIL_APP_PASSWORD,
//     }
// });

// export async function sendEmail(to: string, subject: string, text: string): Promise<void> {
//     const info = await transporter.sendMail({
//         from: `"Team One" <abir@kientik.care>`,
//         to,
//         subject,
//         text,
//     });
//     console.log('Message sent: %s', info.messageId);
// }

export const sendActualEmail = async (
    toEmail: string,
    messageContent: string,
    name: string, subject: string
): Promise<void> => {
    const serviceId = process.env.EMAIL_SERVICE_ID;      // e.g., 'service_abcdefg'
    const templateId = process.env.EMAIL_TEMPLATE_ID;    // e.g., 'template_123456'
    const publicKey = process.env.EMAIL_PUBLIC_KEY;      // e.g., 'YOUR_PUBLIC_KEY_STRING' (usually starts with a letter and has many characters)

    if (!serviceId || !templateId || !publicKey) {
        console.error('EmailJS credentials are not set. Cannot send email.');
        alert('EmailJS credentials missing. Please configure them in sendActualEmail function.');
        return;
    }

    const templateParams = {
        to_email: toEmail,
        message: messageContent,
        name: name,
        title: subject
        // Add any other dynamic fields your template expects
    };

    try {
        const response = await emailjs.send(serviceId, templateId, templateParams, publicKey);
        console.log('Email successfully sent!', response.status, response.text);
        //alert(`Actual email sent to ${toEmail}! Status: ${response.status}`);
    } catch (error) {
        console.error('Failed to send email:', error);
        //alert(`Failed to send email to ${toEmail}. Error: ${error instanceof Error ? error.message : String(error)}`);
    }
};
// Sample Email Call
// const recipientEmail = "ahasankabir146@gmail.com"; // The email for your demo
// const emailSubject = "New Trip Booking Confirmation"; // Subject is handled by EmailJS template
// const emailBody = "your patient id verification is successful";
// const receiver_name = ""
// sendActualEmail(recipientEmail, emailBody, receiver_name, emailSubject);