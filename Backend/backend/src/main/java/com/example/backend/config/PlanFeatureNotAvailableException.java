package com.example.backend.config;

public class PlanFeatureNotAvailableException extends RuntimeException {
    public PlanFeatureNotAvailableException(String message) {
        super(message);
    }
}
