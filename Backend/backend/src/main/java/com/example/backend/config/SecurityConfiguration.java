package com.example.backend.config;

import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.authentication.AuthenticationProvider;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;

import java.util.Collections;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity
@RequiredArgsConstructor
public class SecurityConfiguration {

    private final JwtAuthenticationFilter jwtAuthFilter;
    private final AuthenticationProvider authenticationProvider;

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
                .cors(cors -> cors.configurationSource(request -> {
                    CorsConfiguration config = new CorsConfiguration();
                    config.setAllowCredentials(true);
                    String origin = request.getHeader("Origin");
                    if (origin != null && !origin.isEmpty()) {
                        config.setAllowedOrigins(Collections.singletonList(origin));
                    } else {
                        config.setAllowedOriginPatterns(Collections.singletonList("*"));
                    }
                    config.addAllowedHeader("*"); // includes X-Tenant-Id, Authorization, Content-Type etc.
                    config.addAllowedMethod("*");
                    config.addExposedHeader("Authorization");
                    return config;
                }))
                .csrf(AbstractHttpConfigurer::disable)
                .authorizeHttpRequests(auth -> auth
                        // ✅ Public routes
                        .requestMatchers(
                                "/api/menu/**",
                                "/api/register",
                                "/api/login",
                                "/api/forgot-password",
                                "/api/reset-password",
                                "/api/promotions/**",
                                "/api/tenants/register",
                                "/api/tenants/active",
                                "/api/tenants/{slug}",
                                "/api/map/route",
                                "/api/orders/place",
                                "/api/payfast/**",
                                "/api/reviews",
                                "/store/**",
                                "/images/**",
                                "/uploads/**"
                        ).permitAll()

                        .requestMatchers("/ws/**").permitAll()

                        // Superadmin routes
                        .requestMatchers("/api/superadmin/**").hasAnyRole("SUPERADMIN")

                        // Admin routes — also allow SUPERADMIN to access admin endpoints
                        .requestMatchers("/api/admin/**").hasAnyRole("ADMIN", "SUPERADMIN")

                        // Driver routes
                        .requestMatchers("/api/driver/**").hasRole("DRIVER")

                        // ✅ Everything else requires authentication
                        .anyRequest().authenticated()
                )
                .sessionManagement(session -> session
                        .sessionCreationPolicy(SessionCreationPolicy.STATELESS)
                )
                .authenticationProvider(authenticationProvider)
                .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class)
                .exceptionHandling(handler -> handler
                        .accessDeniedHandler((request, response, accessDeniedException) -> {
                            response.setStatus(HttpServletResponse.SC_FORBIDDEN);
                            response.getWriter().write("Access denied");
                        })
                );

        return http.build();
    }
}
