import axios from "axios";

export async function sendEmail(
  to: string,
  subject: string,
  html: string
) {
  try {
    const response = await axios.post(
      "https://api.brevo.com/v3/smtp/email",
      {
        sender: {
          name: process.env.EMAIL_FROM_NAME,
          email: process.env.EMAIL_FROM,
        },
        to: [{ email: to }],
        subject,
        htmlContent: html,
      },
      {
        headers: {
          accept: "application/json",
          "api-key": process.env.BREVO_API_KEY!,
          "content-type": "application/json",
        },
      }
    );

    return response.data;
  } catch (error: any) {
    console.error(
      "Email Send Error:",
      error.response?.data || error.message
    );
    throw error;
  }
}