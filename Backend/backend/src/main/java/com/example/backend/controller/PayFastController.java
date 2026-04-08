package com.example.backend.controller;

import com.example.backend.service.PayFastService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/payfast")
@CrossOrigin(origins = "*")
public class PayFastController {

    private final PayFastService payFastService;

    @Value("${app.frontend-url:http://localhost:4200}")
    private String frontendUrl;

    @Value("${app.backend-url:http://localhost:8080}")
    private String backendUrl;

    public PayFastController(PayFastService payFastService) {
        this.payFastService = payFastService;
    }

    /**
     * Generate PayFast payment form data. The frontend will use this
     * to build and auto-submit a form POST to PayFast.
     */
    @PostMapping("/initiate")
    public ResponseEntity<Map<String, Object>> initiatePayment(@RequestBody Map<String, String> request,
                                                                @RequestHeader(value = "X-Store-Slug", required = false) String storeSlug) {
        double total = Double.parseDouble(request.getOrDefault("total", "0"));
        String itemName = request.getOrDefault("itemName", "Food Order");
        String paymentId = request.getOrDefault("paymentId", "order-" + System.currentTimeMillis());

        // Build return/cancel/notify URLs
        String basePath = (storeSlug != null && !storeSlug.isEmpty())
                ? frontendUrl + "/store/" + storeSlug
                : frontendUrl;

        String returnUrl = basePath + "/thank-you?pf_payment_id=" + paymentId;
        String cancelUrl = basePath + "/checkout?payment=cancelled";
        String notifyUrl = backendUrl + "/api/payfast/notify";

        Map<String, String> formData = payFastService.buildPaymentData(
                total, itemName, returnUrl, cancelUrl, notifyUrl, paymentId
        );

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("processUrl", payFastService.getProcessUrl());
        response.put("formData", formData);

        return ResponseEntity.ok(response);
    }

    /**
     * ITN (Instant Transaction Notification) callback from PayFast.
     * PayFast POSTs payment confirmation here (server-to-server).
     */
    @PostMapping("/notify")
    public ResponseEntity<String> handleItn(@RequestParam Map<String, String> data) {
        // Verify the signature
        if (!payFastService.verifyItnSignature(data)) {
            System.err.println("PayFast ITN: Invalid signature");
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
            // Payment confirmed — order was already placed optimistically on the frontend
            // The m_payment_id can be used to look up and confirm the order if needed
        }

        return ResponseEntity.ok("OK");
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
