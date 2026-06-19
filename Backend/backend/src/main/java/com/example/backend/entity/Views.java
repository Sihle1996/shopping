package com.example.backend.entity;

/**
 * Jackson serialization views. Fields tagged {@code @JsonView(Views.Internal.class)} are emitted only
 * on endpoints (admin) that don't declare a view; public endpoints declare {@code @JsonView(Public)}
 * and therefore omit those internal fields (e.g. food cost / stock).
 */
public final class Views {
    private Views() {}
    public interface Public {}
    public interface Internal extends Public {}
}
