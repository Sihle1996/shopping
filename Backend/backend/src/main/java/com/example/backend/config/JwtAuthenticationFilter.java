package com.example.backend.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

@Component
@RequiredArgsConstructor
@Slf4j
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private final JwtService jwtService;
    private final UserDetailsService userDetailsService;

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain
    ) throws ServletException, IOException {
        final String authHeader = request.getHeader("Authorization");
        final String jwt;
        final String userEmail;

        // Check for Authorization header and JWT prefix
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            log.debug("Missing or invalid Authorization header");
            filterChain.doFilter(request, response);
            return;
        }

        jwt = authHeader.substring(7); // Extract JWT from header
        try {
            // Extract user information from JWT
            userEmail = jwtService.extractUsername(jwt);
            Long userId = jwtService.extractUserId(jwt);
            request.setAttribute("userId", userId);
            log.debug("Extracted userId: {} and set it in the request", userId);
        } catch (Exception ex) {
            log.error("Error extracting user information from JWT: {}", ex.getMessage());
            handleUnauthorizedResponse(response, "Invalid or malformed JWT token");
            return;
        }

        // Authenticate user if email is valid and not already authenticated
        if (userEmail != null && SecurityContextHolder.getContext().getAuthentication() == null) {
            try {
                UserDetails userDetails = userDetailsService.loadUserByUsername(userEmail);
                if (jwtService.isTokenValid(jwt, userDetails)) {
                    // Set authentication in the security context
                    UsernamePasswordAuthenticationToken authToken = new UsernamePasswordAuthenticationToken(
                            userDetails, null, userDetails.getAuthorities()
                    );
                    authToken.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
                    SecurityContextHolder.getContext().setAuthentication(authToken);
                    log.debug("User authenticated successfully: {}", userEmail);
                } else {
                    log.debug("JWT token is invalid for user: {}", userEmail);
                }
            } catch (Exception ex) {
                log.error("Error during user authentication: {}", ex.getMessage());
                handleUnauthorizedResponse(response, "Authentication failed");
                return;
            }
        }

        filterChain.doFilter(request, response);
    }

    /**
     * Handle unauthorized responses with a standardized JSON format.
     *
     * @param response HttpServletResponse
     * @param message  Error message
     * @throws IOException In case of an I/O error
     */
    private void handleUnauthorizedResponse(HttpServletResponse response, String message) throws IOException {
        response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
        response.setContentType("application/json");
        response.getWriter().write("{\"error\": \"" + message + "\"}");
        log.debug("Unauthorized response sent: {}", message);
    }
}
