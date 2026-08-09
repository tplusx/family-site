import type { APIRoute } from 'astro';
import nodemailer from 'nodemailer';

const attempts = new Map<string, { count: number; reset: number }>();
const reply = (message: string, status: number) => new Response(JSON.stringify({ message }), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

export const POST: APIRoute = async ({ request, clientAddress }) => {
  const now = Date.now();
  const entry = attempts.get(clientAddress) ?? { count: 0, reset: now + 60 * 60_000 };
  if (now > entry.reset) { entry.count = 0; entry.reset = now + 60 * 60_000; }
  if (++entry.count > 5) return reply('Too many messages. Please try again later.', 429);
  attempts.set(clientAddress, entry);

  const data = await request.formData();
  const name = String(data.get('name') ?? '').trim();
  const email = String(data.get('email') ?? '').trim();
  const message = String(data.get('message') ?? '').trim();
  if (data.get('website')) return reply('Thanks — your message has been received.', 200);
  if (!name || name.length > 80 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 || message.length < 10 || message.length > 4000) return reply('Please check each field and try again.', 400);

  const required = ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASSWORD', 'CONTACT_TO', 'CONTACT_FROM'] as const;
  if (required.some((key) => !process.env[key])) { console.error('Contact mail environment is incomplete.'); return reply('Mail is temporarily unavailable. Please try again later.', 503); }
  const transporter = nodemailer.createTransport({ host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT ?? 587), secure: process.env.SMTP_SECURE === 'true', auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } });
  try {
    await transporter.sendMail({ from: process.env.CONTACT_FROM, to: process.env.CONTACT_TO, replyTo: email, subject: `Family archive message from ${name.replace(/[\r\n]/g, ' ')}`, text: `From: ${name} <${email}>\n\n${message}` });
  } catch (error) {
    console.error('Contact mail delivery failed.', error);
    return reply('Mail is temporarily unavailable. Please try again later.', 502);
  }
  return reply('Thank you. Your message has been sent.', 200);
};

export const ALL: APIRoute = () => reply('Method not allowed.', 405);
