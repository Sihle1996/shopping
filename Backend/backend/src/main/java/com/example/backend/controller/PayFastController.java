package com.example.backend.controller;

import com.example.backend.entity.Order;
import com.example.backend.repository.OrderRepository;
import com.example.backend.repository.TenantRepository;
import com.example.backend.service.PayFastService;
import com.example.backend.service.PlanCommissionService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.web.bind.annotation.*;

import java.io.BufferedReader;
import java.io.IOException;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/payfast")
@CrossOrigin(origins = "*")
public class PayFastController {

    private final PayFastService payFastService;
    private final TenantRepository tenantRepository;
    private final OrderRepository orderRepository;
    private final PlanCommissionService planCommissionService;
    private final SimpMessagingTemplate messagingTemplate;

    @Value("${app.frontend-url:http://localhost:4200}")
    private String frontendUrl;

    @Value("${app.backend-url:http://localhost:8080}")
    private String backendUrl;

    @Value("${app.cors.allowed-origins:}")
    private String allowedOrigins;

    public PayFastController(PayFastService payFastService, TenantRepository tenantRepository,
                             OrderRepository orderRepository, PlanCommissionService planCommissionService,
                             SimpMessagingTemplate messagingTemplate) {
        this.payFastService = payFastService;
        this.tenantRepository = tenantRepository;
        this.orderRepository = orderRepository;
        this.planCommissionService = planCommissionService;
        this.messagingTemplate = messagingTemplate;
    }

    /**
     * Generate PayFast payment form data. The frontend will use this
     * to build and auto-submit a form POST to PayFast.
     */
    @PostMapping("/initiate")
    public ResponseEntity<Map<String, Object>> initiatePayment(@RequestBody Map<String, String> request,
                                                                @RequestHeader(value = "X-Store-Slug", required = false) String storeSlug,
                                                                @RequestHeader(value = "Origin", required = false) String origin) {
        double total = Double.parseDouble(request.getOrDefault("total", "0"));
        String itemName = request.getOrDefault("itemName", "Food Order");
        String paymentId = request.getOrDefault("paymentId", "order-" + System.currentTimeMillis());

        // Return the customer to the exact domain they checked out from (crave-it.co.za,
        // www, or the Vercel URL) so their session/order context survives the round-trip.
        String base = resolveFrontendBase(origin);

        // Build return/cancel/notify URLs
        String returnUrl, cancelUrl;
        if (paymentId.startsWith("sub-")) {
            // Subscription upgrade — send admin back to their subscription page
            String payload = paymentId.substring(4); // strip "sub-"
            int lastDash = payload.lastIndexOf('-');
            String planName = lastDash >= 0 ? payload.substring(lastDash + 1) : "";
            returnUrl = base + "/admin/subscription?payment=success&plan=" + planName;
            cancelUrl = base + "/admin/subscription?payment=cancelled";
        } else {
            // Food order — send customer to thank-you page
            String basePath = (storeSlug != null && !storeSlug.isEmpty())
                    ? base + "/store/" + storeSlug
                    : base;
            returnUrl = basePath + "/thank-you?pf_payment_id=" + paymentId;
            cancelUrl = basePath + "/checkout?payment=cancelled&orderId=" + paymentId;
        }
        String notifyUrl = backendUrl + "/api/payfast/notify";

        Map<String, String> formData = payFastService.buildPaymentData(
                total, itemName, returnUrl, cancelUrl, notifyUrl, paymentId
        );

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("processUrl", payFastService.getProcessUrl());
        response.put("formData", formData);

        return ResponseEntity.ok(response);
    }

    /** Use the request Origin if it's an allowed front-end domain, else the configured default. */
    private String resolveFrontendBase(String origin) {
        if (origin != null && !origin.isBlank() && allowedOrigins != null) {
            for (String allowed : allowedOrigins.split(",")) {
                if (origin.trim().equalsIgnoreCase(allowed.trim())) {
                    return origin.trim();
                }
            }
        }
        return frontendUrl;
    }

    /**
     * ITN (Instant Transaction Notification) callback from PayFast.
     * PayFast POSTs payment confirmation here (server-to-server).
     */
    @PostMapping("/notify")
    public ResponseEntity<String> handleItn(HttpServletRequest request) {
        // Read the RAW body exactly as PayFast posted it. PayFast signs the values AS SENT (already
        // url-encoded, INCLUDING empty fields, in order). Re-encoding a decoded @RequestParam map
        // dropped the empty fields and produced a different signature, so every ITN returned 400 →
        // paid orders never had their paymentId set and were auto-cancelled.
        String rawBody;
        try (BufferedReader reader = request.getReader()) {
            rawBody = reader.lines().collect(Collectors.joining());
        } catch (IOException e) {
            System.err.println("PayFast ITN: could not read body — " + e.getMessage());
            return ResponseEntity.badRequest().body("Cannot read body");
        }

        List<String> orderedPairs = new ArrayList<>();
        Map<String, String> data = new LinkedHashMap<>();
        for (String pair : rawBody.split("&")) {
            if (pair.isEmpty()) continue;
            orderedPairs.add(pair);
            int eq = pair.indexOf('=');
            String key = eq >= 0 ? pair.substring(0, eq) : pair;
            String val = eq >= 0 ? pair.substring(eq + 1) : "";
            data.put(URLDecoder.decode(key, StandardCharsets.UTF_8),
                     URLDecoder.decode(val, StandardCharsets.UTF_8));
        }

        if (!payFastService.verifyItnSignature(orderedPairs)) {
            System.err.println("PayFast ITN: Invalid signature. Raw body: " + rawBody);
            return ResponseEntity.badRequest().body("Invalid signature");
        }

        String paymentStatus = data.get("payment_status");
        String mPaymentId = data.get("m_payment_id");
        String pfPaymentId = data.get("pf_payment_id");
        String amountGross = data.get("amount_gross");

        System.out.println("PayFast ITN received — m_payment_id=" + mPaymentId
                + " pf_payment_id=" + pfPaymentId
                + " status=" + paymentStatus
                + " amount=" + amountGross);

        if ("COMPLETE".equalsIgnoreCase(paymentStatus)) {
            if (mPaymentId != null && mPaymentId.startsWith("sub-")) {
                activateSubscription(mPaymentId);
            } else if (mPaymentId != null) {
                confirmOrderPayment(mPaymentId, pfPaymentId, amountGross);
            }
        }

        return ResponseEntity.ok("OK");
    }

    /**
     * Activates a store subscription when PayFast confirms payment.
     * m_payment_id format: "sub-{tenantId}-{planName}"
     */
    private void activateSubscription(String mPaymentId) {
        // Strip "sub-" prefix, then split on the last "-" to get tenantId and planName
        String payload = mPaymentId.substring(4); // remove "sub-"
        int lastDash = payload.lastIndexOf('-');
        if (lastDash < 1) {
            System.err.println("PayFast ITN: malformed subscription m_payment_id: " + mPaymentId);
            return;
        }
        String tenantIdStr = payload.substring(0, lastDash);
        String planName = payload.substring(lastDash + 1);
        try {
            UUID tenantId = UUID.fromString(tenantIdStr);
            tenantRepository.findById(tenantId).ifPresentOrElse(tenant -> {
                planCommissionService.applyPlan(tenant, planName);   // sets plan + syncs commission from the table
                tenant.setSubscriptionStatus("ACTIVE");
                tenantRepository.save(tenant);
                System.out.println("PayFast ITN: activated tenant " + tenant.getName() + " on plan " + planName);
            }, () -> System.err.println("PayFast ITN: tenant not found: " + tenantIdStr));
        } catch (IllegalArgumentException e) {
            System.err.println("PayFast ITN: invalid tenantId in m_payment_id: " + mPaymentId);
        }
    }

    private void confirmOrderPayment(String mPaymentId, String pfPaymentId, String amountGross) {
        try {
            UUID orderId = UUID.fromString(mPaymentId);
            orderRepository.findById(orderId).ifPresentOrElse(order -> {
                // Idempotency: already processed
                if (order.getPaymentId() != null && order.getPaymentId().equals(pfPaymentId)) {
                    System.out.println("PayFast ITN: duplicate for order " + orderId + ", skipping");
                    return;
                }
                if ("Pending".equals(order.getStatus()) || "Scheduled".equals(order.getStatus())) {
                    // Validate payment amount matches order total
                    if (amountGross != null) {
                        double paidAmount = Double.parseDouble(amountGross);
                        double expectedTotal = order.getTotalAmount()
                                + (order.getDeliveryFee() != null ? order.getDeliveryFee() : 0.0);
                        if (Math.abs(paidAmount - expectedTotal) > 1.0) {
                            System.err.println("PayFast ITN: amount mismatch for order " + orderId
                                    + " — expected " + expectedTotal + " got " + paidAmount);
                            return;
                        }
                    }
                    order.setPaymentId(pfPaymentId != null ? pfPaymentId : mPaymentId);
                    orderRepository.save(order);

                    // Push a live "paid" event so the admin (and customer) order views flip from
                    // "pending payment" to paid without a manual refresh.
                    Map<String, Object> paidEvent = Map.of(
                            "type", "ORDER_PAID",
                            "orderId", order.getId().toString(),
                            "status", order.getStatus(),
                            "paid", true
                    );
                    messagingTemplate.convertAndSend("/topic/orders", paidEvent);
                    if (order.getUser() != null) {
                        messagingTemplate.convertAndSend("/topic/orders/" + order.getUser().getId(), paidEvent);
                    }

                    System.out.println("PayFast ITN: confirmed payment for order " + orderId
                            + " (pf_payment_id=" + pfPaymentId + ")");
                } else {
                    System.out.println("PayFast ITN: order " + orderId + " already in status " + order.getStatus());
                }
            }, () -> System.err.println("PayFast ITN: order not found: " + mPaymentId));
        } catch (IllegalArgumentException e) {
            System.err.println("PayFast ITN: invalid order ID in m_payment_id: " + mPaymentId);
        }
    }

    /**
     * Return URL — PayFast redirects the user here after successful payment.
     * This is handled by the frontend router, but we provide a fallback.
     */
    @GetMapping("/return")
    public ResponseEntity<String> paymentReturn(@RequestParam Map<String, String> params) {
        return ResponseEntity.ok("Payment successful. Redirecting...");
    }

    /**
     * Cancel URL — PayFast redirects here if the user cancels.
     */
    @GetMapping("/cancel")
    public ResponseEntity<String> paymentCancel() {
        return ResponseEntity.ok("Payment cancelled.");
    }
}
