package com.example.backend.user;

import com.example.backend.entity.CartItem;
import com.example.backend.entity.Order;
import com.example.backend.entity.Tenant;
import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.*;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "_user")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class User implements UserDetails {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    private String email;
    @JsonIgnore
    private String password;
    @JsonIgnore
    private String resetOtp;
    @JsonIgnore
    @Column(name = "reset_otp_expires_at")
    private java.time.Instant resetOtpExpiresAt;

    @Enumerated(EnumType.STRING)
    private Role role;

    @Enumerated(EnumType.STRING)
    private DriverStatus driverStatus;

    @Builder.Default
    private boolean active = true;

    // Bumped on logout / password change / reset to invalidate all previously-issued JWTs for this user.
    @Column(name = "token_version", nullable = false)
    @Builder.Default
    private int tokenVersion = 0;

    @Column(name = "email_verified", nullable = false, columnDefinition = "boolean default true")
    @Builder.Default
    private boolean emailVerified = true;

    @Column(name = "email_verification_token")
    @JsonIgnore
    private String emailVerificationToken;

    @Column(name = "email_verification_token_expires_at")
    @JsonIgnore
    private java.time.Instant emailVerificationTokenExpiresAt;

    // The new email a user is changing TO — NOT applied to `email` (their login) until they confirm it via
    // the verification link sent to the new address. Reuses emailVerificationToken for the confirmation.
    @Column(name = "pending_email")
    @JsonIgnore
    private String pendingEmail;

    private String fullName;
    private String phone;

    @Column(name = "marketing_email_opt_in", nullable = false, columnDefinition = "boolean default false")
    @Builder.Default
    private boolean marketingEmailOptIn = false;

    // A SUPERADMIN with this flag is a Compliance officer — only they may open KYB documents and see
    // full bank account numbers. SUPERADMINs without it are Operations (approvals, plans, payouts) only.
    @Column(name = "compliance_officer", nullable = false, columnDefinition = "boolean default false")
    @Builder.Default
    private boolean complianceOfficer = false;

    private String vehicleType;
    private String vehiclePlate;
    private String profilePhotoUrl;

    private Double latitude;
    private Double longitude;
    private Double speed;
    private Instant lastPing;

    /** Recency-weighted on-time rate (EWMA, 0..1) + how many deliveries have fed it. */
    @Column(name = "delivery_score_ewma")
    private Double deliveryScoreEwma;
    @Column(name = "delivery_score_samples")
    @Builder.Default
    private Integer deliveryScoreSamples = 0;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "tenant_id")
    @JsonIgnore
    private Tenant tenant;

    @OneToMany(mappedBy = "user", cascade = CascadeType.ALL, orphanRemoval = true)
    @JsonIgnore
    private List<Order> orders = new ArrayList<>();

    @OneToMany(mappedBy = "user", cascade = CascadeType.ALL, orphanRemoval = true)
    @JsonIgnore
    private List<CartItem> cartItems = new ArrayList<>();

    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        Role effectiveRole = role != null ? role : Role.USER;
        return List.of(new SimpleGrantedAuthority("ROLE_" + effectiveRole.name()));
    }

    @Override
    public String getUsername() {
        return email;
    }

    @Override
    public boolean isAccountNonExpired() {
        return true;
    }

    @Override
    public boolean isAccountNonLocked() {
        return true;
    }

    @Override
    public boolean isCredentialsNonExpired() {
        return true;
    }

    @Override
    public boolean isEnabled() {
        return active && emailVerified;
    }
}
