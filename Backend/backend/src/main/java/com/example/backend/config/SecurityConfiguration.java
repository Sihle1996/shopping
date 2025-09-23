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
                    config.addAllowedHeader("*");
                    config.addAllowedMethod("*");
                    return config;
                }))
                .csrf(AbstractHttpConfigurer::disable)
                .authorizeHttpRequests(auth -> auth
                        // ✅ Public routes
                        .requestMatchers(
                                "/api/menu/**",
                                "/api/register",
                                "/api/login",
                                "/api/promotions/**",
                                "/api/map/route",
                                "/images/**",         // ✅ Allow public access to static images
                                "/uploads/**"         // ✅ Just in case direct file path is hit
                        ).permitAll()

                        // ✅ Allow WebSocket (SockJS) connections
                        .requestMatchers("/ws/**").permitAll()

                        // ✅ Admin-only routes
                        .requestMatchers("/api/admin/**").hasRole("ADMIN")

                        // ✅ Driver-only routes
                        .requestMatchers("/api/driver/**").hasRole("DRIVER")

                        // ✅ Manager-only routes
                        .requestMatchers("/api/manager/**").hasRole("MANAGER")

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
