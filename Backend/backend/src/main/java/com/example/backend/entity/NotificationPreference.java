package com.example.backend.entity;

import com.example.backend.user.User;
import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.UUID;

@Data
@Entity
@NoArgsConstructor
@Table(name = "notification_preferences")
public class NotificationPreference {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", unique = true)
    private User user;

    private boolean emailOnNewOrder = true;
    private boolean emailOnCancellation = true;
    private boolean emailOnDriverAssigned = false;
    private boolean toastOnNewOrder = true;
    private boolean toastOnStatusChange = true;
}
