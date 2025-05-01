package com.example.backend.controller;


import com.example.backend.service.PayPalService;
import com.paypal.api.payments.Payment;
import com.paypal.base.rest.PayPalRESTException;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/paypal")
@CrossOrigin(origins = "*")
public class PayPalController {

    @Autowired
    private PayPalService payPalService;

    private static final String SUCCESS_URL = "http://localhost:4200/success";
    private static final String CANCEL_URL = "http://localhost:4200/cancel";

    // ✅ Create a payment
    @PostMapping("/pay")
    public Map<String, String> createPayment(@RequestBody Map<String, String> request) {
        try {
            Payment payment = payPalService.createPayment(
                    Double.valueOf(request.get("total")),
                    "USD",
                    "paypal",
                    "sale",
                    "Food Order Payment",
                    CANCEL_URL,
                    SUCCESS_URL
            );

            for (com.paypal.api.payments.Links link : payment.getLinks()) {
                if (link.getRel().equals("approval_url")) {
                    return Map.of("redirectUrl", link.getHref());
                }
            }
        } catch (PayPalRESTException e) {
            e.printStackTrace();
        }
        return Map.of("error", "Failed to create PayPal payment.");
    }

    // ✅ Execute the payment
    @GetMapping("/success")
    public String executePayment(@RequestParam("paymentId") String paymentId, @RequestParam("PayerID") String payerId) {
        try {
            Payment payment = payPalService.executePayment(paymentId, payerId);
            if (payment.getState().equals("approved")) {
                return "Payment success!";
            }
        } catch (PayPalRESTException e) {
            e.printStackTrace();
        }
        return "Payment failed.";
    }
}
