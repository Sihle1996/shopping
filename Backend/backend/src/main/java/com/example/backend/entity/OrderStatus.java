package com.example.backend.entity;

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

    /** Terminal success — the sale is realised and counts as revenue. */
    public boolean isRealisedRevenue() { return this == DELIVERED; }

    /** Order produced no revenue (cancelled or rejected). */
    public boolean isVoided() { return this == CANCELLED || this == REJECTED; }
}
