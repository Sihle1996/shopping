package com.example.backend.entity;

import com.example.backend.user.DriverStatus;
import lombok.AllArgsConstructor;
import lombok.Data;

import java.util.UUID;

@Data
@AllArgsConstructor
public class DriverDTO {
    private UUID id;
    private String email;
    private DriverStatus driverStatus;
}
