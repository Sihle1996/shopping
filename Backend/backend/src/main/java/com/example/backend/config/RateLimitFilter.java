package com.example.backend.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import io.github.bucket4j.Bandwidth;
import io.github.bucket4j.Bucket;
import io.github.bucket4j.Refill;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.Duration;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

public class RateLimitFilter extends OncePerRequestFilter {

    private static final Set<String> RATE_LIMITED_PATHS = Set.of(
            "/api/orders/place",
            "/api/login",
            "/api/register",
            "/api/tenants/register",
            "/api/forgot-password",
            "/api/reset-password",
            "/api/resend-verification"
    );
    private static final int AUTH_LIMIT = 5;
    private static final int GUEST_LIMIT = 3;
    private static final int AUTH_ENDPOINT_LIMIT = 5;

    private final ConcurrentHashMap<String, Bucket> buckets = new ConcurrentHashMap<>();
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {

        String path = request.getServletPath();
        if (!"POST".equalsIgnoreCase(request.getMethod()) || !RATE_LIMITED_PATHS.contains(path)) {
            chain.doFilter(request, response);
            return;
        }

        boolean isAuthEndpoint = !"/api/orders/place".equals(path);
        final String key;
        final int limit;

        if (isAuthEndpoint) {
            key = "ip:" + getClientIp(request);
            limit = AUTH_ENDPOINT_LIMIT;
        } else {
            Authentication auth = SecurityContextHolder.getContext().getAuthentication();
            boolean isAuth = auth != null && auth.isAuthenticated() && !"anonymousUser".equals(auth.getPrincipal());
            key = isAuth ? "user:" + auth.getName() : "ip:" + getClientIp(request);
            limit = isAuth ? AUTH_LIMIT : GUEST_LIMIT;
        }

        String bucketKey = path + ":" + key;
        Bucket bucket = buckets.computeIfAbsent(bucketKey, k -> buildBucket(limit));

        if (bucket.tryConsume(1)) {
            chain.doFilter(request, response);
        } else {
            response.setStatus(429);
            response.setContentType("application/json");
            objectMapper.writeValue(response.getWriter(),
                    Map.of("error", "Too many requests. Please try again later."));
        }
    }

    private Bucket buildBucket(int requestsPerMinute) {
        Bandwidth limit = Bandwidth.classic(requestsPerMinute,
                Refill.greedy(requestsPerMinute, Duration.ofMinutes(1)));
        return Bucket.builder().addLimit(limit).build();
    }

    private String getClientIp(HttpServletRequest request) {
        String xff = request.getHeader("X-Forwarded-For");
        if (xff != null && !xff.isBlank()) {
            return xff.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }
}
