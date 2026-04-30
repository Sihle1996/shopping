package com.example.backend.dto;

import java.math.BigDecimal;

public record AiDescribeItemRequest(
        String name,
        BigDecimal price,
        String category
) {}
