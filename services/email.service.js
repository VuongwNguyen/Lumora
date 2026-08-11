const nodemailer = require("nodemailer");

class EmailService {
  constructor() {
    this.transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
      },
    });
  }

  async sendOtp(email, otp) {
    await this.transporter.sendMail({
      from: `"Galaxy ✨" <${process.env.GMAIL_USER}>`,
      to: email,
      subject: "[Galaxy] Mã xác thực của bạn",
      text: `Mã OTP của bạn là: ${otp}\nMã có hiệu lực trong 5 phút.\nKhông chia sẻ mã này với ai.`,
      html: `
        <div style="font-family:sans-serif;max-width:400px;margin:0 auto;padding:24px;background:#0a0a1f;color:#fff;border-radius:12px;">
          <h2 style="color:#e0b3ff;text-align:center;">✨ Galaxy</h2>
          <p style="margin:16px 0;">Mã OTP xác thực email của bạn:</p>
          <div style="font-size:32px;font-weight:bold;letter-spacing:8px;text-align:center;color:#a259f7;padding:16px;background:rgba(162,89,247,0.1);border-radius:8px;">
            ${otp}
          </div>
          <p style="margin-top:16px;font-size:13px;color:rgba(255,255,255,0.5);">
            Mã có hiệu lực trong 5 phút. Không chia sẻ mã này với ai.
          </p>
        </div>
      `,
    });
  }

  async sendPasswordResetOtp(email, otp) {
    await this.transporter.sendMail({
      from: `"Galaxy ✨" <${process.env.GMAIL_USER}>`,
      to: email,
      subject: "[Galaxy] Đặt lại mật khẩu",
      text: `Mã OTP đặt lại mật khẩu của bạn là: ${otp}\nMã có hiệu lực trong 5 phút.\nNếu bạn không yêu cầu, hãy bỏ qua email này.`,
      html: `
        <div style="font-family:sans-serif;max-width:400px;margin:0 auto;padding:24px;background:#0a0a1f;color:#fff;border-radius:12px;">
          <h2 style="color:#e0b3ff;text-align:center;">✨ Galaxy</h2>
          <p style="margin:16px 0;">Mã OTP đặt lại mật khẩu của bạn:</p>
          <div style="font-size:32px;font-weight:bold;letter-spacing:8px;text-align:center;color:#a259f7;padding:16px;background:rgba(162,89,247,0.1);border-radius:8px;">
            ${otp}
          </div>
          <p style="margin-top:16px;font-size:13px;color:rgba(255,255,255,0.5);">
            Mã có hiệu lực trong 5 phút. Nếu bạn không yêu cầu đặt lại mật khẩu, hãy bỏ qua email này.
          </p>
        </div>
      `,
    });
  }

  async sendSupportRequest(request) {
    if (!process.env.SUPPORT_EMAIL) return false;
    await this.transporter.sendMail({
      from: `"Lumora Support" <${process.env.GMAIL_USER}>`,
      to: process.env.SUPPORT_EMAIL,
      replyTo: request.email,
      subject: `[Lumora Support] ${request.referenceCode} · ${request.type}`,
      text: [
        `Mã yêu cầu: ${request.referenceCode}`,
        `Loại: ${request.type}`,
        `Họ tên: ${request.name}`,
        `Email phản hồi: ${request.email}`,
        `Mã đơn: ${request.orderCode || 'Không cung cấp'}`,
        '',
        request.message,
      ].join('\n'),
    });
    return true;
  }
}

module.exports = new EmailService();
