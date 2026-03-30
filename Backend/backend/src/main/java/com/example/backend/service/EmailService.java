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

    @Value("${resend.from:orders@resend.dev}")
    private String fromAddress;

    private final RestTemplate restTemplate;

    public void sendRaw(String toEmail, String subject, String html) {
        if (apiKey == null || apiKey.isBlank()) {
            log.warn("RESEND_API_KEY not configured — skipping email");
            return;
        }
        send(toEmail, subject, html);
    }

    public void sendOrderConfirmation(String toEmail, OrderDTO order, String storeName) {
        log.info("Sending order confirmation to {} (apiKey set={})", toEmail, apiKey != null && !apiKey.isBlank());
        if (apiKey == null || apiKey.isBlank()) {
            log.warn("RESEND_API_KEY not configured — skipping order confirmation email");
            return;
        }
        String subject = "Order Confirmed \uD83C\uDF89 — " + storeName;
        String html = buildConfirmationHtml(order, storeName);
        send(toEmail, subject, html);
    }

    public void sendOrderDelivered(String toEmail, OrderDTO order, String storeName) {
        if (apiKey == null || apiKey.isBlank()) {
            log.warn("RESEND_API_KEY not configured — skipping order delivered email");
            return;
        }
        String subject = "Your order has been delivered \uD83D\uDCE6 — " + storeName;
        String html = buildDeliveredHtml(order, storeName);
        send(toEmail, subject, html);
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

    private String buildConfirmationHtml(OrderDTO order, String storeName) {
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

        return String.format("""
            <div style='font-family:Inter,Helvetica,Arial,sans-serif;background:#f9fafb;padding:40px 0;'>
              <div style='max-width:520px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);'>
                <!-- Header -->
                <div style='background:#111827;padding:32px 36px;text-align:center;'>
                  <h1 style='margin:0;color:#ffffff;font-size:22px;font-weight:700;'>%s</h1>
                  <p style='margin:8px 0 0;color:#9ca3af;font-size:13px;'>Order Confirmation</p>
                </div>
                <!-- Body -->
                <div style='padding:32px 36px;'>
                  <p style='margin:0 0 24px;color:#374151;font-size:15px;'>
                    Thanks for your order! We've received it and it's being prepared. 🎉
                  </p>
                  <!-- Order meta -->
                  <div style='background:#f3f4f6;border-radius:10px;padding:16px 20px;margin-bottom:24px;'>
                    <p style='margin:0 0 4px;color:#6b7280;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;'>Order ID</p>
                    <p style='margin:0;color:#111827;font-size:13px;font-family:monospace;'>%s</p>
                  </div>
                  <!-- Items -->
                  <table style='width:100%%;border-collapse:collapse;'>
                    <thead>
                      <tr style='border-bottom:1px solid #e5e7eb;'>
                        <th style='padding-bottom:8px;text-align:left;color:#6b7280;font-size:12px;font-weight:600;text-transform:uppercase;'>Item</th>
                        <th style='padding-bottom:8px;text-align:right;color:#6b7280;font-size:12px;font-weight:600;text-transform:uppercase;'>Price</th>
                      </tr>
                    </thead>
                    <tbody>%s</tbody>
                    <tfoot>
                      <tr style='border-top:1px solid #e5e7eb;'>
                        <td colspan='2' style='padding-top:8px;'></td>
                      </tr>
                      %s
                      <tr>
                        <td style='padding:6px 0;color:#111827;font-size:15px;font-weight:700;'>Total</td>
                        <td style='padding:6px 0;color:#111827;font-size:15px;font-weight:700;text-align:right;'>R%.2f</td>
                      </tr>
                    </tfoot>
                  </table>
                  <!-- Delivery -->
                  <div style='margin-top:24px;border-top:1px solid #e5e7eb;padding-top:20px;'>
                    <p style='margin:0 0 4px;color:#6b7280;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;'>Delivery Address</p>
                    <p style='margin:0;color:#374151;font-size:14px;'>%s</p>
                  </div>
                </div>
                <!-- Footer -->
                <div style='background:#f9fafb;padding:20px 36px;text-align:center;border-top:1px solid #e5e7eb;'>
                  <p style='margin:0;color:#9ca3af;font-size:12px;'>You'll receive another email when your order is delivered.</p>
                </div>
              </div>
            </div>
            """,
                escapeHtml(storeName),
                order.getId(),
                items,
                discountRow,
                order.getTotalAmount(),
                escapeHtml(order.getDeliveryAddress() != null ? order.getDeliveryAddress() : "—")
        );
    }

    private String buildDeliveredHtml(OrderDTO order, String storeName) {
        return String.format("""
            <div style='font-family:Inter,Helvetica,Arial,sans-serif;background:#f9fafb;padding:40px 0;'>
              <div style='max-width:520px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);'>
                <!-- Header -->
                <div style='background:#059669;padding:32px 36px;text-align:center;'>
                  <div style='font-size:40px;margin-bottom:12px;'>📦</div>
                  <h1 style='margin:0;color:#ffffff;font-size:22px;font-weight:700;'>Order Delivered!</h1>
                  <p style='margin:8px 0 0;color:#a7f3d0;font-size:13px;'>%s</p>
                </div>
                <!-- Body -->
                <div style='padding:32px 36px;text-align:center;'>
                  <p style='margin:0 0 20px;color:#374151;font-size:15px;line-height:1.6;'>
                    Your order has been successfully delivered. We hope you enjoy your meal! 🍽️
                  </p>
                  <div style='background:#f3f4f6;border-radius:10px;padding:16px 20px;margin-bottom:24px;text-align:left;'>
                    <p style='margin:0 0 4px;color:#6b7280;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;'>Order ID</p>
                    <p style='margin:0 0 12px;color:#111827;font-size:13px;font-family:monospace;'>%s</p>
                    <p style='margin:0 0 4px;color:#6b7280;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;'>Total Paid</p>
                    <p style='margin:0;color:#111827;font-size:18px;font-weight:700;'>R%.2f</p>
                  </div>
                  <p style='margin:0;color:#6b7280;font-size:13px;'>Thank you for ordering with %s. See you next time!</p>
                </div>
                <!-- Footer -->
                <div style='background:#f9fafb;padding:20px 36px;text-align:center;border-top:1px solid #e5e7eb;'>
                  <p style='margin:0;color:#9ca3af;font-size:12px;'>This is an automated message. Please do not reply.</p>
                </div>
              </div>
            </div>
            """,
                escapeHtml(storeName),
                order.getId(),
                order.getTotalAmount(),
                escapeHtml(storeName)
        );
    }

    private String escapeHtml(String input) {
        if (input == null) return "";
        return input.replace("&", "&amp;")
                    .replace("<", "&lt;")
                    .replace(">", "&gt;")
                    .replace("\"", "&quot;");
    }
}
