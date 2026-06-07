package com.example.backend.entity;

import java.util.List;

/**
 * Canonical order lifecycle statuses. The database/API still stores the
 * human label (e.g. "Out for Delivery") for backward compatibility, but code
 * should compare against these enum constants instead of scattering string
 * literals. Use {@link #matches(String)} / {@link #fromLabel(String)} to bridge
 * the stored label and the enum.
 */
public enum OrderStatus {
    PENDING("Pending"),
    CONFIRMED("Confirmed"),
    SCHEDULED("Scheduled"),
    PREPARING("Preparing"),
    OUT_FOR_DELIVERY("Out for Delivery"),
    DELIVERED("Delivered"),
    CANCELLED("Cancelled"),
    REJECTED("Rejected");

    private final String label;

    OrderStatus(String label) { this.label = label; }

    /** The stored/display label as persisted on {@code Order.status}. */
    public String label() { return label; }

    /** Case-insensitive match against a stored status string. */
    public boolean matches(String status) {
        return status != null && label.equalsIgnoreCase(status.trim());
    }

    /** Resolve a stored status string to the enum, or {@code null} if unknown. */
    public static OrderStatus fromLabel(String status) {
        if (status != null) {
            for (OrderStatus s : values()) {
                if (s.matches(status)) return s;
            }
        }
        return null;
    }

    /**
     * The statuses an order in THIS state may move to next — the lifecycle
     * workflow the AI (and UI) reason over. Terminal states return empty.
     */
    public List<OrderStatus> nextStatuses() {
        return switch (this) {
            case PENDING          -> List.of(CONFIRMED, CANCELLED, REJECTED);
            case SCHEDULED        -> List.of(CONFIRMED, CANCELLED);
            case CONFIRMED        -> List.of(PREPARING, CANCELLED);
            case PREPARING        -> List.of(OUT_FOR_DELIVERY, CANCELLED);
            case OUT_FOR_DELIVERY -> List.of(DELIVERED, CANCELLED);
            case DELIVERED, CANCELLED, REJECTED -> List.of();
        };
    }

    /** Whether moving from this status to {@code target} is a valid transition. */
    public boolean canTransitionTo(OrderStatus target) {
        return target != null && nextStatuses().contains(target);
    }

    /** Terminal success — the sale is realised and counts as revenue. */
    public boolean isRealisedRevenue() { return this == DELIVERED; }

    /** Order produced no revenue (cancelled or rejected). */
    public boolean isVoided() { return this == CANCELLED || this == REJECTED; }
}
