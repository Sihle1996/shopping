package com.example.backend.service;

import com.example.backend.entity.OrderDTO;
import com.example.backend.entity.OrderItemDTO;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class EmailService {

    @Value("${resend.api-key:}")
    private String apiKey;

    @Value("${resend.from:noreply@crave-it.co.za}")
    private String fromAddress;

    private final RestTemplate restTemplate;

    public void sendDriverWelcomeEmail(String toEmail, String password, String storeName, String loginUrl) {
        if (apiKey == null || apiKey.isBlank()) {
            log.warn("RESEND_API_KEY not configured — skipping driver welcome email");
            return;
        }
        String html = "<div style='font-family:Inter,Helvetica,Arial,sans-serif;background:#f9fafb;padding:40px 0;'>"
            + "<div style='max-width:480px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);'>"
            + "<div style='background:#111827;padding:28px 36px;text-align:center;'>"
            + "<h1 style='margin:0;color:#ffffff;font-size:20px;font-weight:700;'>CraveIt</h1>"
            + "<p style='margin:8px 0 0;color:#9ca3af;font-size:13px;'>Driver Account Created</p>"
            + "</div>"
            + "<div style='padding:32px 36px;'>"
            + "<p style='margin:0 0 16px;color:#374151;font-size:15px;'>Hi! Your driver account for <strong>" + escapeHtml(storeName) + "</strong> is ready.</p>"
            + "<div style='background:#f3f4f6;border-radius:10px;padding:16px 20px;margin-bottom:20px;'>"
            + "<p style='margin:0 0 8px;color:#6b7280;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;'>Your login details</p>"
            + "<p style='margin:0 0 4px;color:#374151;font-size:14px;'><strong>Email:</strong> " + escapeHtml(toEmail) + "</p>"
            + "<p style='margin:0;color:#374151;font-size:14px;'><strong>Password:</strong> " + escapeHtml(password) + "</p>"
            + "</div>"
            + "<a href='" + escapeHtml(loginUrl) + "' style='display:inline-block;background:#E76F51;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:10px;font-size:15px;font-weight:600;'>Log In Now</a>"
            + "<p style='margin:20px 0 0;color:#9ca3af;font-size:12px;'>Please change your password after your first login.</p>"
            + "</div>"
            + "</div>"
            + "</div>";
        send(toEmail, "Your CraveIt driver account is ready", html);
    }

    public void sendVerificationEmail(String toEmail, String nameOrEmail, String verificationUrl) {
        if (apiKey == null || apiKey.isBlank()) {
            log.warn("RESEND_API_KEY not configured — skipping verification email");
            return;
        }
        String html = "<div style='font-family:Inter,Helvetica,Arial,sans-serif;background:#f9fafb;padding:40px 0;'>"
            + "<div style='max-width:480px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);'>"
            + "<div style='background:#111827;padding:28px 36px;text-align:center;'>"
            + "<h1 style='margin:0;color:#ffffff;font-size:20px;font-weight:700;'>CraveIt</h1>"
            + "<p style='margin:8px 0 0;color:#9ca3af;font-size:13px;'>Verify your email address</p>"
            + "</div>"
            + "<div style='padding:32px 36px;text-align:center;'>"
            + "<p style='margin:0 0 24px;color:#374151;font-size:15px;'>Click the button below to verify your email and activate your account.</p>"
            + "<a href='" + escapeHtml(verificationUrl) + "' style='display:inline-block;background:#E76F51;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:10px;font-size:15px;font-weight:600;'>Verify Email</a>"
            + "<p style='margin:24px 0 0;color:#6b7280;font-size:12px;'>If you didn't create an account, you can safely ignore this email.</p>"
            + "</div>"
            + "</div>"
            + "</div>";
        send(toEmail, "Verify your CraveIt account", html);
    }

    public void sendRaw(String toEmail, String subject, String html) {
        if (apiKey == null || apiKey.isBlank()) {
            log.warn("RESEND_API_KEY not configured — skipping email");
            return;
        }
        send(toEmail, subject, html);
    }

    public void sendOrderConfirmation(String toEmail, OrderDTO order, String storeName, String logoUrl, String primaryColor) {
        log.info("Sending order confirmation to {} (apiKey set={})", toEmail, apiKey != null && !apiKey.isBlank());
        if (apiKey == null || apiKey.isBlank()) {
            log.warn("RESEND_API_KEY not configured — skipping order confirmation email");
            return;
        }
        String subject = "Order Confirmed 🎉 — " + storeName;
        String html = buildConfirmationHtml(order, storeName, logoUrl, primaryColor);
        send(toEmail, subject, html);
    }

    public void sendDeliveryOtp(String toEmail, String otp, String storeName, String orderId, String logoUrl, String primaryColor) {
        if (apiKey == null || apiKey.isBlank()) {
            log.warn("RESEND_API_KEY not configured — skipping OTP email");
            return;
        }
        String subject = "Your delivery OTP — " + storeName;
        String html = "<div style='font-family:Inter,Helvetica,Arial,sans-serif;background:#f9fafb;padding:40px 0;'>"
            + "<div style='max-width:480px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);'>"
            + emailHeader(storeName, logoUrl, primaryColor, "Delivery Verification Code")
            + "<div style='padding:32px 36px;text-align:center;'>"
            + "<p style='margin:0 0 24px;color:#374151;font-size:15px;'>Your driver has arrived! Share this code to confirm delivery:</p>"
            + "<div style='background:#f3f4f6;border-radius:12px;padding:24px;margin-bottom:24px;'>"
            + "<p style='margin:0;font-size:42px;font-weight:800;letter-spacing:12px;color:#111827;font-family:monospace;'>" + otp + "</p>"
            + "</div>"
            + "<p style='margin:0;color:#6b7280;font-size:13px;'>This code expires in 15 minutes. Order ID: <span style='font-family:monospace;'>" + escapeHtml(orderId) + "</span></p>"
            + "</div>"
            + "<div style='background:#f9fafb;padding:16px 36px;text-align:center;border-top:1px solid #e5e7eb;'>"
            + "<p style='margin:0;color:#9ca3af;font-size:12px;'>Only share this code with your delivery driver.</p>"
            + "</div>"
            + "</div>"
            + "</div>";
        send(toEmail, subject, html);
    }

    public void sendOrderStatusUpdate(String toEmail, String status, String orderId, String storeName, String logoUrl, String primaryColor) {
        if (apiKey == null || apiKey.isBlank()) return;
        String subject;
        String body;
        switch (status) {
            case "Confirmed" -> {
                subject = "Order confirmed ✅ — " + storeName;
                body = "Great news! Your order has been confirmed and will be prepared shortly.";
            }
            case "Preparing" -> {
                subject = "Your order is being prepared 👨‍🍳 — " + storeName;
                body = "Our kitchen is now preparing your order. It won't be long!";
            }
            case "Out for Delivery" -> {
                subject = "Order on its way 🛴 — " + storeName;
                body = "Your order has been picked up and is on its way to you!";
            }
            case "Cancelled" -> {
                subject = "Order cancelled — " + storeName;
                body = "Your order has been cancelled. If you have any questions, please contact the store.";
            }
            case "Rejected" -> {
                subject = "Order rejected — " + storeName;
                body = "Unfortunately your order could not be accepted. Please try again or contact the store.";
            }
            default -> { return; }
        }
        String html = "<div style='font-family:Inter,Helvetica,Arial,sans-serif;background:#f9fafb;padding:40px 0;'>"
            + "<div style='max-width:480px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);'>"
            + emailHeader(storeName, logoUrl, primaryColor, "Order Update")
            + "<div style='padding:32px 36px;'>"
            + "<p style='margin:0 0 20px;color:#374151;font-size:15px;line-height:1.6;'>" + escapeHtml(body) + "</p>"
            + "<div style='background:#f3f4f6;border-radius:10px;padding:16px 20px;'>"
            + "<p style='margin:0 0 4px;color:#6b7280;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;'>Order ID</p>"
            + "<p style='margin:0;color:#111827;font-size:13px;font-family:monospace;'>" + escapeHtml(orderId) + "</p>"
            + "</div>"
            + "</div>"
            + "<div style='background:#f9fafb;padding:16px 36px;text-align:center;border-top:1px solid #e5e7eb;'>"
            + "<p style='margin:0;color:#9ca3af;font-size:12px;'>This is an automated message from " + escapeHtml(storeName) + ".</p>"
            + "</div>"
            + "</div>"
            + "</div>";
        send(toEmail, subject, html);
    }

    public void sendOrderDelivered(String toEmail, OrderDTO order, String storeName, String logoUrl, String primaryColor) {
        if (apiKey == null || apiKey.isBlank()) {
            log.warn("RESEND_API_KEY not configured — skipping order delivered email");
            return;
        }
        String subject = "Your order has been delivered 📦 — " + storeName;
        String html = buildDeliveredHtml(order, storeName, logoUrl, primaryColor);
        send(toEmail, subject, html);
    }

    @Async
    public void sendPromotionalEmail(String toEmail, String storeName, String logoUrl, String primaryColor,
                                     String promoTitle, String description, String badgeText, String code, String ctaUrl) {
        if (apiKey == null || apiKey.isBlank()) {
            log.warn("RESEND_API_KEY not configured — skipping promotional email");
            return;
        }
        String accentColor = (primaryColor != null && !primaryColor.isBlank()) ? primaryColor : "#E76F51";
        String badgeBlock = (badgeText != null && !badgeText.isBlank())
                ? "<span style='display:inline-block;background:" + escapeHtml(accentColor) + ";color:#ffffff;font-size:11px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;padding:4px 10px;border-radius:6px;margin-bottom:12px;'>" + escapeHtml(badgeText) + "</span><br/>"
                : "";
        String codeBlock = (code != null && !code.isBlank())
                ? "<div style='background:#f3f4f6;border:2px dashed #d1d5db;border-radius:10px;padding:16px 20px;margin:20px 0;text-align:center;'>"
                + "<p style='margin:0 0 4px;color:#6b7280;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;'>Use code</p>"
                + "<p style='margin:0;font-size:22px;font-weight:800;letter-spacing:4px;color:#111827;font-family:monospace;'>" + escapeHtml(code) + "</p>"
                + "</div>"
                : "";
        String ctaBlock = (ctaUrl != null && !ctaUrl.isBlank())
                ? "<a href='" + escapeHtml(ctaUrl) + "' style='display:inline-block;background:" + escapeHtml(accentColor) + ";color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:10px;font-size:15px;font-weight:600;margin-top:8px;'>Order Now</a>"
                : "";
        String html = "<div style='font-family:Inter,Helvetica,Arial,sans-serif;background:#f9fafb;padding:40px 0;'>"
            + "<div style='max-width:480px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);'>"
            + emailHeader(storeName, logoUrl, primaryColor, "Special Offer")
            + "<div style='padding:32px 36px;text-align:center;'>"
            + badgeBlock
            + "<h2 style='margin:0 0 12px;color:#111827;font-size:20px;font-weight:700;'>" + escapeHtml(promoTitle) + "</h2>"
            + (description != null && !description.isBlank()
                    ? "<p style='margin:0 0 8px;color:#374151;font-size:15px;line-height:1.6;'>" + escapeHtml(description) + "</p>"
                    : "")
            + codeBlock
            + ctaBlock
            + "</div>"
            + "<div style='background:#f9fafb;padding:16px 36px;text-align:center;border-top:1px solid #e5e7eb;'>"
            + "<p style='margin:0;color:#9ca3af;font-size:12px;'>You're receiving this because you opted in to promotional emails from " + escapeHtml(storeName) + ".</p>"
            + "</div>"
            + "</div>"
            + "</div>";
        send(toEmail, "Special offer from " + storeName + " — " + promoTitle, html);
    }

    public void sendDocumentsReceivedEmail(String storeName, String toEmail) {
        if (apiKey == null || apiKey.isBlank()) {
            log.warn("RESEND_API_KEY not configured — skipping documents received email");
            return;
        }
        String html = String.format("""
            <div style='font-family:Inter,Helvetica,Arial,sans-serif;background:#f9fafb;padding:40px 0;'>
              <div style='max-width:480px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);'>
                <div style='background:#111827;padding:28px 36px;text-align:center;'>
                  <h1 style='margin:0;color:#ffffff;font-size:20px;font-weight:700;'>CraveIt</h1>
                  <p style='margin:8px 0 0;color:#9ca3af;font-size:13px;'>Store Application Received</p>
                </div>
                <div style='padding:32px 36px;'>
                  <p style='margin:0 0 16px;color:#374151;font-size:15px;'>Hi <strong>%s</strong>,</p>
                  <p style='margin:0 0 16px;color:#374151;font-size:15px;line-height:1.6;'>We've received your store application and documents. Our team will review your submission within <strong>1–2 business days</strong>.</p>
                  <p style='margin:0 0 24px;color:#374151;font-size:15px;line-height:1.6;'>We'll send you an email as soon as a decision has been made.</p>
                  <div style='background:#fef3c7;border-radius:10px;padding:16px 20px;border-left:4px solid #f59e0b;'>
                    <p style='margin:0;color:#92400e;font-size:13px;line-height:1.5;'>Your store will remain inactive until your application is approved.</p>
                  </div>
                </div>
                <div style='background:#f9fafb;padding:16px 36px;text-align:center;border-top:1px solid #e5e7eb;'>
                  <p style='margin:0;color:#9ca3af;font-size:12px;'>CraveIt Platform &mdash; noreply@crave-it.co.za</p>
                </div>
              </div>
            </div>
            """, escapeHtml(storeName));
        send(toEmail, "We've received your application — CraveIt", html);
    }

    public void sendStoreApprovedEmail(String storeName, String toEmail, String dashboardUrl) {
        if (apiKey == null || apiKey.isBlank()) {
            log.warn("RESEND_API_KEY not configured — skipping store approved email");
            return;
        }
        String html = String.format("""
            <div style='font-family:Inter,Helvetica,Arial,sans-serif;background:#f9fafb;padding:40px 0;'>
              <div style='max-width:480px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);'>
                <div style='background:#111827;padding:28px 36px;text-align:center;'>
                  <h1 style='margin:0;color:#ffffff;font-size:20px;font-weight:700;'>CraveIt</h1>
                  <p style='margin:8px 0 0;color:#9ca3af;font-size:13px;'>Store Approved 🎉</p>
                </div>
                <div style='padding:32px 36px;'>
                  <p style='margin:0 0 16px;color:#374151;font-size:15px;'>Hi <strong>%s</strong>,</p>
                  <p style='margin:0 0 16px;color:#374151;font-size:15px;line-height:1.6;'>Congratulations! Your store application has been <strong style='color:#10b981;'>approved</strong>. You can now log in and start accepting orders from customers.</p>
                  <a href='%s' style='display:inline-block;background:#E76F51;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:10px;font-size:15px;font-weight:600;margin-bottom:24px;'>Go to Dashboard</a>
                  <p style='margin:0;color:#6b7280;font-size:13px;line-height:1.5;'>Complete your store setup — add your menu, set your hours, and open your store when you're ready.</p>
                </div>
                <div style='background:#f9fafb;padding:16px 36px;text-align:center;border-top:1px solid #e5e7eb;'>
                  <p style='margin:0;color:#9ca3af;font-size:12px;'>CraveIt Platform &mdash; noreply@crave-it.co.za</p>
                </div>
              </div>
            </div>
            """, escapeHtml(storeName), escapeHtml(dashboardUrl));
        send(toEmail, "Your store is approved — Welcome to CraveIt!", html);
    }

    public void sendStoreRejectedEmail(String storeName, String toEmail, String reason, String resubmitUrl) {
        if (apiKey == null || apiKey.isBlank()) {
            log.warn("RESEND_API_KEY not configured — skipping store rejected email");
            return;
        }
        String reasonBlock = (reason != null && !reason.isBlank())
                ? String.format("<div style='background:#fef2f2;border-radius:10px;padding:16px 20px;border-left:4px solid #ef4444;margin-bottom:20px;'>"
                        + "<p style='margin:0 0 4px;color:#7f1d1d;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;'>Reason</p>"
                        + "<p style='margin:0;color:#991b1b;font-size:14px;line-height:1.5;'>%s</p>"
                        + "</div>", escapeHtml(reason))
                : "";
        String html = String.format("""
            <div style='font-family:Inter,Helvetica,Arial,sans-serif;background:#f9fafb;padding:40px 0;'>
              <div style='max-width:480px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);'>
                <div style='background:#111827;padding:28px 36px;text-align:center;'>
                  <h1 style='margin:0;color:#ffffff;font-size:20px;font-weight:700;'>CraveIt</h1>
                  <p style='margin:8px 0 0;color:#9ca3af;font-size:13px;'>Application Update</p>
                </div>
                <div style='padding:32px 36px;'>
                  <p style='margin:0 0 16px;color:#374151;font-size:15px;'>Hi <strong>%s</strong>,</p>
                  <p style='margin:0 0 20px;color:#374151;font-size:15px;line-height:1.6;'>Unfortunately, your store application was not approved at this time. Please review the feedback below, update your documents, and resubmit.</p>
                  %s
                  <a href='%s' style='display:inline-block;background:#E76F51;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:10px;font-size:15px;font-weight:600;'>Update & Resubmit</a>
                </div>
                <div style='background:#f9fafb;padding:16px 36px;text-align:center;border-top:1px solid #e5e7eb;'>
                  <p style='margin:0;color:#9ca3af;font-size:12px;'>CraveIt Platform &mdash; noreply@crave-it.co.za</p>
                </div>
              </div>
            </div>
            """, escapeHtml(storeName), reasonBlock, escapeHtml(resubmitUrl));
        send(toEmail, "Action required on your CraveIt application", html);
    }

    private String emailHeader(String storeName, String logoUrl, String primaryColor, String subtitle) {
        String bg = (primaryColor != null && !primaryColor.isBlank()) ? primaryColor : "#111827";
        String logoOrName = (logoUrl != null && !logoUrl.isBlank())
                ? "<img src='" + escapeHtml(logoUrl) + "' alt='" + escapeHtml(storeName) + "' style='max-height:48px;max-width:180px;margin-bottom:8px;'/><br/>"
                : "<h1 style='margin:0 0 8px;color:#ffffff;font-size:22px;font-weight:700;'>" + escapeHtml(storeName) + "</h1>";
        String subtitleHtml = (subtitle != null && !subtitle.isBlank())
                ? "<p style='margin:0;color:rgba(255,255,255,0.75);font-size:13px;'>" + escapeHtml(subtitle) + "</p>"
                : "";
        return "<div style='background:" + escapeHtml(bg) + ";padding:32px 36px;text-align:center;'>"
                + logoOrName
                + subtitleHtml
                + "</div>";
    }

    private void send(String to, String subject, String html) {
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.setBearerAuth(apiKey);

            Map<String, Object> body = Map.of(
                    "from", fromAddress,
                    "to", new String[]{to},
                    "subject", subject,
                    "html", html
            );

            HttpEntity<Map<String, Object>> request = new HttpEntity<>(body, headers);
            ResponseEntity<String> response = restTemplate.postForEntity(
                    "https://api.resend.com/emails", request, String.class);

            if (response.getStatusCode().is2xxSuccessful()) {
                log.info("Email sent to {} — subject: {}", to, subject);
            } else {
                log.error("Resend returned {}: {}", response.getStatusCode(), response.getBody());
            }
        } catch (Exception e) {
            log.error("Failed to send email to {}: {}", to, e.getMessage());
        }
    }

    private String buildConfirmationHtml(OrderDTO order, String storeName, String logoUrl, String primaryColor) {
        StringBuilder items = new StringBuilder();
        for (OrderItemDTO item : order.getItems()) {
            items.append(String.format(
                    "<tr>" +
                    "<td style='padding:8px 0;color:#374151;font-size:14px;'>%s <span style='color:#9ca3af;font-size:12px;'>x%d (%s)</span></td>" +
                    "<td style='padding:8px 0;color:#374151;font-size:14px;text-align:right;font-weight:600;'>R%.2f</td>" +
                    "</tr>",
                    escapeHtml(item.getName()), item.getQuantity(),
                    item.getSize() != null ? item.getSize() : "—",
                    item.getPrice()));
        }

        String discountRow = "";
        if (order.getDiscountAmount() != null && order.getDiscountAmount() > 0) {
            discountRow = String.format(
                    "<tr><td style='padding:4px 0;color:#10b981;font-size:13px;'>Discount</td>" +
                    "<td style='padding:4px 0;color:#10b981;font-size:13px;text-align:right;'>-R%.2f</td></tr>",
                    order.getDiscountAmount());
        }

        return "<div style='font-family:Inter,Helvetica,Arial,sans-serif;background:#f9fafb;padding:40px 0;'>"
            + "<div style='max-width:520px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);'>"
            + emailHeader(storeName, logoUrl, primaryColor, "Order Confirmation")
            + "<div style='padding:32px 36px;'>"
            + "<p style='margin:0 0 24px;color:#374151;font-size:15px;'>Thanks for your order! We've received it and it's being prepared. 🎉</p>"
            + "<div style='background:#f3f4f6;border-radius:10px;padding:16px 20px;margin-bottom:24px;'>"
            + "<p style='margin:0 0 4px;color:#6b7280;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;'>Order ID</p>"
            + "<p style='margin:0;color:#111827;font-size:13px;font-family:monospace;'>" + order.getId() + "</p>"
            + "</div>"
            + "<table style='width:100%;border-collapse:collapse;'>"
            + "<thead><tr style='border-bottom:1px solid #e5e7eb;'>"
            + "<th style='padding-bottom:8px;text-align:left;color:#6b7280;font-size:12px;font-weight:600;text-transform:uppercase;'>Item</th>"
            + "<th style='padding-bottom:8px;text-align:right;color:#6b7280;font-size:12px;font-weight:600;text-transform:uppercase;'>Price</th>"
            + "</tr></thead>"
            + "<tbody>" + items + "</tbody>"
            + "<tfoot><tr style='border-top:1px solid #e5e7eb;'><td colspan='2' style='padding-top:8px;'></td></tr>"
            + discountRow
            + "<tr><td style='padding:6px 0;color:#111827;font-size:15px;font-weight:700;'>Total</td>"
            + String.format("<td style='padding:6px 0;color:#111827;font-size:15px;font-weight:700;text-align:right;'>R%.2f</td>", order.getTotalAmount())
            + "</tr></tfoot></table>"
            + "<div style='margin-top:24px;border-top:1px solid #e5e7eb;padding-top:20px;'>"
            + "<p style='margin:0 0 4px;color:#6b7280;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;'>Delivery Address</p>"
            + "<p style='margin:0;color:#374151;font-size:14px;'>" + escapeHtml(order.getDeliveryAddress() != null ? order.getDeliveryAddress() : "—") + "</p>"
            + "</div>"
            + "</div>"
            + "<div style='background:#f9fafb;padding:20px 36px;text-align:center;border-top:1px solid #e5e7eb;'>"
            + "<p style='margin:0;color:#9ca3af;font-size:12px;'>You'll receive another email when your order is delivered.</p>"
            + "</div>"
            + "</div>"
            + "</div>";
    }

    private String buildDeliveredHtml(OrderDTO order, String storeName, String logoUrl, String primaryColor) {
        String accentColor = (primaryColor != null && !primaryColor.isBlank()) ? primaryColor : "#059669";
        return "<div style='font-family:Inter,Helvetica,Arial,sans-serif;background:#f9fafb;padding:40px 0;'>"
            + "<div style='max-width:520px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);'>"
            + "<div style='background:" + escapeHtml(accentColor) + ";padding:32px 36px;text-align:center;'>"
            + "<div style='font-size:40px;margin-bottom:12px;'>📦</div>"
            + "<h1 style='margin:0;color:#ffffff;font-size:22px;font-weight:700;'>Order Delivered!</h1>"
            + "<p style='margin:8px 0 0;color:rgba(255,255,255,0.8);font-size:13px;'>" + escapeHtml(storeName) + "</p>"
            + "</div>"
            + "<div style='padding:32px 36px;text-align:center;'>"
            + "<p style='margin:0 0 20px;color:#374151;font-size:15px;line-height:1.6;'>Your order has been successfully delivered. We hope you enjoy your meal! 🍽️</p>"
            + "<div style='background:#f3f4f6;border-radius:10px;padding:16px 20px;margin-bottom:24px;text-align:left;'>"
            + "<p style='margin:0 0 4px;color:#6b7280;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;'>Order ID</p>"
            + "<p style='margin:0 0 12px;color:#111827;font-size:13px;font-family:monospace;'>" + order.getId() + "</p>"
            + "<p style='margin:0 0 4px;color:#6b7280;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;'>Total Paid</p>"
            + String.format("<p style='margin:0;color:#111827;font-size:18px;font-weight:700;'>R%.2f</p>", order.getTotalAmount())
            + "</div>"
            + "<p style='margin:0;color:#6b7280;font-size:13px;'>Thank you for ordering with " + escapeHtml(storeName) + ". See you next time!</p>"
            + "</div>"
            + "<div style='background:#f9fafb;padding:20px 36px;text-align:center;border-top:1px solid #e5e7eb;'>"
            + "<p style='margin:0;color:#9ca3af;font-size:12px;'>This is an automated message. Please do not reply.</p>"
            + "</div>"
            + "</div>"
            + "</div>";
    }

    private String escapeHtml(String input) {
        if (input == null) return "";
        return input.replace("&", "&amp;")
                    .replace("<", "&lt;")
                    .replace(">", "&gt;")
                    .replace("\"", "&quot;");
    }
}
