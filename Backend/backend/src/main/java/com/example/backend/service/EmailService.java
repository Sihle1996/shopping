package com.example.backend.service;

import com.example.backend.entity.Order;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.env.Environment;
import org.springframework.lang.NonNull;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;
import org.thymeleaf.TemplateEngine;
import org.thymeleaf.context.Context;

import jakarta.mail.internet.MimeMessage;
import java.time.LocalDate;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Slf4j
public class EmailService {

  private final JavaMailSender mailSender;
  private final Environment env;
  private final TemplateEngine templateEngine;

  public void sendOrderPlaced(@NonNull String to, @NonNull Order order) {
    String subject = "Your order #" + order.getId() + " is confirmed";
    String html = render("email/order-placed", Map.of(
            "orderId", order.getId(),
            "orderDate", order.getOrderDate(),
            "items", order.getOrderItems(),
            "total", order.getTotalAmount(),
            "orderLink", "http://localhost:4200/orders/" + order.getId(),
            "year", LocalDate.now().getYear()
    ));
    sendHtml(to, subject, html);
  }

  public void sendOrderDelivered(@NonNull String to, @NonNull Order order) {
    String subject = "Your order #" + order.getId() + " has been delivered";
    String html = render("email/order-delivered", Map.of(
            "orderId", order.getId(),
            "orderDate", order.getOrderDate(),
            "total", order.getTotalAmount(),
            "orderLink", "http://localhost:4200/orders/" + order.getId(),
            "year", LocalDate.now().getYear()
    ));
    sendHtml(to, subject, html);
  }

  private void sendHtml(String to, String subject, String html) {
    try {
      MimeMessage mime = mailSender.createMimeMessage();
      MimeMessageHelper helper = new MimeMessageHelper(mime, true, "UTF-8");
      String from = env.getProperty("spring.mail.from", env.getProperty("spring.mail.username", "no-reply@local.test"));
      helper.setFrom(from);
      helper.setTo(to);
      helper.setSubject(subject);
      helper.setText(html, true);
      mailSender.send(mime);
      log.info("Email sent to {} subject='{}'", to, subject);
    } catch (Exception e) {
      log.error("Failed to send email to {}: {}", to, e.getMessage());
    }
  }

  private String render(String template, Map<String, Object> variables) {
    Context ctx = new Context();
    if (variables != null) {
      variables.forEach(ctx::setVariable);
    }
    return templateEngine.process(template, ctx);
  }
}
