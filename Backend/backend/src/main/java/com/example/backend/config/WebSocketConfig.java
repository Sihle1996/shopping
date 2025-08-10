package com.example.backend.config;

import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.config.ChannelRegistration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

@Configuration
@EnableWebSocketMessageBroker
@RequiredArgsConstructor
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    private final JwtService jwtService;
    private final UserDetailsService userDetailsService;

    @Override
    public void configureMessageBroker(MessageBrokerRegistry config) {
        config.enableSimpleBroker("/topic", "/queue");
        config.setApplicationDestinationPrefixes("/app");
        config.setUserDestinationPrefix("/user");
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        registry.addEndpoint("/ws").setAllowedOriginPatterns("*").withSockJS();
    }

    @Override
    public void configureClientInboundChannel(ChannelRegistration registration) {
        registration.interceptors(new ChannelInterceptor() {
            @Override
            public Message<?> preSend(Message<?> message, MessageChannel channel) {
                StompHeaderAccessor accessor = MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);
                if (accessor != null) {
                    if (StompCommand.CONNECT.equals(accessor.getCommand())) {
                        String authHeader = accessor.getFirstNativeHeader("Authorization");
                        if (authHeader != null && authHeader.startsWith("Bearer ")) {
                            String token = authHeader.substring(7);
                            try {
                                String username = jwtService.extractUsername(token);
                                UserDetails userDetails = userDetailsService.loadUserByUsername(username);
                                if (jwtService.isTokenValid(token, userDetails)) {
                                    String userId = jwtService.extractUserId(token).toString();
                                    UsernamePasswordAuthenticationToken user = new UsernamePasswordAuthenticationToken(
                                            userId,
                                            null,
                                            userDetails.getAuthorities()
                                    );
                                    accessor.setUser(user);
                                }
                            } catch (Exception ignored) {
                            }
                        }
                    } else if (StompCommand.SUBSCRIBE.equals(accessor.getCommand())) {
                        String destination = accessor.getDestination();
                        String userId = accessor.getUser() != null ? accessor.getUser().getName() : null;
                        String role = accessor.getUser() != null && accessor.getUser().getAuthorities() != null
                                ? accessor.getUser().getAuthorities().stream().findFirst().map(Object::toString).orElse(null)
                                : null;

                        if (destination != null) {
                            if (destination.startsWith("/topic/orders/")) {
                                String destUserId = destination.substring("/topic/orders/".length());
                                if (userId == null || !userId.equals(destUserId)) {
                                    throw new IllegalArgumentException("Forbidden subscription");
                                }
                            } else if (destination.startsWith("/topic/admin") && !"ROLE_ADMIN".equals(role)) {
                                throw new IllegalArgumentException("Forbidden subscription");
                            } else if (destination.startsWith("/topic/driver") && !"ROLE_DRIVER".equals(role)) {
                                throw new IllegalArgumentException("Forbidden subscription");
                            } else if (destination.startsWith("/topic/manager") && !"ROLE_MANAGER".equals(role)) {
                                throw new IllegalArgumentException("Forbidden subscription");
                            }
                        }
                    }
                }
                return message;
            }
        });
    }
}

