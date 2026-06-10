package com.example.backend.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.*;

@Service
public class PayFastService {

    @Value("${payfast.merchant-id}")
    private String merchantId;

    @Value("${payfast.merchant-key}")
    private String merchantKey;

    @Value("${payfast.passphrase:}")
    private String passphrase;

    @Value("${payfast.sandbox:true}")
    private boolean sandbox;

    public String getProcessUrl() {
        return sandbox
                ? "https://sandbox.payfast.co.za/eng/process"
                : "https://www.payfast.co.za/eng/process";
    }

    /**
     * Build the form data map that the frontend will POST to PayFast.
     */
    public Map<String, String> buildPaymentData(
            double amount,
            String itemName,
            String returnUrl,
            String cancelUrl,
            String notifyUrl,
            String paymentId
    ) {
        Map<String, String> data = new LinkedHashMap<>();
        data.put("merchant_id", merchantId);
        data.put("merchant_key", merchantKey);
        data.put("return_url", returnUrl);
        data.put("cancel_url", cancelUrl);
        data.put("notify_url", notifyUrl);
        data.put("m_payment_id", paymentId);
        data.put("amount", String.format("%.2f", amount));
        data.put("item_name", itemName);

        String signature = generateSignature(data);
        data.put("signature", signature);

        return data;
    }

    /**
     * Generate MD5 signature from the data map.
     * PayFast requires parameters in the order they appear, URL-encoded, joined with &.
     * Empty values are excluded. Passphrase is appended last if set.
     */
    public String generateSignature(Map<String, String> data) {
        StringBuilder sb = new StringBuilder();
        for (Map.Entry<String, String> entry : data.entrySet()) {
            if (entry.getValue() == null || entry.getValue().isEmpty()) continue;
            if ("signature".equals(entry.getKey())) continue;
            if (sb.length() > 0) sb.append("&");
            sb.append(entry.getKey())
              .append("=")
              .append(urlEncode(entry.getValue().trim()));
        }
        if (passphrase != null && !passphrase.isEmpty()) {
            sb.append("&passphrase=").append(urlEncode(passphrase.trim()));
        }
        return md5(sb.toString());
    }

    /**
     * Verify an ITN (Instant Transaction Notification) using the RAW posted body pairs.
     * PayFast signs the parameter string built from the values EXACTLY as it posted them (already
     * url-encoded), in the order received, excluding the signature, with the passphrase appended.
     * Rebuilding that string from a DECODED @RequestParam map and re-encoding it does NOT reproduce
     * the same bytes (url-encoding, ordering, and empty-field differences), so it failed every ITN
     * with HTTP 400 — leaving paid orders unconfirmed and auto-cancelled. So we verify against the
     * raw pairs exactly as received.
     *
     * @param orderedRawPairs the body split on '&', each element a raw "key=value" as PayFast sent it
     */
    public boolean verifyItnSignature(List<String> orderedRawPairs) {
        String received = null;
        StringBuilder sb = new StringBuilder();
        for (String pair : orderedRawPairs) {
            if (pair.startsWith("signature=")) {
                received = pair.substring("signature=".length());
                continue;
            }
            if (sb.length() > 0) sb.append("&");
            sb.append(pair);   // raw, byte-for-byte as PayFast concatenated it
        }
        if (received == null || received.isEmpty()) return false;
        if (passphrase != null && !passphrase.isEmpty()) {
            sb.append("&passphrase=").append(urlEncode(passphrase.trim()));
        }
        return md5(sb.toString()).equalsIgnoreCase(received);
    }

    private String urlEncode(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8);
    }

    private String md5(String input) {
        try {
            MessageDigest md = MessageDigest.getInstance("MD5");
            byte[] digest = md.digest(input.getBytes(StandardCharsets.UTF_8));
            StringBuilder hex = new StringBuilder();
            for (byte b : digest) {
                hex.append(String.format("%02x", b));
            }
            return hex.toString();
        } catch (Exception e) {
            throw new RuntimeException("MD5 hashing failed", e);
        }
    }
}
