import json
import logging
import smtplib
import urllib.request
import urllib.error
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Dict, Any, Optional

from app.core.config import settings

logger = logging.getLogger("ExamSecure.EmailService")

class EmailService:
    @classmethod
    def send_unique_id_email(
        cls,
        to_email: str,
        candidate_name: str,
        access_code: str,
        max_uses: int = 3,
        exam_title: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Sends the unique access ID to the candidate's email address with 3-use limit notices.
        Automatically selects configured provider: Resend -> Brevo -> Gmail/SMTP -> Console Fallback.
        """
        subject = f"Your Official Examination Access ID: {access_code}"
        exam_name = exam_title or "Assigned Assessment"
        portal_url = settings.PORTAL_BASE_URL

        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b; }}
            .container {{ max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 16px rgba(0,0,0,0.04); }}
            .header {{ background: linear-gradient(135deg, #1e3a8a, #2563eb); padding: 28px 24px; text-align: center; color: #ffffff; }}
            .header h1 {{ margin: 0; font-size: 22px; font-weight: 700; letter-spacing: -0.5px; }}
            .header p {{ margin: 6px 0 0; font-size: 13px; opacity: 0.9; }}
            .content {{ padding: 32px 28px; }}
            .greeting {{ font-size: 15px; margin-bottom: 16px; font-weight: 600; color: #0f172a; }}
            .code-box {{ background: #f0fdf4; border: 2px dashed #16a34a; border-radius: 10px; padding: 20px; text-align: center; margin: 24px 0; }}
            .code-label {{ font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #166534; margin-bottom: 6px; }}
            .code-value {{ font-family: 'Courier New', Courier, monospace; font-size: 28px; font-weight: 800; color: #0f172a; letter-spacing: 3px; margin: 0; }}
            .warning-card {{ background: #fffbeb; border-left: 4px solid #f59e0b; padding: 14px 16px; border-radius: 6px; margin: 20px 0; font-size: 13px; color: #92400e; }}
            .warning-card b {{ color: #78350f; }}
            .btn-container {{ text-align: center; margin: 28px 0 20px; }}
            .btn {{ display: inline-block; background: #2563eb; color: #ffffff !important; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-weight: 700; font-size: 14px; box-shadow: 0 2px 8px rgba(37,99,235,0.3); }}
            .footer {{ background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 18px 24px; text-align: center; font-size: 11.5px; color: #64748b; }}
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>ExamSecure Assessment Portal</h1>
              <p>Official Candidate Examination Credential</p>
            </div>
            <div class="content">
              <div class="greeting">Dear {candidate_name},</div>
              <p style="font-size: 13.5px; line-height: 1.5; color: #334155;">
                An official examination session has been configured for you in <b>{exam_name}</b>.
                Please use the Unique Access ID below to verify your eligibility and enter the examination terminal.
              </p>

              <div class="code-box">
                <div class="code-label">Your Unique Examination Access ID</div>
                <div class="code-value">{access_code}</div>
              </div>

              <div class="warning-card">
                <b>⚠️ STRICT 3-USE LIMIT ENFORCEMENT:</b><br>
                This Unique Access ID is configured with a strict maximum limit of <b>{max_uses} uses</b>.
                Once it has been used {max_uses} times (for entering or launching the test terminal), it will automatically and permanently expire.
                Do NOT share this code with anyone.
              </div>

              <div class="btn-container">
                <a href="{portal_url}" class="btn" target="_blank">Open Examination Portal</a>
              </div>

              <p style="font-size: 12px; color: #64748b; line-height: 1.4;">
                Ensure your camera, microphone, and internet connectivity are active before starting the assessment.
              </p>
            </div>
            <div class="footer">
              ExamSecure Enterprise System • Automated Proctoring & Access Control<br>
              Kalpanaaa Software Solutions • All Rights Reserved
            </div>
          </div>
        </body>
        </html>
        """

        plain_text = (
            f"Dear {candidate_name},\n\n"
            f"Your Unique Access ID for {exam_name} is: {access_code}\n\n"
            f"STRICT USAGE LIMIT: This ID is valid for ONLY {max_uses} USES. "
            f"Once used {max_uses} times, it permanently expires.\n\n"
            f"Access the examination portal at: {portal_url}\n"
        )

        provider = settings.EMAIL_PROVIDER.lower()

        # 1. Resend Provider
        if provider == "resend" or (provider == "auto" and settings.RESEND_API_KEY):
            return cls._send_via_resend(to_email, subject, html_content, plain_text)

        # 2. Brevo Provider
        if provider == "brevo" or (provider == "auto" and settings.BREVO_API_KEY):
            return cls._send_via_brevo(to_email, subject, html_content, plain_text)

        # 3. SMTP Provider (Gmail or custom SMTP)
        if (provider == "smtp" or provider == "auto") and settings.SMTP_USER and settings.SMTP_PASSWORD:
            return cls._send_via_smtp(to_email, subject, html_content, plain_text)

        # 4. Fallback: Development Console Logger
        logger.warning(
            f"[EMAIL MOCK DELIVERY] No email API key configured. Email logged to console:\n"
            f"To: {to_email} | Subject: {subject} | Access Code: {access_code} (Limit: {max_uses} uses)"
        )
        return {
            "success": True,
            "provider": "mock_logger",
            "message": f"Email logged to server console for {to_email}. Configure RESEND_API_KEY, BREVO_API_KEY, or SMTP to send real emails.",
            "accessCode": access_code
        }

    @classmethod
    def _send_via_resend(cls, to_email: str, subject: str, html: str, text: str) -> Dict[str, Any]:
        """Sends transactional email via Resend REST API."""
        try:
            url = "https://api.resend.com/emails"
            payload = {
                "from": settings.EMAIL_FROM,
                "to": [to_email],
                "subject": subject,
                "html": html,
                "text": text
            }
            req = urllib.request.Request(
                url,
                data=json.dumps(payload).encode("utf-8"),
                headers={
                    "Authorization": f"Bearer {settings.RESEND_API_KEY}",
                    "Content-Type": "application/json"
                },
                method="POST"
            )
            with urllib.request.urlopen(req, timeout=10) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                logger.info(f"[Resend] Email sent to {to_email}, id={data.get('id')}")
                return {
                    "success": True,
                    "provider": "resend",
                    "id": data.get("id"),
                    "message": f"Email delivered to {to_email} via Resend"
                }
        except urllib.error.HTTPError as e:
            err_body = e.read().decode("utf-8", errors="replace")
            logger.error(f"[Resend Error] Status {e.code}: {err_body}")
            return {
                "success": False,
                "provider": "resend",
                "error": f"Resend API error {e.code}: {err_body}",
                "message": f"Failed to deliver email: {err_body}"
            }
        except Exception as e:
            logger.error(f"[Resend Exception] {str(e)}")
            return {
                "success": False,
                "provider": "resend",
                "error": str(e),
                "message": f"Resend connection failed: {str(e)}"
            }

    @classmethod
    def _send_via_brevo(cls, to_email: str, subject: str, html: str, text: str) -> Dict[str, Any]:
        """Sends transactional email via Brevo REST API."""
        try:
            url = "https://api.brevo.com/v3/smtp/email"
            payload = {
                "sender": {"email": settings.EMAIL_FROM.split("<")[-1].replace(">", "").strip() or "noreply@secureexam.local"},
                "to": [{"email": to_email}],
                "subject": subject,
                "htmlContent": html,
                "textContent": text
            }
            req = urllib.request.Request(
                url,
                data=json.dumps(payload).encode("utf-8"),
                headers={
                    "api-key": settings.BREVO_API_KEY,
                    "Content-Type": "application/json"
                },
                method="POST"
            )
            with urllib.request.urlopen(req, timeout=10) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                logger.info(f"[Brevo] Email sent to {to_email}, messageId={data.get('messageId')}")
                return {
                    "success": True,
                    "provider": "brevo",
                    "id": data.get("messageId"),
                    "message": f"Email delivered to {to_email} via Brevo"
                }
        except urllib.error.HTTPError as e:
            err_body = e.read().decode("utf-8", errors="replace")
            logger.error(f"[Brevo Error] Status {e.code}: {err_body}")
            return {
                "success": False,
                "provider": "brevo",
                "error": f"Brevo API error {e.code}: {err_body}",
                "message": f"Failed to deliver email: {err_body}"
            }
        except Exception as e:
            logger.error(f"[Brevo Exception] {str(e)}")
            return {
                "success": False,
                "provider": "brevo",
                "error": str(e),
                "message": f"Brevo connection failed: {str(e)}"
            }

    @classmethod
    def _send_via_smtp(cls, to_email: str, subject: str, html: str, text: str) -> Dict[str, Any]:
        """Sends email via standard SMTP (Gmail or custom server)."""
        try:
            msg = MIMEMultipart("alternative")
            msg["Subject"] = subject
            msg["From"] = settings.EMAIL_FROM
            msg["To"] = to_email

            part1 = MIMEText(text, "plain", "utf-8")
            part2 = MIMEText(html, "html", "utf-8")
            msg.attach(part1)
            msg.attach(part2)

            with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10) as server:
                if settings.SMTP_USE_TLS:
                    server.starttls()
                server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
                server.sendmail(settings.EMAIL_FROM, [to_email], msg.as_string())

            logger.info(f"[SMTP] Email delivered to {to_email} via {settings.SMTP_HOST}")
            return {
                "success": True,
                "provider": "smtp",
                "message": f"Email delivered to {to_email} via SMTP ({settings.SMTP_HOST})"
            }
        except Exception as e:
            logger.error(f"[SMTP Exception] {str(e)}")
            return {
                "success": False,
                "provider": "smtp",
                "error": str(e),
                "message": f"SMTP delivery failed: {str(e)}"
            }
