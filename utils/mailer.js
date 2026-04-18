const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

async function sendAdminNotification(user, plan) {
  const planDetails = {
    monthly: { name: 'Monthly', price: '₹49/month', trips: '10 trips/month' },
    yearly: { name: 'Yearly', price: '₹299/year', trips: 'Unlimited trips' },
  };
  const p = planDetails[plan];

  await transporter.sendMail({
    from: `"TripCraft" <${process.env.SMTP_FROM}>`,
    to: process.env.SMTP_FROM, // Admin email
    subject: `🔔 New Subscription Request - ${p.name} Plan`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto;">
        <h2 style="color: #FF6B35;">New Subscription Request</h2>
        <table style="width: 100%; border-collapse: collapse;">
          <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><b>User</b></td><td style="padding: 8px; border-bottom: 1px solid #eee;">${user.name}</td></tr>
          <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><b>Email</b></td><td style="padding: 8px; border-bottom: 1px solid #eee;">${user.email}</td></tr>
          <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><b>Username</b></td><td style="padding: 8px; border-bottom: 1px solid #eee;">@${user.username || 'N/A'}</td></tr>
          <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><b>Plan</b></td><td style="padding: 8px; border-bottom: 1px solid #eee;">${p.name} - ${p.price}</td></tr>
          <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><b>Trips</b></td><td style="padding: 8px; border-bottom: 1px solid #eee;">${p.trips}</td></tr>
          <tr><td style="padding: 8px;"><b>User ID</b></td><td style="padding: 8px;">${user._id}</td></tr>
        </table>
        <p style="margin-top: 20px; color: #666;">Contact the user to collect payment, then update their subscription via the admin API.</p>
        <p style="color: #999; font-size: 12px;">POST /api/subscription/update with { userId: "${user._id}", tier: "${plan}", days: ${plan === 'monthly' ? 30 : 365} }</p>
      </div>
    `,
  });
}

async function sendUserConfirmation(user, plan) {
  const planDetails = {
    monthly: { name: 'Monthly', price: '₹49/month' },
    yearly: { name: 'Yearly', price: '₹299/year' },
  };
  const p = planDetails[plan];

  await transporter.sendMail({
    from: `"TripCraft" <${process.env.SMTP_FROM}>`,
    to: user.email,
    subject: `✈️ Thanks for choosing TripCraft ${p.name} Plan!`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto;">
        <div style="background: #FF6B35; padding: 20px; border-radius: 12px 12px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0;">✈️ TripCraft</h1>
        </div>
        <div style="padding: 24px; background: #f9f9f9; border-radius: 0 0 12px 12px;">
          <h2 style="color: #1A1A2E;">Thanks, ${user.name}!</h2>
          <p style="color: #6B7280;">You've selected the <b style="color: #FF6B35;">${p.name} Plan (${p.price})</b>.</p>
          <p style="color: #6B7280;">Our team will contact you shortly at <b>${user.email}</b> with payment details.</p>
          <p style="color: #6B7280;">Once payment is confirmed, your plan will be activated and you can start creating amazing trips!</p>
          <div style="margin-top: 24px; padding: 16px; background: white; border-radius: 8px; border-left: 4px solid #FF6B35;">
            <p style="margin: 0; color: #1A1A2E;"><b>What's next?</b></p>
            <p style="margin: 8px 0 0; color: #6B7280;">1. We'll email you payment details<br>2. Complete the payment<br>3. Your plan activates instantly</p>
          </div>
          <p style="margin-top: 20px; color: #9CA3AF; font-size: 12px;">Happy traveling! - The TripCraft Team</p>
        </div>
      </div>
    `,
  });
}

module.exports = { sendAdminNotification, sendUserConfirmation };
