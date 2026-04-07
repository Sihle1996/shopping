package com.example.backend.config;


import com.example.backend.repository.UserRepository;
import com.example.backend.tenant.TenantContext;
import com.example.backend.user.Role;
import com.example.backend.user.User;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.AuthenticationProvider;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.client.RestTemplate;

import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Configuration
@EnableAsync
@org.springframework.scheduling.annotation.EnableScheduling
public class ApplicationConfig {

    private final UserRepository repository;

    // Constructor for dependency injection
    public ApplicationConfig(UserRepository repository) {
        this.repository = repository;
    }

    // Role priority: ADMIN > DRIVER > USER (higher index = lower priority)
    private static final Map<Role, Integer> ROLE_PRIORITY = Map.of(
            Role.ADMIN, 0,
            Role.DRIVER, 1,
            Role.USER, 2
    );

    @Bean
    public UserDetailsService userDetailsService() {
        return username -> {
            UUID tenantId = TenantContext.getCurrentTenantId();
            if (tenantId != null) {
                return repository.findByEmailAndTenant_Id(username, tenantId)
                        .or(() -> repository.findByEmailAndTenantIsNull(username))
                        .orElseThrow(() -> new UsernameNotFoundException("User not found"));
            }
            // No tenant context — pick the highest-priority role if multiple accounts share the email
            List<User> matches = repository.findAllByEmail(username);
            if (matches.isEmpty()) throw new UsernameNotFoundException("User not found");
            return matches.stream()
                    .min(Comparator.comparingInt(u -> ROLE_PRIORITY.getOrDefault(u.getRole(), 99)))
                    .get();
        };
    }

    @Bean
    public AuthenticationProvider authenticationProvider() {
        DaoAuthenticationProvider authProvider = new DaoAuthenticationProvider();
        authProvider.setUserDetailsService(userDetailsService());
        authProvider.setPasswordEncoder(passwordEncoder());
        return authProvider;
    }

    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration config) throws Exception {
        return config.getAuthenticationManager();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public RestTemplate restTemplate() {
        return new RestTemplate();
    }
}
